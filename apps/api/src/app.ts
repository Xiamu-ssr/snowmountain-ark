import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  Agent,
  ApiKey,
  AuditEvent,
  Credential,
  DependencyEdge,
  Environment,
  ManagedResource,
  MarketCatalog,
  MarketEntry,
  MemoryStore,
  ModelCatalogItem,
  ModelEndpoint,
  MonitoringSummary,
  ResourceKind,
  RuntimeProfile,
  Session,
  SpecBundle,
  UserAccount,
  Vault
} from "@snowmountain/contracts";
import { defaultToolPolicies } from "@snowmountain/contracts";
import { config } from "./config.js";
import { AuthManager, LoginRateLimitError, passwordDigest } from "./auth.js";
import { Store } from "./db.js";
import { Harness } from "./harness.js";
import { createId } from "./ids.js";
import { fetchClientCredentialsToken } from "./mcp.js";
import { InteractionQueue } from "./queue.js";
import { Sandbox } from "./sandbox.js";
import { loadSpecBundle } from "./specs.js";
import { effectiveBuiltinTools } from "./tools.js";
import { openSecret, sealSecret } from "./vault.js";

export interface AppOptions {
  databasePath?: string;
  dataDir?: string;
  logger?: boolean;
  seed?: boolean;
  auth?: {
    username: string;
    password: string;
    cookieSecure?: boolean;
    cookiePath?: string;
    sessionHours?: number;
  };
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
  credentialId: z.string().optional(),
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

const defaultRuntimeProfileId = "Snowmountain-Managed-Agents-Preview-20260715";
const defaultResourceConfig = { cpu: 1, memoryMiB: 512, maxRuntimeSeconds: 3600, networkMode: "full" as const };

function sanitize(resource: ManagedResource): ManagedResource {
  if (resource.kind === "session") {
    const session = resource;
    resource = {
      ...session,
      cacheReadTokens: session.cacheReadTokens ?? 0,
      cacheWriteTokens: session.cacheWriteTokens ?? 0,
      agentVersion: session.agentVersion ?? 1,
      resourceConfig: session.resourceConfig
        ? { ...session.resourceConfig, networkMode: session.resourceConfig.networkMode === "deny" ? "deny" : "full" }
        : defaultResourceConfig
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

function dependencyEdges(store: Store, tenantId?: string): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const agent of store.list<Agent>("agent", tenantId)) {
    edges.push({ source: agent.id, target: `model:${agent.model.name}`, relation: "uses-model" });
    if (agent.model.credentialId) edges.push({ source: agent.id, target: agent.model.credentialId, relation: "uses-model-credential" });
    for (const id of agent.skillIds) edges.push({ source: agent.id, target: id, relation: "uses-skill" });
    for (const id of agent.mcpIds) edges.push({ source: agent.id, target: id, relation: "uses-mcp" });
    for (const binding of agent.mcpServers ?? []) {
      edges.push({ source: agent.id, target: `mcp:${binding.id}`, relation: "uses-mcp-server" });
      if (binding.credentialId) edges.push({ source: `mcp:${binding.id}`, target: binding.credentialId, relation: "uses-credential" });
    }
    for (const id of agent.subAgentIds) edges.push({ source: agent.id, target: id, relation: "delegates-to" });
  }
  for (const session of store.list<Session>("session", tenantId)) {
    edges.push({ source: session.id, target: session.agentId, relation: "runs-agent" });
    edges.push({ source: session.id, target: session.environmentId, relation: "binds-environment" });
    for (const id of session.memoryStoreIds) edges.push({ source: session.id, target: id, relation: "reads-memory" });
  }
  for (const credential of store.list<Credential>("credential", tenantId)) {
    edges.push({ source: credential.id, target: credential.vaultId, relation: "stored-in" });
  }
  return edges;
}

function seedStore(store: Store): void {
  if (!store.get<RuntimeProfile>(defaultRuntimeProfileId)) {
    store.create<RuntimeProfile>("runtime-profile", {
      id: defaultRuntimeProfileId,
      kind: "runtime-profile",
      name: "Snowmountain Managed Agents Preview",
      description: "可恢复的长任务 Harness：持久 Session、Tool/MCP 路由、审批、子 Agent 与按需 Sandbox。",
      tenantId: "system",
      ownerId: "platform",
      engine: "snowmountain-harness",
      version: "2026-07-15",
      default: true,
      enabled: true,
      capabilities: ["durable-session", "tool-loop", "mcp-proxy", "subagents", "approval", "sandbox-as-tool"]
    });
  }
  if (!store.get<ModelEndpoint>("mdl-endpoint-local")) {
    store.create<ModelEndpoint>("model-endpoint", {
      id: "mdl-endpoint-local",
      kind: "model-endpoint",
      name: "Local deterministic",
      description: "不调用外部 LLM 的验收模型，用于测试 Session、Tool 与事件契约。",
      tenantId: "system",
      ownerId: "platform",
      provider: "mock",
      enabled: true,
      models: [{
        id: "model-deterministic-local",
        endpointId: "mdl-endpoint-local",
        provider: "mock",
        name: "deterministic-local-harness",
        displayName: "Deterministic Local Harness",
        description: "无需模型 Credential；只执行确定性验收路径，不代表真实投顾推理。",
        modalities: ["text"],
        enabled: true,
        inputPricePerK: 0,
        outputPricePerK: 0
      }]
    });
  }
  if (store.list<Agent>("agent").length || store.list<Environment>("environment").length || store.list<Session>("session").length) return;
  const environment = store.create<Environment>("environment", {
    id: "env-default",
    kind: "environment",
    name: "Default isolated workspace",
    description: "Session-scoped /workspace with normal outbound network by default.",
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
    baseAgent: defaultRuntimeProfileId,
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

function modelCatalog(store: Store): ModelCatalogItem[] {
  return store.list<ModelEndpoint>("model-endpoint", "system")
    .filter((endpoint) => endpoint.enabled)
    .flatMap((endpoint) => endpoint.models.filter((model) => model.enabled).map((model) => ({ ...model, endpointId: endpoint.id, provider: endpoint.provider })));
}

function resolveModelConfig(store: Store, requested: z.infer<typeof modelInput> | undefined): z.infer<typeof modelInput> {
  if (!requested) {
    const fallback = modelCatalog(store)[0];
    return fallback ? { ...fallback } : { provider: "mock", name: "deterministic-local-harness" };
  }
  if (!requested.endpointId) return requested;
  const endpoint = store.get<ModelEndpoint>(requested.endpointId, "system");
  const model = endpoint?.models.find((candidate) => candidate.enabled && (candidate.name === requested.name || candidate.id === requested.name));
  if (!endpoint?.enabled || !model) throw new Error("model_catalog_item_not_found");
  return {
    provider: endpoint.provider,
    name: model.name,
    endpointId: endpoint.id,
    displayName: model.displayName,
    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
    ...(model.inputPricePerK !== undefined ? { inputPricePerK: model.inputPricePerK } : {}),
    ...(model.cachedInputPricePerK !== undefined ? { cachedInputPricePerK: model.cachedInputPricePerK } : {}),
    ...(model.outputPricePerK !== undefined ? { outputPricePerK: model.outputPricePerK } : {}),
    ...(model.rpm ? { rpm: model.rpm } : {}),
    ...(model.tpm ? { tpm: model.tpm } : {})
  };
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const authOptions = {
    username: options.auth?.username ?? config.adminUsername,
    password: options.auth?.password ?? config.adminPassword,
    sessionHours: options.auth?.sessionHours ?? config.authSessionHours,
    cookieSecure: options.auth?.cookieSecure ?? config.authCookieSecure,
    cookiePath: options.auth?.cookiePath ?? config.authCookiePath
  };
  await app.register(cors, { origin: authOptions.password ? false : true, credentials: true });
  const store = new Store(options.databasePath ?? resolve(config.dataDir, "snowmountain.db"));
  const specBundle = loadSpecBundle(config.specBundlePath);
  if (options.seed ?? true) seedStore(store);
  store.recoverInterruptedSessions();
  const sandbox = new Sandbox({
    dataDir: options.dataDir ?? config.dataDir,
    driver: config.sandboxDriver,
    image: config.sandboxImage,
    workerUrl: config.sandboxWorkerUrl,
    workerToken: config.sandboxWorkerToken,
    hostDataDir: config.sandboxHostDataDir
  });
  const harness = new Harness(store, sandbox);
  const queue = new InteractionQueue(store, harness, 4, (error) => app.log.error(error));
  const auth = new AuthManager(store, {
    ...authOptions
  });
  const actors = new WeakMap<object, string>();
  type Principal = { username: string; role: "admin" | "user"; tenantId: string };
  const principals = new WeakMap<object, Principal>();
  const principalFor = (request: FastifyRequest): Principal => principals.get(request) ?? { username: "local-admin", role: "admin", tenantId: "system" };
  const tenantScope = (request: FastifyRequest): string | undefined => principalFor(request).role === "admin" ? undefined : principalFor(request).tenantId;
  const visible = <T extends ManagedResource>(request: FastifyRequest, id: string): T | undefined => store.get<T>(id, tenantScope(request));
  const createFor = <T extends ManagedResource>(request: FastifyRequest, kind: ResourceKind, input: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): T => {
    const principal = principalFor(request);
    return store.create<T>(kind, {
      ...input,
      tenantId: principal.role === "admin" ? input.tenantId ?? "default" : principal.tenantId,
      ownerId: principal.username
    });
  };
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (principalFor(request).role !== "admin") await reply.code(403).send({ error: "admin_required" });
  };
  app.addHook("onClose", () => { queue.close(); store.close(); });
  queue.start();

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?", 1)[0] ?? request.url;
    if (!auth.enabled) {
      actors.set(request, "local-admin");
      principals.set(request, { username: "local-admin", role: "admin", tenantId: "system" });
      return;
    }
    if (path === "/v1/auth/status" || path === "/v1/auth/login" || path === "/health" || path.startsWith("/api/v1/")) return;
    if (!path.startsWith("/v1/") && path !== "/metrics") return;
    const session = auth.session(request);
    if (!session) {
      await reply.code(401).send({ error: "authentication_required" });
      return;
    }
    actors.set(request, session.username);
    principals.set(request, { username: session.username, role: session.role, tenantId: session.tenant_id });
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !auth.verifyCsrf(request, session)) {
      await reply.code(403).send({ error: "invalid_csrf_token" });
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    const target = request.url.split("?", 1)[0] ?? request.url;
    store.appendAudit({
      actor: actors.get(request) ?? "anonymous",
      action: `${request.method} ${target}`,
      target,
      method: request.method,
      status_code: reply.statusCode,
      ip: request.ip,
      request_id: request.id
    });
  });

  app.get("/v1/auth/status", async (request) => auth.status(request));

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = z.object({ username: z.string().min(1).max(120), password: z.string().min(1).max(1000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_login" });
    try {
      const result = auth.login(parsed.data.username, parsed.data.password, request.ip);
      if (!result) return reply.code(401).send({ error: "invalid_login" });
      actors.set(request, parsed.data.username);
      reply.header("set-cookie", auth.loginCookies(result));
      return { enabled: true, authenticated: true, user: parsed.data.username, role: result.role, tenantId: result.tenantId, expiresAt: result.expiresAt };
    } catch (error) {
      if (error instanceof LoginRateLimitError) return reply.code(429).send({ error: "login_rate_limited" });
      throw error;
    }
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    auth.logout(request);
    reply.header("set-cookie", auth.clearCookies());
    return { authenticated: false };
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/audit", { preHandler: requireAdmin }, async (request): Promise<{ items: AuditEvent[] }> => ({
    items: store.listAudit(Number(request.query.limit ?? 200)).map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      method: row.method,
      statusCode: row.status_code,
      ip: row.ip,
      requestId: row.request_id,
      createdAt: row.created_at
    }))
  }));

  const requireApiKey = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authorization = request.headers.authorization ?? "";
    const secret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const keyHash = createHash("sha256").update(secret).digest("hex");
    const apiKey = store.list<ApiKey>("api-key").find((item) => item.keyHash === keyHash && !item.revokedAt);
    if (!apiKey) {
      await reply.code(401).send({ error: "invalid_api_key" });
      return;
    }
    actors.set(request, `api-key:${apiKey.id}`);
    principals.set(request, { username: `api-key:${apiKey.id}`, role: "user", tenantId: apiKey.tenantId ?? "default" });
    store.update<ApiKey>(apiKey.id, { lastUsedAt: new Date().toISOString() });
  };

  app.get("/health", async () => ({ status: "ok", resources: store.count(), sandbox: config.sandboxDriver }));

  app.get("/v1/model-catalog", async () => ({ items: modelCatalog(store) }));
  app.get("/v1/runtime-profiles", async () => ({
    items: store.list<RuntimeProfile>("runtime-profile", "system").filter((profile) => profile.enabled)
  }));

  const publicUser = (row: ReturnType<Store["listUsers"]>[number]): UserAccount => ({
    id: row.id,
    username: row.username,
    role: row.role,
    tenantId: row.tenant_id,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
  const publicEndpoint = (endpoint: ModelEndpoint) => ({
    ...endpoint,
    apiKeyCiphertext: undefined,
    credentialConfigured: Boolean(endpoint.apiKeyCiphertext)
  });

  app.get("/v1/admin/users", { preHandler: requireAdmin }, async () => ({ items: store.listUsers().map(publicUser) }));
  app.post("/v1/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = z.object({
      username: z.string().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
      password: z.string().min(12).max(1000),
      tenantId: z.string().min(2).max(80).regex(/^[a-z0-9][a-z0-9-]*$/),
      role: z.enum(["admin", "user"]).optional().default("user")
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (store.getUserByUsername(parsed.data.username) || parsed.data.username === authOptions.username) return reply.code(409).send({ error: "username_exists" });
    const digest = passwordDigest(parsed.data.password);
    const user = store.createUser({
      id: createId("user"),
      username: parsed.data.username,
      password_salt: digest.salt,
      password_hash: digest.hash,
      role: parsed.data.role,
      tenant_id: parsed.data.tenantId
    });
    return reply.code(201).send(publicUser(user));
  });
  app.patch<{ Params: { id: string } }>("/v1/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = z.object({ enabled: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return store.setUserEnabled(request.params.id, parsed.data.enabled) ? { updated: true } : reply.code(404).send({ error: "not_found" });
  });

  const adminModelInput = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(1000).optional().default(""),
    provider: z.enum(["mock", "openai-compatible"]),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    enabled: z.boolean().optional().default(true),
    models: z.array(z.object({
      name: z.string().min(1), displayName: z.string().min(1), description: z.string().max(1000).optional().default(""),
      modalities: z.array(z.enum(["text", "vision"])).min(1).optional().default(["text"]),
      contextWindow: z.number().int().positive().optional(), inputPricePerK: z.number().min(0).optional(), cachedInputPricePerK: z.number().min(0).optional(), outputPricePerK: z.number().min(0).optional(),
      rpm: z.number().int().positive().optional(), tpm: z.number().int().positive().optional(), enabled: z.boolean().optional().default(true)
    })).min(1)
  });
  app.get("/v1/admin/model-endpoints", { preHandler: requireAdmin }, async () => ({ items: store.list<ModelEndpoint>("model-endpoint", "system").map(publicEndpoint) }));
  app.post("/v1/admin/model-endpoints", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = adminModelInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.provider === "openai-compatible" && !parsed.data.baseUrl) return reply.code(400).send({ error: "base_url_required" });
    const id = createId("mdl-endpoint");
    const endpoint = store.create<ModelEndpoint>("model-endpoint", {
      id, kind: "model-endpoint", tenantId: "system", ownerId: principalFor(request).username,
      name: parsed.data.name, description: parsed.data.description, provider: parsed.data.provider,
      baseUrl: parsed.data.baseUrl, apiKeyCiphertext: parsed.data.apiKey ? sealSecret(parsed.data.apiKey) : undefined,
      enabled: parsed.data.enabled,
      models: parsed.data.models.map((model, index) => ({ ...model, id: `${id}-model-${index + 1}`, endpointId: id, provider: parsed.data.provider }))
    });
    return reply.code(201).send(publicEndpoint(endpoint));
  });
  app.patch<{ Params: { id: string } }>("/v1/admin/model-endpoints/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const endpoint = store.get<ModelEndpoint>(request.params.id, "system");
    if (!endpoint) return reply.code(404).send({ error: "not_found" });
    const parsed = z.object({ enabled: z.boolean().optional(), apiKey: z.string().optional(), name: z.string().min(1).max(120).optional(), description: z.string().max(1000).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return publicEndpoint(store.update<ModelEndpoint>(endpoint.id, {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.apiKey ? { apiKeyCiphertext: sealSecret(parsed.data.apiKey) } : {}),
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {})
    }));
  });

  app.get("/v1/admin/runtime-profiles", { preHandler: requireAdmin }, async () => ({ items: store.list<RuntimeProfile>("runtime-profile", "system") }));
  app.post("/v1/admin/runtime-profiles", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = baseInput.extend({ engine: z.literal("snowmountain-harness"), version: z.string().min(1), enabled: z.boolean().optional().default(true), capabilities: z.array(z.string()).optional().default([]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(store.create<RuntimeProfile>("runtime-profile", {
      kind: "runtime-profile", tenantId: "system", ownerId: principalFor(request).username,
      ...parsed.data, default: false
    }));
  });

  app.post("/v1/api-keys", async (request, reply) => {
    const parsed = baseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const secret = `smak_${randomBytes(24).toString("base64url")}`;
    const apiKey = createFor<ApiKey>(request, "api-key", {
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
    app.get(`/v1/${route.path}`, async (request) => ({ items: store.list(route.kind, tenantScope(request)).map(sanitize) }));
    app.get<{ Params: { id: string } }>(`/v1/${route.path}/:id`, async (request, reply) => {
      const resource = visible(request, request.params.id);
      if (!resource || resource.kind !== route.kind) return reply.code(404).send({ error: "not_found" });
      return sanitize(resource);
    });
    app.delete<{ Params: { id: string } }>(`/v1/${route.path}/:id`, async (request, reply) => {
      const dependents = dependencyEdges(store, tenantScope(request)).filter((edge) => edge.target === request.params.id);
      if (dependents.length) return reply.code(409).send({ error: "resource_in_use", dependents });
      const resource = visible(request, request.params.id);
      if (!resource || resource.kind !== route.kind) return reply.code(404).send({ error: "not_found" });
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
      baseAgent: z.string().optional(),
      skillIds: z.array(z.string()).optional(),
      mcpIds: z.array(z.string()).optional(),
      mcpServers: z.array(mcpBindingInput).max(20).optional(),
      subAgentIds: z.array(z.string()).max(20).optional(),
      toolPolicies: z.record(z.enum(toolNames), z.enum(["full", "workspace", "approval", "deny"])).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const nestedSubAgent = (parsed.data.subAgentIds ?? [])
      .map((id) => visible<Agent>(request, id))
      .find((candidate) => candidate && candidate.subAgentIds.length > 0);
    if (nestedSubAgent) return reply.code(400).send({ error: "nested_multi_agent_not_allowed", agentId: nestedSubAgent.id });
    if (parsed.data.model?.credentialId) {
      const credential = visible<Credential>(request, parsed.data.model.credentialId);
      if (!credential) return reply.code(400).send({ error: "model_credential_not_found", credentialId: parsed.data.model.credentialId });
      if (!["model", "generic"].includes(credential.usage ?? "mcp")) return reply.code(400).send({ error: "credential_usage_mismatch", expected: "model", credentialId: credential.id });
    }
    const missingCredential = (parsed.data.mcpServers ?? []).find((binding) => binding.credentialId && !visible<Credential>(request, binding.credentialId));
    if (missingCredential) return reply.code(400).send({ error: "credential_not_found", credentialId: missingCredential.credentialId });
    const wrongMcpCredential = (parsed.data.mcpServers ?? []).map((binding) => binding.credentialId ? visible<Credential>(request, binding.credentialId) : undefined).find((credential) => credential?.usage === "model");
    if (wrongMcpCredential) return reply.code(400).send({ error: "credential_usage_mismatch", expected: "mcp", credentialId: wrongMcpCredential.id });
    const baseAgent = parsed.data.baseAgent ?? defaultRuntimeProfileId;
    if (!store.get<RuntimeProfile>(baseAgent, "system")?.enabled) return reply.code(400).send({ error: "runtime_profile_not_found", baseAgent });
    let resolvedModel: z.infer<typeof modelInput>;
    try { resolvedModel = resolveModelConfig(store, parsed.data.model); }
    catch { return reply.code(400).send({ error: "model_catalog_item_not_found" }); }
    return reply.code(201).send(createFor<Agent>(request, "agent", {
      kind: "agent",
      name: parsed.data.name,
      description: parsed.data.description,
      version: 1,
      baseAgent,
      model: resolvedModel,
      systemPrompt: parsed.data.systemPrompt ?? "Work inside /workspace and cite tool evidence.",
      skillIds: parsed.data.skillIds ?? [], mcpIds: parsed.data.mcpIds ?? [], mcpServers: parsed.data.mcpServers ?? [], subAgentIds: parsed.data.subAgentIds ?? [],
      subAgentVersions: Object.fromEntries((parsed.data.subAgentIds ?? []).map((id) => [id, visible<Agent>(request, id)?.version]).filter((entry): entry is [string, number] => typeof entry[1] === "number")),
      toolPolicies: { ...defaultToolPolicies, ...parsed.data.toolPolicies },
      tags: parsed.data.tags ?? []
    }));
  });

  app.patch<{ Params: { id: string } }>("/v1/agents/:id", async (request, reply) => {
    const agent = visible<Agent>(request, request.params.id);
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
      .map((id) => visible<Agent>(request, id))
      .find((candidate) => candidate && candidate.subAgentIds.length > 0);
    if (nestedSubAgent) return reply.code(400).send({ error: "nested_multi_agent_not_allowed", agentId: nestedSubAgent.id });
    if (patch.data.model?.credentialId) {
      const credential = visible<Credential>(request, patch.data.model.credentialId);
      if (!credential) return reply.code(400).send({ error: "model_credential_not_found", credentialId: patch.data.model.credentialId });
      if (!["model", "generic"].includes(credential.usage ?? "mcp")) return reply.code(400).send({ error: "credential_usage_mismatch", expected: "model", credentialId: credential.id });
    }
    const missingCredential = (patch.data.mcpServers ?? []).find((binding) => binding.credentialId && !visible<Credential>(request, binding.credentialId));
    if (missingCredential) return reply.code(400).send({ error: "credential_not_found", credentialId: missingCredential.credentialId });
    const wrongMcpCredential = (patch.data.mcpServers ?? []).map((binding) => binding.credentialId ? visible<Credential>(request, binding.credentialId) : undefined).find((credential) => credential?.usage === "model");
    if (wrongMcpCredential) return reply.code(400).send({ error: "credential_usage_mismatch", expected: "mcp", credentialId: wrongMcpCredential.id });
    if (patch.data.baseAgent && !store.get<RuntimeProfile>(patch.data.baseAgent, "system")?.enabled) return reply.code(400).send({ error: "runtime_profile_not_found", baseAgent: patch.data.baseAgent });
    const cleanPatch = Object.fromEntries(Object.entries(patch.data).filter(([, value]) => value !== undefined)) as Partial<Agent>;
    if (patch.data.model) {
      try { cleanPatch.model = resolveModelConfig(store, patch.data.model); }
      catch { return reply.code(400).send({ error: "model_catalog_item_not_found" }); }
    }
    if (patch.data.subAgentIds) cleanPatch.subAgentVersions = Object.fromEntries(patch.data.subAgentIds.map((id) => [id, visible<Agent>(request, id)?.version]).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
    return store.update<Agent>(agent.id, cleanPatch, { versionAgent: true });
  });

  app.get<{ Params: { id: string } }>("/v1/agents/:id/versions", async (request, reply) => visible<Agent>(request, request.params.id) ? { items: store.listAgentVersions(request.params.id) } : reply.code(404).send({ error: "not_found" }));
  app.get<{ Params: { id: string; version: string } }>("/v1/agents/:id/versions/:version", async (request, reply) => {
    if (!visible<Agent>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
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
    if (parsed.data.variables?.some((variable) => variable.secret)) return reply.code(400).send({ error: "environment_secret_not_allowed", use: "vault_credential_binding" });
    return reply.code(201).send(createFor<Environment>(request, "environment", {
      kind: "environment", name: parsed.data.name, description: parsed.data.description,
      packages: parsed.data.packages ?? [], variables: parsed.data.variables ?? [],
      networkAllowlist: parsed.data.networkAllowlist ?? [], filesystemMode: parsed.data.filesystemMode ?? "read-write-no-delete"
    }));
  });

  app.patch<{ Params: { id: string } }>("/v1/environments/:id", async (request, reply) => {
    const environment = visible<Environment>(request, request.params.id);
    if (!environment) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().extend({
      packages: z.array(z.string()).optional(),
      variables: z.array(z.object({ key: z.string().min(1), value: z.string(), secret: z.boolean() })).optional(),
      networkAllowlist: z.array(z.string()).optional(),
      filesystemMode: z.enum(["read-only", "read-write", "read-write-no-delete"]).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.variables?.some((variable) => variable.secret)) return reply.code(400).send({ error: "environment_secret_not_allowed", use: "vault_credential_binding" });
    return store.update<Environment>(environment.id, parsed.data as Partial<Environment>);
  });

  app.post("/v1/vaults", async (request, reply) => {
    const parsed = baseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(createFor<Vault>(request, "vault", { kind: "vault", ...parsed.data }));
  });

  app.patch<{ Params: { id: string } }>("/v1/vaults/:id", async (request, reply) => {
    const vault = visible<Vault>(request, request.params.id);
    if (!vault) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const cleanPatch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as Partial<Vault>;
    return store.update<Vault>(vault.id, cleanPatch);
  });

  app.post("/v1/credentials/validate", async (request, reply) => {
    const parsed = z.object({
      serverUrl: z.string().url(),
      usage: z.enum(["mcp", "model", "generic"]).optional().default("mcp"),
      authType: z.enum(["bearer", "oauth"]),
      secret: z.string().optional(),
      tokenUrl: z.string().url().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      scopes: z.array(z.string()).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.usage === "model" && principalFor(request).role !== "admin") return reply.code(403).send({ error: "model_credentials_are_admin_managed" });
    try {
      const token = parsed.data.authType === "oauth" && parsed.data.tokenUrl && parsed.data.clientId && parsed.data.clientSecret
        ? (await fetchClientCredentialsToken({
            tokenUrl: parsed.data.tokenUrl,
            clientId: parsed.data.clientId,
            clientSecret: parsed.data.clientSecret,
            ...(parsed.data.scopes ? { scopes: parsed.data.scopes } : {})
          })).accessToken
        : parsed.data.secret;
      const modelValidation = parsed.data.usage === "model";
      const response = await fetch(modelValidation ? `${parsed.data.serverUrl.replace(/\/$/, "")}/models` : parsed.data.serverUrl, {
        method: modelValidation ? "GET" : "POST",
        headers: {
          ...(modelValidation ? {} : { "content-type": "application/json", accept: "application/json, text/event-stream" }),
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        ...(modelValidation ? {} : { body: JSON.stringify({ jsonrpc: "2.0", id: "snowmountain-validation", method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "snowmountain-ark", version: "0.2.0" } } }) }),
        signal: AbortSignal.timeout(10_000)
      });
      return { valid: response.ok, status: response.status, checkedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(422).send({ valid: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/v1/credentials", async (request, reply) => {
    const parsed = baseInput.extend({
      vaultId: z.string(), serverUrl: z.string().url(), authType: z.enum(["bearer", "oauth"]),
      usage: z.enum(["mcp", "model", "generic"]).optional().default("mcp"),
      secret: z.string().optional().default(""), mcpServerId: z.string().optional(), mcpServerName: z.string().optional(),
      clientId: z.string().optional(), clientSecret: z.string().optional(), tokenUrl: z.string().url().optional(),
      scopes: z.array(z.string()).optional(), expiresAt: z.string().datetime().optional(),
      validated: z.boolean().optional().default(false)
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.usage === "model" && principalFor(request).role !== "admin") return reply.code(403).send({ error: "model_credentials_are_admin_managed" });
    if (!visible<Vault>(request, parsed.data.vaultId)) return reply.code(400).send({ error: "vault_not_found" });
    const credential = createFor<Credential>(request, "credential", {
      kind: "credential", name: parsed.data.name, description: parsed.data.description,
      vaultId: parsed.data.vaultId, usage: parsed.data.usage, serverUrl: parsed.data.serverUrl, authType: parsed.data.authType,
      secretCiphertext: sealSecret(parsed.data.secret || "oauth-pending"),
      mcpServerId: parsed.data.mcpServerId, mcpServerName: parsed.data.mcpServerName,
      clientId: parsed.data.clientId,
      clientSecretCiphertext: parsed.data.clientSecret ? sealSecret(parsed.data.clientSecret) : undefined,
      tokenUrl: parsed.data.tokenUrl,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt,
      validationStatus: parsed.data.validated ? "valid" : "unvalidated",
      lastValidatedAt: parsed.data.validated ? new Date().toISOString() : undefined
    });
    return reply.code(201).send(sanitize(credential));
  });

  app.post("/v1/memory-stores", async (request, reply) => {
    const parsed = baseInput.extend({ content: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(createFor<MemoryStore>(request, "memory-store", {
      kind: "memory-store", name: parsed.data.name, description: parsed.data.description,
      memories: parsed.data.content ? [{ id: createId("mem"), title: parsed.data.name, content: parsed.data.content, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] : []
    }));
  });

  app.patch<{ Params: { id: string } }>("/v1/memory-stores/:id", async (request, reply) => {
    const memoryStore = visible<MemoryStore>(request, request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const parsed = baseInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const cleanPatch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as Partial<MemoryStore>;
    return store.update<MemoryStore>(memoryStore.id, cleanPatch);
  });

  app.post<{ Params: { id: string } }>("/v1/memory-stores/:id/memories", async (request, reply) => {
    const memoryStore = visible<MemoryStore>(request, request.params.id);
    if (!memoryStore) return reply.code(404).send({ error: "not_found" });
    const parsed = z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(100_000), tags: z.array(z.string()).max(20).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const now = new Date().toISOString();
    const memory = { id: createId("mem"), ...parsed.data, tags: parsed.data.tags ?? [], createdAt: now, updatedAt: now };
    store.update<MemoryStore>(memoryStore.id, { memories: [...memoryStore.memories, memory] });
    return reply.code(201).send(memory);
  });

  app.patch<{ Params: { id: string; memoryId: string } }>("/v1/memory-stores/:id/memories/:memoryId", async (request, reply) => {
    const memoryStore = visible<MemoryStore>(request, request.params.id);
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
    const memoryStore = visible<MemoryStore>(request, request.params.id);
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
        networkMode: z.enum(["deny", "full"])
      }).optional()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const agent = visible<Agent>(request, parsed.data.agentId);
    const environment = visible<Environment>(request, parsed.data.environmentId);
    if (!agent || !environment) {
      return reply.code(400).send({ error: "missing_agent_or_environment" });
    }
    const missingMemories = (parsed.data.memoryStoreIds ?? []).filter((id) => !visible<MemoryStore>(request, id));
    if (missingMemories.length) return reply.code(400).send({ error: "memory_store_not_found", ids: missingMemories });
    const session = createFor<Session>(request, "session", {
      kind: "session", name: parsed.data.name, description: parsed.data.description,
      agentId: parsed.data.agentId, agentVersion: agent.version, environmentId: parsed.data.environmentId,
      memoryStoreIds: parsed.data.memoryStoreIds ?? [], status: "idle", inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      workspacePath: "/workspace", resourceConfig: parsed.data.resourceConfig ?? defaultResourceConfig
    });
    await sandbox.provision(session.id);
    store.appendEvent(session.id, "status", { status: "idle", content: "Session initialized" });
    return reply.code(201).send(session);
  });

  app.get<{ Params: { id: string } }>("/v1/sessions/:id/effective-tools", async (request, reply) => {
    const session = visible<Session>(request, request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    const agent = store.getAgentVersion(session.agentId, session.agentVersion) ?? store.get<Agent>(session.agentId);
    if (!agent) return reply.code(409).send({ error: "pinned_agent_version_missing" });
    return {
      sessionId: session.id,
      agentId: agent.id,
      agentVersion: session.agentVersion,
      resolution: "Session → 固定 Agent Version → 内置工具策略 + MCP 动态发现 + 子 Agent 委派",
      builtin: effectiveBuiltinTools(agent).map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        permission: tool.permission,
        source: "runtime-builtin"
      })),
      mcp: (agent.mcpServers ?? []).map((binding) => ({
        bindingId: binding.id,
        name: binding.name,
        permission: binding.permission,
        credentialBinding: binding.credentialId ?? null,
        source: binding.source,
        discovery: "运行时 tools/list"
      })),
      subagents: agent.subAgentIds.map((id) => ({ agentId: id, version: agent.subAgentVersions?.[id], source: "pinned-agent-version" })),
      skills: agent.skillIds.map((id) => ({ id, source: "agent-version", runtimeEffect: "当前仅作为能力引用；尚未自动装载到 Prompt" }))
    };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/sessions/:id/events", async (request, reply) => {
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
    return { items: store.events(request.params.id, Number(request.query.after ?? 0)) };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/sessions/:id/events/stream", async (request, reply) => {
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
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
    const session = visible<Session>(request, request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    if (["queued", "running", "waiting_approval"].includes(session.status)) return reply.code(409).send({ error: "session_running" });
    const job = queue.enqueue(session.id, parsed.data.content);
    if (parsed.data.wait) {
      await queue.wait(job.id);
      return { accepted: true, jobId: job.id, status: store.get<Session>(session.id)?.status };
    }
    return reply.code(202).send({ accepted: true, sessionId: session.id, jobId: job.id });
  });

  app.get<{ Params: { id: string } }>("/v1/interaction-jobs/:id", async (request, reply) => {
    const job = store.getInteractionJob(request.params.id);
    return job && visible<Session>(request, job.sessionId) ? job : reply.code(404).send({ error: "not_found" });
  });

  app.post<{ Params: { id: string; approvalId: string } }>("/v1/sessions/:id/approvals/:approvalId", async (request, reply) => {
    const parsed = z.object({ allowed: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
    const resolved = harness.resolveApproval(request.params.id, request.params.approvalId, parsed.data.allowed);
    return resolved ? { resolved: true } : reply.code(409).send({ error: "approval_not_active" });
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/stop", async (request, reply) => {
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
    return queue.stop(request.params.id) ? { stopped: true } : reply.code(409).send({ error: "session_not_running" });
  });

  app.post<{ Params: { id: string } }>("/api/v1/sessions/:id/interactions", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = z.object({ content: z.string().min(1), wait: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const session = visible<Session>(request, request.params.id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    if (["queued", "running", "waiting_approval"].includes(session.status)) return reply.code(409).send({ error: "session_running" });
    const job = queue.enqueue(session.id, parsed.data.content);
    if (parsed.data.wait) {
      await queue.wait(job.id);
      return { accepted: true, jobId: job.id, status: store.get<Session>(session.id)?.status };
    }
    return reply.code(202).send({ accepted: true, sessionId: session.id, jobId: job.id });
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/api/v1/sessions/:id/events", { preHandler: requireApiKey }, async (request, reply) => {
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
    return { items: store.events(request.params.id, Number(request.query.after ?? 0)) };
  });

  app.get<{ Querystring: { agentId?: string } }>("/v1/monitoring/summary", async (request): Promise<MonitoringSummary> => {
    const sessions = store.list<Session>("session", tenantScope(request)).filter((session) => !request.query.agentId || session.agentId === request.query.agentId);
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

  app.get("/metrics", { preHandler: requireAdmin }, async (_request, reply) => {
    const sessions = store.list<Session>("session");
    const events = sessions.flatMap((session) => store.events(session.id, 0, 10_000));
    const lines = [
      "# HELP snowmountain_sessions_total Managed sessions by current state.",
      "# TYPE snowmountain_sessions_total gauge",
      ...(["idle", "queued", "running", "waiting_approval", "failed", "stopped"] as const).map((status) => `snowmountain_sessions_total{status=\"${status}\"} ${sessions.filter((session) => session.status === status).length}`),
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

  app.get("/v1/settings", { preHandler: requireAdmin }, async () => ({
    product: "Snowmountain Ark",
    mode: "tenant-isolated",
    sandboxDriver: config.sandboxDriver,
    sandboxImage: config.sandboxImage,
    sandboxWorker: config.sandboxDriver === "remote" ? config.sandboxWorkerUrl : undefined,
    marketIndexUrl: config.marketIndexUrl,
    marketPublicUrl: config.marketPublicUrl,
    agentRuntime: "runtime-profile-registry",
    commandNetworkDefault: "full",
    networkScope: "Docker command container only; web_fetch runs in Worker, MCP and model calls run through control-plane proxies",
    memoryExtraction: "disabled-explicit-writes-only",
    modelCredentialConfigured: store.list<ModelEndpoint>("model-endpoint", "system").some((endpoint) => Boolean(endpoint.apiKeyCiphertext)),
    publishedModelCount: modelCatalog(store).length,
    runtimeProfileCount: store.count("runtime-profile", "system"),
    userCount: store.listUsers().length,
    vaultMasterKeyConfigured: Boolean(process.env.VAULT_MASTER_KEY),
    apiKeyCount: store.count("api-key"),
    eventStore: "sqlite-wal",
    runtime: process.version
  }));

  app.get("/v1/specs", { preHandler: requireAdmin }, async (): Promise<SpecBundle> => ({
    ...specBundle,
    runtimeFacts: [
      { id: "runtime.harness", label: "Agent 运行时", value: "runtime-profile-registry / snowmountain-harness", source: "RuntimeProfile" },
      { id: "runtime.model", label: "已发布模型目录项", value: modelCatalog(store).length, source: "ModelEndpoint" },
      { id: "runtime.tenancy", label: "数据隔离", value: "tenantId + admin/user", source: "AuthSession / SQLite" },
      { id: "runtime.sandbox", label: "Sandbox 驱动", value: config.sandboxDriver, source: "进程配置" },
      { id: "runtime.memory-extraction", label: "自动抽取长期 Memory", value: false, source: "memory.lifecycle" },
      { id: "runtime.resources", label: "中台资源数量", value: store.count(), source: "SQLite" },
      { id: "runtime.market", label: "Market 公开地址", value: config.marketPublicUrl, source: "进程配置" }
    ]
  }));

  app.get("/v1/dependencies", async (request) => ({ edges: dependencyEdges(store, tenantScope(request)) }));

  app.get("/v1/market/catalog", async () => {
    try {
      const response = await fetch(config.marketIndexUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`Market returned ${response.status}`);
      const payload = await response.json() as MarketCatalog;
      if (!new Set(["snowmountain-market-catalog/v1", "snowmountain-market-catalog/v2"]).has(payload.format ?? "") || !Array.isArray(payload.items)) throw new Error("Market returned an invalid catalog");
      return { ...payload, source: config.marketPublicUrl, endpoint: config.marketIndexUrl, offline: false };
    } catch (error) {
      app.log.warn({ error }, "Market catalog unavailable");
      return { items: [] as MarketEntry[], offline: true, source: config.marketPublicUrl, endpoint: config.marketIndexUrl, reason: "market_unreachable" };
    }
  });

  app.post<{ Params: { id: string } }>("/v1/sessions/:id/sandbox/inspect", async (request, reply) => {
    if (!visible<Session>(request, request.params.id)) return reply.code(404).send({ error: "not_found" });
    return sandbox.inspect(request.params.id);
  });

  return app;
}
