import type { ManagedResource, MarketEntry, SessionEvent } from "@snowmountain/contracts";

const configured = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = configured?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  list<T extends ManagedResource>(path: string): Promise<{ items: T[] }> {
    return request(`/v1/${path}`);
  },
  get<T extends ManagedResource>(path: string, id: string): Promise<T> {
    return request(`/v1/${path}/${id}`);
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
  market(): Promise<{ items: MarketEntry[]; offline?: boolean; source?: string }> {
    return request("/v1/market/catalog");
  },
  dependencies(): Promise<{ edges: Array<{ source: string; target: string; relation: string }> }> {
    return request("/v1/dependencies");
  }
};
