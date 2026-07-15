import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Agent,
  InteractionJob,
  ManagedResource,
  ResourceKind,
  Session,
  SessionEvent,
  SessionEventType
} from "@snowmountain/contracts";
import { createId } from "./ids.js";

const prefixByKind: Record<ResourceKind, string> = {
  agent: "agent",
  environment: "env",
  vault: "vlt",
  credential: "cred",
  "memory-store": "memstore",
  session: "sesn",
  "api-key": "ak",
  "model-endpoint": "mdl-endpoint",
  "runtime-profile": "runtime"
};

interface ResourceRow {
  data: string;
}

interface EventRow {
  id: string;
  session_id: string;
  sequence: number;
  type: SessionEventType;
  payload: string;
  created_at: string;
}

interface InteractionJobRow {
  id: string;
  session_id: string;
  content: string;
  status: InteractionJob["status"];
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function interactionJob(row: InteractionJobRow): InteractionJob {
  return {
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    status: row.status,
    attempts: row.attempts,
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface AuthSessionRow {
  token_hash: string;
  username: string;
  role: "admin" | "user";
  tenant_id: string;
  csrf_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  role: "admin" | "user";
  tenant_id: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  method: string;
  status_code: number;
  ip: string;
  request_id: string;
  created_at: string;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        owner_id TEXT NOT NULL DEFAULT 'system',
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS resources_kind_updated
        ON resources(kind, updated_at DESC);
      CREATE TABLE IF NOT EXISTS agent_versions (
        agent_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(agent_id, version)
      );
      CREATE TABLE IF NOT EXISTS session_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(session_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS session_events_sequence
        ON session_events(session_id, sequence);
      CREATE TABLE IF NOT EXISTS interaction_jobs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS interaction_jobs_status_created
        ON interaction_jobs(status, created_at ASC);
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        tenant_id TEXT NOT NULL DEFAULT 'system',
        csrf_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS users_tenant ON users(tenant_id, username);
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        ip TEXT NOT NULL,
        request_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_events_created ON audit_events(created_at DESC);
    `);
    const resourceColumns = new Set((this.db.prepare("PRAGMA table_info(resources)").all() as Array<{ name: string }>).map((column) => column.name));
    if (!resourceColumns.has("tenant_id")) this.db.exec("ALTER TABLE resources ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'");
    if (!resourceColumns.has("owner_id")) this.db.exec("ALTER TABLE resources ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'system'");
    const sessionColumns = new Set((this.db.prepare("PRAGMA table_info(auth_sessions)").all() as Array<{ name: string }>).map((column) => column.name));
    if (!sessionColumns.has("role")) this.db.exec("ALTER TABLE auth_sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
    if (!sessionColumns.has("tenant_id")) this.db.exec("ALTER TABLE auth_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'system'");
    this.db.exec("CREATE INDEX IF NOT EXISTS resources_tenant_kind_updated ON resources(tenant_id, kind, updated_at DESC)");
  }

  close(): void {
    this.db.close();
  }

  count(kind?: ResourceKind, tenantId?: string): number {
    if (kind && tenantId) {
      const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources WHERE kind = ? AND tenant_id = ?").get(kind, tenantId) as { count: number };
      return row.count;
    }
    if (kind) {
      const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources WHERE kind = ?").get(kind) as { count: number };
      return row.count;
    }
    if (tenantId) {
      const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources WHERE tenant_id = ?").get(tenantId) as { count: number };
      return row.count;
    }
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources").get() as { count: number };
    return row.count;
  }

  list<T extends ManagedResource>(kind: ResourceKind, tenantId?: string): T[] {
    const rows = tenantId
      ? this.db.prepare("SELECT data FROM resources WHERE kind = ? AND tenant_id = ? ORDER BY updated_at DESC").all(kind, tenantId) as unknown as ResourceRow[]
      : this.db.prepare("SELECT data FROM resources WHERE kind = ? ORDER BY updated_at DESC").all(kind) as unknown as ResourceRow[];
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  get<T extends ManagedResource>(id: string, tenantId?: string): T | undefined {
    const row = tenantId
      ? this.db.prepare("SELECT data FROM resources WHERE id = ? AND tenant_id = ?").get(id, tenantId) as ResourceRow | undefined
      : this.db.prepare("SELECT data FROM resources WHERE id = ?").get(id) as ResourceRow | undefined;
    return row ? JSON.parse(row.data) as T : undefined;
  }

  create<T extends ManagedResource>(kind: ResourceKind, input: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): T {
    const now = new Date().toISOString();
    const id = input.id ?? createId(prefixByKind[kind]);
    const tenantId = input.tenantId ?? (kind === "model-endpoint" || kind === "runtime-profile" ? "system" : "default");
    const ownerId = input.ownerId ?? "system";
    const data = { ...input, id, tenantId, ownerId, createdAt: now, updatedAt: now } as T;
    this.db.prepare(
      "INSERT INTO resources(id, kind, name, tenant_id, owner_id, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, kind, data.name, tenantId, ownerId, JSON.stringify(data), now, now);
    if (kind === "agent") this.saveAgentVersion(data as unknown as Agent);
    return data;
  }

  update<T extends ManagedResource>(id: string, patch: Partial<T>, options: { versionAgent?: boolean } = {}): T {
    const current = this.get<T>(id);
    if (!current) throw new Error(`Resource not found: ${id}`);
    const now = new Date().toISOString();
    const next = {
      ...current,
      ...patch,
      id: current.id,
      kind: current.kind,
      createdAt: current.createdAt,
      updatedAt: now
    } as T;
    if (current.kind === "agent" && options.versionAgent) {
      (next as unknown as Agent).version = (current as unknown as Agent).version + 1;
    }
    this.db.prepare("UPDATE resources SET name = ?, tenant_id = ?, owner_id = ?, data = ?, updated_at = ? WHERE id = ?")
      .run(next.name, next.tenantId ?? "default", next.ownerId ?? "system", JSON.stringify(next), now, id);
    if (current.kind === "agent" && options.versionAgent) this.saveAgentVersion(next as unknown as Agent);
    return next;
  }

  delete(id: string): boolean {
    const resource = this.get(id);
    if (resource?.kind === "session") {
      this.db.prepare("DELETE FROM session_events WHERE session_id = ?").run(id);
      this.db.prepare("DELETE FROM interaction_jobs WHERE session_id = ?").run(id);
    }
    if (resource?.kind === "agent") {
      this.db.prepare("DELETE FROM agent_versions WHERE agent_id = ?").run(id);
    }
    const result = this.db.prepare("DELETE FROM resources WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  saveAgentVersion(agent: Agent): void {
    this.db.prepare(
      "INSERT OR REPLACE INTO agent_versions(agent_id, version, data, created_at) VALUES(?, ?, ?, ?)"
    ).run(agent.id, agent.version, JSON.stringify(agent), new Date().toISOString());
  }

  listAgentVersions(agentId: string): Agent[] {
    const rows = this.db.prepare(
      "SELECT data FROM agent_versions WHERE agent_id = ? ORDER BY version DESC"
    ).all(agentId) as unknown as ResourceRow[];
    return rows.map((row) => JSON.parse(row.data) as Agent);
  }

  getAgentVersion(agentId: string, version: number): Agent | undefined {
    const row = this.db.prepare(
      "SELECT data FROM agent_versions WHERE agent_id = ? AND version = ?"
    ).get(agentId, version) as ResourceRow | undefined;
    return row ? JSON.parse(row.data) as Agent : undefined;
  }

  appendEvent<T>(sessionId: string, type: SessionEventType, payload: T): SessionEvent<T> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare(
        "SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM session_events WHERE session_id = ?"
      ).get(sessionId) as { next: number };
      const event: SessionEvent<T> = {
        id: createId("sevt"),
        sessionId,
        sequence: row.next,
        type,
        payload,
        createdAt: new Date().toISOString()
      };
      this.db.prepare(
        "INSERT INTO session_events(id, session_id, sequence, type, payload, created_at) VALUES(?, ?, ?, ?, ?, ?)"
      ).run(event.id, sessionId, event.sequence, type, JSON.stringify(payload), event.createdAt);
      this.db.exec("COMMIT");
      return event;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  events<T = unknown>(sessionId: string, after = 0, limit = 500): SessionEvent<T>[] {
    const rows = this.db.prepare(`
      SELECT id, session_id, sequence, type, payload, created_at
      FROM session_events
      WHERE session_id = ? AND sequence > ?
      ORDER BY sequence ASC
      LIMIT ?
    `).all(sessionId, after, limit) as unknown as EventRow[];
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      sequence: row.sequence,
      type: row.type,
      payload: JSON.parse(row.payload) as T,
      createdAt: row.created_at
    }));
  }

  recoverInterruptedSessions(): string[] {
    const interrupted = this.list<Session>("session")
      .filter((session) => session.status === "running" || session.status === "waiting_approval");
    for (const session of interrupted) {
      const message = "Execution was interrupted by a control-plane restart; the Session can be retried safely.";
      this.update<Session>(session.id, { status: "failed", lastError: message, pendingApproval: undefined });
      this.appendEvent(session.id, "error", { message, reason: "control_plane_restart" });
      this.appendEvent(session.id, "status", {
        status: "failed",
        threadStatus: "failed",
        stopReason: { type: "control_plane_restart" }
      });
    }
    return interrupted.map((session) => session.id);
  }

  enqueueInteraction(sessionId: string, content: string): InteractionJob {
    const now = new Date().toISOString();
    const job: InteractionJob = {
      id: createId("job"), sessionId, content, status: "queued", attempts: 0,
      createdAt: now, updatedAt: now
    };
    this.db.prepare("INSERT INTO interaction_jobs(id, session_id, content, status, attempts, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)")
      .run(job.id, sessionId, content, job.status, job.attempts, now, now);
    this.update<Session>(sessionId, { status: "queued", lastError: "", pendingApproval: undefined });
    this.appendEvent(sessionId, "status", { status: "queued", threadStatus: "queued", jobId: job.id });
    return job;
  }

  getInteractionJob(id: string): InteractionJob | undefined {
    const row = this.db.prepare("SELECT * FROM interaction_jobs WHERE id = ?").get(id) as unknown as InteractionJobRow | undefined;
    return row ? interactionJob(row) : undefined;
  }

  claimNextInteraction(excludedSessionIds: Set<string>): InteractionJob | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const rows = this.db.prepare("SELECT * FROM interaction_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 100")
        .all() as unknown as InteractionJobRow[];
      const row = rows.find((candidate) => !excludedSessionIds.has(candidate.session_id));
      if (!row) {
        this.db.exec("COMMIT");
        return undefined;
      }
      const now = new Date().toISOString();
      this.db.prepare("UPDATE interaction_jobs SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ? AND status = 'queued'")
        .run(now, row.id);
      this.db.exec("COMMIT");
      return this.getInteractionJob(row.id);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  finishInteractionJob(id: string, status: "completed" | "failed", error?: string): InteractionJob | undefined {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE interaction_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?")
      .run(status, error ?? null, now, id);
    return this.getInteractionJob(id);
  }

  cancelQueuedInteraction(sessionId: string): boolean {
    const row = this.db.prepare("SELECT * FROM interaction_jobs WHERE session_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1")
      .get(sessionId) as unknown as InteractionJobRow | undefined;
    if (!row) return false;
    this.finishInteractionJob(row.id, "failed", "Cancelled before execution");
    this.update<Session>(sessionId, { status: "stopped", stoppedAt: new Date().toISOString() });
    this.appendEvent(sessionId, "status", { status: "stopped", threadStatus: "stopped", stopReason: { type: "user_stop" }, jobId: row.id });
    return true;
  }

  recoverInterruptedJobs(): string[] {
    const rows = this.db.prepare("SELECT * FROM interaction_jobs WHERE status = 'running'").all() as unknown as InteractionJobRow[];
    for (const row of rows) this.finishInteractionJob(row.id, "failed", "Interrupted by control-plane restart; submit a retry explicitly");
    return rows.map((row) => row.id);
  }

  createAuthSession(tokenHash: string, username: string, role: "admin" | "user", tenantId: string, csrfHash: string, expiresAt: string): AuthSessionRow {
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO auth_sessions(token_hash, username, role, tenant_id, csrf_hash, expires_at, created_at, last_seen_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)")
      .run(tokenHash, username, role, tenantId, csrfHash, expiresAt, now, now);
    return { token_hash: tokenHash, username, role, tenant_id: tenantId, csrf_hash: csrfHash, expires_at: expiresAt, created_at: now, last_seen_at: now };
  }

  getAuthSession(tokenHash: string): AuthSessionRow | undefined {
    const row = this.db.prepare("SELECT * FROM auth_sessions WHERE token_hash = ?").get(tokenHash) as unknown as AuthSessionRow | undefined;
    if (!row) return undefined;
    if (Date.parse(row.expires_at) <= Date.now()) {
      this.deleteAuthSession(tokenHash);
      return undefined;
    }
    this.db.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash);
    return row;
  }

  deleteAuthSession(tokenHash: string): boolean {
    return Number(this.db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash).changes) > 0;
  }

  pruneAuthSessions(): void {
    this.db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(new Date().toISOString());
  }

  createUser(input: Omit<UserRow, "created_at" | "updated_at" | "enabled"> & { enabled?: number }): UserRow {
    const now = new Date().toISOString();
    const row: UserRow = { ...input, enabled: input.enabled ?? 1, created_at: now, updated_at: now };
    this.db.prepare("INSERT INTO users(id, username, password_salt, password_hash, role, tenant_id, enabled, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(row.id, row.username, row.password_salt, row.password_hash, row.role, row.tenant_id, row.enabled, now, now);
    return row;
  }

  getUserByUsername(username: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as unknown as UserRow | undefined;
  }

  listUsers(): UserRow[] {
    return this.db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as unknown as UserRow[];
  }

  setUserEnabled(id: string, enabled: boolean): boolean {
    return Number(this.db.prepare("UPDATE users SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, new Date().toISOString(), id).changes) > 0;
  }

  appendAudit(input: Omit<AuditRow, "id" | "created_at">): AuditRow {
    const row: AuditRow = { id: createId("audit"), created_at: new Date().toISOString(), ...input };
    this.db.prepare("INSERT INTO audit_events(id, actor, action, target, method, status_code, ip, request_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(row.id, row.actor, row.action, row.target, row.method, row.status_code, row.ip, row.request_id, row.created_at);
    return row;
  }

  listAudit(limit = 200): AuditRow[] {
    return this.db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?").all(Math.min(Math.max(limit, 1), 1000)) as unknown as AuditRow[];
  }
}
