import type { AuditEvent, AuthStatus, ManagedResource, MarketEntry, MonitoringSummary, SessionEvent, SpecBundle } from "@snowmountain/contracts";

const configured = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = configured?.replace(/\/$/, "") ?? "";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init.body !== null;
  const csrfCookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("sm_ark_csrf="));
  const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.slice("sm_ark_csrf=".length)) : "";
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 && !path.startsWith("/v1/auth/")) window.dispatchEvent(new Event("snowmountain-auth-expired"));
    throw new Error(body || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  authStatus(): Promise<AuthStatus> {
    return request("/v1/auth/status");
  },
  login(username: string, password: string): Promise<AuthStatus> {
    return request("/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  },
  logout(): Promise<{ authenticated: boolean }> {
    return request("/v1/auth/logout", { method: "POST" });
  },
  audit(): Promise<{ items: AuditEvent[] }> {
    return request("/v1/audit");
  },
  list<T extends ManagedResource>(path: string): Promise<{ items: T[] }> {
    return request(`/v1/${path}`);
  },
  get<T extends ManagedResource>(path: string, id: string): Promise<T> {
    return request(`/v1/${path}/${id}`);
  },
  agentVersions(agentId: string): Promise<{ items: ManagedResource[] }> {
    return request(`/v1/agents/${agentId}/versions`);
  },
  create<T>(path: string, body: unknown): Promise<T> {
    return request(`/v1/${path}`, { method: "POST", body: JSON.stringify(body) });
  },
  patch<T>(path: string, id: string, body: unknown): Promise<T> {
    return request(`/v1/${path}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  remove(path: string, id: string): Promise<{ deleted: boolean }> {
    return request(`/v1/${path}/${id}`, { method: "DELETE" });
  },
  events(sessionId: string, after = 0): Promise<{ items: SessionEvent[] }> {
    return request(`/v1/sessions/${sessionId}/events?after=${after}`);
  },
  interact(sessionId: string, content: string): Promise<{ accepted: boolean }> {
    return request(`/v1/sessions/${sessionId}/interactions`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  },
  approve(sessionId: string, approvalId: string, allowed: boolean): Promise<{ resolved: boolean }> {
    return request(`/v1/sessions/${sessionId}/approvals/${approvalId}`, { method: "POST", body: JSON.stringify({ allowed }) });
  },
  stop(sessionId: string): Promise<{ stopped: boolean }> {
    return request(`/v1/sessions/${sessionId}/stop`, { method: "POST" });
  },
  validateCredential(body: { serverUrl: string; authType: "bearer" | "oauth"; secret?: string; tokenUrl?: string; clientId?: string; clientSecret?: string; scopes?: string[] }): Promise<{ valid: boolean; status?: number; checkedAt?: string }> {
    return request("/v1/credentials/validate", { method: "POST", body: JSON.stringify(body) });
  },
  addMemory<T>(storeId: string, body: unknown): Promise<T> {
    return request(`/v1/memory-stores/${storeId}/memories`, { method: "POST", body: JSON.stringify(body) });
  },
  updateMemory<T>(storeId: string, memoryId: string, body: unknown): Promise<T> {
    return request(`/v1/memory-stores/${storeId}/memories/${memoryId}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  removeMemory(storeId: string, memoryId: string): Promise<{ deleted: boolean }> {
    return request(`/v1/memory-stores/${storeId}/memories/${memoryId}`, { method: "DELETE" });
  },
  monitoring(agentId?: string): Promise<MonitoringSummary> {
    return request(`/v1/monitoring/summary${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`);
  },
  settings(): Promise<Record<string, unknown>> {
    return request("/v1/settings");
  },
  specs(): Promise<SpecBundle> {
    return request("/v1/specs");
  },
  eventStreamUrl(sessionId: string, after = 0): string {
    return `${API_BASE}/v1/sessions/${sessionId}/events/stream?after=${after}`;
  },
  market(): Promise<{ items: MarketEntry[]; offline?: boolean; source?: string; endpoint?: string; reason?: string }> {
    return request("/v1/market/catalog");
  },
  dependencies(): Promise<{ edges: Array<{ source: string; target: string; relation: string }> }> {
    return request("/v1/dependencies");
  }
};
