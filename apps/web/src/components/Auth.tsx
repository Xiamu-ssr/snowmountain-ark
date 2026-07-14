import { LockKeyhole, MountainSnow } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AuthStatus } from "@snowmountain/contracts";
import { api } from "../api";

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>();
  const [error, setError] = useState("");
  useEffect(() => {
    void api.authStatus().then(setStatus).catch((reason: Error) => setError(reason.message));
    const expired = () => setStatus((current) => current ? { ...current, authenticated: false } : { enabled: true, authenticated: false });
    window.addEventListener("snowmountain-auth-expired", expired);
    return () => window.removeEventListener("snowmountain-auth-expired", expired);
  }, []);
  if (!status) return <div className="auth-loading"><MountainSnow size={28} /><span>{error || "正在连接雪山方舟…"}</span></div>;
  if (status.enabled && !status.authenticated) return <LoginPage onLogin={setStatus} />;
  return children;
}

function LoginPage({ onLogin }: { onLogin(status: AuthStatus): void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      onLogin(await api.login(username, password));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message.includes("login_rate_limited") ? "登录尝试过多，请稍后再试。" : "用户名或密码不正确。");
    } finally {
      setBusy(false);
    }
  };
  return <main className="login-page"><section className="login-card"><div className="login-mark"><MountainSnow size={28} /></div><span className="eyebrow">SNOWMOUNTAIN MANAGED AGENTS</span><h1>登录雪山方舟</h1><p>进入 Agent、Session、Sandbox、Vault 与 Memory 控制面。</p>{error && <div className="login-error">{error}</div>}<label>账号<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>密码<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></label><button className="button primary login-submit" disabled={busy || !username || !password} onClick={() => void submit()}>{busy ? "登录中…" : "登录"}</button><footer><LockKeyhole size={14} />HttpOnly Session · SameSite Strict · CSRF Protected</footer></section></main>;
}
