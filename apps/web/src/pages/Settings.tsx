import { CheckCircle2, Copy, KeyRound, Plus, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ApiKey, AuditEvent } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Modal, PageHeader } from "../components/UI";

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => Promise.all([api.settings(), api.list<ApiKey>("api-keys"), api.audit()])
    .then(([nextSettings, nextKeys, nextAudit]) => { setSettings(nextSettings); setKeys(nextKeys.items); setAudit(nextAudit.items); })
    .catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    try {
      const created = await api.create<ApiKey & { secret: string }>("api-keys", { name, description: "Session API access" });
      setSecret(created.secret); setOpen(false); setName(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const remove = async (id: string) => {
    try { await api.remove("api-keys", id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className="page">
    <PageHeader title="系统设置" description="配置运行时、外部 API 接入与单租户控制面。凭证值不会在这里回显。" action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={16} />创建 API Key</button>} />
    {error && <ErrorBanner error={error} />}
    <div className="settings-grid">
      <section className="panel detail-panel"><h3><ServerCog size={17} />运行时</h3><dl className="kv-list">
        <div><dt>Sandbox driver</dt><dd>{String(settings.sandboxDriver ?? "-")}</dd></div>
        <div><dt>Sandbox image</dt><dd>{String(settings.sandboxImage ?? "-")}</dd></div>
        <div><dt>Event store</dt><dd>{String(settings.eventStore ?? "-")}</dd></div>
        <div><dt>Node runtime</dt><dd>{String(settings.runtime ?? "-")}</dd></div>
      </dl></section>
      <section className="panel detail-panel"><h3><ShieldCheck size={17} />安全配置</h3><div className="security-checks">
        <span className={settings.vaultMasterKeyConfigured ? "ok" : "warn"}><CheckCircle2 size={16} />Vault master key {settings.vaultMasterKeyConfigured ? "已配置" : "使用开发默认值"}</span>
        <span className={settings.modelCredentialConfigured ? "ok" : "neutral"}><CheckCircle2 size={16} />模型凭证 {settings.modelCredentialConfigured ? "已配置" : "尚未配置"}</span>
        <small>Market: {String(settings.marketIndexUrl ?? "-")}</small>
      </div></section>
    </div>
    <section className="panel settings-keys"><header><div><h3>API Keys</h3><p>用于把 Managed Session 作为中台 API 调用。Secret 只在创建后显示一次。</p></div></header>
      {keys.length ? <div className="table-wrap"><table><thead><tr><th>名称</th><th>Prefix</th><th>创建时间</th><th>最后使用</th><th /></tr></thead><tbody>{keys.map((key) => <tr key={key.id}><td><span className="resource-link"><span className="resource-icon amber"><KeyRound size={16} /></span><span><strong>{key.name}</strong><small>{key.id}</small></span></span></td><td><code>{key.keyPrefix}…</code></td><td>{new Date(key.createdAt).toLocaleString()}</td><td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "尚未使用"}</td><td><button className="icon-button danger" aria-label={`删除 ${key.name}`} onClick={() => void remove(key.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="暂无 API Key" description="创建后即可从服务端调用 Session 交互与事件接口。" />}
    </section>
    <section className="panel settings-keys"><header><div><h3>操作审计</h3><p>只记录身份、目标、方法和结果，不记录密码、Token、Prompt 或 Credential 明文。</p></div></header>{audit.length ? <div className="table-wrap"><table><thead><tr><th>时间</th><th>Actor</th><th>Action</th><th>状态</th><th>IP</th><th>Request ID</th></tr></thead><tbody>{audit.map((event) => <tr key={event.id}><td>{new Date(event.createdAt).toLocaleString()}</td><td><code>{event.actor}</code></td><td>{event.action}</td><td><span className={`spec-status ${event.statusCode < 400 ? "implemented" : "reference"}`}>{event.statusCode}</span></td><td><code>{event.ip}</code></td><td><code>{event.requestId}</code></td></tr>)}</tbody></table></div> : <EmptyState title="暂无审计事件" description="登录和后续写操作会出现在这里。" />}</section>
    <Modal title="创建 API Key" open={open} onClose={() => setOpen(false)} footer={<><button className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button primary" disabled={!name.trim()} onClick={() => void create()}>创建</button></>}><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：production-backend" /></label><div className="security-note"><KeyRound size={18} /><div><strong>Secret 只显示一次</strong><p>服务端仅保存 SHA-256 摘要，无法恢复原值。</p></div></div></Modal>
    <Modal title="保存 API Key" open={Boolean(secret)} onClose={() => setSecret("")} footer={<button className="button primary" onClick={() => setSecret("")}>我已保存</button>}><div className="one-time-secret"><p>请立即保存，关闭后无法再次查看。</p><code>{secret}</code><button className="button secondary" onClick={() => void navigator.clipboard.writeText(secret)}><Copy size={15} />复制</button></div></Modal>
  </div>;
}
