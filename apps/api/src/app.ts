import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  Agent,
  ApiKey,
  Credential,
  DependencyEdge,
  Environment,
  ManagedResource,
  MarketEntry,
  MemoryStore,
  MonitoringSummary,
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

const modelInput = z.object({
  provider: z.enum(["mock", "openai-compatible"]),
  name: z.string().min(1),
  baseUrl: z.string().url().optional(),
  endpointId: z.string().optional(),
  displayName: z.string().optional(),
  contextWindow: z.number().int().positive().optional(),
  inputPricePerK: z.number().min(0).optional(),
  cachedInputPricePerK: z.number().min(0).optional(),
  outputPricePerK: z.number().min(0).optional(),
  rpm: z.number().int().positive().optional(),
  tpm: z.number().int().positive().optional()
});

const mcpBindingInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  permission: z.enum(["full", "approval", "deny"]),
  credentialId: z.string().optional(),
  source: z.enum(["preset", "manual", "market"]),
  description: z.string().optional()
});

const defaultResourceConfig = { cpu: 1, memoryMiB: 512, maxRuntimeSeconds: 3600, networkMode: "deny" as const };

function sanitize(resource: ManagedResource): ManagedResource {
  if (resource.kind === "session") {
    const session = resource;
    resource = {
      ...session,
      cacheReadTokens: session.cacheReadTokens ?? 0,
      cacheWriteTokens: session.cacheWriteTokens ?? 0,
      agentVersion: session.agentVersion ?? 1,
      resourceConfig: session.resourceConfig ?? defaultResourceConfig
    };
  }
  if (resource.kind === "agent") resource = { ...resource, mcpServers: resource.mcpServers ?? [] };
  if (resource.kind === "environment") {
    resource = { ...resource, variables: resource.variables.map((variable) => variable.secret ? { ...variable, value: "••••••••" } : variable) };
  }
  if (resource.kind === "credential") {
    return { ...resource, secretCiphertext: "••••••••", clientSecretCiphertext: resource.clientSecretCiphertext ? "••••••••" : undefined };
  }
  if (resource.kind === "api-key") return { ...resource, keyHash: "••••••••" };
  return resource;
}

function dependencyEdges(store: Store): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const agent of store.list<Agent>("agent")) {
    edges.push({ source: agent.id, target: `model:${agent.model.name}`, relation: "uses-model" });
    for (const id of agent.skillIds) edges.push({ source: agent.id, target: id, relation: "uses-skill" });
    for (const id of agent.mcpIds) edges.push({ source: agent.id, target: id, relation: "uses-mcp" });
    for (const binding of agent.mcpServers ?? []) {
      edges.push({ source: agent.id, target: `mcp:${binding.id}`, relation: "uses-mcp-server" });
      if (binding.credentialId) edges.push({ source: `mcp:${binding.id}`, target: binding.credentialId, relation: "uses-credential" });
    }
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
    agentVersion: agent.version,
    environmentId: environment.id,
    memoryStoreIds: [memory.id],
    status: "idle",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    workspacePath: "/workspace",
    resourceConfig: defaultResourceConfig
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

  const requireApiKey = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authorization = request.headers.authorization ?? "";
    const secret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const keyHash = createHash("sha256").update(secret).digest("hex");
    const apiKey = store.list<ApiKey>("api-key").find((item) => item.keyHash === keyHash && !item.revokedAt);
    if (!apiKey) {
      await reply.code(401).send({ error: "invalid_api_key" });
      return;
    }
    store.update<ApiKey>(apiKey.id, { lastUsedAt: new Date().toISOString() });
  };

  app.get("/health", async () => ({ status: "ok", resources: store.count(), sandbox: config.sandboxDriver }));

  app.post("/v1/api-keys", async (request, reply) => {
    const parsed = baseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const secret = `smak_${randomBytes(24).toString("base64url")}`;
    const apiKey = store.create<ApiKey>("api-key", {
      kind: "api-key",
      name: parsed.data.name,
      description: parsed.data.description,
      keyPrefix: secret.slice(0, 12),
      keyHash: createHash("sha256").update(secret).digest("hex")
    });
    return reply.code(201).send({ ...sanitize(apiKey), secret });
  });

  const listRoutes: Array<{ path: string; kind: ResourceKind }> = [
    { path: "agents", kind: "agent" },
    { path: "environments", kind: "environment" },
    { path: "vaults", kind: "vault" },
    { path: "credentials", kind: "credential" },
    { path: "memory-stores", kind: "memory-store" },
    { path: "sessions", kind: "session" },
    { path: "api-keys", kind: "api-key" }
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
      const resource = store.get(request.params.id);
      if (resource?.kind === "session") {
        harness.stop(resource.id);
        await sandbox.destroy(resource.id);
      }
      return { deleted: store.delete(request.params.id) };
    });
  }

  app.post("/v1/agents", async (request, reply) => {
    const parsed = baseInput.extend({
      model: modelInput.optional(),
      systemPrompt: z.string().max(10_000).optional(),
      tags: z.array(z.string()).max(20).optional(),
      skillIds: z.array(z.string()).optional(),
      mcpIds: z.array(z.string()).optional(),
      mcpServers: z.array(mcpBindingInput).max(20).optional(),
      subAgentIds: z.array(z.string()).max(20).optional(),
      toolPolicies: z.record(z.enum(toolNames), z.enum(["full", "workspace", "approval", "deny"])).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const nestedSubAgent = (parsed.data.subAgentIds ?? [])
      .map((id) => store.get<Agent>(id))
      .find((candidate) => candidate && candidate.subAgentIds.length > 0);
    if (nestedSubAgent) return reply.code(400).send({ error: "nested_multi_agent_not_allowed", agentId: nestedSubAgent.id });
    const missingCredential = (parsed.data.mcpServers ?? []).find((binding) => binding.credentialId && !store.get<Credential>(binding.credentialId));
    if (missingCredential) return reply.code(400).send({ error: "credential_not_found", credentialId: missingCredential.credentialId });
    return reply.code(201).send(store.create<Agent>("agent", {
      kind: "agent",
      name: parsed.data.name,
      description: parsed.data.description,
      version: 1,
      baseAgent: "Snowmountain-Managed-Agent-Preview-20260713",
      model: parsed.data.model ?? { provider: "mock", name: "deterministic-local-harness" },
      systemPrompt: parsed.data.systemPrompt ?? "Work inside /workspace and cite tool evidence.",
      skillIds: parsed.data.skillIds ?? [], mcpIds: parsed.data.mcpIds ?? [], mcpServers: parsed.data.mcpServers ?? [], subAgentIds: parsed.data.subAgentIds ?? [],
      subAgentVersions: Object.fromEntries((parsed.data.subAgentIds ?? []).map((id) => [id, store.get<Agent>(id)?.version]).filter((entry): entry is [string, number] => typeof entry[1] === "number")),
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
      model: modelInput.optional(), baseAgent: z.string().optional(),
      skillIds: z.array(z.string()).optional(), mcpIds: z.array(z.string()).optional(), mcpServers: z.array(mcpBindingInput).max(20).optional(), subAgentIds: z.array(z.string()).max(20).optional(),
      toolPolicies: z.record(z.enum(toolNames), z.enum(["full", "workspace", "approval", "deny"])).optional()
    }).safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: patch.error.flatten() });
    if (patch.data.subAgentIds?.includes(agent.id)) return reply.code(400).send({ error: "agent_cannot_delegate_to_itself" });
    const nestedSubAgent = (patch.data.subAgentIds ?? [])
      .map((id) => store.get<Agent>(id))
      .find((candidate) => candidate && candidate.subAgentIds.length > 0);
    if (nestedSubAgent) return reply.code(400).send({ error: "nested_multi_agent_not_allowed", agentId: nestedSubAgent.id });
    const cleanPatch = Object.fromEntries(Object.entries(patch.data).filter(([, value]) => value !== undefined)) as Partial<Agent>;
    if (patch.data.subAgentIds) cleanPatch.subAgentVersions = Object.fromEntries(patch.data.subAgentIds.map((id) => [id, store.get<Agent>(id)?.version]).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
    return store.update<Agent>(agent.id, cleanPatch, { versionAgent: true });
  });

  app.get<{ Params: { id: string } }>("/v1/agents/:id/versions", async (request) => ({ items: store.listAgentVersions(request.params.id) }));
  app.get<{ Params: { id: string; version: string } }>("/v1/agents/:id/versions/:version", async (request, reply) => {
    const agent = store.getAgentVersion(request.params.id, Number(request.params.version));
    return agent ?? reply.code(404).send({ error: "version_not_found" });
  });

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

  app.patch<{ Params: { id: string } }>("/v1/environments/:id", async (request, reply) => {
    const environment = store.get<Environment>(request.params.id);
    if (!environment) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().extend({
      packages: z.array(z.string()).optional(),
      variables: z.array(z.object({ key: z.string().min(1), value: z.string(), secret: z.boolean() })).optional(),
      networkAllowlist: z.array(z.string()).optional(),
      filesystemMode: z.enum(["read-only", "read-write", "read-write-no-delete"]).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return store.update<Environment>(environment.id, parsed.data as Partial<Environment>);
  });

  app.post("/v1/vaults", async (request, reply) => {
    const parsed = baseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<Vault>("vault", { kind: "vault", ...parsed.data }));
  });

  app.patch<{ Params: { id: string } }>("/v1/vaults/:id", async (request, reply) => {
    const vault = store.get<Vault>(request.params.id);
    if (!vault) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const cleanPatch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as Partial<Vault>;
    return store.update<Vault>(vault.id, cleanPatch);
  });

  app.post("/v1/credentials/validate", async (request, reply) => {
    const parsed = z.object({
      serverUrl: z.string().url(),
      authType: z.enum(["bearer", "oauth"]),
      secret: z.string().optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const response = await fetch(parsed.data.serverUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(parsed.data.secret ? { authorization: `Bearer ${parsed.data.secret}` } : {})
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: "snowmountain-validation", method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "snowmountain-ark", version: "0.2.0" } } }),
        signal: AbortSignal.timeout(10_000)
      });
      return { valid: response.status < 500, status: response.status, checkedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(422).send({ valid: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/v1/credentials", async (request, reply) => {
    const parsed = baseInput.extend({
      vaultId: z.string(), serverUrl: z.string().url(), authType: z.enum(["bearer", "oauth"]),
      secret: z.string().optional().default(""), mcpServerId: z.string().optional(), mcpServerName: z.string().optional(),
      clientId: z.string().optional(), clientSecret: z.string().optional(), expiresAt: z.string().datetime().optional(),
      validated: z.boolean().optional().default(false)
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!store.get<Vault>(parsed.data.vaultId)) return reply.code(400).send({ error: "vault_not_found" });
    const credential = store.create<Credential>("credential", {
      kind: "credential", name: parsed.data.name, description: parsed.data.description,
      vaultId: parsed.data.vaultId, serverUrl: parsed.data.serverUrl, authType: parsed.data.authType,
      secretCiphertext: sealSecret(parsed.data.secret || "oauth-pending"),
      mcpServerId: parsed.data.mcpServerId, mcpServerName: parsed.data.mcpServerName,
      clientId: parsed.data.clientId,
      clientSecretCiphertext: parsed.data.clientSecret ? sealSecret(parsed.data.clientSecret) : undefined,
      expiresAt: parsed.data.expiresAt,
      validationStatus: parsed.data.validated ? "valid" : "unvalidated",
      lastValidatedAt: parsed.data.validated ? new Date().toISOString() : undefined
    });
    return reply.code(201).send(sanitize(credential));
  });

  app.post("/v1/memory-stores", async (request, reply) => {
    const parsed = baseInput.extend({ content: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<MemoryStore>("memory-store", {
      kind: "memory-store", name: parsed.data.name, description: parsed.data.description,
      memories: parsed.data.content ? [{ id: createId("mem"), title: parsed.data.name, content: parsed.data.content, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] : []
    }));
  });

  app.patch<{ Params: { id: string } }>("/v1/memory-stores/:id", async (request, reply) => {
    const memoryStore = store.get<MemoryStore>(request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const cleanPatch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as Partial<MemoryStore>;
    return store.update<MemoryStore>(memoryStore.id, cleanPatch);
  });

  app.post<{ Params: { id: string } }>("/v1/memory-stores/:id/memories", async (request, reply) => {
    const memoryStore = store.get<MemoryStore>(request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const parsed = z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(100_000), tags: z.array(z.string()).max(20).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const memory = { id: createId("mem"), ...parsed.data, tags: parsed.data.tags ?? [], createdAt: now, updatedAt: now };
    store.update<MemoryStore>(memoryStore.id, { memories: [...memoryStore.memories, memory] });
    return reply.code(201).send(memory);
  });

  app.patch<{ Params: { id: string; memoryId: string } }>("/v1/memory-stores/:id/memories/:memoryId", async (request, reply) => {
    const memoryStore = store.get<MemoryStore>(request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const parsed = z.object({ title: z.string().min(1).max(200).optional(), content: z.string().min(1).max(100_000).optional(), tags: z.array(z.string()).max(20).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let found = false;
    const memoryPatch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
    const memories = memoryStore.memories.map((memory) => {
      if (memory.id !== request.params.memoryId) return memory;
      found = true;
      return { ...memory, ...memoryPatch, updatedAt: new Date().toISOString() };
    });
    if (!found) return reply.code(404).send({ error: "memory_not_found" });
    return store.update<MemoryStore>(memoryStore.id, { memories });
  });

  app.delete<{ Params: { id: string; memoryId: string } }>("/v1/memory-stores/:id/memories/:memoryId", async (request, reply) => {
    const memoryStore = store.get<MemoryStore>(request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const memories = memoryStore.memories.filter((memory) => memory.id !== request.params.memoryId);
    if (memories.length === memoryStore.memories.length) return reply.code(404).send({ error: "memory_not_found" });
    store.update<MemoryStore>(memoryStore.id, { memories });
    return { deleted: true };
  });

  app.post("/v1/sessions", async (request, reply) => {
    const parsed = baseInput.extend({
      agentId: z.string(), environmentId: z.string(), memoryStoreIds: z.array(z.string()).max(20).optional(),
      resourceConfig: z.object({
        cpu: z.number().min(0.25).max(16),
        memoryMiB: z.number().int().min(128).max(65_536),
        maxRuntimeSeconds: z.number().int().min(60).max(86_400),
        networkMode: z.enum(["deny", "allowlist"])
      }).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const agent = store.get<Agent>(parsed.data.agentId);
    const environment = store.get<Environment>(parsed.data.environmentId);
    if (!agent || !environment) {
      return reply.code(400).send({ error: "missing_agent_or_environment" });
    }
    const missingMemories = (parsed.data.memoryStoreIds ?? []).filter((id) => !store.get<MemoryStore>(id));
    if (missingMemories.length) return reply.code(400).send({ error: "memory_store_not_found", ids: missingMemories });
    const session = store.create<Session>("session", {
      kind: "session", name: parsed.data.name, description: parsed.data.description,
      agentId: parsed.data.agentId, agentVersion: agent.version, environmentId: parsed.data.environmentId,
      memoryStoreIds: parsed.data.memoryStoreIds ?? [], status: "idle", inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      workspacePath: "/workspace", resourceConfig: parsed.data.resourceConfig ?? {
        ...defaultResourceConfig,
        networkMode: environment.networkAllowlist.length ? "allowlist" : "deny"
      }
    });
    await sandbox.provision(session.id);
    store.appendEvent(session.id, "status", { status: "idle", content: "Session initialized" });
    return reply.code(201).send(session);
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/sessions/:id/events", async (request, reply) => {
    if (!store.get<Session>(request.params.id)) return reply.code(404).send({ error: "not_found" });
    return { items: store.events(request.params.id, Number(request.query.after ?? 0)) };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/sessions/:id/events/stream", async (request, reply) => {
    if (!store.get<Session>(request.params.id)) return reply.code(404).send({ error: "not_found" });
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    let after = Number(request.query.after ?? 0);
    const emit = () => {
      for (const event of store.events(request.params.id, after)) {
        after = event.sequence;
        reply.raw.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    };
    emit();
    const timer = setInterval(emit, 500);
    request.raw.on("close", () => clearInterval(timer));
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/interactions", async (request, reply) => {
    const parsed = z.object({ content: z.string().min(1), wait: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const session = store.get<Session>(request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    if (session.status === "running" || session.status === "waiting_approval") return reply.code(409).send({ error: "session_running" });
    const run = harness.run(session.id, parsed.data.content);
    if (parsed.data.wait) {
      await run;
      return { accepted: true, status: store.get<Session>(session.id)?.status };
    }
    void run.catch((error) => app.log.error(error));
    return reply.code(202).send({ accepted: true, sessionId: session.id });
  });

  app.post<{ Params: { id: string; approvalId: string } }>("/v1/sessions/:id/approvals/:approvalId", async (request, reply) => {
    const parsed = z.object({ allowed: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const resolved = harness.resolveApproval(request.params.id, request.params.approvalId, parsed.data.allowed);
    return resolved ? { resolved: true } : reply.code(409).send({ error: "approval_not_active" });
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/stop", async (request, reply) => {
    return harness.stop(request.params.id) ? { stopped: true } : reply.code(409).send({ error: "session_not_running" });
  });

  app.post<{ Params: { id: string } }>("/api/v1/sessions/:id/interactions", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = z.object({ content: z.string().min(1), wait: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const session = store.get<Session>(request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    if (["running", "waiting_approval"].includes(session.status)) return reply.code(409).send({ error: "session_running" });
    const run = harness.run(session.id, parsed.data.content);
    if (parsed.data.wait) {
      await run;
      return { accepted: true, status: store.get<Session>(session.id)?.status };
    }
    void run.catch((error) => app.log.error(error));
    return reply.code(202).send({ accepted: true, sessionId: session.id });
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/api/v1/sessions/:id/events", { preHandler: requireApiKey }, async (request, reply) => {
    if (!store.get<Session>(request.params.id)) return reply.code(404).send({ error: "not_found" });
    return { items: store.events(request.params.id, Number(request.query.after ?? 0)) };
  });

  app.get<{ Querystring: { agentId?: string } }>("/v1/monitoring/summary", async (request): Promise<MonitoringSummary> => {
    const sessions = store.list<Session>("session").filter((session) => !request.query.agentId || session.agentId === request.query.agentId);
    const events = sessions.flatMap((session) => store.events(session.id, 0, 10_000));
    return {
      sessions: sessions.length,
      running: sessions.filter((session) => session.status === "running").length,
      waitingApproval: sessions.filter((session) => session.status === "waiting_approval").length,
      failed: sessions.filter((session) => session.status === "failed").length,
      inputTokens: sessions.reduce((sum, session) => sum + session.inputTokens, 0),
      outputTokens: sessions.reduce((sum, session) => sum + session.outputTokens, 0),
      cacheReadTokens: sessions.reduce((sum, session) => sum + (session.cacheReadTokens ?? 0), 0),
      cacheWriteTokens: sessions.reduce((sum, session) => sum + (session.cacheWriteTokens ?? 0), 0),
      toolCalls: events.filter((event) => event.type === "tool_use").length,
      modelRequests: events.filter((event) => event.type === "model_request_end").length
    };
  });

  app.get("/metrics", async (_request, reply) => {
    const sessions = store.list<Session>("session");
    const events = sessions.flatMap((session) => store.events(session.id, 0, 10_000));
    const lines = [
      "# HELP snowmountain_sessions_total Managed sessions by current state.",
      "# TYPE snowmountain_sessions_total gauge",
      ...(["idle", "running", "waiting_approval", "failed", "stopped"] as const).map((status) => `snowmountain_sessions_total{status=\"${status}\"} ${sessions.filter((session) => session.status === status).length}`),
      "# HELP snowmountain_tokens_total Model tokens recorded by direction.",
      "# TYPE snowmountain_tokens_total counter",
      `snowmountain_tokens_total{direction=\"input\"} ${sessions.reduce((sum, session) => sum + session.inputTokens, 0)}`,
      `snowmountain_tokens_total{direction=\"output\"} ${sessions.reduce((sum, session) => sum + session.outputTokens, 0)}`,
      `snowmountain_tokens_total{direction=\"cache_read\"} ${sessions.reduce((sum, session) => sum + (session.cacheReadTokens ?? 0), 0)}`,
      `snowmountain_tokens_total{direction=\"cache_write\"} ${sessions.reduce((sum, session) => sum + (session.cacheWriteTokens ?? 0), 0)}`,
      "# HELP snowmountain_events_total Append-only session events by type.",
      "# TYPE snowmountain_events_total counter",
      ...Array.from(new Set(events.map((event) => event.type))).sort().map((type) => `snowmountain_events_total{type=\"${type}\"} ${events.filter((event) => event.type === type).length}`)
    ];
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(`${lines.join("\n")}\n`);
  });

  app.get("/v1/settings", async () => ({
    product: "Snowmountain Ark",
    mode: "single-tenant",
    sandboxDriver: config.sandboxDriver,
    sandboxImage: config.sandboxImage,
    marketIndexUrl: config.marketIndexUrl,
    modelCredentialConfigured: Boolean(process.env.MODEL_API_KEY),
    vaultMasterKeyConfigured: Boolean(process.env.VAULT_MASTER_KEY),
    apiKeyCount: store.count("api-key"),
    eventStore: "sqlite-wal",
    runtime: process.version
  }));

  app.get("/v1/specs", async () => ({ items: [
    { id: "managed-agents", title: "Managed Agents architecture", type: "architecture", status: "implemented", path: "docs/notes/anthropic-managed-agents.md" },
    { id: "auto-mode", title: "Approval and Auto Mode policy", type: "security", status: "implemented", path: "docs/notes/anthropic-auto-mode.md" },
    { id: "containment", title: "Sandbox and credential containment", type: "security", status: "implemented", path: "docs/notes/anthropic-containment.md" },
    { id: "volcengine-parity", title: "Volcengine Managed Agents parity map", type: "acceptance", status: "in-progress", path: "docs/notes/volcengine-managed-agents-reverse-engineering.md" },
    { id: "sdd-dialogue", title: "SDD / DSL design dialogue", type: "product-thinking", status: "reference", path: "docs/notes/opus46-sdd-dialogue-reading-notes.md" }
  ] }));

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
