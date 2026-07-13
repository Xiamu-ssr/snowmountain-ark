import { resolve } from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  Agent,
  Credential,
  DependencyEdge,
  Environment,
  ManagedResource,
  MarketEntry,
  MemoryStore,
  ResourceKind,
  Session,
  Vault
} from "@snowmountain/contracts";
import { defaultToolPolicies } from "@snowmountain/contracts";
import { config } from "./config.js";
import { Store } from "./db.js";
import { Harness } from "./harness.js";
import { createId } from "./ids.js";
import { Sandbox } from "./sandbox.js";
import { sealSecret } from "./vault.js";

export interface AppOptions {
  databasePath?: string;
  dataDir?: string;
  logger?: boolean;
  seed?: boolean;
}

const baseInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().default("")
});

const toolNames = ["bash", "read", "write", "edit", "glob", "grep", "web_fetch", "web_search"] as const;

function sanitize(resource: ManagedResource): ManagedResource {
  if (resource.kind !== "credential") return resource;
  return { ...resource, secretCiphertext: "••••••••" };
}

function dependencyEdges(store: Store): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const agent of store.list<Agent>("agent")) {
    edges.push({ source: agent.id, target: `model:${agent.model.name}`, relation: "uses-model" });
    for (const id of agent.skillIds) edges.push({ source: agent.id, target: id, relation: "uses-skill" });
    for (const id of agent.mcpIds) edges.push({ source: agent.id, target: id, relation: "uses-mcp" });
    for (const id of agent.subAgentIds) edges.push({ source: agent.id, target: id, relation: "delegates-to" });
  }
  for (const session of store.list<Session>("session")) {
    edges.push({ source: session.id, target: session.agentId, relation: "runs-agent" });
    edges.push({ source: session.id, target: session.environmentId, relation: "binds-environment" });
    for (const id of session.memoryStoreIds) edges.push({ source: session.id, target: id, relation: "reads-memory" });
  }
  for (const credential of store.list<Credential>("credential")) {
    edges.push({ source: credential.id, target: credential.vaultId, relation: "stored-in" });
  }
  return edges;
}

function seedStore(store: Store): void {
  if (store.count() > 0) return;
  const environment = store.create<Environment>("environment", {
    id: "env-default",
    kind: "environment",
    name: "Default isolated workspace",
    description: "Session-scoped /workspace with network denied by default.",
    packages: ["git", "nodejs", "ripgrep"],
    variables: [],
    networkAllowlist: [],
    filesystemMode: "read-write-no-delete"
  });
  const memory = store.create<MemoryStore>("memory-store", {
    id: "memstore-product-principles",
    kind: "memory-store",
    name: "Product principles",
    description: "Cross-session project principles stored separately from the event log.",
    memories: [{
      id: "mem-brain-hands-session",
      title: "Brain, hands, session",
      content: "Keep the harness, execution targets, and append-only session log independently replaceable.",
      tags: ["architecture"],
      createdAt: new Date().toISOString()
    }]
  });
  const agent = store.create<Agent>("agent", {
    id: "agent-snowmountain-guide",
    kind: "agent",
    name: "雪山向导",
    description: "A managed agent that can inspect and edit its isolated workspace.",
    version: 1,
    baseAgent: "Snowmountain-Managed-Agent-Preview-20260713",
    model: { provider: "mock", name: "deterministic-local-harness" },
    systemPrompt: "You are 雪山向导. Work only inside /workspace and report evidence from tools.",
    skillIds: [],
    mcpIds: [],
    subAgentIds: [],
    toolPolicies: { ...defaultToolPolicies, bash: "full", read: "workspace", write: "workspace" },
    tags: ["demo", "managed-agent"]
  });
  const session = store.create<Session>("session", {
    id: "sesn-snowmountain-demo",
    kind: "session",
    name: "雪山向导 · Demo Session",
    description: "A durable session with an append-only event log.",
    agentId: agent.id,
    environmentId: environment.id,
    memoryStoreIds: [memory.id],
    status: "idle",
    inputTokens: 0,
    outputTokens: 0,
    workspacePath: "/workspace"
  });
  store.appendEvent(session.id, "status", { status: "idle", content: "Session initialized" });
  store.create<Vault>("vault", {
    id: "vlt-default",
    kind: "vault",
    name: "Default vault",
    description: "Credentials are encrypted and only resolved by the proxy layer."
  });
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(cors, { origin: true });
  const store = new Store(options.databasePath ?? resolve(config.dataDir, "snowmountain.db"));
  if (options.seed ?? true) seedStore(store);
  const sandbox = new Sandbox({ dataDir: options.dataDir ?? config.dataDir, driver: config.sandboxDriver, image: config.sandboxImage });
  const harness = new Harness(store, sandbox);
  app.addHook("onClose", () => store.close());

  app.get("/health", async () => ({ status: "ok", resources: store.count(), sandbox: config.sandboxDriver }));

  const listRoutes: Array<{ path: string; kind: ResourceKind }> = [
    { path: "agents", kind: "agent" },
    { path: "environments", kind: "environment" },
    { path: "vaults", kind: "vault" },
    { path: "credentials", kind: "credential" },
    { path: "memory-stores", kind: "memory-store" },
    { path: "sessions", kind: "session" }
  ];
  for (const route of listRoutes) {
    app.get(`/v1/${route.path}`, async () => ({ items: store.list(route.kind).map(sanitize) }));
    app.get<{ Params: { id: string } }>(`/v1/${route.path}/:id`, async (request, reply) => {
      const resource = store.get(request.params.id);
      if (!resource || resource.kind !== route.kind) return reply.code(404).send({ error: "not_found" });
      return sanitize(resource);
    });
    app.delete<{ Params: { id: string } }>(`/v1/${route.path}/:id`, async (request, reply) => {
      const dependents = dependencyEdges(store).filter((edge) => edge.target === request.params.id);
      if (dependents.length) return reply.code(409).send({ error: "resource_in_use", dependents });
      return { deleted: store.delete(request.params.id) };
    });
  }

  app.post("/v1/agents", async (request, reply) => {
    const parsed = baseInput.extend({
      model: z.object({ provider: z.enum(["mock", "openai-compatible"]), name: z.string(), baseUrl: z.string().url().optional() }).optional(),
      systemPrompt: z.string().max(10_000).optional(),
      tags: z.array(z.string()).max(20).optional(),
      skillIds: z.array(z.string()).optional(),
      mcpIds: z.array(z.string()).optional(),
      subAgentIds: z.array(z.string()).optional(),
      toolPolicies: z.record(z.enum(toolNames), z.enum(["full", "workspace", "approval", "deny"])).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<Agent>("agent", {
      kind: "agent",
      name: parsed.data.name,
      description: parsed.data.description,
      version: 1,
      baseAgent: "Snowmountain-Managed-Agent-Preview-20260713",
      model: parsed.data.model
        ? { provider: parsed.data.model.provider, name: parsed.data.model.name, ...(parsed.data.model.baseUrl ? { baseUrl: parsed.data.model.baseUrl } : {}) }
        : { provider: "mock", name: "deterministic-local-harness" },
      systemPrompt: parsed.data.systemPrompt ?? "Work inside /workspace and cite tool evidence.",
      skillIds: parsed.data.skillIds ?? [], mcpIds: parsed.data.mcpIds ?? [], subAgentIds: parsed.data.subAgentIds ?? [],
      toolPolicies: { ...defaultToolPolicies, ...parsed.data.toolPolicies },
      tags: parsed.data.tags ?? []
    }));
  });

  app.patch<{ Params: { id: string } }>("/v1/agents/:id", async (request, reply) => {
    const agent = store.get<Agent>(request.params.id);
    if (!agent) return reply.code(404).send({ error: "not_found" });
    const patch = z.object({
      name: z.string().min(1).optional(), description: z.string().optional(),
      systemPrompt: z.string().max(10_000).optional(), tags: z.array(z.string()).max(20).optional(),
      skillIds: z.array(z.string()).optional(), mcpIds: z.array(z.string()).optional(), subAgentIds: z.array(z.string()).optional(),
      toolPolicies: z.record(z.enum(toolNames), z.enum(["full", "workspace", "approval", "deny"])).optional()
    }).safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: patch.error.flatten() });
    const cleanPatch = Object.fromEntries(Object.entries(patch.data).filter(([, value]) => value !== undefined)) as Partial<Agent>;
    return store.update<Agent>(agent.id, cleanPatch, { versionAgent: true });
  });

  app.get<{ Params: { id: string } }>("/v1/agents/:id/versions", async (request) => ({ items: store.listAgentVersions(request.params.id) }));

  app.post("/v1/environments", async (request, reply) => {
    const parsed = baseInput.extend({
      packages: z.array(z.string()).optional(),
      variables: z.array(z.object({ key: z.string(), value: z.string(), secret: z.boolean() })).optional(),
      networkAllowlist: z.array(z.string()).optional(),
      filesystemMode: z.enum(["read-only", "read-write", "read-write-no-delete"]).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<Environment>("environment", {
      kind: "environment", name: parsed.data.name, description: parsed.data.description,
      packages: parsed.data.packages ?? [], variables: parsed.data.variables ?? [],
      networkAllowlist: parsed.data.networkAllowlist ?? [], filesystemMode: parsed.data.filesystemMode ?? "read-write-no-delete"
    }));
  });

  app.post("/v1/vaults", async (request, reply) => {
    const parsed = baseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<Vault>("vault", { kind: "vault", ...parsed.data }));
  });

  app.post("/v1/credentials", async (request, reply) => {
    const parsed = baseInput.extend({
      vaultId: z.string(), serverUrl: z.string().url(), authType: z.enum(["bearer", "oauth"]), secret: z.string().min(1)
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!store.get<Vault>(parsed.data.vaultId)) return reply.code(400).send({ error: "vault_not_found" });
    const credential = store.create<Credential>("credential", {
      kind: "credential", name: parsed.data.name, description: parsed.data.description,
      vaultId: parsed.data.vaultId, serverUrl: parsed.data.serverUrl, authType: parsed.data.authType,
      secretCiphertext: sealSecret(parsed.data.secret), lastValidatedAt: new Date().toISOString()
    });
    return reply.code(201).send(sanitize(credential));
  });

  app.post("/v1/memory-stores", async (request, reply) => {
    const parsed = baseInput.extend({ content: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<MemoryStore>("memory-store", {
      kind: "memory-store", name: parsed.data.name, description: parsed.data.description,
      memories: parsed.data.content ? [{ id: createId("mem"), title: parsed.data.name, content: parsed.data.content, tags: [], createdAt: new Date().toISOString() }] : []
    }));
  });

  app.post("/v1/sessions", async (request, reply) => {
    const parsed = baseInput.extend({
      agentId: z.string(), environmentId: z.string(), memoryStoreIds: z.array(z.string()).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!store.get<Agent>(parsed.data.agentId) || !store.get<Environment>(parsed.data.environmentId)) {
      return reply.code(400).send({ error: "missing_agent_or_environment" });
    }
    const session = store.create<Session>("session", {
      kind: "session", name: parsed.data.name, description: parsed.data.description,
      agentId: parsed.data.agentId, environmentId: parsed.data.environmentId,
      memoryStoreIds: parsed.data.memoryStoreIds ?? [], status: "idle", inputTokens: 0, outputTokens: 0,
      workspacePath: "/workspace"
    });
    await sandbox.provision(session.id);
    store.appendEvent(session.id, "status", { status: "idle", content: "Session initialized" });
    return reply.code(201).send(session);
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/sessions/:id/events", async (request, reply) => {
    if (!store.get<Session>(request.params.id)) return reply.code(404).send({ error: "not_found" });
    return { items: store.events(request.params.id, Number(request.query.after ?? 0)) };
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/interactions", async (request, reply) => {
    const parsed = z.object({ content: z.string().min(1), wait: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const session = store.get<Session>(request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    if (session.status === "running") return reply.code(409).send({ error: "session_running" });
    const run = harness.run(session.id, parsed.data.content);
    if (parsed.data.wait) {
      await run;
      return { accepted: true, status: store.get<Session>(session.id)?.status };
    }
    void run.catch((error) => app.log.error(error));
    return reply.code(202).send({ accepted: true, sessionId: session.id });
  });

  app.get("/v1/dependencies", async () => ({ edges: dependencyEdges(store) }));

  app.get("/v1/market/catalog", async () => {
    try {
      const response = await fetch(config.marketIndexUrl, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error(`Market returned ${response.status}`);
      return await response.json() as { items: MarketEntry[] };
    } catch {
      return { items: [] as MarketEntry[], offline: true, source: config.marketIndexUrl };
    }
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/sandbox/inspect", async (request, reply) => {
    if (!store.get<Session>(request.params.id)) return reply.code(404).send({ error: "not_found" });
    return sandbox.inspect(request.params.id);
  });

  return app;
}
