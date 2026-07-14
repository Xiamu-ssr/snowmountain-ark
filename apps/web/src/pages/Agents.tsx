import {
  Bot, Boxes, ChevronRight, CircleDollarSign, Copy, MoreHorizontal,
  Plus, RefreshCw, ShieldCheck, Sparkles, Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Agent, Credential, MarketEntry, McpServerBinding, PermissionMode, Session, ToolName } from "@snowmountain/contracts";
import { defaultToolPolicies } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, PageHeader, Status, StepTitle, Toolbar } from "../components/UI";

const toolDescriptions: Record<ToolName, string> = {
  bash: "在隔离工作区执行 shell 命令",
  read: "读取工作区文件",
  write: "创建或覆盖工作区文件",
  edit: "精确修改文件片段",
  glob: "按文件名模式搜索",
  grep: "搜索文件内容",
  web_fetch: "读取已授权 URL",
  web_search: "调用配置的搜索服务"
};

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const load = () => api.list<Agent>("agents").then((result) => setAgents(result.items)).catch((reason: Error) => setError(reason.message));
  useEffect(() => { void load(); }, []);
  const filtered = agents.filter((agent) => `${agent.name} ${agent.id} ${agent.model.name}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="page">
    <PageHeader title="Agents" description="定制模型、Prompt 与能力，并以不可变版本运行在 Managed Session 中。" action={<Link className="button primary" to="/agents/create"><Plus size={16} />创建 Agent</Link>} />
    {error && <ErrorBanner error={error} />}
    <section className="panel">
      <Toolbar search={search} onSearch={setSearch}><button className="button secondary" onClick={load}><RefreshCw size={15} />刷新</button></Toolbar>
      {filtered.length === 0 ? <EmptyState title="还没有 Agent" description="创建第一个 Agent，并从雪山 Market 添加 Skill、MCP 或子 Agent。" /> :
        <div className="table-wrap"><table><thead><tr><th>Agent 名称 / ID</th><th>模型</th><th>版本</th><th>能力</th><th>更新时间</th><th /></tr></thead><tbody>
          {filtered.map((agent) => <tr key={agent.id}>
            <td><Link className="resource-link" to={`/agents/${agent.id}`}><span className="resource-icon violet"><Bot size={16} /></span><span><strong>{agent.name}</strong><small>{agent.id}</small></span></Link></td>
            <td><span className="model-pill">{agent.model.name}</span></td>
            <td><span className="version-pill">V{agent.version}</span></td>
            <td><span className="muted">{agent.skillIds.length} Skills · {agent.mcpIds.length} MCPs · {agent.subAgentIds.length} Agents</span></td>
            <td><span className="muted">{new Date(agent.updatedAt).toLocaleString()}</span></td>
            <td><Link className="icon-button" to={`/agents/${agent.id}`} aria-label={`查看 ${agent.name}`}><ChevronRight size={17} /></Link></td>
          </tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}

type CapabilityTab = "skills" | "tools" | "agents" | "mcps";

export function AgentCreatePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<CapabilityTab>("skills");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<"mock" | "openai-compatible">("mock");
  const [modelName, setModelName] = useState("deterministic-local-harness");
  const [baseUrl, setBaseUrl] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("你是雪山方舟托管 Agent。只在 /workspace 中操作，并用工具事件作为结论证据。");
  const [tags, setTags] = useState("managed-agent, local");
  const [toolPolicies, setToolPolicies] = useState<Record<ToolName, PermissionMode>>({ ...defaultToolPolicies });
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedLocalAgents, setSelectedLocalAgents] = useState<string[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerBinding[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void Promise.all([api.market(), api.list<Agent>("agents"), api.list<Credential>("credentials")]).then(([catalog, agents, credentialResult]) => { setMarket(catalog.items); setLocalAgents(agents.items.filter((agent) => agent.subAgentIds.length === 0)); setCredentials(credentialResult.items); }).catch(() => setMarket([])); }, []);

  const relevantMarket = market.filter((item) => item.type === (tab === "skills" ? "skill" : tab === "mcps" ? "mcp" : tab === "agents" ? "agent" : "tool"));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleLocalAgent = (id: string) => setSelectedLocalAgents((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 20 ? [...current, id] : current);
  const addMcp = () => setMcpServers((current) => current.length >= 20 ? current : [...current, { id: `manual-${crypto.randomUUID()}`, name: "", url: "", permission: "approval", source: "manual" }]);
  const updateMcp = (index: number, patch: Partial<McpServerBinding>) => setMcpServers((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, ...patch } : value));

  const submit = async () => {
    if (!name.trim()) { setError("请填写 Agent 名称"); return; }
    setSaving(true); setError("");
    try {
      const model = provider === "mock" ? { provider, name: modelName } : { provider, name: modelName, baseUrl };
      const byType = (type: MarketEntry["type"]) => market.filter((item) => item.type === type && selected.includes(item.id)).map((item) => item.id);
      const agent = await api.create<Agent>("agents", {
        name, description, systemPrompt, model,
        tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
        toolPolicies,
        skillIds: byType("skill"),
        mcpIds: byType("mcp"),
        mcpServers: mcpServers.filter((binding) => binding.name && binding.url),
        subAgentIds: [...selectedLocalAgents, ...byType("agent")]
      });
      navigate(`/agents/${agent.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSaving(false); }
  };

  return <div className="page page-narrow">
    <PageHeader title="创建 Agent" description="能力、权限和模型配置会固化为 Agent Version，已运行的 Session 不被后续编辑污染。" />
    {error && <ErrorBanner error={error} />}
    <section className="form-panel">
      <StepTitle number="01" title="基础信息" />
      <div className="form-grid two"><label>名称 <span>必填</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：雪山研究员" /></label><label>标签 <span>逗号分隔</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label></div>
      <label>描述 <span>建议填写场景和主要用途</span><textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Agent 的使用场景、输入边界和预期产物" /><small className="counter">{description.length}/300</small></label>

      <StepTitle number="02" title="模型配置" description="OpenAI-compatible 可接火山方舟、OpenAI 或自托管兼容端点；API Key 只由服务端读取。" />
      <div className="form-grid three"><label>Provider<select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="mock">Local deterministic</option><option value="openai-compatible">OpenAI-compatible</option></select></label><label>模型 ID<input value={modelName} onChange={(event) => setModelName(event.target.value)} /></label><label>Base URL<input disabled={provider === "mock"} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://.../v1" /></label></div>

      <StepTitle number="03" title="System Prompt" />
      <label>System<textarea className="code-textarea" rows={8} maxLength={10_000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /><small className="counter">{systemPrompt.length}/10000</small></label>

      <StepTitle number="04" title="能力扩展" description="本地内置工具与 Market 能力在同一个配置面中，但权限来源和运行边界分别展示。" />
      <div className="capability-tabs">
        {(["skills", "tools", "agents", "mcps"] as CapabilityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "agents" ? "Multi Agents" : item.toUpperCase()}<span>{item === "tools" ? Object.keys(toolPolicies).length : market.filter((entry) => entry.type === (item === "skills" ? "skill" : item === "mcps" ? "mcp" : item === "agents" ? "agent" : "tool") && selected.includes(entry.id)).length}</span></button>)}
      </div>
      {tab === "tools" && <div className="tool-list">
        {(Object.keys(toolDescriptions) as ToolName[]).map((tool) => <div className="tool-row" key={tool}><span className="tool-icon"><Wrench size={15} /></span><div><strong>{tool}</strong><small>{toolDescriptions[tool]}</small></div><label className="switch"><input type="checkbox" checked={toolPolicies[tool] !== "deny"} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.checked ? "workspace" : "deny" }))} /><span /></label><select value={toolPolicies[tool]} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.value as PermissionMode }))}><option value="full">完全访问</option><option value="workspace">工作区内</option><option value="approval">请求批准</option><option value="deny">禁用</option></select></div>)}
      </div>}
      {tab === "skills" && (relevantMarket.length ? <div className="market-picker">{relevantMarket.map((item) => <MarketPick key={item.id} item={item} selected={selected.includes(item.id)} onClick={() => toggle(item.id)} />)}</div> : <EmptyState title="Market 暂无 Skill" description="雪山 Market 的 Git catalog 会在这里作为可选能力来源。" />)}
      {tab === "agents" && <div className="market-picker"><div className="picker-section"><h3>组织内 Agent</h3>{localAgents.map((candidate) => <button type="button" key={candidate.id} onClick={() => toggleLocalAgent(candidate.id)} className={`market-pick-card ${selectedLocalAgents.includes(candidate.id) ? "selected" : ""}`}><span className="resource-icon violet"><Bot size={16} /></span><div><strong>{candidate.name} · V{candidate.version}</strong><p>{candidate.description}</p><small>最多 20 个；已是 Multi-Agent 的不可作为 subagent</small></div><span className="pick-indicator">{selectedLocalAgents.includes(candidate.id) ? "已添加" : "添加"}</span></button>)}</div>{relevantMarket.map((item) => <MarketPick key={item.id} item={item} selected={selected.includes(item.id)} onClick={() => toggle(item.id)} />)}</div>}
      {tab === "mcps" && <div className="mcp-editor"><div className="market-picker">{relevantMarket.map((item) => <MarketPick key={item.id} item={item} selected={selected.includes(item.id)} onClick={() => toggle(item.id)} />)}</div><div className="mcp-manual-head"><div><h3>手动输入 MCP</h3><p>配置 Streamable HTTP URL、调用策略和 Credential。</p></div><button className="button secondary" onClick={addMcp}><Plus size={14} />添加（{mcpServers.length}/20）</button></div>{mcpServers.map((binding, index) => <div className="mcp-row" key={binding.id}><input value={binding.name} onChange={(event) => updateMcp(index, { name: event.target.value })} placeholder="名称" /><input value={binding.url} onChange={(event) => updateMcp(index, { url: event.target.value })} placeholder="https://…/mcp" /><select value={binding.permission} onChange={(event) => updateMcp(index, { permission: event.target.value as McpServerBinding["permission"] })}><option value="full">完全访问</option><option value="approval">请求批准</option><option value="deny">禁用</option></select><select value={binding.credentialId ?? ""} onChange={(event) => updateMcp(index, { credentialId: event.target.value || undefined })}><option value="">无凭证</option>{credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select><button className="icon-button danger" onClick={() => setMcpServers((current) => current.filter((_, itemIndex) => itemIndex !== index))}><MoreHorizontal size={15} /></button></div>)}</div>}

      <StepTitle number="05" title="高级参数" />
      <div className="advanced-row"><div><span>Base Agent</span><strong>Snowmountain-Managed-Agent-Preview-20260713</strong></div><div><span>费用预估</span><strong>本地运行 ¥0.00</strong></div><ShieldCheck size={24} /></div>
      <div className="sticky-actions"><button className="button secondary" onClick={() => navigate("/agents")}>取消</button><button className="button primary" onClick={submit} disabled={saving}>{saving ? "创建中…" : "创建 Agent"}</button></div>
    </section>
  </div>;
}

export function AgentEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [tab, setTab] = useState<CapabilityTab>("skills");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tags, setTags] = useState("");
  const [modelName, setModelName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [provider, setProvider] = useState<"mock" | "openai-compatible">("mock");
  const [selectedMarket, setSelectedMarket] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [toolPolicies, setToolPolicies] = useState<Record<ToolName, PermissionMode>>({ ...defaultToolPolicies });
  const [mcpServers, setMcpServers] = useState<McpServerBinding[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Agent>("agents", id), api.list<Agent>("agents"), api.list<Credential>("credentials"), api.market()])
      .then(([current, allAgents, allCredentials, catalog]) => {
        setAgent(current); setAgents(allAgents.items); setCredentials(allCredentials.items); setMarket(catalog.items);
        setName(current.name); setDescription(current.description); setSystemPrompt(current.systemPrompt); setTags(current.tags.join(", "));
        setProvider(current.model.provider); setModelName(current.model.name); setBaseUrl(current.model.baseUrl ?? ""); setToolPolicies(current.toolPolicies);
        const marketIds = new Set(catalog.items.map((item) => item.id));
        setSelectedMarket([...current.skillIds, ...current.mcpIds, ...current.subAgentIds].filter((value) => marketIds.has(value)));
        setSelectedAgents(current.subAgentIds.filter((value) => !marketIds.has(value)));
        setMcpServers(current.mcpServers ?? []);
      }).catch((reason: Error) => setError(reason.message));
  }, [id]);

  const toggleMarket = (entryId: string) => setSelectedMarket((current) => current.includes(entryId) ? current.filter((value) => value !== entryId) : [...current, entryId]);
  const toggleAgent = (agentId: string) => setSelectedAgents((current) => current.includes(agentId) ? current.filter((value) => value !== agentId) : current.length < 20 ? [...current, agentId] : current);
  const byType = (type: MarketEntry["type"]) => market.filter((item) => item.type === type && selectedMarket.includes(item.id)).map((item) => item.id);
  const addMcp = () => setMcpServers((current) => current.length >= 20 ? current : [...current, { id: `manual-${crypto.randomUUID()}`, name: "", url: "", permission: "approval", source: "manual" }]);
  const updateMcp = (index: number, patch: Partial<McpServerBinding>) => setMcpServers((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, ...patch } : value));
  const removeMcp = (index: number) => setMcpServers((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const save = async () => {
    setSaving(true); setError("");
    try {
      const next = await api.patch<Agent>("agents", id, {
        name, description, systemPrompt, tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
        model: { provider, name: modelName, ...(provider === "openai-compatible" && baseUrl ? { baseUrl } : {}) },
        skillIds: byType("skill"), mcpIds: byType("mcp"), subAgentIds: [...selectedAgents, ...byType("agent")],
        mcpServers: mcpServers.filter((binding) => binding.name && binding.url), toolPolicies
      });
      navigate(`/agents/${next.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };
  if (!agent && !error) return <Loading />;
  const marketItems = market.filter((item) => item.type === (tab === "skills" ? "skill" : tab === "mcps" ? "mcp" : tab === "agents" ? "agent" : "tool"));
  const localSubagents = agents.filter((candidate) => candidate.id !== id && candidate.subAgentIds.length === 0);
  return <div className="page page-narrow">
    <PageHeader title={`编辑 Agent · V${agent?.version ?? ""}`} description="保存会创建新的不可变版本；已有 Session 继续固定在创建时版本。" />
    {error && <ErrorBanner error={error} />}
    <section className="form-panel">
      <StepTitle number="01" title="基础信息" /><div className="form-grid two"><label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} /></label></div><label>描述<textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <StepTitle number="02" title="模型配置" /><div className="form-grid three"><label>Provider<select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="mock">Local deterministic</option><option value="openai-compatible">OpenAI-compatible</option></select></label><label>模型 ID<input value={modelName} onChange={(event) => setModelName(event.target.value)} /></label><label>Base URL<input disabled={provider === "mock"} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label></div>
      <StepTitle number="03" title="System Prompt" /><label>System<textarea className="code-textarea" rows={8} maxLength={10_000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /><small className="counter">{systemPrompt.length}/10000</small></label>
      <StepTitle number="04" title="能力扩展" description="Market 条目、组织内子 Agent、内置工具和手动 MCP 在同一版本中固化。" />
      <div className="capability-tabs">{(["skills", "tools", "agents", "mcps"] as CapabilityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "agents" ? "Multi Agents" : item.toUpperCase()}</button>)}</div>
      {tab === "tools" && <div className="tool-list">{(Object.keys(toolDescriptions) as ToolName[]).map((tool) => <div className="tool-row" key={tool}><span className="tool-icon"><Wrench size={15} /></span><div><strong>{tool}</strong><small>{toolDescriptions[tool]}</small></div><label className="switch"><input type="checkbox" checked={toolPolicies[tool] !== "deny"} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.checked ? "workspace" : "deny" }))} /><span /></label><select value={toolPolicies[tool]} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.value as PermissionMode }))}><option value="full">完全访问</option><option value="workspace">工作区内</option><option value="approval">请求批准</option><option value="deny">禁用</option></select></div>)}</div>}
      {tab === "agents" && <div className="market-picker"><div className="picker-section"><h3>组织内 Agent</h3>{localSubagents.map((candidate) => <button type="button" key={candidate.id} onClick={() => toggleAgent(candidate.id)} className={`market-pick-card ${selectedAgents.includes(candidate.id) ? "selected" : ""}`}><span className="resource-icon violet"><Bot size={16} /></span><div><strong>{candidate.name} · V{candidate.version}</strong><p>{candidate.description}</p><small>已是 Multi-Agent 的 Agent 不可作为 subagent · 最多 20 个</small></div><span className="pick-indicator">{selectedAgents.includes(candidate.id) ? "已添加" : "添加"}</span></button>)}</div>{marketItems.map((item) => <MarketPick key={item.id} item={item} selected={selectedMarket.includes(item.id)} onClick={() => toggleMarket(item.id)} />)}</div>}
      {tab === "skills" && <div className="market-picker">{marketItems.length ? marketItems.map((item) => <MarketPick key={item.id} item={item} selected={selectedMarket.includes(item.id)} onClick={() => toggleMarket(item.id)} />) : <EmptyState title="暂无 Skill" description="从雪山 Market 获取可审计 Skill manifest。" />}</div>}
      {tab === "mcps" && <div className="mcp-editor"><div className="market-picker">{marketItems.map((item) => <MarketPick key={item.id} item={item} selected={selectedMarket.includes(item.id)} onClick={() => toggleMarket(item.id)} />)}</div><div className="mcp-manual-head"><div><h3>手动输入 MCP</h3><p>名称、Streamable HTTP URL、调用策略与可选 Credential。</p></div><button className="button secondary" onClick={addMcp}><Plus size={14} />添加（{mcpServers.length}/20）</button></div>{mcpServers.map((binding, index) => <div className="mcp-row" key={binding.id}><input aria-label="MCP 名称" value={binding.name} onChange={(event) => updateMcp(index, { name: event.target.value })} placeholder="名称" /><input aria-label="MCP URL" value={binding.url} onChange={(event) => updateMcp(index, { url: event.target.value })} placeholder="https://…/mcp" /><select value={binding.permission} onChange={(event) => updateMcp(index, { permission: event.target.value as McpServerBinding["permission"] })}><option value="full">完全访问</option><option value="approval">请求批准</option><option value="deny">禁用</option></select><select value={binding.credentialId ?? ""} onChange={(event) => updateMcp(index, { credentialId: event.target.value || undefined })}><option value="">无凭证</option>{credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select><button className="icon-button danger" onClick={() => removeMcp(index)}><MoreHorizontal size={15} /></button></div>)}</div>}
      <div className="sticky-actions"><button className="button secondary" onClick={() => navigate(`/agents/${id}`)}>取消</button><button className="button primary" onClick={() => void save()} disabled={saving || !name || !modelName}>{saving ? "保存中…" : `保存为 V${(agent?.version ?? 0) + 1}`}</button></div>
    </section>
  </div>;
}

function MarketPick({ item, selected, onClick }: { item: MarketEntry; selected: boolean; onClick(): void }) {
  return <button type="button" onClick={onClick} className={`market-pick-card ${selected ? "selected" : ""}`}><span className="resource-icon aqua">{item.type === "skill" ? <Sparkles size={16} /> : item.type === "agent" ? <Bot size={16} /> : <Boxes size={16} />}</span><div><strong>{item.title}</strong><p>{item.description}</p><small>{item.version} · {item.permissions.join(" · ") || "无额外权限"}</small></div><span className="pick-indicator">{selected ? "已添加" : "添加"}</span></button>;
}

export function AgentDetailPage() {
  const { id = "" } = useParams();
  const [agent, setAgent] = useState<Agent>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [versions, setVersions] = useState<Agent[]>([]);
  const [tab, setTab] = useState<"base" | "sessions" | "model" | "monitor">("base");
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.get<Agent>("agents", id), api.list<Session>("sessions"), fetch(`/v1/agents/${id}/versions`).then((response) => response.json())])
      .then(([agentData, sessionData, versionData]) => { setAgent(agentData); setSessions(sessionData.items.filter((item) => item.agentId === id)); setVersions(versionData.items as Agent[]); })
      .catch((reason: Error) => setError(reason.message));
  }, [id]);
  if (error) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!agent) return <Loading />;

  const activeTools = Object.entries(agent.toolPolicies).filter(([, mode]) => mode !== "deny");
  return <div className="page">
    <div className="detail-hero"><Link className="back-link" to="/agents">Agents</Link><ChevronRight size={15} /><span>{agent.name}</span><div className="detail-actions"><button className="button secondary" onClick={() => void navigator.clipboard.writeText(agent.id)}><Copy size={15} />复制 ID</button><Link className="button secondary" to={`/agents/${agent.id}/edit`}><MoreHorizontal size={16} />编辑</Link><Link className="button primary" to={`/sessions?agentId=${agent.id}&create=1`}><Plus size={16} />创建 Session</Link></div></div>
    <section className="identity-card"><span className="resource-icon large violet"><Bot size={24} /></span><div><div className="identity-title"><h1>{agent.name}</h1><span className="version-pill">当前版本 V{agent.version}</span></div><p>{agent.description || "暂无描述"}</p><small>{agent.id} · 创建于 {new Date(agent.createdAt).toLocaleString()}</small></div></section>
    <div className="detail-tabs">{([["base","基础配置"],["sessions","Sessions 管理"],["model","模型配置"],["monitor","监控"]] as const).map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={tab === value ? "active" : ""}>{label}</button>)}</div>
    {tab === "base" && <div className="detail-grid"><section className="panel detail-panel"><h3>基本信息</h3><dl className="kv-grid"><div><dt>Base Agent</dt><dd>{agent.baseAgent}</dd></div><div><dt>模型</dt><dd>{agent.model.name}</dd></div><div><dt>版本历史</dt><dd>{versions.length} 个版本</dd></div><div><dt>标签</dt><dd>{agent.tags.join(" · ") || "-"}</dd></div></dl><div className="version-history">{versions.map((version) => <span key={version.version} className={version.version === agent.version ? "active" : ""}>V{version.version}<small>{new Date(version.updatedAt).toLocaleString()}</small></span>)}</div></section><section className="panel detail-panel wide"><h3>能力扩展</h3><div className="metric-strip"><div><Sparkles size={17} /><strong>{agent.skillIds.length}</strong><span>Skills</span></div><div><Wrench size={17} /><strong>{activeTools.length}</strong><span>Tools</span></div><div><Bot size={17} /><strong>{agent.subAgentIds.length}</strong><span>Multi Agent</span></div><div><Boxes size={17} /><strong>{agent.mcpIds.length + (agent.mcpServers?.length ?? 0)}</strong><span>MCPs</span></div></div><div className="capability-inventory"><div><strong>Skills</strong><span>{agent.skillIds.join(" · ") || "暂无"}</span></div><div><strong>Multi Agents</strong><span>{agent.subAgentIds.join(" · ") || "暂无"}</span></div><div><strong>MCPs</strong><span>{[...agent.mcpIds, ...(agent.mcpServers ?? []).map((binding) => `${binding.name} (${binding.permission})`)].join(" · ") || "暂无"}</span></div></div><div className="compact-tools">{activeTools.map(([name, mode]) => <div key={name}><code>{name}</code><span>{mode}</span></div>)}</div></section></div>}
    {tab === "sessions" && <section className="panel">{sessions.length ? <div className="table-wrap"><table><thead><tr><th>Session</th><th>状态</th><th>Agent 版本</th><th>Tokens</th><th>更新时间</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><Link className="resource-link" to={`/sessions/${session.id}`}><span><strong>{session.name}</strong><small>{session.id}</small></span></Link></td><td><Status value={session.status} /></td><td><span className="version-pill">V{session.agentVersion ?? 1}</span></td><td>{session.inputTokens} / {session.outputTokens}</td><td>{new Date(session.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Session" description="用这个版本创建 Session 后会出现在这里。" />}</section>}
    {tab === "model" && <div className="detail-grid"><section className="panel detail-panel"><h3>模型接入</h3><dl className="kv-list"><div><dt>Provider</dt><dd>{agent.model.provider}</dd></div><div><dt>模型 ID</dt><dd>{agent.model.name}</dd></div><div><dt>Endpoint ID</dt><dd>{agent.model.endpointId ?? "-"}</dd></div><div><dt>Base URL</dt><dd>{agent.model.baseUrl ?? "本地 Harness"}</dd></div><div><dt>模型限流</dt><dd>RPM {agent.model.rpm?.toLocaleString() ?? "-"} · TPM {agent.model.tpm?.toLocaleString() ?? "-"}</dd></div></dl></section><section className="panel detail-panel"><h3>计费信息</h3><div className="billing-zero"><CircleDollarSign size={25} /><div><strong>{agent.model.provider === "mock" ? "¥0.00" : "由模型提供商结算"}</strong><span>输入 ¥{agent.model.inputPricePerK ?? "-"} / 千 tokens · 缓存 ¥{agent.model.cachedInputPricePerK ?? "-"} · 输出 ¥{agent.model.outputPricePerK ?? "-"}</span></div></div></section></div>}
    {tab === "monitor" && <section className="panel monitor-card"><div><span className="eyebrow">LAST 15 MINUTES</span><h3>Session 运行概况</h3><p>事件、Tokens 和工具延迟可通过 OTLP 导出到 Prometheus、Grafana 或你的观测平台。</p></div><div className="monitor-metrics"><div><strong>{sessions.length}</strong><span>Sessions</span></div><div><strong>{sessions.filter((item) => item.status === "running").length}</strong><span>Running</span></div><div><strong>{sessions.reduce((sum,item) => sum + item.inputTokens + item.outputTokens, 0)}</strong><span>Tokens</span></div></div></section>}
  </div>;
}
