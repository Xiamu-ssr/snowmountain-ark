import type { Agent, Credential, McpServerBinding } from "@snowmountain/contracts";
import { Store } from "./db.js";
import { openSecret } from "./vault.js";

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id?: string | number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ExposedMcpTool {
  exposedName: string;
  remoteName: string;
  binding: McpServerBinding;
  definition: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "server";
}

export class McpProxy {
  constructor(private readonly store: Store) {}

  async listTools(agent: Agent): Promise<{ tools: ExposedMcpTool[]; errors: Array<{ bindingId: string; message: string }> }> {
    const tools: ExposedMcpTool[] = [];
    const errors: Array<{ bindingId: string; message: string }> = [];
    for (const binding of agent.mcpServers ?? []) {
      if (binding.permission === "deny") continue;
      try {
        const result = await this.rpc<{ tools?: McpTool[] }>(binding, "tools/list", {});
        for (const remote of result.tools ?? []) {
          const exposedName = `mcp__${safeName(binding.name)}__${safeName(remote.name)}`;
          tools.push({
            exposedName,
            remoteName: remote.name,
            binding,
            definition: {
              type: "function",
              function: {
                name: exposedName,
                description: `[MCP ${binding.name}] ${remote.description ?? remote.name}`,
                parameters: remote.inputSchema ?? { type: "object", properties: {} }
              }
            }
          });
        }
      } catch (error) {
        errors.push({ bindingId: binding.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { tools, errors };
  }

  async call(tool: ExposedMcpTool, args: Record<string, unknown>): Promise<unknown> {
    return this.rpc(tool.binding, "tools/call", { name: tool.remoteName, arguments: args });
  }

  private headers(binding: McpServerBinding): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream"
    };
    if (!binding.credentialId) return headers;
    const credential = this.store.get<Credential>(binding.credentialId);
    if (!credential) throw new Error(`Credential not found: ${binding.credentialId}`);
    const secret = openSecret(credential.secretCiphertext);
    if (secret && secret !== "oauth-pending") headers.authorization = `Bearer ${secret}`;
    return headers;
  }

  private async rpc<T>(binding: McpServerBinding, method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(binding.url, {
      method: "POST",
      headers: this.headers(binding),
      body: JSON.stringify({ jsonrpc: "2.0", id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, method, params }),
      signal: AbortSignal.timeout(30_000)
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP ${binding.name} returned ${response.status}: ${body.slice(0, 300)}`);
    const payload = response.headers.get("content-type")?.includes("text/event-stream")
      ? body.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => JSON.parse(line) as JsonRpcResponse<T>).at(-1)
      : JSON.parse(body) as JsonRpcResponse<T>;
    if (!payload) throw new Error(`MCP ${binding.name} returned no JSON-RPC payload`);
    if (payload.error) throw new Error(`MCP ${binding.name}: ${payload.error.message}`);
    if (payload.result === undefined) throw new Error(`MCP ${binding.name} returned no result`);
    return payload.result;
  }
}
