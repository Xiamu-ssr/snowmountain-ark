import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Agent,
  ManagedResource,
  ResourceKind,
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
  session: "sesn"
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
    `);
  }

  close(): void {
    this.db.close();
  }

  count(kind?: ResourceKind): number {
    if (kind) {
      const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources WHERE kind = ?").get(kind) as { count: number };
      return row.count;
    }
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM resources").get() as { count: number };
    return row.count;
  }

  list<T extends ManagedResource>(kind: ResourceKind): T[] {
    const rows = this.db.prepare(
      "SELECT data FROM resources WHERE kind = ? ORDER BY updated_at DESC"
    ).all(kind) as unknown as ResourceRow[];
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  get<T extends ManagedResource>(id: string): T | undefined {
    const row = this.db.prepare("SELECT data FROM resources WHERE id = ?").get(id) as ResourceRow | undefined;
    return row ? JSON.parse(row.data) as T : undefined;
  }

  create<T extends ManagedResource>(kind: ResourceKind, input: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): T {
    const now = new Date().toISOString();
    const id = input.id ?? createId(prefixByKind[kind]);
    const data = { ...input, id, createdAt: now, updatedAt: now } as T;
    this.db.prepare(
      "INSERT INTO resources(id, kind, name, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)"
    ).run(id, kind, data.name, JSON.stringify(data), now, now);
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
    this.db.prepare("UPDATE resources SET name = ?, data = ?, updated_at = ? WHERE id = ?")
      .run(next.name, JSON.stringify(next), now, id);
    if (current.kind === "agent" && options.versionAgent) this.saveAgentVersion(next as unknown as Agent);
    return next;
  }

  delete(id: string): boolean {
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
}
