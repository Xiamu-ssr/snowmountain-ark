import {
  Activity, Bot, Box, Braces, ChevronRight, Clock3, Code2, CornerDownLeft,
  Cpu, MessageSquareText, Pause, Play, Plus, Radio, Send, TerminalSquare, Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Agent, Environment, MemoryStore, Session, SessionEvent } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader, Status, Toolbar } from "../components/UI";

export function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [memories, setMemories] = useState<MemoryStore[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", agentId: "", environmentId: "", memoryStoreId: "" });
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
        agentId: form.agentId, environmentId: form.environmentId,
        memoryStoreIds: form.memoryStoreId ? [form.memoryStoreId] : []
      });
      setOpen(false); navigate(`/sessions/${session.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className="page">
    <PageHeader title="Sessions" description="每个 Session 都有独立工作区、追加事件流与可恢复运行状态；控制台和 API 使用同一数据面。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Session</button>} />
    {error && <ErrorBanner error={error} />}
    <section className="panel"><Toolbar search={search} onSearch={setSearch}><span className="quiet-chip"><Radio size={14} />实时事件</span></Toolbar>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Session 名称 / ID</th><th>状态</th><th>Agent</th><th>Environment</th><th>Tokens</th><th>更新时间</th><th /></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}>
        <td><Link className="resource-link" to={`/sessions/${session.id}`}><span className="resource-icon blue"><MessageSquareText size={16} /></span><span><strong>{session.name}</strong><small>{session.id}</small></span></Link></td>
        <td><Status value={session.status} /></td><td>{nameOf(agents, session.agentId)}</td><td>{nameOf(environments, session.environmentId)}</td><td><span className="token-pair">{session.inputTokens}<i>/</i>{session.outputTokens}</span></td><td className="muted">{new Date(session.updatedAt).toLocaleString()}</td><td><Link className="icon-button" to={`/sessions/${session.id}`}><ChevronRight size={17} /></Link></td>
      </tr>)}</tbody></table></div> : <EmptyState title="还没有 Session" description="选择 Agent 与 Environment，创建一个可回放的运行实例。" />}
    </section>
    <Modal title="创建 Session" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={create} disabled={!form.agentId || !form.environmentId}>创建</button></>}>
      <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="不填则自动生成" /></label>
      <label>Agent <span>必填</span><select value={form.agentId} onChange={(event) => setForm({ ...form, agentId: event.target.value })}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name} · V{agent.version}</option>)}</select></label>
      <label>Environment <span>必填</span><select value={form.environmentId} onChange={(event) => setForm({ ...form, environmentId: event.target.value })}>{environments.map((environment) => <option value={environment.id} key={environment.id}>{environment.name}</option>)}</select></label>
      <label>Memory Store <span>可选</span><select value={form.memoryStoreId} onChange={(event) => setForm({ ...form, memoryStoreId: event.target.value })}><option value="">不绑定</option>{memories.map((memory) => <option value={memory.id} key={memory.id}>{memory.name}</option>)}</select></label>
      <div className="resource-preview"><Cpu size={18} /><div><strong>资源配置</strong><p>1 CPU · 512 MiB · Session-scoped /workspace · Network deny</p></div></div>
    </Modal>
  </div>;
}

function payloadContent(event: SessionEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.message === "string") return payload.message;
  return JSON.stringify(payload, null, 2);
}

function EventItem({ event, selected, onSelect }: { event: SessionEvent; selected: boolean; onSelect(): void }) {
  const icons = { user: MessageSquareText, assistant: Bot, thinking: Activity, tool_use: TerminalSquare, tool_result: Braces, policy: Zap, status: Radio, error: Pause };
  const Icon = icons[event.type];
  const label = event.type.replace("_", " ");
  return <button className={`event-item type-${event.type} ${selected ? "selected" : ""}`} onClick={onSelect}>
    <span className="event-rail"><span><Icon size={14} /></span></span>
    <span className="event-card"><span className="event-meta"><strong>{label}</strong><time>{new Date(event.createdAt).toLocaleTimeString()}</time></span><span className="event-content">{payloadContent(event)}</span></span>
  </button>;
}

export function SessionDetailPage() {
  const { id = "" } = useParams();
  const [session, setSession] = useState<Session>();
  const [agent, setAgent] = useState<Agent>();
  const [environment, setEnvironment] = useState<Environment>();
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [selected, setSelected] = useState<SessionEvent>();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"preview" | "debug">("preview");
  const [tab, setTab] = useState<"timeline" | "tokens">("timeline");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const current = await api.get<Session>("sessions", id);
      const eventResult = await api.events(id);
      setSession(current); setEvents(eventResult.items);
      if (!agent || agent.id !== current.agentId) setAgent(await api.get<Agent>("agents", current.agentId));
      if (!environment || environment.id !== current.environmentId) setEnvironment(await api.get<Environment>("environments", current.environmentId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [id, agent, environment]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 1200); return () => window.clearInterval(timer); }, [refresh]);

  const send = async () => {
    if (!message.trim() || session?.status === "running") return;
    const content = message; setMessage("");
    try { await api.interact(id, content); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const tokenEvents = useMemo(() => events.filter((event) => event.type === "assistant" || event.type === "user"), [events]);
  if (error && !session) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!session || !agent || !environment) return <Loading />;

  return <div className="session-page">
    <header className="session-header"><div className="session-title"><Link to="/sessions">Sessions</Link><ChevronRight size={14} /><div><h1>{session.name}</h1><span>{session.id}</span></div><Status value={session.status} /></div><div className="session-stats"><div><Clock3 size={15} /><span>更新时间<strong>{new Date(session.updatedAt).toLocaleTimeString()}</strong></span></div><div><Bot size={15} /><span>Agent<strong>{agent.name} · V{agent.version}</strong></span></div><div><Box size={15} /><span>Environment<strong>{environment.name}</strong></span></div><div><Code2 size={15} /><span>Tokens<strong>{session.inputTokens} / {session.outputTokens}</strong></span></div></div></header>
    {error && <ErrorBanner error={error} />}
    <div className="session-workbench">
      <section className="event-pane"><div className="event-toolbar"><div className="mode-toggle"><button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>预览模式</button><button className={mode === "debug" ? "active" : ""} onClick={() => setMode("debug")}>调试模式</button></div><div className="event-tabs"><button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>时间线</button><button className={tab === "tokens" ? "active" : ""} onClick={() => setTab("tokens")}>Tokens</button></div><span className="event-count">{events.length} events</span></div>
        <div className="event-scroll">{tab === "timeline" ? events.map((event) => <EventItem key={event.id} event={event} selected={selected?.id === event.id} onSelect={() => setSelected(event)} />) : <div className="token-view"><div className="token-chart"><span style={{ height: "38%" }} /><span style={{ height: "62%" }} /><span style={{ height: "45%" }} /><span style={{ height: "82%" }} /><span style={{ height: "54%" }} /></div><h3>上下文使用</h3><p>当前事件中有 {tokenEvents.length} 条用户/Agent 消息。完整事件保存在 Session，模型窗口只是可重建投影。</p></div>}</div>
        <div className="task-composer"><textarea aria-label="给 Agent 分配一个任务" value={message} disabled={session.status === "running"} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} placeholder={session.status === "running" ? "Agent 正在运行…" : "给 Agent 分配一个任务"} /><button className="composer-command" aria-label="斜杠命令">/</button><button className="send-button" onClick={() => void send()} disabled={!message.trim() || session.status === "running"}>{session.status === "running" ? <Activity size={18} className="pulse-icon" /> : <Send size={18} />}</button><small><CornerDownLeft size={12} />⌘ Enter</small></div>
      </section>
      <aside className="inspector"><div className="inspector-title"><strong>Event inspector</strong><span>结构化证据</span></div>{selected ? <><dl><div><dt>Event ID</dt><dd>{selected.id}</dd></div><div><dt>Sequence</dt><dd>#{selected.sequence}</dd></div><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Time</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div></dl><pre>{JSON.stringify(selected.payload, null, 2)}</pre></> : <div className="inspector-empty"><Play size={20} /><strong>选择一个事件</strong><p>查看 Tool Call、Policy Decision 与 Tool Result 的原始结构。</p></div>}</aside>
    </div>
  </div>;
}
