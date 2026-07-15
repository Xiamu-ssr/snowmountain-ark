import { CheckCircle2, Copy, Cpu, KeyRound, Plus, ServerCog, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ApiKey, AuditEvent, ModelEndpoint, RuntimeProfile, UserAccount } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, Modal, PageHeader } from "../components/UI";

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [endpoints, setEndpoints] = useState<Array<ModelEndpoint & { credentialConfigured?: boolean }>>([]);
  const [runtimes, setRuntimes] = useState<RuntimeProfile[]>([]);
  const [keyOpen, setKeyOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [endpointName, setEndpointName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelDisplayName, setModelDisplayName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => Promise.all([
    api.settings(), api.list<ApiKey>("api-keys"), api.audit(), api.adminUsers(), api.adminModelEndpoints(), api.adminRuntimeProfiles()
  ]).then(([nextSettings, nextKeys, nextAudit, nextUsers, nextEndpoints, nextRuntimes]) => {
    setSettings(nextSettings); setKeys(nextKeys.items); setAudit(nextAudit.items); setUsers(nextUsers.items); setEndpoints(nextEndpoints.items); setRuntimes(nextRuntimes.items);
  }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);

  const createKey = async () => {
    try {
      const created = await api.create<ApiKey & { secret: string }>("api-keys", { name, description: "Session API access" });
      setSecret(created.secret); setKeyOpen(false); setName(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const createUser = async () => {
    try {
      await api.createAdminUser({ username, password, tenantId });
      setUserOpen(false); setUsername(""); setPassword(""); setTenantId(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const createEndpoint = async () => {
    try {
      await api.createModelEndpoint({
        name: endpointName, description: `${modelDisplayName} 的平台模型服务`, provider: "openai-compatible", baseUrl, apiKey,
        models: [{ name: modelName, displayName: modelDisplayName, description: "由平台管理员发布给 Managed Agents 用户。", modalities: ["text"] }]
      });
      setModelOpen(false); setEndpointName(""); setBaseUrl(""); setApiKey(""); setModelName(""); setModelDisplayName(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const removeKey = async (id: string) => {
    try { await api.remove("api-keys", id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className="page">
    <PageHeader title="平台管理" description="管理员配置模型服务、Base Agent Runtime、租户账号、API 接入与审计；普通用户只看到 Managed Agents 业务资源。" action={<div className="toolbar-actions"><button className="button secondary" onClick={() => setUserOpen(true)}><UserRoundCog size={16} />创建用户</button><button className="button primary" onClick={() => setModelOpen(true)}><Plus size={16} />添加模型 Endpoint</button></div>} />
    {error && <ErrorBanner error={error} />}
    <div className="settings-grid">
      <section className="panel detail-panel"><h3><ServerCog size={17} />控制面</h3><dl className="kv-list">
        <div><dt>数据隔离</dt><dd>{String(settings.mode ?? "-")}</dd></div>
        <div><dt>Sandbox driver</dt><dd>{String(settings.sandboxDriver ?? "-")}</dd></div>
        <div><dt>命令容器网络默认值</dt><dd>{String(settings.commandNetworkDefault ?? "-")}</dd></div>
        <div><dt>Agent Runtime</dt><dd>{String(settings.agentRuntime ?? "-")}</dd></div>
        <div><dt>Event store</dt><dd>{String(settings.eventStore ?? "-")}</dd></div>
      </dl></section>
      <section className="panel detail-panel"><h3><ShieldCheck size={17} />安全边界</h3><div className="security-checks">
        <span className={settings.vaultMasterKeyConfigured ? "ok" : "warn"}><CheckCircle2 size={16} />Vault master key {settings.vaultMasterKeyConfigured ? "已配置" : "使用开发默认值"}</span>
        <span className="ok"><CheckCircle2 size={16} />模型密钥只保存在平台 Endpoint，不下发用户或 Sandbox</span>
        <small>{String(settings.networkScope ?? "-")}</small>
      </div></section>
    </div>

    <section className="panel admin-section"><header><div><h3>模型目录</h3><p>普通用户选择管理员发布的模型；Provider URL 与 API Key 不出现在 Agent 创建页。</p></div></header>
      <div className="card-grid">{endpoints.map((endpoint) => <article className="vault-card" key={endpoint.id}><div className="vault-card-head"><span className="resource-icon blue"><Cpu size={17} /></span><span className={`spec-status ${endpoint.enabled ? "verified" : "deprecated"}`}>{endpoint.enabled ? "已发布" : "已停用"}</span></div><h3>{endpoint.name}</h3><p>{endpoint.description}</p><small>{endpoint.provider} · {endpoint.baseUrl ?? "local"}</small><div className="vault-card-foot"><span>{endpoint.models.length} models</span><span>{endpoint.credentialConfigured ? "凭证已配置" : endpoint.provider === "mock" ? "无需凭证" : "缺少凭证"}</span></div></article>)}</div>
    </section>

    <section className="panel admin-section"><header><div><h3>Base Agent Runtime</h3><p>Base Agent 是可版本化 Harness Profile，不是 LLM；它决定循环、恢复、Tool/MCP 路由与上下文策略。</p></div></header>
      <div className="table-wrap"><table><thead><tr><th>Runtime</th><th>Engine</th><th>版本</th><th>能力</th><th>状态</th></tr></thead><tbody>{runtimes.map((runtime) => <tr key={runtime.id}><td><strong>{runtime.name}</strong><small className="block-id">{runtime.id}</small></td><td>{runtime.engine}</td><td>{runtime.version}</td><td>{runtime.capabilities.join(" · ")}</td><td>{runtime.default ? "默认" : runtime.enabled ? "可用" : "停用"}</td></tr>)}</tbody></table></div>
    </section>

    <section className="panel admin-section"><header><div><h3>用户与租户</h3><p>每个普通用户归属一个 tenantId；Agent、Session、Environment、Vault 和 Memory 的 API 读写均按租户过滤。</p></div></header>
      {users.length ? <div className="table-wrap"><table><thead><tr><th>账号</th><th>角色</th><th>Tenant</th><th>状态</th><th>创建时间</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.username}</strong></td><td>{user.role}</td><td><code>{user.tenantId}</code></td><td>{user.enabled ? "启用" : "停用"}</td><td>{new Date(user.createdAt).toLocaleString()}</td><td><button className="button secondary" onClick={() => void api.setAdminUserEnabled(user.id, !user.enabled).then(load)}>{user.enabled ? "停用" : "启用"}</button></td></tr>)}</tbody></table></div> : <EmptyState title="暂无普通用户" description="管理员仍可运维 default tenant；创建用户后即可验证租户隔离。" />}
    </section>

    <section className="panel settings-keys"><header><div><h3>中台 API Keys</h3><p>用于调用 Managed Session API；Secret 只显示一次。</p></div><button className="button secondary" onClick={() => setKeyOpen(true)}><Plus size={15} />创建 API Key</button></header>
      {keys.length ? <div className="table-wrap"><table><thead><tr><th>名称</th><th>Prefix</th><th>Tenant</th><th>创建时间</th><th /></tr></thead><tbody>{keys.map((key) => <tr key={key.id}><td><strong>{key.name}</strong></td><td><code>{key.keyPrefix}…</code></td><td><code>{key.tenantId ?? "default"}</code></td><td>{new Date(key.createdAt).toLocaleString()}</td><td><button className="icon-button danger" aria-label={`删除 ${key.name}`} onClick={() => void removeKey(key.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="暂无 API Key" description="创建后即可从服务端调用 Session。" />}
    </section>

    <section className="panel settings-keys"><header><div><h3>操作审计</h3><p>只记录身份、目标、方法和结果，不记录密码、Token、Prompt 或 Credential 明文。</p></div></header>{audit.length ? <div className="table-wrap"><table><thead><tr><th>时间</th><th>Actor</th><th>Action</th><th>状态</th><th>IP</th></tr></thead><tbody>{audit.map((event) => <tr key={event.id}><td>{new Date(event.createdAt).toLocaleString()}</td><td><code>{event.actor}</code></td><td>{event.action}</td><td>{event.statusCode}</td><td><code>{event.ip}</code></td></tr>)}</tbody></table></div> : <EmptyState title="暂无审计事件" description="登录和后续写操作会出现在这里。" />}</section>

    <Modal title="创建 API Key" open={keyOpen} onClose={() => setKeyOpen(false)} footer={<><button className="button secondary" onClick={() => setKeyOpen(false)}>取消</button><button className="button primary" disabled={!name.trim()} onClick={() => void createKey()}>创建</button></>}><label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label></Modal>
    <Modal title="创建普通用户" open={userOpen} onClose={() => setUserOpen(false)} footer={<><button className="button secondary" onClick={() => setUserOpen(false)}>取消</button><button className="button primary" disabled={!username || password.length < 12 || !tenantId} onClick={() => void createUser()}>创建</button></>}><label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>初始密码 <span>至少 12 位</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Tenant ID<input value={tenantId} onChange={(event) => setTenantId(event.target.value.toLowerCase())} placeholder="例如 xiamu" /></label></Modal>
    <Modal title="添加模型 Endpoint" open={modelOpen} onClose={() => setModelOpen(false)} footer={<><button className="button secondary" onClick={() => setModelOpen(false)}>取消</button><button className="button primary" disabled={!endpointName || !baseUrl || !modelName || !modelDisplayName} onClick={() => void createEndpoint()}>发布模型</button></>}><label>Endpoint 名称<input value={endpointName} onChange={(event) => setEndpointName(event.target.value)} placeholder="例如 ZenMux" /></label><label>OpenAI-compatible Base URL<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/v1" /></label><label>平台 API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label><div className="form-grid two"><label>模型 ID<input value={modelName} onChange={(event) => setModelName(event.target.value)} /></label><label>显示名称<input value={modelDisplayName} onChange={(event) => setModelDisplayName(event.target.value)} /></label></div></Modal>
    <Modal title="保存 API Key" open={Boolean(secret)} onClose={() => setSecret("")} footer={<button className="button primary" onClick={() => setSecret("")}>我已保存</button>}><div className="one-time-secret"><p>请立即保存，关闭后无法再次查看。</p><code>{secret}</code><button className="button secondary" onClick={() => void navigator.clipboard.writeText(secret)}><Copy size={15} />复制</button></div></Modal>
  </div>;
}
