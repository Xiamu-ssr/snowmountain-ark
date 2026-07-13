import {
  Box, Brain, CheckCircle2, Database, GitBranch, KeyRound, LockKeyhole,
  PackagePlus, Plus, ServerCog, Shield, Trash2
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Environment, MemoryStore, Vault } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Modal, PageHeader, Toolbar } from "../components/UI";

export function EnvironmentsPage() {
  const [items, setItems] = useState<Environment[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", packages: "git, nodejs, ripgrep", allowlist: "" });
  const load = useCallback(() => api.list<Environment>("environments").then((result) => setItems(result.items)).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { try { await api.create("environments", { name: form.name, description: form.description, packages: form.packages.split(",").map((item) => item.trim()).filter(Boolean), variables: [], networkAllowlist: form.allowlist.split(",").map((item) => item.trim()).filter(Boolean), filesystemMode: "read-write-no-delete" }); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Environments" description="定义可复用的运行环境模板；计算实例可以替换，Session 工作区与事件不会随容器丢失。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Environment</button>} />{error && <ErrorBanner error={error} />}<section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="table-wrap"><table><thead><tr><th>名称 / ID</th><th>预装包</th><th>文件系统</th><th>网络能力</th><th>创建时间</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className="resource-link"><span className="resource-icon blue"><Box size={16} /></span><span><strong>{item.name}</strong><small>{item.id}</small></span></span></td><td><div className="tag-row">{item.packages.slice(0,3).map((value) => <span key={value}>{value}</span>)}{item.packages.length > 3 && <span>+{item.packages.length - 3}</span>}</div></td><td>{item.filesystemMode}</td><td>{item.networkAllowlist.length ? item.networkAllowlist.join(", ") : <span className="safe-text"><Shield size={14} />默认拒绝</span>}</td><td className="muted">{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Environment" description="创建可复用的包、变量与能力边界模板。" />}</section>
    <Modal title="创建 Environment" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" disabled={!form.name} onClick={() => void create()}>创建</button></>}><label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：Node.js 研究环境" /></label><label>描述<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>预装包 <span>逗号分隔</span><input value={form.packages} onChange={(event) => setForm({ ...form, packages: event.target.value })} /></label><label>网络域名能力 <span>默认不联网</span><input value={form.allowlist} onChange={(event) => setForm({ ...form, allowlist: event.target.value })} placeholder="api.example.com, github.com" /></label><div className="security-note"><LockKeyhole size={18} /><div><strong>秘密不会成为环境变量</strong><p>需要认证的 MCP 与外部工具只引用 Credentials Vault。</p></div></div></Modal>
  </div>;
}

export function VaultsPage() {
  const [items, setItems] = useState<Vault[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => api.list<Vault>("vaults").then((result) => setItems(result.items)).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { try { await api.create("vaults", { name, description: "Encrypted credential collection" }); setName(""); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Credentials Vault" description="MCP 与 Skill 只引用凭证名称；代理层动态注入，明文不进入模型上下文或 Sandbox。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Vault</button>} />{error && <ErrorBanner error={error} />}<div className="vault-banner"><Shield size={22} /><div><strong>AES-256-GCM at rest · proxy-only resolution</strong><p>生产环境必须配置独立 VAULT_MASTER_KEY，并接入云 KMS/HSM 轮换。</p></div><CheckCircle2 size={18} /></div><section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="card-grid">{filtered.map((item) => <article className="vault-card" key={item.id}><div className="vault-card-head"><span className="resource-icon amber"><KeyRound size={17} /></span><button className="icon-button"><Trash2 size={15} /></button></div><h3>{item.name}</h3><p>{item.description || "集中托管凭证"}</p><small>{item.id}</small><div className="vault-card-foot"><span><ServerCog size={14} />0 Credentials</span><span>{new Date(item.updatedAt).toLocaleDateString()}</span></div></article>)}</div> : <EmptyState title="暂无 Vault" description="创建 Vault 后再为 MCP Server 添加 Bearer 或 OAuth Credential。" />}</section><Modal title="创建 Vault" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!name}>创建 Vault</button></>}><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：production-mcp" /></label><div className="security-note"><LockKeyhole size={18} /><div><strong>保存后明文不可回读</strong><p>修改 Credential 时必须重新填写并校验。</p></div></div></Modal></div>;
}

export function MemoryPage() {
  const [items, setItems] = useState<MemoryStore[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", content: "" });
  const load = useCallback(() => api.list<MemoryStore>("memory-stores").then((result) => setItems(result.items)).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { try { await api.create("memory-stores", form); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const filtered = items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Memory Stores" description="为 Agent 提供跨 Session 的显式长期记忆；完整事实历史仍保存在每个 Session 的事件日志中。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 Memory Store</button>} />{error && <ErrorBanner error={error} />}<section className="panel"><Toolbar search={search} onSearch={setSearch} />{filtered.length ? <div className="table-wrap"><table><thead><tr><th>名称 / ID</th><th>描述</th><th>Memory 数量</th><th>估算存储</th><th>更新时间</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className="resource-link"><span className="resource-icon green"><Brain size={16} /></span><span><strong>{item.name}</strong><small>{item.id}</small></span></span></td><td>{item.description || <span className="muted">暂无描述</span>}</td><td>{item.memories.length}</td><td>{item.memories.reduce((sum, memory) => sum + memory.content.length, 0)} B</td><td className="muted">{new Date(item.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无 Memory Store" description="把跨任务稳定知识放进 Memory，而不是压缩覆盖 Session 事件。" />}</section><Modal title="创建 Memory Store" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" onClick={() => void create()} disabled={!form.name}>创建</button></>}><label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>描述<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Agent 应在什么情况下查询这组记忆" /></label><label>添加首条 Memory<textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="可留空，稍后再添加" /></label></Modal></div>;
}
