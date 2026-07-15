import {
  Box, Brain, CheckCircle2, ChevronRight, KeyRound, LockKeyhole,
  Plus, ServerCog, Shield, Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Credential, Environment, EnvironmentVariable, MemoryEntry, MemoryStore, Session, Vault } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader, Status, Toolbar } from "../components/UI";

function parseVariables(value: string): EnvironmentVariable[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return { key: index >= 0 ? line.slice(0, index).trim() : line, value: index >= 0 ? line.slice(index + 1) : "", secret: false };
  }).filter((item) => item.key);
}

function serializeVariables(variables: EnvironmentVariable[]): string {
  return variables.filter((item) => !item.secret).map((item) => `${item.key}=${item.value}`).join("\n");
}

export function EnvironmentsPage() {
  const [items, setItems] = useState<Environment[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", packages: "git, nodejs, ripgrep", variables: "" });
  const load = useCallback(() => api.list<Environment>("environments").then((result) => setItems(result.items)).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    try {
      await api.create("environments", {
        name: form.name, description: form.description,
        packages: form.packages.split(",").map((item) => item.trim()).filter(Boolean),
        variables: parseVariables(form.variables)
      });
      setOpen(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page">
    <PageHeader title="Environments" description="定义 Agent 的运行环境模板，预置依赖和环境变量；隔离策略由平台统一托管。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Environment</button>} />
    {error && <ErrorBanner error={error} />}
    <section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="table-wrap"><table><thead><tr><th>名称 / ID</th><th>预装包</th><th>环境变量</th><th>执行边界</th><th>创建时间</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}>
      <td><Link className="resource-link" to={`/environments/${item.id}`}><span className="resource-icon blue"><Box size={16} /></span><span><strong>{item.name}</strong><small>{item.id}</small></span></Link></td>
      <td>{item.packages.length} packages</td><td>{item.variables.length} vars</td><td><span className="safe-text"><Shield size={14} />平台托管</span></td><td className="muted">{new Date(item.createdAt).toLocaleString()}</td><td><Link className="icon-button" to={`/environments/${item.id}`}><ChevronRight size={17} /></Link></td>
    </tr>)}</tbody></table></div> : <EmptyState title="暂无 Environment" description="创建可复用的包、变量与能力边界模板。" />}</section>
    <EnvironmentModal open={open} form={form} setForm={setForm} onClose={() => setOpen(false)} onSave={() => void create()} title="创建 Environment" />
  </div>;
}

function EnvironmentModal({ open, form, setForm, onClose, onSave, title }: {
  open: boolean; form: { name: string; description: string; packages: string; variables: string };
  setForm(value: typeof form): void; onClose(): void; onSave(): void; title: string;
}) {
  return <Modal title={title} open={open} onClose={onClose} footer={<><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!form.name} onClick={onSave}>保存</button></>}>
    <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：Node.js 研究环境" /></label>
    <label>描述<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    <label>预装包 <span>逗号分隔；实际镜像必须已包含这些包</span><input value={form.packages} onChange={(event) => setForm({ ...form, packages: event.target.value })} /></label>
    <label>普通环境变量 <span>每行 KEY=value；不接受 Token、密码或其他秘密</span><textarea className="code-textarea" rows={5} value={form.variables} onChange={(event) => setForm({ ...form, variables: event.target.value })} placeholder={"NODE_ENV=production\nLOG_LEVEL=info"} /></label>
    <div className="security-note"><LockKeyhole size={18} /><div><strong>权限和秘密都不属于 Environment</strong><p>文件系统、网络和资源上限由 Sandbox/Policy 实施；模型密钥由管理员 Endpoint 托管，MCP/Skill 凭证引用租户 Vault。</p></div></div>
  </Modal>;
}

export function EnvironmentDetailPage() {
  const { id = "" } = useParams();
  const [item, setItem] = useState<Environment>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", packages: "", variables: "" });
  const load = useCallback(() => Promise.all([api.get<Environment>("environments", id), api.list<Session>("sessions")]).then(([environment, result]) => {
    setItem(environment); setSessions(result.items.filter((session) => session.environmentId === id));
    setForm({ name: environment.name, description: environment.description, packages: environment.packages.join(", "), variables: serializeVariables(environment.variables) });
  }).catch((reason: Error) => setError(reason.message)), [id]);
  useEffect(() => { void load(); }, [load]);
  if (error && !item) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!item) return <Loading />;
  const save = async () => { try { await api.patch("environments", id, { name: form.name, description: form.description, packages: form.packages.split(",").map((value) => value.trim()).filter(Boolean), variables: parseVariables(form.variables) }); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  return <div className="page"><div className="detail-hero"><Link className="back-link" to="/environments">Environments</Link><ChevronRight size={15} /><span>{item.name}</span><div className="detail-actions"><button className="button primary" onClick={() => setOpen(true)}>编辑配置</button></div></div>{error && <ErrorBanner error={error} />}
    <section className="identity-card"><span className="resource-icon large blue"><Box size={24} /></span><div><h1>{item.name}</h1><p>{item.description || "暂无描述"}</p><small>{item.id} · 更新于 {new Date(item.updatedAt).toLocaleString()}</small></div></section>
    <div className="detail-grid"><section className="panel detail-panel"><h3>配置</h3><dl className="kv-list"><div><dt>预装包</dt><dd>{item.packages.join(" · ") || "未配置"}</dd></div><div><dt>环境变量</dt><dd>{item.variables.map((value) => value.key).join(" · ") || "未配置"}</dd></div><div><dt>执行边界</dt><dd>平台托管 Sandbox Policy</dd></div><div><dt>网络</dt><dd>命令容器默认普通出网；可在高级 API 设为 deny</dd></div></dl></section><section className="panel detail-panel"><h3>关联 Session · {sessions.length}</h3>{sessions.length ? <div className="table-wrap"><table><thead><tr><th>Session</th><th>状态</th><th>Agent 版本</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><Link to={`/sessions/${session.id}`}>{session.name}</Link><small>{session.id}</small></td><td><Status value={session.status} /></td><td>V{session.agentVersion ?? 1}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无关联 Session" description="创建 Session 时选择此 Environment。" />}</section></div>
    <EnvironmentModal open={open} form={form} setForm={setForm} onClose={() => setOpen(false)} onSave={() => void save()} title="编辑 Environment" />
  </div>;
}

export function VaultsPage() {
  const [items, setItems] = useState<Vault[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => Promise.all([api.list<Vault>("vaults"), api.list<Credential>("credentials")]).then(([vaults, creds]) => { setItems(vaults.items); setCredentials(creds.items); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { try { await api.create("vaults", { name, description: "Encrypted credential collection" }); setName(""); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Credentials Vault" description="Vault 是当前租户共享的凭证池，供 MCP Server 与 Skill ENV 按名称引用；不会无条件注入所有 Session。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Vault</button>} />{error && <ErrorBanner error={error} />}<div className="vault-banner"><Shield size={22} /><div><strong>Tenant-scoped pool · AES-256-GCM · proxy-only resolution</strong><p>Agent Version 保存非秘密引用，代理层在 MCP/Skill 调用时动态解密；明文不进入模型上下文或 Sandbox。</p></div><CheckCircle2 size={18} /></div><section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="card-grid">{filtered.map((item) => <Link className="vault-card" to={`/vaults/${item.id}`} key={item.id}><div className="vault-card-head"><span className="resource-icon amber"><KeyRound size={17} /></span><ChevronRight size={16} /></div><h3>{item.name}</h3><p>{item.description || "集中托管凭证"}</p><small>{item.id}</small><div className="vault-card-foot"><span><ServerCog size={14} />{credentials.filter((value) => value.vaultId === item.id).length} Credentials</span><span>{new Date(item.updatedAt).toLocaleDateString()}</span></div></Link>)}</div> : <EmptyState title="暂无 Vault" description="创建 Vault 后再添加 MCP 或 Skill Credential。" />}</section><Modal title="创建 Vault" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!name}>创建 Vault</button></>}><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：production-credentials" /></label><div className="security-note"><LockKeyhole size={18} /><div><strong>共享目录不等于共享明文</strong><p>租户内 Agent 可以选择 Credential 名称；只有实际 MCP/Skill binding 的代理层能解密和代发。</p></div></div></Modal></div>;
}

export function VaultDetailPage() {
  const { id = "" } = useParams();
  const [vault, setVault] = useState<Vault>();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [open, setOpen] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", serverUrl: "", mcpServerName: "", usage: "mcp" as "mcp" | "generic", authType: "bearer" as Credential["authType"], secret: "", clientId: "", clientSecret: "", tokenUrl: "", scopeText: "" });
  const load = useCallback(() => Promise.all([api.get<Vault>("vaults", id), api.list<Credential>("credentials")]).then(([nextVault, result]) => { setVault(nextVault); setCredentials(result.items.filter((item) => item.vaultId === id)); }).catch((reason: Error) => setError(reason.message)), [id]);
  useEffect(() => { void load(); }, [load]);
  const credentialPayload = () => ({
    name: form.name, description: form.description, serverUrl: form.serverUrl, usage: form.usage,
    mcpServerName: form.mcpServerName, authType: form.authType, secret: form.secret,
    vaultId: id, mcpServerId: form.mcpServerName.toLowerCase().replace(/\s+/g, "-"),
    ...(form.authType === "oauth" ? {
      tokenUrl: form.tokenUrl, clientId: form.clientId, clientSecret: form.clientSecret,
      scopes: form.scopeText.split(/\s+/).filter(Boolean)
    } : {})
  });
  const validate = async () => { setValidating(true); setError(""); try { const result = await api.validateCredential(credentialPayload()); setValidated(result.valid); if (!result.valid) setError("MCP Server 未通过校验"); } catch (reason) { setValidated(false); setError(reason instanceof Error ? reason.message : String(reason)); } finally { setValidating(false); } };
  const create = async () => { try { await api.create("credentials", { ...credentialPayload(), validated }); setOpen(false); setValidated(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const remove = async (credentialId: string) => { try { await api.remove("credentials", credentialId); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  if (error && !vault) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!vault) return <Loading />;
  return <div className="page"><div className="detail-hero"><Link className="back-link" to="/vaults">Credentials Vault</Link><ChevronRight size={15} /><span>{vault.name}</span><div className="detail-actions"><button className="button primary" onClick={() => setOpen(true)}><Plus size={15} />添加 Credential</button></div></div>{error && <ErrorBanner error={error} />}<section className="identity-card"><span className="resource-icon large amber"><KeyRound size={24} /></span><div><h1>{vault.name}</h1><p>{vault.description || "集中托管凭证"}</p><small>{vault.id} · 更新于 {new Date(vault.updatedAt).toLocaleString()}</small></div></section><section className="panel resource-detail-table">{credentials.length ? <div className="table-wrap"><table><thead><tr><th>名称 / ID</th><th>用途</th><th>Endpoint URL</th><th>鉴权方式</th><th>校验状态</th><th>更新时间</th><th /></tr></thead><tbody>{credentials.map((credential) => <tr key={credential.id}><td><span className="resource-link"><span className="resource-icon amber"><KeyRound size={15} /></span><span><strong>{credential.name}</strong><small>{credential.id}</small></span></span></td><td>{credential.usage ?? "mcp"}</td><td><code>{credential.serverUrl}</code></td><td>{credential.authType}</td><td><span className={`spec-status ${credential.validationStatus === "valid" ? "implemented" : "reference"}`}>{credential.validationStatus ?? "unvalidated"}</span></td><td>{new Date(credential.updatedAt).toLocaleString()}</td><td><button className="icon-button danger" onClick={() => void remove(credential.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Credential" description="创建 MCP 或 Skill Credential，并在对应 binding 中引用。" />}</section>
    <Modal title="创建 Credential" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button secondary" disabled={!form.serverUrl || validating} onClick={() => void validate()}>{validating ? "校验中…" : validated ? "已校验" : "校验"}</button><button className="button primary" disabled={!form.name || !form.serverUrl || !validated} onClick={() => void create()}>创建</button></>}>
      <div className="security-note"><LockKeyhole size={18} /><div><strong>保存后明文不可再次查看</strong><p>Vault 在租户内可发现，但只有 MCP/Skill binding 的代理层能使用；模型 Provider 密钥由管理员在平台管理中配置。</p></div></div>
      <div className="mode-toggle credential-auth"><button className={form.usage === "mcp" ? "active" : ""} onClick={() => { setForm({ ...form, usage: "mcp" }); setValidated(false); }}>MCP</button><button className={form.usage === "generic" ? "active" : ""} onClick={() => { setForm({ ...form, usage: "generic" }); setValidated(false); }}>Skill / 通用</button></div>
      <label>名称<input value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setValidated(false); }} placeholder="例如：github-production" /></label>
      <label>MCP Server / Skill 名称<input value={form.mcpServerName} onChange={(event) => { setForm({ ...form, mcpServerName: event.target.value }); setValidated(false); }} /></label>
      <label>MCP Server URL<input value={form.serverUrl} onChange={(event) => { setForm({ ...form, serverUrl: event.target.value }); setValidated(false); }} placeholder="https://mcp.example.com/mcp" /></label>
      <div className="mode-toggle credential-auth"><button className={form.authType === "bearer" ? "active" : ""} onClick={() => { setForm({ ...form, authType: "bearer" }); setValidated(false); }}>Bearer Token</button><button className={form.authType === "oauth" ? "active" : ""} onClick={() => { setForm({ ...form, authType: "oauth" }); setValidated(false); }}>OAuth</button></div>
      <label>{form.authType === "bearer" ? "Token" : "Access token（可选）"}<input type="password" value={form.secret} onChange={(event) => { setForm({ ...form, secret: event.target.value }); setValidated(false); }} /></label>
      {form.authType === "oauth" && <><label>Token URL<input value={form.tokenUrl} onChange={(event) => { setForm({ ...form, tokenUrl: event.target.value }); setValidated(false); }} placeholder="https://auth.example.com/oauth/token" /></label><div className="form-grid two"><label>Client ID<input value={form.clientId} onChange={(event) => { setForm({ ...form, clientId: event.target.value }); setValidated(false); }} /></label><label>Client secret<input type="password" value={form.clientSecret} onChange={(event) => { setForm({ ...form, clientSecret: event.target.value }); setValidated(false); }} /></label></div><label>Scopes（空格分隔）<input value={form.scopeText} onChange={(event) => { setForm({ ...form, scopeText: event.target.value }); setValidated(false); }} placeholder="mcp.read mcp.execute" /></label></>}
    </Modal>
  </div>;
}

export function MemoryPage() {
  const [items, setItems] = useState<MemoryStore[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", content: "" });
  const load = useCallback(() => Promise.all([api.list<MemoryStore>("memory-stores"), api.list<Session>("sessions")]).then(([result, sessionResult]) => { setItems(result.items); setSessions(sessionResult.items); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { try { await api.create("memory-stores", form); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Memory Stores" description="为 Agent 提供跨 Session 的显式长期记忆；当前不会从 Session 自动抽取。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Memory Store</button>} />{error && <ErrorBanner error={error} />}<div className="security-note memory-policy-note"><Brain size={18} /><div><strong>写入策略：explicit</strong><p>只有人类/API 的显式新增、编辑和删除会改变 Memory；Session compact 与长期 Memory 是两种不同机制。</p></div></div><section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="table-wrap"><table><thead><tr><th>名称 / ID</th><th>描述</th><th>关联 Session</th><th>Memory 数量</th><th>存储用量</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><Link className="resource-link" to={`/memory/${item.id}`}><span className="resource-icon green"><Brain size={16} /></span><span><strong>{item.name}</strong><small>{item.id}</small></span></Link></td><td>{item.description || <span className="muted">暂无描述</span>}</td><td>{sessions.filter((session) => session.memoryStoreIds.includes(item.id)).length}</td><td>{item.memories.length}</td><td>{item.memories.reduce((sum, memory) => sum + new Blob([memory.content]).size, 0)} B</td><td><Link className="icon-button" to={`/memory/${item.id}`}><ChevronRight size={17} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Memory Store" description="把跨任务稳定知识放进 Memory，而不是压缩覆盖 Session 事件。" />}</section><Modal title="创建 Memory Store" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!form.name}>创建</button></>}><label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>描述<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Agent 应在什么情况下查询这组记忆" /></label><label>添加首条 Memory<textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="可留空，稍后再添加" /></label></Modal></div>;
}

export function MemoryDetailPage() {
  const { id = "" } = useParams();
  const [store, setStore] = useState<MemoryStore>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry>();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", content: "", tags: "" });
  const load = useCallback(() => Promise.all([api.get<MemoryStore>("memory-stores", id), api.list<Session>("sessions")]).then(([nextStore, result]) => { setStore(nextStore); setSessions(result.items.filter((session) => session.memoryStoreIds.includes(id))); }).catch((reason: Error) => setError(reason.message)), [id]);
  useEffect(() => { void load(); }, [load]);
  const showCreate = () => { setEditing(undefined); setForm({ title: "", content: "", tags: "" }); setOpen(true); };
  const showEdit = (memory: MemoryEntry) => { setEditing(memory); setForm({ title: memory.title, content: memory.content, tags: memory.tags.join(", ") }); setOpen(true); };
  const save = async () => { try { const body = { title: form.title, content: form.content, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean) }; if (editing) await api.updateMemory(id, editing.id, body); else await api.addMemory(id, body); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const remove = async (memoryId: string) => { try { await api.removeMemory(id, memoryId); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const bytes = useMemo(() => store?.memories.reduce((sum, memory) => sum + new Blob([memory.content]).size, 0) ?? 0, [store]);
  if (error && !store) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!store) return <Loading />;
  return <div className="page"><div className="detail-hero"><Link className="back-link" to="/memory">Memory</Link><ChevronRight size={15} /><span>{store.name}</span><div className="detail-actions"><button className="button primary" onClick={showCreate}><Plus size={15} />添加 Memory</button></div></div>{error && <ErrorBanner error={error} />}<section className="identity-card"><span className="resource-icon large green"><Brain size={24} /></span><div><h1>{store.name}</h1><p>{store.description || "暂无描述"}</p><small>{store.id} · {store.memories.length} Memories · {bytes} B · {sessions.length} Sessions</small></div></section><div className="memory-grid">{store.memories.map((memory) => <article className="panel memory-card" key={memory.id}><header><div><h3>{memory.title}</h3><small>{memory.id}</small></div><button className="icon-button danger" onClick={() => void remove(memory.id)}><Trash2 size={14} /></button></header><p>{memory.content}</p><footer><div className="tag-row">{memory.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button className="button secondary" onClick={() => showEdit(memory)}>编辑</button></footer></article>)}</div>{store.memories.length === 0 && <section className="panel"><EmptyState title="暂无 Memory" description="添加可被多个 Session 显式绑定的长期知识。" /></section>}
    <Modal title={editing ? "编辑 Memory" : "添加 Memory"} open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" disabled={!form.title || !form.content} onClick={() => void save()}>保存</button></>}><label>标题<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>内容<textarea rows={9} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label><label>标签 <span>逗号分隔</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label></Modal>
  </div>;
}
