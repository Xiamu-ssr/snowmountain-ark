import {
  Activity, Bot, Box, Braces, Check, ChevronRight, Clock3, Code2, CornerDownLeft,
  KeyRound, MessageSquareText, Pause, Play, Plus, Radio, Send, Square,
  TerminalSquare, Trash2, X, Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Agent, ApiKey, Environment, MemoryStore, Session, SessionEvent, SessionEventType } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader, Status, Toolbar } from "../components/UI";

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
    <PageHeader title="Sessions" description="交互测试 Agent；事件流、工具调用、模型 Tokens 和审批完整记录，可随时回放。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Session</button>} />
    {error && <ErrorBanner error={error} />}
    <section className="panel"><Toolbar search={search} onSearch={setSearch}><span className="quiet-chip"><Radio size={14} />SSE 实时事件</span></Toolbar>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Session 名称 / ID</th><th>状态</th><th>Agent / Version</th><th>Environment</th><th>Tokens</th><th>更新时间</th><th /></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}>
        <td><Link className="resource-link" to={`/sessions/${session.id}`}><span className="resource-icon blue"><MessageSquareText size={16} /></span><span><strong>{session.name}</strong><small>{session.id}</small></span></Link></td>
        <td><Status value={session.status} /></td><td>{nameOf(agents, session.agentId)} · V{session.agentVersion ?? 1}</td><td>{nameOf(environments, session.environmentId)}</td><td><span className="token-pair">{session.inputTokens}<i>/</i>{session.outputTokens}</span></td><td className="muted">{new Date(session.updatedAt).toLocaleString()}</td><td><div className="row-actions"><Link className="icon-button" to={`/sessions/${session.id}`}><ChevronRight size={17} /></Link><button className="icon-button danger" aria-label={`删除 ${session.name}`} onClick={() => void remove(session.id)}><Trash2 size={15} /></button></div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="还没有 Session" description="选择 Agent 与 Environment，创建一个可回放的运行实例。" />}
    </section>
    <Modal title="创建 Session" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!form.agentId || !form.environmentId}>创建</button></>}>
      <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="不填则自动生成" /></label>
      <label>Agent <span>必填；创建时固定版本</span><select value={form.agentId} onChange={(event) => setForm({ ...form, agentId: event.target.value })}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name} · V{agent.version}</option>)}</select></label>
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
    <span className="event-card"><span className="event-meta"><strong>{label}</strong><time>{new Date(event.createdAt).toLocaleTimeString()}</time></span><span className="event-content">{payloadContent(event)}</span></span>
  </button>;
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
  const [tab, setTab] = useState<"timeline" | "tokens">("timeline");
  const [apiOpen, setApiOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState("");

  const refreshResource = useCallback(async () => {
    try {
      const current = await api.get<Session>("sessions", id);
      setSession(current);
      setAgent((previous) => previous?.id === current.agentId ? previous : undefined);
      setEnvironment((previous) => previous?.id === current.environmentId ? previous : undefined);
      const [currentAgent, currentEnvironment, currentTools] = await Promise.all([
        api.get<Agent>("agents", current.agentId), api.get<Environment>("environments", current.environmentId), api.effectiveTools(current.id)
      ]);
      setAgent(currentAgent); setEnvironment(currentEnvironment); setEffectiveTools(currentTools);
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

  const send = async () => {
    if (!message.trim() || ["queued", "running", "waiting_approval"].includes(session?.status ?? "")) return;
    const content = message; setMessage(""); setError("");
    try { await api.interact(id, content); await refreshResource(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const resolveApproval = async (allowed: boolean) => { if (!session?.pendingApproval) return; try { await api.approve(id, session.pendingApproval.id, allowed); await refreshResource(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const stop = async () => { try { await api.stop(id); await refreshResource(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const remove = async () => { try { await api.remove("sessions", id); navigate("/sessions"); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const openApi = async () => { setApiOpen(true); try { setApiKeys((await api.list<ApiKey>("api-keys")).items); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };

  const visibleEvents = useMemo(() => mode === "debug" ? events : events.filter((event) => !["model_request_start", "model_request_end", "policy"].includes(event.type)), [events, mode]);
  const tokenEvents = useMemo(() => events.filter((event) => event.type === "model_request_end"), [events]);
  const busy = ["queued", "running", "waiting_approval"].includes(session?.status ?? "");
  if (error && !session) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!session || !agent || !environment) return <Loading />;

  const curl = `curl -X POST ${window.location.origin.replace(/:\\d+$/, ":4310")}/api/v1/sessions/${session.id}/interactions \\\n+  -H "Authorization: Bearer $SNOWMOUNTAIN_API_KEY" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"content":"分析 /workspace 并返回证据","wait":false}'`;

  return <div className="session-page">
    <header className="session-header"><div className="session-title"><Link to="/sessions">Sessions</Link><ChevronRight size={14} /><div><h1>{session.name}</h1><span>{session.id}</span></div><Status value={session.status} /></div><div className="session-stats"><div><Clock3 size={15} /><span>更新时间<strong>{new Date(session.updatedAt).toLocaleTimeString()}</strong></span></div><div><Bot size={15} /><span>Agent<strong>{agent.name} · V{session.agentVersion ?? agent.version}</strong></span></div><div><Box size={15} /><span>Environment<strong>{environment.name}</strong></span></div><div><Code2 size={15} /><span>输入 / 输出<strong>{session.inputTokens} / {session.outputTokens}</strong></span></div><button className="button secondary" onClick={() => void openApi()}><KeyRound size={14} />API 接入</button>{busy && <button className="button secondary danger" onClick={() => void stop()}><Square size={13} />停止</button>}<button className="icon-button danger" aria-label="删除 Session" onClick={() => void remove()}><Trash2 size={15} /></button></div></header>
    {error && <ErrorBanner error={error} />}
    <div className="session-workbench">
      <section className="event-pane"><div className="event-toolbar"><div className="mode-toggle"><button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>预览模式</button><button className={mode === "debug" ? "active" : ""} onClick={() => setMode("debug")}>调试模式</button></div><div className="event-tabs"><button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>时间线</button><button className={tab === "tokens" ? "active" : ""} onClick={() => setTab("tokens")}>Tokens</button></div><span className="event-count">{visibleEvents.length} / {events.length} events</span></div>
        <div className="event-scroll">{tab === "timeline" ? visibleEvents.map((event) => <EventItem key={event.id} event={event} mode={mode} selected={selected?.id === event.id} onSelect={() => setSelected(event)} />) : <TokenView events={tokenEvents} session={session} />}</div>
        {session.pendingApproval && <div className="approval-bar"><Pause size={19} /><div><strong>工具调用等待批准</strong><p>{session.pendingApproval.call.name} · {session.pendingApproval.reason}</p><code>{JSON.stringify(session.pendingApproval.call.input)}</code></div><button className="button secondary danger" onClick={() => void resolveApproval(false)}><X size={15} />拒绝</button><button className="button primary" onClick={() => void resolveApproval(true)}><Check size={15} />允许一次</button></div>}
        <div className="task-composer"><textarea aria-label="给 Agent 分配一个任务" value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} placeholder={session.status === "waiting_approval" ? "请先处理工具审批" : session.status === "running" ? "Agent 正在运行…" : "给 Agent 分配一个任务"} /><button className="composer-command" aria-label="斜杠命令">/</button><button className="send-button" onClick={() => void send()} disabled={!message.trim() || busy}>{busy ? <Activity size={18} className="pulse-icon" /> : <Send size={18} />}</button><small><CornerDownLeft size={12} />⌘ Enter</small></div>
      </section>
      <aside className="inspector"><div className="inspector-title"><strong>事件与有效能力</strong><span>{mode === "debug" ? "原始事件" : "结构化证据"}</span></div>{selected ? <><dl><div><dt>Event ID</dt><dd>{selected.id}</dd></div><div><dt>Sequence</dt><dd>#{selected.sequence}</dd></div><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Time</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div></dl><pre>{JSON.stringify(selected.payload, null, 2)}</pre></> : <div className="effective-tools"><Play size={20} /><strong>本 Session 的有效能力</strong><p>{effectiveTools?.resolution ?? "正在解析固定 Agent Version…"}</p><h4>内置 Tool · {effectiveTools?.builtin.length ?? 0}</h4>{effectiveTools?.builtin.map((tool) => <span key={tool.name}><code>{tool.name}</code><small>{tool.permission}</small></span>)}<h4>MCP binding · {effectiveTools?.mcp.length ?? 0}</h4>{effectiveTools?.mcp.map((binding) => <span key={binding.name}><code>{binding.name}</code><small>{binding.permission} · Credential {binding.credentialBinding ?? "无"}</small></span>)}<h4>子 Agent · {effectiveTools?.subagents.length ?? 0}</h4></div>}</aside>
    </div>
    <Modal title="快捷 API 接入" open={apiOpen} onClose={() => setApiOpen(false)} footer={<button className="button primary" onClick={() => setApiOpen(false)}>完成</button>}><div className="api-steps"><section><span>STEP 1</span><h3>获取 API Key</h3><p>{apiKeys.length ? `已有 ${apiKeys.length} 个 API Key，可在系统设置中管理。` : "尚无 API Key，请先前往系统设置创建。"}</p>{apiKeys.map((key) => <div className="api-key-row" key={key.id}><KeyRound size={15} /><strong>{key.name}</strong><code>{key.keyPrefix}…</code></div>)}</section><section><span>STEP 2</span><h3>复制示例代码</h3><pre>{curl}</pre><button className="button secondary" onClick={() => void navigator.clipboard.writeText(curl)}>复制 cURL</button></section></div></Modal>
  </div>;
}

function TokenView({ events, session }: { events: SessionEvent[]; session: Session }) {
  return <div className="token-view wide"><div className="token-summary"><div><span>Input</span><strong>{session.inputTokens.toLocaleString()}</strong></div><div><span>Output</span><strong>{session.outputTokens.toLocaleString()}</strong></div><div><span>Cache read</span><strong>{(session.cacheReadTokens ?? 0).toLocaleString()}</strong></div><div><span>Cache write</span><strong>{(session.cacheWriteTokens ?? 0).toLocaleString()}</strong></div></div><h3>Model requests</h3>{events.length ? <table><thead><tr><th>#</th><th>模型</th><th>Input</th><th>Output</th><th>Cache read</th><th>Cache write</th><th>耗时</th></tr></thead><tbody>{events.map((event) => { const payload = event.payload as Record<string, unknown>; return <tr key={event.id}><td>{event.sequence}</td><td>{String(payload.model ?? "-")}</td><td>{Number(payload.inputTokens ?? 0).toLocaleString()}</td><td>{Number(payload.outputTokens ?? 0).toLocaleString()}</td><td>{Number(payload.cacheReadTokens ?? 0).toLocaleString()}</td><td>{Number(payload.cacheWriteTokens ?? 0).toLocaleString()}</td><td>{Number(payload.durationMs ?? 0)} ms</td></tr>; })}</tbody></table> : <EmptyState title="暂无模型请求" description="运行任务后，每次模型请求都会记录 Token 与缓存命中。" />}</div>;
}
