import {
  Bot, Boxes, ChevronLeft, ChevronRight, CircleDollarSign, Copy, Cpu, MoreHorizontal,
  Plus, RefreshCw, Search, ShieldCheck, Sparkles, Wrench
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Agent, Credential, MarketEntry, McpServerBinding, ModelCatalogItem, PermissionMode, RuntimeProfile, Session, ToolName } from "@snowmountain/contracts";
import { defaultToolPolicies } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader, Status, StepTitle, Toolbar } from "../components/UI";

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

function modelConfig(item: ModelCatalogItem) {
  return {
    provider: item.provider,
    name: item.name,
    endpointId: item.endpointId,
    displayName: item.displayName,
    contextWindow: item.contextWindow,
    inputPricePerK: item.inputPricePerK,
    cachedInputPricePerK: item.cachedInputPricePerK,
    outputPricePerK: item.outputPricePerK,
    rpm: item.rpm,
    tpm: item.tpm
  };
}

export function AgentCreatePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<CapabilityTab>("skills");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [models, setModels] = useState<ModelCatalogItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [runtimes, setRuntimes] = useState<RuntimeProfile[]>([]);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState("");
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
  useEffect(() => {
    void Promise.all([api.modelCatalog(), api.runtimeProfiles()]).then(([modelResult, runtimeResult]) => { setModels(modelResult.items); setSelectedModelId(modelResult.items[0]?.id ?? ""); setRuntimes(runtimeResult.items); setSelectedRuntimeId(runtimeResult.items.find((runtime) => runtime.default)?.id ?? runtimeResult.items[0]?.id ?? ""); }).catch((reason: Error) => setError(reason.message));
    void Promise.all([api.market(), api.list<Agent>("agents"), api.list<Credential>("credentials")]).then(([catalog, agents, credentialResult]) => { setMarket(catalog.items); setLocalAgents(agents.items.filter((agent) => agent.subAgentIds.length === 0)); setCredentials(credentialResult.items); }).catch((reason: Error) => setError(reason.message));
  }, []);

  const relevantMarket = market.filter((item) => item.type === (tab === "skills" ? "skill" : tab === "mcps" ? "mcp" : tab === "agents" ? "agent" : "tool"));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleLocalAgent = (id: string) => setSelectedLocalAgents((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 20 ? [...current, id] : current);
  const addMcp = () => setMcpServers((current) => current.length >= 20 ? current : [...current, { id: `manual-${crypto.randomUUID()}`, name: "", url: "", permission: "approval", source: "manual" }]);
  const updateMcp = (index: number, patch: Partial<McpServerBinding>) => setMcpServers((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, ...patch } : value));

  const submit = async () => {
    if (!name.trim()) { setError("请填写 Agent 名称"); return; }
    setSaving(true); setError("");
    try {
      const selectedModel = models.find((item) => item.id === selectedModelId);
      if (!selectedModel) throw new Error("请先选择管理员发布的模型");
      const byType = (type: MarketEntry["type"]) => market.filter((item) => item.type === type && selected.includes(item.id)).map((item) => item.id);
      const agent = await api.create<Agent>("agents", {
        name, description, systemPrompt, model: modelConfig(selectedModel), baseAgent: selectedRuntimeId,
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
  const selectedModel = models.find((item) => item.id === selectedModelId);

  return <div className="page page-narrow">
    <PageHeader title="创建 Agent" description="能力、权限和模型配置会固化为 Agent Version；Session 只绑定 Agent，并跟随其当前版本。" />
    {error && <ErrorBanner error={error} />}
    <section className="form-panel">
      <StepTitle number="01" title="基础信息" />
      <div className="form-grid two"><label>名称 <span>必填</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：雪山研究员" /></label><label>标签 <span>逗号分隔</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label></div>
      <label>描述 <span>建议填写场景和主要用途</span><textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Agent 的使用场景、输入边界和预期产物" /><small className="counter">{description.length}/300</small></label>

      <StepTitle number="02" title="模型配置" description="从管理员发布的模型目录中选择；Provider URL 与平台密钥不会暴露给普通用户。" />
      <button type="button" className="model-selection" onClick={() => setModelPickerOpen(true)}><span className="resource-icon blue"><Cpu size={17} /></span><div><strong>{selectedModel?.displayName ?? "请选择模型"}</strong><p>{selectedModel?.description ?? "管理员尚未发布可用模型"}</p><small>{selectedModel ? `${selectedModel.provider} · ${selectedModel.name}` : ""}</small></div><span className="pick-indicator">选择模型</span></button>

      <StepTitle number="03" title="System Prompt" />
      <label>System<textarea className="code-textarea" rows={8} maxLength={10_000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /><small className="counter">{systemPrompt.length}/10000</small></label>

      <StepTitle number="04" title="能力扩展" description="本地内置工具与 Market 能力在同一个配置面中，但权限来源和运行边界分别展示。" />
      <div className="capability-tabs">
        {(["skills", "tools", "agents", "mcps"] as CapabilityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "agents" ? "Multi Agents" : item.toUpperCase()}<span>{item === "tools" ? Object.keys(toolPolicies).length : market.filter((entry) => entry.type === (item === "skills" ? "skill" : item === "mcps" ? "mcp" : item === "agents" ? "agent" : "tool") && selected.includes(entry.id)).length}</span></button>)}
      </div>
      {tab === "tools" && <div className="tool-list">
        {(Object.keys(toolDescriptions) as ToolName[]).map((tool) => <div className="tool-row" key={tool}><span className="tool-icon"><Wrench size={15} /></span><div><strong>{tool}</strong><small>{toolDescriptions[tool]}</small></div><label className="switch"><input type="checkbox" checked={toolPolicies[tool] !== "deny"} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.checked ? "workspace" : "deny" }))} /><span /></label><select value={toolPolicies[tool]} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.value as PermissionMode }))}><option value="full">完全访问</option><option value="workspace">工作区内</option><option value="approval">请求批准</option><option value="deny">禁用</option></select></div>)}
      </div>}
      {tab === "skills" && <MarketCapabilityPicker items={relevantMarket} selectedIds={selected} onToggle={toggle} emptyTitle="Market 暂无 Skill" emptyDescription="雪山 Market 的 Git catalog 会在这里作为可选能力来源。" />}
      {tab === "agents" && <div className="market-picker"><div className="picker-section"><h3>组织内 Agent</h3>{localAgents.map((candidate) => <button type="button" key={candidate.id} onClick={() => toggleLocalAgent(candidate.id)} className={`market-pick-card ${selectedLocalAgents.includes(candidate.id) ? "selected" : ""}`}><span className="resource-icon violet"><Bot size={16} /></span><div><strong>{candidate.name} · V{candidate.version}</strong><p>{candidate.description}</p><small>最多 20 个；已是 Multi-Agent 的不可作为 subagent</small></div><span className="pick-indicator">{selectedLocalAgents.includes(candidate.id) ? "已添加" : "添加"}</span></button>)}</div>{relevantMarket.map((item) => <MarketPick key={item.id} item={item} selected={selected.includes(item.id)} onClick={() => toggle(item.id)} />)}</div>}
      {tab === "mcps" && <div className="mcp-editor"><MarketCapabilityPicker items={relevantMarket} selectedIds={selected} onToggle={toggle} emptyTitle="Market 暂无 MCP" emptyDescription="可继续使用下方的手动 MCP binding。" /><div className="mcp-manual-head"><div><h3>手动输入 MCP</h3><p>配置 Streamable HTTP URL、调用策略和显式 Credential。</p></div><button className="button secondary" onClick={addMcp}><Plus size={14} />添加（{mcpServers.length}/20）</button></div>{mcpServers.map((binding, index) => <div className="mcp-row" key={binding.id}><input value={binding.name} onChange={(event) => updateMcp(index, { name: event.target.value })} placeholder="名称" /><input value={binding.url} onChange={(event) => updateMcp(index, { url: event.target.value })} placeholder="https://…/mcp" /><select value={binding.permission} onChange={(event) => updateMcp(index, { permission: event.target.value as McpServerBinding["permission"] })}><option value="full">完全访问</option><option value="approval">请求批准</option><option value="deny">禁用</option></select><select value={binding.credentialId ?? ""} onChange={(event) => updateMcp(index, { credentialId: event.target.value || undefined })}><option value="">无凭证</option>{credentials.filter((credential) => !credential.usage || ["mcp", "generic"].includes(credential.usage)).map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select><button className="icon-button danger" onClick={() => setMcpServers((current) => current.filter((_, itemIndex) => itemIndex !== index))}><MoreHorizontal size={15} /></button></div>)}</div>}

      <StepTitle number="05" title="高级参数" />
      <div className="advanced-row"><label>Base Agent <span>运行时 Harness Profile</span><select value={selectedRuntimeId} onChange={(event) => setSelectedRuntimeId(event.target.value)}>{runtimes.map((runtime) => <option value={runtime.id} key={runtime.id}>{runtime.id}{runtime.default ? " · 默认" : ""}</option>)}</select></label><div><span>费用预估</span><strong>{selectedModel?.provider === "mock" ? "本地运行 ¥0.00" : "按模型 Endpoint 计费"}</strong></div><ShieldCheck size={24} /></div>
      <div className="sticky-actions"><button className="button secondary" onClick={() => navigate("/agents")}>取消</button><button className="button primary" onClick={submit} disabled={saving || !selectedModelId || !selectedRuntimeId}>{saving ? "创建中…" : "创建 Agent"}</button></div>
    </section>
    <ModelPicker open={modelPickerOpen} models={models} selectedId={selectedModelId} onSelect={(id) => { setSelectedModelId(id); setModelPickerOpen(false); }} onClose={() => setModelPickerOpen(false)} />
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
  const [models, setModels] = useState<ModelCatalogItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [runtimes, setRuntimes] = useState<RuntimeProfile[]>([]);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [toolPolicies, setToolPolicies] = useState<Record<ToolName, PermissionMode>>({ ...defaultToolPolicies });
  const [mcpServers, setMcpServers] = useState<McpServerBinding[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Agent>("agents", id), api.list<Agent>("agents"), api.list<Credential>("credentials"), api.market(), api.modelCatalog(), api.runtimeProfiles()])
      .then(([current, allAgents, allCredentials, catalog, modelResult, runtimeResult]) => {
        setAgent(current); setAgents(allAgents.items); setCredentials(allCredentials.items); setMarket(catalog.items);
        setName(current.name); setDescription(current.description); setSystemPrompt(current.systemPrompt); setTags(current.tags.join(", "));
        setModels(modelResult.items); setSelectedModelId(modelResult.items.find((model) => model.endpointId === current.model.endpointId && model.name === current.model.name)?.id ?? modelResult.items.find((model) => model.name === current.model.name)?.id ?? "");
        setRuntimes(runtimeResult.items); setSelectedRuntimeId(current.baseAgent); setToolPolicies(current.toolPolicies);
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
      const selectedModel = models.find((item) => item.id === selectedModelId);
      if (!selectedModel) throw new Error("请先选择管理员发布的模型");
      const next = await api.patch<Agent>("agents", id, {
        name, description, systemPrompt, tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
        model: modelConfig(selectedModel), baseAgent: selectedRuntimeId,
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
  const selectedModel = models.find((item) => item.id === selectedModelId);
  return <div className="page page-narrow">
    <PageHeader title={`编辑 Agent · Latest V${agent?.version ?? ""}`} description="保存会创建新的不可变版本，但不会自动设为当前版本；所有 Session 都跟随 Agent 当前版本。" />
    {error && <ErrorBanner error={error} />}
    <section className="form-panel">
      <StepTitle number="01" title="基础信息" /><div className="form-grid two"><label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} /></label></div><label>描述<textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <StepTitle number="02" title="模型配置" description="模型目录由平台管理员发布；保存版本时只固化模型 ID 与 Endpoint 引用。" /><button type="button" className="model-selection" onClick={() => setModelPickerOpen(true)}><span className="resource-icon blue"><Cpu size={17} /></span><div><strong>{selectedModel?.displayName ?? agent?.model.displayName ?? agent?.model.name ?? "请选择模型"}</strong><p>{selectedModel?.description ?? "当前模型已不在可选目录中，请重新选择。"}</p><small>{selectedModel ? `${selectedModel.provider} · ${selectedModel.name}` : agent?.model.name}</small></div><span className="pick-indicator">更换模型</span></button>
      <StepTitle number="03" title="System Prompt" /><label>System<textarea className="code-textarea" rows={8} maxLength={10_000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /><small className="counter">{systemPrompt.length}/10000</small></label>
      <StepTitle number="04" title="能力扩展" description="Market 条目、组织内子 Agent、内置工具和手动 MCP 在同一版本中固化。" />
      <div className="capability-tabs">{(["skills", "tools", "agents", "mcps"] as CapabilityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "agents" ? "Multi Agents" : item.toUpperCase()}</button>)}</div>
      {tab === "tools" && <div className="tool-list">{(Object.keys(toolDescriptions) as ToolName[]).map((tool) => <div className="tool-row" key={tool}><span className="tool-icon"><Wrench size={15} /></span><div><strong>{tool}</strong><small>{toolDescriptions[tool]}</small></div><label className="switch"><input type="checkbox" checked={toolPolicies[tool] !== "deny"} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.checked ? "workspace" : "deny" }))} /><span /></label><select value={toolPolicies[tool]} onChange={(event) => setToolPolicies((value) => ({ ...value, [tool]: event.target.value as PermissionMode }))}><option value="full">完全访问</option><option value="workspace">工作区内</option><option value="approval">请求批准</option><option value="deny">禁用</option></select></div>)}</div>}
      {tab === "agents" && <div className="market-picker"><div className="picker-section"><h3>组织内 Agent</h3>{localSubagents.map((candidate) => <button type="button" key={candidate.id} onClick={() => toggleAgent(candidate.id)} className={`market-pick-card ${selectedAgents.includes(candidate.id) ? "selected" : ""}`}><span className="resource-icon violet"><Bot size={16} /></span><div><strong>{candidate.name} · V{candidate.version}</strong><p>{candidate.description}</p><small>已是 Multi-Agent 的 Agent 不可作为 subagent · 最多 20 个</small></div><span className="pick-indicator">{selectedAgents.includes(candidate.id) ? "已添加" : "添加"}</span></button>)}</div>{marketItems.map((item) => <MarketPick key={item.id} item={item} selected={selectedMarket.includes(item.id)} onClick={() => toggleMarket(item.id)} />)}</div>}
      {tab === "skills" && <MarketCapabilityPicker items={marketItems} selectedIds={selectedMarket} onToggle={toggleMarket} emptyTitle="暂无 Skill" emptyDescription="从雪山 Market 获取可审计 Skill manifest。" />}
      {tab === "mcps" && <div className="mcp-editor"><MarketCapabilityPicker items={marketItems} selectedIds={selectedMarket} onToggle={toggleMarket} emptyTitle="Market 暂无 MCP" emptyDescription="可继续使用下方的手动 MCP binding。" /><div className="mcp-manual-head"><div><h3>手动输入 MCP</h3><p>名称、Streamable HTTP URL、调用策略与显式 Credential。</p></div><button className="button secondary" onClick={addMcp}><Plus size={14} />添加（{mcpServers.length}/20）</button></div>{mcpServers.map((binding, index) => <div className="mcp-row" key={binding.id}><input aria-label="MCP 名称" value={binding.name} onChange={(event) => updateMcp(index, { name: event.target.value })} placeholder="名称" /><input aria-label="MCP URL" value={binding.url} onChange={(event) => updateMcp(index, { url: event.target.value })} placeholder="https://…/mcp" /><select value={binding.permission} onChange={(event) => updateMcp(index, { permission: event.target.value as McpServerBinding["permission"] })}><option value="full">完全访问</option><option value="approval">请求批准</option><option value="deny">禁用</option></select><select value={binding.credentialId ?? ""} onChange={(event) => updateMcp(index, { credentialId: event.target.value || undefined })}><option value="">无凭证</option>{credentials.filter((credential) => !credential.usage || ["mcp", "generic"].includes(credential.usage)).map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select><button className="icon-button danger" onClick={() => removeMcp(index)}><MoreHorizontal size={15} /></button></div>)}</div>}
      <StepTitle number="05" title="高级参数" /><label>Base Agent <span>可版本化 Harness Profile</span><select value={selectedRuntimeId} onChange={(event) => setSelectedRuntimeId(event.target.value)}>{runtimes.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.id}{runtime.default ? " · 默认" : ""}</option>)}</select></label>
      <div className="sticky-actions"><button className="button secondary" onClick={() => navigate(`/agents/${id}`)}>取消</button><button className="button primary" onClick={() => void save()} disabled={saving || !name || !selectedModelId || !selectedRuntimeId}>{saving ? "保存中…" : `保存为 V${(agent?.version ?? 0) + 1}`}</button></div>
    </section>
    <ModelPicker open={modelPickerOpen} models={models} selectedId={selectedModelId} onSelect={(value) => { setSelectedModelId(value); setModelPickerOpen(false); }} onClose={() => setModelPickerOpen(false)} />
  </div>;
}

function ModelPicker({ open, models, selectedId, onSelect, onClose }: { open: boolean; models: ModelCatalogItem[]; selectedId: string; onSelect(id: string): void; onClose(): void }) {
  const [pending, setPending] = useState(selectedId);
  useEffect(() => { if (open) setPending(selectedId); }, [open, selectedId]);
  return <Modal title="选择模型" open={open} onClose={onClose} footer={<><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!pending} onClick={() => onSelect(pending)}>确定</button></>}>
    <div className="model-picker-grid"><div className="model-picker-list">{models.map((model) => <button type="button" key={model.id} className={pending === model.id ? "selected" : ""} onClick={() => setPending(model.id)}><span className="resource-icon blue"><Cpu size={17} /></span><div><strong>{model.displayName}</strong><small>{model.name}</small></div></button>)}</div><div className="model-picker-detail">{models.filter((model) => model.id === pending).map((model) => <div key={model.id}><span className="eyebrow">{model.provider}</span><h3>{model.displayName}</h3><p>{model.description}</p><dl className="kv-list"><div><dt>上下文</dt><dd>{model.contextWindow?.toLocaleString() ?? "由 Provider 决定"}</dd></div><div><dt>模态</dt><dd>{model.modalities.join(" · ")}</dd></div><div><dt>计费</dt><dd>{model.provider === "mock" ? "¥0.00" : `输入 ${model.inputPricePerK ?? "-"} / 输出 ${model.outputPricePerK ?? "-"}（每千 Tokens）`}</dd></div></dl></div>)}</div></div>
  </Modal>;
}

function MarketPick({ item, selected, onClick }: { item: MarketEntry; selected: boolean; onClick(): void }) {
  return <button type="button" onClick={onClick} className={`market-pick-card ${selected ? "selected" : ""}`}><span className="resource-icon aqua">{item.type === "skill" ? <Sparkles size={16} /> : item.type === "agent" ? <Bot size={16} /> : <Boxes size={16} />}</span><div><strong>{item.title}</strong><p>{item.description}</p><small>{item.version} · {item.permissions.join(" · ") || "无额外权限"}</small></div><span className="pick-indicator">{selected ? "已添加" : "添加"}</span></button>;
}

const marketPageSize = 8;

function MarketCapabilityPicker({
  items, selectedIds, onToggle, emptyTitle, emptyDescription
}: {
  items: MarketEntry[];
  selectedIds: string[];
  onToggle(id: string): void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [selection, setSelection] = useState<"all" | "selected" | "unselected">("all");
  const [page, setPage] = useState(1);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right)), [items]);
  const tags = useMemo(() => [...new Set(items.flatMap((item) => item.tags))].sort((left, right) => left.localeCompare(right)), [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !normalized || [item.title, item.description, item.id, item.provider, item.registry, ...item.tags].filter(Boolean).join(" ").toLowerCase().includes(normalized);
      const matchesCategory = category === "all" || item.category === category;
      const matchesTag = tag === "all" || item.tags.includes(tag);
      const matchesSelection = selection === "all" || (selection === "selected" ? selected.has(item.id) : !selected.has(item.id));
      return matchesQuery && matchesCategory && matchesTag && matchesSelection;
    });
  }, [category, items, query, selected, selection, tag]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / marketPageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * marketPageSize, safePage * marketPageSize);
  useEffect(() => { setPage(1); }, [query, category, tag, selection]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  return <div className="market-browser">
    <div className="market-browser-toolbar">
      <label className="market-browser-search"><span>搜索</span><div><Search size={14} /><input aria-label="搜索 Market 能力" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、描述、ID 或标签" /></div></label>
      <label><span>分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部分类</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>标签</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">全部标签</option>{tags.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>选择状态</span><select value={selection} onChange={(event) => setSelection(event.target.value as typeof selection)}><option value="all">全部条目</option><option value="selected">仅看已添加</option><option value="unselected">仅看未添加</option></select></label>
    </div>
    <div className="market-browser-summary"><span>找到 <strong>{filtered.length}</strong> / {items.length} 条</span><span>已添加 <strong>{items.filter((item) => selected.has(item.id)).length}</strong> 条</span></div>
    {pageItems.length ? <div className="market-browser-list">{pageItems.map((item) => <MarketPick key={item.id} item={item} selected={selected.has(item.id)} onClick={() => onToggle(item.id)} />)}</div> : <EmptyState title={items.length ? "没有符合条件的能力" : emptyTitle} description={items.length ? "调整搜索词或筛选条件后再试。" : emptyDescription} />}
    {filtered.length > 0 && <div className="market-pagination"><span>第 {safePage} / {pageCount} 页 · 每页 {marketPageSize} 条</span><div><button type="button" className="icon-button" aria-label="上一页" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /></button><button type="button" className="icon-button" aria-label="下一页" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={15} /></button></div></div>}
  </div>;
}

export function AgentDetailPage() {
  const { id = "" } = useParams();
  const [agent, setAgent] = useState<Agent>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [versions, setVersions] = useState<Agent[]>([]);
  const [tab, setTab] = useState<"base" | "sessions" | "model" | "monitor">("base");
  const [versionOpen, setVersionOpen] = useState(false);
  const [activatingVersion, setActivatingVersion] = useState<number>();
  const [error, setError] = useState("");
  const load = useCallback(() => Promise.all([api.get<Agent>("agents", id), api.list<Session>("sessions"), api.agentVersions(id)])
      .then(([agentData, sessionData, versionData]) => { setAgent(agentData); setSessions(sessionData.items.filter((item) => item.agentId === id)); setVersions(versionData.items as Agent[]); })
      .catch((reason: Error) => setError(reason.message)), [id]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!agent) return <Loading />;

  const activeVersion = agent.activeVersion ?? agent.version;
  const activeAgent = versions.find((version) => version.version === activeVersion) ?? agent;
  const activeTools = Object.entries(activeAgent.toolPolicies).filter(([, mode]) => mode !== "deny");
  const activateVersion = async (version: number) => {
    setActivatingVersion(version); setError("");
    try { await api.activateAgentVersion(agent.id, version); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setActivatingVersion(undefined); }
  };
  return <div className="page">
    <div className="detail-hero"><Link className="back-link" to="/agents">Agents</Link><ChevronRight size={15} /><span>{agent.name}</span><div className="detail-actions"><button className="button secondary version-current-button" onClick={() => setVersionOpen(true)}>当前版本 V{activeVersion}<ChevronRight size={14} /></button><button className="button secondary" onClick={() => void navigator.clipboard.writeText(agent.id)}><Copy size={15} />复制 ID</button><Link className="button secondary" to={`/agents/${agent.id}/edit`}><MoreHorizontal size={16} />编辑</Link><Link className="button primary" to={`/sessions?agentId=${agent.id}&create=1`}><Plus size={16} />创建 Session</Link></div></div>
    <section className="identity-card"><span className="resource-icon large violet"><Bot size={24} /></span><div><div className="identity-title"><h1>{activeAgent.name}</h1><span className="version-pill">当前 V{activeVersion}</span>{agent.version !== activeVersion && <span className="latest-version-pill">Latest V{agent.version}</span>}</div><p>{activeAgent.description || "暂无描述"}</p><small>{agent.id} · 创建于 {new Date(agent.createdAt).toLocaleString()}</small></div></section>
    <div className="detail-tabs">{([["base","基础配置"],["sessions","Sessions 管理"],["model","模型配置"],["monitor","监控"]] as const).map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={tab === value ? "active" : ""}>{label}</button>)}</div>
    {tab === "base" && <div className="detail-grid"><section className="panel detail-panel"><h3>基本信息</h3><dl className="kv-grid"><div><dt>Base Agent</dt><dd>{activeAgent.baseAgent}</dd></div><div><dt>模型</dt><dd>{activeAgent.model.name}</dd></div><div><dt>版本历史</dt><dd>{versions.length} 个版本</dd></div><div><dt>标签</dt><dd>{activeAgent.tags.join(" · ") || "-"}</dd></div></dl><div className="version-history">{versions.map((version) => <span key={version.version} className={version.version === activeVersion ? "active" : ""}>V{version.version}<small>{version.version === activeVersion ? "当前" : version.version === agent.version ? "Latest" : new Date(version.updatedAt).toLocaleString()}</small></span>)}</div></section><section className="panel detail-panel wide"><h3>能力扩展</h3><div className="metric-strip"><div><Sparkles size={17} /><strong>{activeAgent.skillIds.length}</strong><span>Skills</span></div><div><Wrench size={17} /><strong>{activeTools.length}</strong><span>Tools</span></div><div><Bot size={17} /><strong>{activeAgent.subAgentIds.length}</strong><span>Multi Agent</span></div><div><Boxes size={17} /><strong>{activeAgent.mcpIds.length + (activeAgent.mcpServers?.length ?? 0)}</strong><span>MCPs</span></div></div><div className="capability-inventory"><div><strong>Skills</strong><span>{activeAgent.skillIds.join(" · ") || "暂无"}</span></div><div><strong>Multi Agents</strong><span>{activeAgent.subAgentIds.join(" · ") || "暂无"}</span></div><div><strong>MCPs</strong><span>{[...activeAgent.mcpIds, ...(activeAgent.mcpServers ?? []).map((binding) => `${binding.name} (${binding.permission})`)].join(" · ") || "暂无"}</span></div></div><div className="compact-tools">{activeTools.map(([name, mode]) => <div key={name}><code>{name}</code><span>{mode === "approval" ? "自动放行" : mode}</span></div>)}</div></section></div>}
    {tab === "sessions" && <section className="panel">{sessions.length ? <div className="table-wrap"><table><thead><tr><th>Session</th><th>状态</th><th>Agent 当前版本</th><th>Tokens</th><th>更新时间</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><Link className="resource-link" to={`/sessions/${session.id}`}><span><strong>{session.name}</strong><small>{session.id}</small></span></Link></td><td><Status value={session.status} /></td><td><span className="version-pill">跟随 V{activeVersion}</span></td><td>{session.inputTokens} / {session.outputTokens}</td><td>{new Date(session.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Session" description="创建 Session 后会绑定这个 Agent，并自动跟随当前版本。" />}</section>}
    {tab === "model" && <div className="detail-grid"><section className="panel detail-panel"><h3>模型接入</h3><dl className="kv-list"><div><dt>Provider</dt><dd>{activeAgent.model.provider}</dd></div><div><dt>模型 ID</dt><dd>{activeAgent.model.name}</dd></div><div><dt>Endpoint ID</dt><dd>{activeAgent.model.endpointId ?? "本地 Harness"}</dd></div><div><dt>Provider 配置</dt><dd>由平台管理员托管</dd></div><div><dt>模型限流</dt><dd>RPM {activeAgent.model.rpm?.toLocaleString() ?? "-"} · TPM {activeAgent.model.tpm?.toLocaleString() ?? "-"}</dd></div></dl></section><section className="panel detail-panel"><h3>计费信息</h3><div className="billing-zero"><CircleDollarSign size={25} /><div><strong>{activeAgent.model.provider === "mock" ? "¥0.00" : "由模型提供商结算"}</strong><span>输入 ¥{activeAgent.model.inputPricePerK ?? "-"} / 千 tokens · 缓存 ¥{activeAgent.model.cachedInputPricePerK ?? "-"} · 输出 ¥{activeAgent.model.outputPricePerK ?? "-"}</span></div></div></section></div>}
    {tab === "monitor" && <section className="panel monitor-card"><div><span className="eyebrow">LAST 15 MINUTES</span><h3>Session 运行概况</h3><p>事件、Tokens 和工具延迟可通过 OTLP 导出到 Prometheus、Grafana 或你的观测平台。</p></div><div className="monitor-metrics"><div><strong>{sessions.length}</strong><span>Sessions</span></div><div><strong>{sessions.filter((item) => item.status === "running").length}</strong><span>Running</span></div><div><strong>{sessions.reduce((sum,item) => sum + item.inputTokens + item.outputTokens, 0)}</strong><span>Tokens</span></div></div></section>}
    <Modal title="版本历史" open={versionOpen} onClose={() => setVersionOpen(false)} footer={<button className="button primary" onClick={() => setVersionOpen(false)}>完成</button>}><div className="agent-version-list">{versions.map((version) => <div key={version.version} className={version.version === activeVersion ? "current" : ""}><span className="version-number">V{version.version}</span><div><strong>{version.description || version.name}</strong><small>{new Date(version.updatedAt).toLocaleString()}</small></div><div className="version-labels">{version.version === agent.version && <span className="latest">Latest</span>}{version.version === activeVersion && <span className="current">当前</span>}</div>{version.version !== activeVersion && <button className="button secondary" disabled={activatingVersion !== undefined} onClick={() => void activateVersion(version.version)}>{activatingVersion === version.version ? "切换中…" : "设为当前"}</button>}</div>)}</div></Modal>
  </div>;
}
