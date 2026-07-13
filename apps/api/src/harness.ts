import type {
  Agent,
  Environment,
  Session,
  SessionEvent,
  ToolCall,
  ToolName
} from "@snowmountain/contracts";
import { Store } from "./db.js";
import { createId } from "./ids.js";
import { decidePolicy } from "./policy.js";
import { Sandbox } from "./sandbox.js";

interface TextPayload {
  content: string;
}

interface ToolUsePayload {
  call: ToolCall;
}

interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: ToolName; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

interface ChatCompletionResponse {
  choices: Array<{ message: ChatMessage }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const toolDefinitions = [
  { name: "bash", description: "Run a shell command inside /workspace", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read", description: "Read a UTF-8 file inside /workspace", parameters: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] } },
  { name: "write", description: "Write a UTF-8 file inside /workspace", parameters: { type: "object", properties: { file_path: { type: "string" }, content: { type: "string" } }, required: ["file_path", "content"] } },
  { name: "edit", description: "Replace one exact string in a workspace file", parameters: { type: "object", properties: { file_path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["file_path", "old_string", "new_string"] } }
].map((item) => ({ type: "function", function: item }));

export class Harness {
  constructor(private readonly store: Store, private readonly sandbox: Sandbox) {}

  async run(sessionId: string, content: string): Promise<void> {
    const session = this.store.get<Session>(sessionId);
    if (!session) throw new Error("Session not found");
    const agent = this.store.get<Agent>(session.agentId);
    const environment = this.store.get<Environment>(session.environmentId);
    if (!agent || !environment) throw new Error("Session dependencies are missing");
    if (session.status === "running") throw new Error("Session is already running");

    this.store.appendEvent(sessionId, "user", { content });
    this.store.update<Session>(sessionId, { status: "running", lastError: "" });
    this.store.appendEvent(sessionId, "status", { status: "running" });

    try {
      if (agent.model.provider === "openai-compatible") {
        await this.runOpenAICompatible(session, agent, environment);
      } else {
        await this.runMock(session, agent, environment, content);
      }
      const latest = this.store.get<Session>(sessionId);
      this.store.update<Session>(sessionId, {
        status: "idle",
        inputTokens: (latest?.inputTokens ?? 0) + Math.ceil(content.length / 3)
      });
      this.store.appendEvent(sessionId, "status", { status: "idle" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.update<Session>(sessionId, { status: "failed", lastError: message });
      this.store.appendEvent(sessionId, "error", { message });
      this.store.appendEvent(sessionId, "status", { status: "failed" });
      throw error;
    }
  }

  private async runMock(session: Session, agent: Agent, environment: Environment, content: string): Promise<void> {
    this.store.appendEvent(session.id, "thinking", { content: "Planning with the configured tools and environment." });

    if (/只使用\s*read|read\s+tool/i.test(content) && /runtime-probe/.test(content)) {
      const result = await this.callTool(session, agent, environment, "read", { file_path: "/workspace/runtime-probe.txt" });
      const text = `文件仍存在。这是上一任务创建的文件，内容为：\n\n\`${String((result as { content?: string }).content ?? "").trim()}\``;
      this.assistant(session.id, text);
      return;
    }

    if (/探针|probe/i.test(content)) {
      const pwd = await this.callTool(session, agent, environment, "bash", { command: "pwd" });
      await this.callTool(session, agent, environment, "write", {
        file_path: "/workspace/runtime-probe.txt",
        content: "snowmountain-ark-managed-agent-probe"
      });
      const read = await this.callTool(session, agent, environment, "read", { file_path: "/workspace/runtime-probe.txt" });
      const stdout = String((pwd as { stdout?: string }).stdout ?? "").trim();
      const fileContent = String((read as { content?: string }).content ?? "").trim();
      this.assistant(session.id, `探针完成：工作目录 ${stdout || "/workspace"}；文件内容 ${fileContent}。工具事件和结果已写入持久 Session 日志。`);
      return;
    }

    this.assistant(
      session.id,
      `我是 ${agent.name}。当前使用 ${agent.model.name}，绑定环境 ${environment.name}。这条回复来自本地确定性 Harness；配置 OpenAI-compatible endpoint 与 MODEL_API_KEY 后可切换真实模型循环。`
    );
  }

  private async callTool(
    session: Session,
    agent: Agent,
    environment: Environment,
    name: ToolName,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const call: ToolCall = { id: createId("call"), name, input };
    const decision = decidePolicy(call, agent, environment);
    this.store.appendEvent(session.id, "policy", { callId: call.id, ...decision });
    if (decision.effect !== "allow") throw new Error(`${decision.effect}: ${decision.reason}`);
    this.store.appendEvent<ToolUsePayload>(session.id, "tool_use", { call });
    const result = await this.sandbox.execute(call, session, environment);
    this.store.appendEvent(session.id, "tool_result", { callId: call.id, name, result });
    return result;
  }

  private assistant(sessionId: string, content: string): void {
    this.store.appendEvent<TextPayload>(sessionId, "assistant", { content });
    const session = this.store.get<Session>(sessionId);
    if (session) {
      this.store.update<Session>(sessionId, {
        outputTokens: session.outputTokens + Math.ceil(content.length / 3)
      });
    }
  }

  private async runOpenAICompatible(session: Session, agent: Agent, environment: Environment): Promise<void> {
    const apiKey = process.env.MODEL_API_KEY;
    if (!apiKey) throw new Error("MODEL_API_KEY is required for openai-compatible models");
    const baseUrl = (agent.model.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const history = this.store.events(session.id, 0, 200);
    const messages: ChatMessage[] = [
      { role: "system", content: agent.systemPrompt || "You are a managed agent operating in /workspace." }
    ];
    for (const event of history) {
      const payload = event.payload as Partial<TextPayload>;
      if (event.type === "user" && payload.content) messages.push({ role: "user", content: payload.content });
      if (event.type === "assistant" && payload.content) messages.push({ role: "assistant", content: payload.content });
    }

    for (let turn = 0; turn < 8; turn += 1) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: agent.model.name, messages, tools: toolDefinitions, tool_choice: "auto" }),
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
      const completion = await response.json() as ChatCompletionResponse;
      const message = completion.choices[0]?.message;
      if (!message) throw new Error("Model returned no message");
      messages.push(message);

      if (completion.usage) {
        const latest = this.store.get<Session>(session.id);
        if (latest) this.store.update<Session>(session.id, {
          inputTokens: latest.inputTokens + (completion.usage.prompt_tokens ?? 0),
          outputTokens: latest.outputTokens + (completion.usage.completion_tokens ?? 0)
        });
      }

      if (!message.tool_calls?.length) {
        this.assistant(session.id, message.content ?? "");
        return;
      }

      for (const toolCall of message.tool_calls) {
        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await this.callTool(session, agent, environment, toolCall.function.name, input);
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }
    throw new Error("Harness reached the maximum tool loop count");
  }
}

export function eventText(event: SessionEvent): string | undefined {
  const payload = event.payload as Partial<TextPayload>;
  return typeof payload.content === "string" ? payload.content : undefined;
}
