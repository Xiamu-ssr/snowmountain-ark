import {
  Activity, Bot, Box, Braces, Check, ChevronRight, Clock3, Code2, CornerDownLeft,
  KeyRound, MessageSquareText, Pause, Play, Plus, Radio, Send, Square,
  TerminalSquare, Trash2, Zap
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Agent, ApiKey, Environment, MemoryStore, Session, SessionEvent, SessionEventType } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader, Status, Toolbar } from "../components/UI";

const MarkdownMessage = lazy(() => import("../components/MarkdownMessage"));

export function SessionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [memories, setMemories] = useState<MemoryStore[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(searchParams.get("create") === "1");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", agentId: searchParams.get("agentId") ?? "", environmentId: "", memoryStoreIds: [] as string[] });
  const load = useCallback(() => Promise.all([
    api.list<Session>("sessions"), api.list<Agent>("agents"), api.list<Environment>("environments"), api.list<MemoryStore>("memory-stores")
  ]).then(([sessionResult, agentResult, environmentResult, memoryResult]) => {
    setSessions(sessionResult.items); setAgents(agentResult.items); setEnvironments(environmentResult.items); setMemories(memoryResult.items);
    setForm((current) => ({ ...current, agentId: current.agentId || agentResult.items[0]?.id || "", environmentId: current.environmentId || environmentResult.items[0]?.id || "" }));
  }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const filtered = sessions.filter((session) => `${session.name} ${session.id}`.toLowerCase().includes(search.toLowerCase()));
  const nameOf = (items: Array<{ id: string; name: string }>, id: string) => items.find((item) => item.id === id)?.name ?? id;

  const create = async () => {
    try {
      const session = await api.create<Session>("sessions", {
        name: form.name || `${nameOf(agents, form.agentId)} · ${new Date().toLocaleString()}`,
        description: "Created from the Snowmountain control plane",
        agentId: form.agentId, environmentId: form.environmentId, memoryStoreIds: form.memoryStoreIds
      });
      setOpen(false); navigate(`/sessions/${session.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const remove = async (id: string) => { try { await api.remove("sessions", id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };

  return <div className="page">
    <PageHeader title="Sessions" description="Session 只绑定 Agent；对话、工具调用、模型 Tokens 与调试事件完整记录，可随时回放。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Session</button>} />
    {error && <ErrorBanner error={error} />}
    <section className="panel"><Toolbar search={search} onSearch={setSearch}><span className="quiet-chip"><Radio size={14} />SSE 实时事件</span></Toolbar>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Session 名称 / ID</th><th>状态</th><th>Agent</th><th>Environment</th><th>Tokens</th><th>更新时间</th><th /></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}>
        <td><Link className="resource-link" to={`/sessions/${session.id}`}><span className="resource-icon blue"><MessageSquareText size={16} /></span><span><strong>{session.name}</strong><small>{session.id}</small></span></Link></td>
        <td><Status value={session.status} /></td><td>{nameOf(agents, session.agentId)}</td><td>{nameOf(environments, session.environmentId)}</td><td><span className="token-pair">{session.inputTokens}<i>/</i>{session.outputTokens}</span></td><td className="muted">{new Date(session.updatedAt).toLocaleString()}</td><td><div className="row-actions"><Link className="icon-button" to={`/sessions/${session.id}`}><ChevronRight size={17} /></Link><button className="icon-button danger" aria-label={`删除 ${session.name}`} onClick={() => void remove(session.id)}><Trash2 size={15} /></button></div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="还没有 Session" description="选择 Agent 与 Environment，创建一个可回放的运行实例。" />}
    </section>
    <Modal title="创建 Session" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!form.agentId || !form.environmentId}>创建</button></>}>
      <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="不填则自动生成" /></label>
      <label>Agent <span>必填；Session 自动跟随 Agent 当前版本</span><select value={form.agentId} onChange={(event) => setForm({ ...form, agentId: event.target.value })}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name} · 当前 V{agent.activeVersion ?? agent.version}</option>)}</select></label>
      <label>Environment <span>必填</span><select value={form.environmentId} onChange={(event) => setForm({ ...form, environmentId: event.target.value })}>{environments.map((environment) => <option value={environment.id} key={environment.id}>{environment.name}</option>)}</select></label>
      <fieldset className="memory-selector"><legend>Memory Stores <span>可多选</span></legend>{memories.map((memory) => <label key={memory.id}><input type="checkbox" checked={form.memoryStoreIds.includes(memory.id)} onChange={(event) => setForm({ ...form, memoryStoreIds: event.target.checked ? [...form.memoryStoreIds, memory.id] : form.memoryStoreIds.filter((id) => id !== memory.id) })} />{memory.name}<small>{memory.memories.length} memories</small></label>)}</fieldset>
      <div className="security-note"><Box size={18} /><div><strong>计算资源由平台托管</strong><p>Session 只选择 Agent、Environment 和 Memory；CPU、内存、超时与网络边界由 Sandbox Policy/API 默认值实施。</p></div></div>
    </Modal>
  </div>;
}

function payloadContent(event: SessionEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.message === "string") return payload.message;
  if (event.type === "model_request_end") return `${payload.inputTokens ?? 0} input → ${payload.outputTokens ?? 0} output · ${payload.cacheReadTokens ?? 0} cache read · ${payload.cacheWriteTokens ?? 0} cache write`;
  return JSON.stringify(payload, null, 2);
}

function eventSummary(event: SessionEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (event.type === "user" || event.type === "assistant" || event.type === "thinking" || event.type === "error") return payloadContent(event);
  if (event.type === "tool_use" || event.type === "mcp_use") {
    const call = payload.call as { name?: string; input?: Record<string, unknown> } | undefined;
    return `${call?.name ?? "tool"}${call?.input ? ` · ${JSON.stringify(call.input)}` : ""}`;
  }
  if (event.type === "tool_result" || event.type === "mcp_result") return `${String(payload.name ?? payload.bindingId ?? "tool")} 已返回结果`;
  if (event.type === "model_request_start") return `${String(payload.model ?? "模型")} 开始推理`;
  if (event.type === "model_request_end") return `${String(payload.model ?? "模型")} · ${payload.inputTokens ?? 0} in / ${payload.outputTokens ?? 0} out · ${Number(payload.durationMs ?? 0).toLocaleString()} ms`;
  if (event.type === "policy") return `${String(payload.effect ?? "policy")} · ${String(payload.reason ?? "")}`;
  if (event.type === "status") return String(payload.status ?? payload.threadStatus ?? "状态变化");
  if (event.type === "approval_request") return "历史审批请求";
  if (event.type === "approval_result") return `历史审批结果 · ${payload.allowed ? "允许" : "拒绝"}`;
  if (event.type === "subagent_use" || event.type === "subagent_result") return `子 Agent · ${String(payload.agentId ?? "")}`;
  return payloadContent(event);
}

const eventIcons: Record<SessionEventType, typeof Activity> = {
  user: MessageSquareText, assistant: Bot, thinking: Activity, tool_use: TerminalSquare,
  tool_result: Braces, policy: Zap, status: Radio, error: Pause,
  model_request_start: Activity, model_request_end: Code2,
  approval_request: Pause, approval_result: Check,
  mcp_use: TerminalSquare, mcp_result: Braces,
  subagent_use: Bot, subagent_result: Bot
};

const previewLabels: Partial<Record<SessionEventType, string>> = {
  user: "User", assistant: "Agent", thinking: "Agent · Thinking", tool_use: "Tool Use",
  tool_result: "Tool Result", status: "Session", error: "Error", approval_request: "Approval Required", approval_result: "Approval Result"
};

function EventItem({ event, selected, mode, onSelect }: { event: SessionEvent; selected: boolean; mode: "preview" | "debug"; onSelect(): void }) {
  const Icon = eventIcons[event.type];
  const label = mode === "debug" ? event.type : previewLabels[event.type] ?? event.type.replaceAll("_", " ");
  return <button className={`event-item type-${event.type} ${selected ? "selected" : ""}`} onClick={onSelect}>
    <span className="event-rail"><span><Icon size={14} /></span></span>
    <span className="event-card"><span className="event-meta"><strong>{label}</strong><time>{new Date(event.createdAt).toLocaleTimeString()}</time></span><span className="event-content">{eventSummary(event)}</span></span>
  </button>;
}

interface ConversationTurn {
  key: string;
  user?: SessionEvent | undefined;
  assistant?: SessionEvent | undefined;
  activities: SessionEvent[];
}

function conversationTurns(events: SessionEvent[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let current: ConversationTurn | undefined;
  for (const event of events) {
    if (event.type === "user") {
      if (current) turns.push(current);
      current = { key: event.id, user: event, activities: [] };
      continue;
    }
    if (event.type === "assistant") {
      if (!current) current = { key: event.id, activities: [] };
      current.assistant = event;
      turns.push(current);
      current = undefined;
      continue;
    }
    if (current) current.activities.push(event);
  }
  if (current) turns.push(current);
  return turns;
}

function activityName(event: SessionEvent): string {
  const payload = event.payload as Record<string, unknown>;
  const call = payload.call as { name?: string } | undefined;
  if (event.type === "thinking") return "思考";
  if (event.type === "model_request_start") return "模型请求";
  if (event.type === "model_request_end") return "模型返回";
  if (event.type === "tool_use") return call?.name ?? "Tool";
  if (event.type === "tool_result") return "Tool 结果";
  if (event.type === "mcp_use") return call?.name ?? "MCP";
  if (event.type === "mcp_result") return "MCP 结果";
  if (event.type === "approval_request" || event.type === "approval_result") return "历史审批";
  if (event.type === "error") return "错误";
  if (event.type === "status") return String(payload.status ?? "状态");
  return event.type.replaceAll("_", " ");
}

function ConversationView({ events, agentName, selectedId, onSelect }: { events: SessionEvent[]; agentName: string; selectedId?: string | undefined; onSelect(event: SessionEvent): void }) {
  const turns = conversationTurns(events);
  if (!turns.length) return <EmptyState title="还没有对话" description="在下方输入任务；工具与模型过程会收进每轮对话的运行时间条。" />;
  return <div className="conversation-stream">{turns.map((turn) => {
    const significant = turn.activities.filter((event) => !["policy", "model_request_start", "tool_result", "mcp_result"].includes(event.type));
    const started = turn.user ? Date.parse(turn.user.createdAt) : Date.parse(turn.activities[0]?.createdAt ?? turn.assistant?.createdAt ?? "");
    const ended = Date.parse(turn.assistant?.createdAt ?? turn.activities.at(-1)?.createdAt ?? turn.user?.createdAt ?? "");
    const duration = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0;
    const modelCalls = turn.activities.filter((event) => event.type === "model_request_end").length;
    const toolCalls = turn.activities.filter((event) => ["tool_use", "mcp_use", "subagent_use"].includes(event.type)).length;
    return <section className="conversation-turn" key={turn.key}>
      {turn.user && <article role="button" tabIndex={0} className={`chat-message user ${selectedId === turn.user.id ? "selected" : ""}`} onClick={() => onSelect(turn.user!)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(turn.user!); }}><span className="chat-avatar">你</span><span className="chat-bubble"><span className="chat-meta"><strong>你</strong><time>{new Date(turn.user.createdAt).toLocaleTimeString()}</time></span><span>{payloadContent(turn.user)}</span></span></article>}
      {turn.activities.length > 0 && <div className="run-progress"><div className="run-progress-head"><span>运行轨迹</span><strong>{modelCalls} 次模型 · {toolCalls} 次工具 · {(duration / 1000).toFixed(1)}s</strong></div><div className="run-progress-track"><span className="run-progress-line" />{significant.map((event) => <button type="button" key={event.id} title={`${activityName(event)} · ${new Date(event.createdAt).toLocaleTimeString()}`} aria-label={`查看 ${activityName(event)}`} className={`${event.type} ${selectedId === event.id ? "selected" : ""}`} onClick={() => onSelect(event)}><i /><small>{activityName(event)}</small></button>)}</div></div>}
      {turn.assistant ? <article role="button" tabIndex={0} className={`chat-message assistant ${selectedId === turn.assistant.id ? "selected" : ""}`} onClick={() => onSelect(turn.assistant!)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(turn.assistant!); }}><span className="chat-avatar"><Bot size={15} /></span><span className="chat-bubble"><span className="chat-meta"><strong>{agentName}</strong><time>{new Date(turn.assistant.createdAt).toLocaleTimeString()}</time></span><span className="chat-markdown"><Suspense fallback={<span>{payloadContent(turn.assistant)}</span>}><MarkdownMessage content={payloadContent(turn.assistant)} /></Suspense></span></span></article> : <div className="chat-pending"><Activity size={14} className="pulse-icon" />Agent 尚未完成这一轮</div>}
    </section>;
  })}</div>;
}

export function SessionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>();
  const [agent, setAgent] = useState<Agent>();
  const [environment, setEnvironment] = useState<Environment>();
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [effectiveTools, setEffectiveTools] = useState<{ resolution: string; builtin: Array<{ name: string; description: string; permission: string }>; mcp: Array<{ name: string; permission: string; credentialBinding: string | null; discovery: string }>; subagents: Array<{ agentId: string; version?: number }> }>();
  const [selected, setSelected] = useState<SessionEvent>();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"preview" | "debug">("preview");
  const [tab, setTab] = useState<"conversation" | "timeline" | "tokens">("conversation");
  const [apiOpen, setApiOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState("");
  const eventScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const refreshResource = useCallback(async () => {
    try {
      const current = await api.get<Session>("sessions", id);
      setSession(current);
      setAgent((previous) => previous?.id === current.agentId ? previous : undefined);
      setEnvironment((previous) => previous?.id === current.environmentId ? previous : undefined);
      const [agentMeta, currentEnvironment, currentTools] = await Promise.all([
        api.get<Agent>("agents", current.agentId), api.get<Environment>("environments", current.environmentId), api.effectiveTools(current.id)
      ]);
      const activeVersion = agentMeta.activeVersion ?? agentMeta.version;
      const activeAgent = activeVersion === agentMeta.version ? agentMeta : await api.agentVersion(agentMeta.id, activeVersion) as Agent;
      setAgent({ ...activeAgent, activeVersion }); setEnvironment(currentEnvironment); setEffectiveTools(currentTools);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [id]);

  useEffect(() => {
    let closed = false;
    const refreshEvents = () => api.events(id).then((result) => {
      if (!closed) setEvents((current) => {
        const byId = new Map([...current, ...result.items].map((event) => [event.id, event]));
        return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
      });
    }).catch((reason: Error) => setError((current) => current || reason.message));
    void Promise.all([refreshResource(), refreshEvents()]);
    const timer = window.setInterval(() => { void refreshResource(); void refreshEvents(); }, 1500);
    const source = new EventSource(api.eventStreamUrl(id));
    const eventTypes = Object.keys(eventIcons) as SessionEventType[];
    const receive = (nativeEvent: Event) => {
      const data = (nativeEvent as MessageEvent<unknown>).data;
      if (typeof data !== "string" || !data.trim()) return;
      let event: SessionEvent;
      try { event = JSON.parse(data) as SessionEvent; }
      catch { return; }
      setEvents((current) => current.some((value) => value.id === event.id) ? current : [...current, event].sort((a, b) => a.sequence - b.sequence));
      if (event.type === "status" || event.type === "approval_request" || event.type === "approval_result") void refreshResource();
    };
    eventTypes.forEach((type) => source.addEventListener(type, receive));
    source.onerror = () => setError((current) => current || "实时事件连接暂时中断，正在自动重连");
    return () => { closed = true; window.clearInterval(timer); eventTypes.forEach((type) => source.removeEventListener(type, receive)); source.close(); };
  }, [id, refreshResource]);

  useEffect(() => {
    const container = eventScrollRef.current;
    if (container && stickToBottom.current) container.scrollTop = container.scrollHeight;
  }, [events, tab]);

  const send = async () => {
    if (!message.trim() || ["queued", "running", "waiting_approval"].includes(session?.status ?? "")) return;
    const content = message; setMessage(""); setError("");
    try { await api.interact(id, content); await refreshResource(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const stop = async () => { try { await api.stop(id); await refreshResource(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const remove = async () => { try { await api.remove("sessions", id); navigate("/sessions"); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const openApi = async () => { setApiOpen(true); try { setApiKeys((await api.list<ApiKey>("api-keys")).items); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };

  const visibleEvents = useMemo(() => mode === "debug" ? events : events.filter((event) => !["model_request_start", "model_request_end", "policy"].includes(event.type)), [events, mode]);
  const tokenEvents = useMemo(() => events.filter((event) => event.type === "model_request_end"), [events]);
  const tokenTotals = useMemo(() => tokenEvents.reduce((totals, event) => {
    const payload = event.payload as Record<string, unknown>;
    totals.input += Number(payload.inputTokens ?? 0); totals.output += Number(payload.outputTokens ?? 0);
    totals.cacheRead += Number(payload.cacheReadTokens ?? 0); totals.cacheWrite += Number(payload.cacheWriteTokens ?? 0);
    return totals;
  }, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), [tokenEvents]);
  const busy = ["queued", "running", "waiting_approval"].includes(session?.status ?? "");
  if (error && !session) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!session || !agent || !environment) return <Loading />;

  const curl = `curl -X POST ${window.location.origin.replace(/:\\d+$/, ":4310")}/api/v1/sessions/${session.id}/interactions \\\n+  -H "Authorization: Bearer $SNOWMOUNTAIN_API_KEY" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"content":"分析 /workspace 并返回证据","wait":false}'`;

  return <div className="session-page">
    <header className="session-header"><div className="session-title"><Link to="/sessions">Sessions</Link><ChevronRight size={14} /><div><h1>{session.name}</h1><span>{session.id}</span></div><Status value={session.status} /></div><div className="session-stats"><div><Clock3 size={15} /><span>更新时间<strong>{new Date(session.updatedAt).toLocaleTimeString()}</strong></span></div><div><Bot size={15} /><span>Agent<strong>{agent.name} · 当前 V{agent.activeVersion ?? agent.version}</strong></span></div><div><Box size={15} /><span>Environment<strong>{environment.name}</strong></span></div><div><Code2 size={15} /><span>输入 / 输出<strong>{tokenTotals.input} / {tokenTotals.output}</strong></span></div><button className="button secondary" onClick={() => void openApi()}><KeyRound size={14} />API 接入</button>{busy && <button className="button secondary danger" onClick={() => void stop()}><Square size={13} />停止</button>}<button className="icon-button danger" aria-label="删除 Session" onClick={() => void remove()}><Trash2 size={15} /></button></div></header>
    {error && <ErrorBanner error={error} />}
    <div className="session-workbench">
      <section className="event-pane"><div className="event-toolbar"><div className="mode-toggle"><button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>预览模式</button><button className={mode === "debug" ? "active" : ""} onClick={() => setMode("debug")}>调试模式</button></div><div className="event-tabs"><button className={tab === "conversation" ? "active" : ""} onClick={() => setTab("conversation")}>对话</button><button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>运行时间线</button><button className={tab === "tokens" ? "active" : ""} onClick={() => setTab("tokens")}>Tokens</button></div><span className="event-count">{events.length} events</span></div>
        <div className="event-scroll" ref={eventScrollRef} onScroll={(event) => { const element = event.currentTarget; stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{tab === "conversation" ? <ConversationView events={events} agentName={agent.name} selectedId={selected?.id} onSelect={setSelected} /> : tab === "timeline" ? <div className="compact-timeline">{visibleEvents.map((event) => <EventItem key={event.id} event={event} mode={mode} selected={selected?.id === event.id} onSelect={() => setSelected(event)} />)}</div> : <TokenView events={tokenEvents} />}</div>
        <div className="task-composer"><textarea aria-label="给 Agent 分配一个任务" value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} placeholder={session.status === "running" ? "Agent 正在运行…" : "给 Agent 分配一个任务"} /><button className="composer-command" aria-label="斜杠命令">/</button><button className="send-button" onClick={() => void send()} disabled={!message.trim() || busy}>{busy ? <Activity size={18} className="pulse-icon" /> : <Send size={18} />}</button><small><CornerDownLeft size={12} />⌘ Enter</small></div>
      </section>
      <aside className="inspector"><div className="inspector-title"><strong>{selected ? "事件详情" : "本 Session 的有效能力"}</strong><span>{selected ? `#${selected.sequence}` : "跟随 Agent 当前版本"}</span></div>{selected ? <><dl><div><dt>Event ID</dt><dd>{selected.id}</dd></div><div><dt>Sequence</dt><dd>#{selected.sequence}</dd></div><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Time</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div></dl><pre>{JSON.stringify(selected.payload, null, 2)}</pre></> : <div className="effective-tools"><Play size={20} /><strong>当前版本 V{agent.activeVersion ?? agent.version}</strong><p>{effectiveTools?.resolution ?? "正在解析 Agent 当前版本…"}</p><h4>内置 Tool · {effectiveTools?.builtin.length ?? 0}</h4>{effectiveTools?.builtin.map((tool) => <span key={tool.name}><code>{tool.name}</code><small>{tool.permission === "approval" ? "调试阶段自动放行" : tool.permission}</small></span>)}<h4>MCP binding · {effectiveTools?.mcp.length ?? 0}</h4>{effectiveTools?.mcp.map((binding) => <span key={binding.name}><code>{binding.name}</code><small>{binding.permission === "approval" ? "自动放行" : binding.permission} · Credential {binding.credentialBinding ?? "无"}</small></span>)}<h4>子 Agent · {effectiveTools?.subagents.length ?? 0}</h4></div>}</aside>
    </div>
    <Modal title="快捷 API 接入" open={apiOpen} onClose={() => setApiOpen(false)} footer={<button className="button primary" onClick={() => setApiOpen(false)}>完成</button>}><div className="api-steps"><section><span>STEP 1</span><h3>获取 API Key</h3><p>{apiKeys.length ? `已有 ${apiKeys.length} 个 API Key，可在系统设置中管理。` : "尚无 API Key，请先前往系统设置创建。"}</p>{apiKeys.map((key) => <div className="api-key-row" key={key.id}><KeyRound size={15} /><strong>{key.name}</strong><code>{key.keyPrefix}…</code></div>)}</section><section><span>STEP 2</span><h3>复制示例代码</h3><pre>{curl}</pre><button className="button secondary" onClick={() => void navigator.clipboard.writeText(curl)}>复制 cURL</button></section></div></Modal>
  </div>;
}

function TokenView({ events }: { events: SessionEvent[] }) {
  const requests = events.map((event) => {
    const payload = event.payload as Record<string, unknown>;
    return {
      event,
      model: String(payload.model ?? "unknown"),
      input: Number(payload.inputTokens ?? 0), output: Number(payload.outputTokens ?? 0),
      cacheRead: Number(payload.cacheReadTokens ?? 0), cacheWrite: Number(payload.cacheWriteTokens ?? 0),
      duration: Number(payload.durationMs ?? 0)
    };
  });
  const groups = [...requests.reduce((map, request) => {
    const current = map.get(request.model) ?? { model: request.model, requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, duration: 0 };
    current.requests += 1; current.input += request.input; current.output += request.output;
    current.cacheRead += request.cacheRead; current.cacheWrite += request.cacheWrite; current.duration += request.duration;
    map.set(request.model, current);
    return map;
  }, new Map<string, { model: string; requests: number; input: number; output: number; cacheRead: number; cacheWrite: number; duration: number }>()).values()];
  const totals = groups.reduce((value, group) => ({ input: value.input + group.input, output: value.output + group.output, cacheRead: value.cacheRead + group.cacheRead, cacheWrite: value.cacheWrite + group.cacheWrite }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  return <div className="token-view wide"><div className="token-summary"><div><span>Input</span><strong>{totals.input.toLocaleString()}</strong></div><div><span>Output</span><strong>{totals.output.toLocaleString()}</strong></div><div><span>Cache read</span><strong>{totals.cacheRead.toLocaleString()}</strong></div><div><span>Cache write</span><strong>{totals.cacheWrite.toLocaleString()}</strong></div></div><h3>按模型聚合</h3>{groups.length ? <><table><thead><tr><th>模型</th><th>请求数</th><th>Input</th><th>Output</th><th>Cache read</th><th>Cache write</th><th>总耗时</th></tr></thead><tbody>{groups.map((group) => <tr key={group.model}><td><strong>{group.model}</strong></td><td>{group.requests}</td><td>{group.input.toLocaleString()}</td><td>{group.output.toLocaleString()}</td><td>{group.cacheRead.toLocaleString()}</td><td>{group.cacheWrite.toLocaleString()}</td><td>{(group.duration / 1000).toFixed(1)}s</td></tr>)}</tbody></table><details className="token-request-details"><summary>查看 {requests.length} 次模型请求明细</summary><div className="table-wrap"><table><thead><tr><th>#</th><th>模型</th><th>Input</th><th>Output</th><th>耗时</th></tr></thead><tbody>{requests.map((request) => <tr key={request.event.id}><td>#{request.event.sequence}</td><td>{request.model}</td><td>{request.input.toLocaleString()}</td><td>{request.output.toLocaleString()}</td><td>{request.duration.toLocaleString()} ms</td></tr>)}</tbody></table></div></details></> : <EmptyState title="暂无模型请求" description="运行任务后，Tokens 会先按模型汇总；单次请求明细可按需展开。" />}</div>;
}
