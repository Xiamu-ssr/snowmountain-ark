import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Agent, Session, SessionEvent } from "@snowmountain/contracts";
import { buildApp } from "../src/app.js";
import { Store } from "../src/db.js";

test("runs a managed interaction and records an append-only evidence trail", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);

    const interaction = await app.inject({
      method: "POST",
      url: "/v1/sessions/sesn-snowmountain-demo/interactions",
      payload: { content: "运行 workspace 持久性探针 probe", wait: true }
    });
    assert.equal(interaction.statusCode, 200, interaction.body);

    const eventResponse = await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" });
    const events = eventResponse.json<{ items: SessionEvent[] }>().items;
    assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
    assert.ok(events.some((event) => event.type === "tool_use"));
    assert.ok(events.some((event) => event.type === "tool_result"));
    assert.equal(events.at(-1)?.type, "status");
    assert.equal((events.at(-1)?.payload as { status: string }).status, "idle");

    const followup = await app.inject({
      method: "POST",
      url: "/v1/sessions/sesn-snowmountain-demo/interactions",
      payload: { content: "只使用 read tool 读取 runtime-probe", wait: true }
    });
    assert.equal(followup.statusCode, 200, followup.body);
    const finalEvents = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" })).json<{ items: SessionEvent[] }>().items;
    const assistant = finalEvents.filter((event) => event.type === "assistant").at(-1);
    assert.match(JSON.stringify(assistant?.payload), /snowmountain-ark-managed-agent-probe/);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects deletion of a resource referenced by a session", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const response = await app.inject({ method: "DELETE", url: "/v1/environments/env-default" });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, "resource_in_use");
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("binds a Session to an Agent and follows its active version", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const before = (await app.inject({ method: "GET", url: "/v1/agents/agent-snowmountain-guide" })).json<Agent>();
    assert.equal(before.version, 1);
    assert.equal(before.activeVersion, 1);
    const updated = (await app.inject({ method: "PATCH", url: "/v1/agents/agent-snowmountain-guide", payload: { description: "new version" } })).json<Agent>();
    assert.equal(updated.version, 2);
    assert.equal(updated.activeVersion, 1);
    const originalSession = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo" })).json<Session>();
    assert.equal(originalSession.agentVersion, undefined);
    const interaction = await app.inject({ method: "POST", url: "/v1/sessions/sesn-snowmountain-demo/interactions", payload: { content: "说明当前版本", wait: true } });
    assert.equal(interaction.statusCode, 200, interaction.body);
    let events = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" })).json<{ items: SessionEvent[] }>().items;
    assert.match(JSON.stringify(events.filter((event) => event.type === "assistant").at(-1)?.payload), /V1/);
    const activated = await app.inject({ method: "POST", url: "/v1/agents/agent-snowmountain-guide/active-version", payload: { version: 2 } });
    assert.equal(activated.statusCode, 200, activated.body);
    assert.equal(activated.json<Agent>().activeVersion, 2);
    const nextInteraction = await app.inject({ method: "POST", url: "/v1/sessions/sesn-snowmountain-demo/interactions", payload: { content: "再次说明当前版本", wait: true } });
    assert.equal(nextInteraction.statusCode, 200, nextInteraction.body);
    events = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" })).json<{ items: SessionEvent[] }>().items;
    assert.match(JSON.stringify(events.filter((event) => event.type === "assistant").at(-1)?.payload), /V2/);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("auto-allows approval-mode tools during the debugging phase", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const approvalVersion = (await app.inject({ method: "PATCH", url: "/v1/agents/agent-snowmountain-guide", payload: { toolPolicies: { bash: "approval", read: "workspace", write: "workspace", edit: "workspace", glob: "workspace", grep: "workspace", web_fetch: "approval", web_search: "approval" } } })).json<Agent>();
    await app.inject({ method: "POST", url: "/v1/agents/agent-snowmountain-guide/active-version", payload: { version: approvalVersion.version } });
    const created = (await app.inject({ method: "POST", url: "/v1/sessions", payload: { name: "approval", agentId: "agent-snowmountain-guide", environmentId: "env-default" } })).json<Session>();
    const accepted = await app.inject({ method: "POST", url: `/v1/sessions/${created.id}/interactions`, payload: { content: "运行 probe", wait: true } });
    assert.equal(accepted.statusCode, 200, accepted.body);
    const finished = (await app.inject({ method: "GET", url: `/v1/sessions/${created.id}` })).json<Session>();
    assert.equal(finished.status, "idle");
    assert.equal(finished.pendingApproval, undefined);
    const events = (await app.inject({ method: "GET", url: `/v1/sessions/${created.id}/events` })).json<{ items: SessionEvent[] }>().items;
    assert.ok(!events.some((event) => event.type === "approval_request"));
    assert.ok(events.some((event) => event.type === "policy" && (event.payload as { rule?: string }).rule === "approval.auto"));
    assert.ok(events.some((event) => event.type === "tool_result"));
    const staleResolution = await app.inject({ method: "POST", url: `/v1/sessions/${created.id}/approvals/appr-stale`, payload: { allowed: true } });
    assert.equal(staleResolution.statusCode, 200, staleResolution.body);
    assert.equal(staleResolution.json().autoApproval, true);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("exposes the middleware API only with a one-time API key", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const denied = await app.inject({ method: "POST", url: "/api/v1/sessions/sesn-snowmountain-demo/interactions", payload: { content: "hello" } });
    assert.equal(denied.statusCode, 401);
    const key = (await app.inject({ method: "POST", url: "/v1/api-keys", payload: { name: "test-key" } })).json<{ secret: string; keyHash: string }>();
    assert.match(key.secret, /^smak_/);
    assert.equal(key.keyHash, "••••••••");
    const accepted = await app.inject({ method: "POST", url: "/api/v1/sessions/sesn-snowmountain-demo/interactions", headers: { authorization: `Bearer ${key.secret}` }, payload: { content: "hello", wait: true } });
    assert.equal(accepted.statusCode, 200, accepted.body);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("protects the control plane with login cookies, CSRF and audit events", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-auth-"));
  const app = await buildApp({
    databasePath: join(root, "test.db"), dataDir: root, seed: true,
    auth: { username: "admin", password: "correct-horse-battery-staple", cookiePath: "/" }
  });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    const anonymous = await app.inject({ method: "GET", url: "/v1/agents" });
    assert.equal(anonymous.statusCode, 401);
    const wrong = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { username: "admin", password: "wrong" } });
    assert.equal(wrong.statusCode, 401);
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { username: "admin", password: "correct-horse-battery-staple" } });
    assert.equal(login.statusCode, 200, login.body);
    const setCookieHeader = login.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [String(setCookieHeader)];
    const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
    const csrf = /sm_ark_csrf=([^;]+)/.exec(cookie)?.[1];
    assert.ok(csrf);
    const authenticated = await app.inject({ method: "GET", url: "/v1/agents", headers: { cookie } });
    assert.equal(authenticated.statusCode, 200, authenticated.body);
    const missingCsrf = await app.inject({ method: "POST", url: "/v1/vaults", headers: { cookie }, payload: { name: "blocked" } });
    assert.equal(missingCsrf.statusCode, 403);
    const created = await app.inject({ method: "POST", url: "/v1/vaults", headers: { cookie, "x-csrf-token": decodeURIComponent(csrf!) }, payload: { name: "audited" } });
    assert.equal(created.statusCode, 201, created.body);
    const audit = await app.inject({ method: "GET", url: "/v1/audit", headers: { cookie } });
    assert.equal(audit.statusCode, 200, audit.body);
    assert.ok(audit.json<{ items: Array<{ action: string; statusCode: number }> }>().items.some((event) => event.action === "POST /v1/vaults" && event.statusCode === 201));
    const logout = await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { cookie, "x-csrf-token": decodeURIComponent(csrf!) } });
    assert.equal(logout.statusCode, 200, logout.body);
    const afterLogout = await app.inject({ method: "GET", url: "/v1/agents", headers: { cookie } });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("isolates managed resources by tenant while administrators retain platform visibility", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-tenants-"));
  const app = await buildApp({
    databasePath: join(root, "test.db"), dataDir: root, seed: true,
    auth: { username: "admin", password: "correct-horse-battery-staple", cookiePath: "/" }
  });
  const login = async (username: string, password: string) => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { username, password } });
    assert.equal(response.statusCode, 200, response.body);
    const values = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [String(response.headers["set-cookie"] ?? "")];
    const cookie = values.map((value) => value.split(";", 1)[0]).join("; ");
    const csrf = decodeURIComponent(/sm_ark_csrf=([^;]+)/.exec(cookie)?.[1] ?? "");
    return { cookie, csrf };
  };
  try {
    const admin = await login("admin", "correct-horse-battery-staple");
    for (const user of [
      { username: "alice", password: "tenant-alpha-password", tenantId: "tenant-alpha" },
      { username: "bob", password: "tenant-bravo-password", tenantId: "tenant-bravo" }
    ]) {
      const created = await app.inject({ method: "POST", url: "/v1/admin/users", headers: { cookie: admin.cookie, "x-csrf-token": admin.csrf }, payload: user });
      assert.equal(created.statusCode, 201, created.body);
    }
    const alice = await login("alice", "tenant-alpha-password");
    const aliceVault = await app.inject({ method: "POST", url: "/v1/vaults", headers: { cookie: alice.cookie, "x-csrf-token": alice.csrf }, payload: { name: "Alice Vault" } });
    assert.equal(aliceVault.statusCode, 201, aliceVault.body);
    assert.equal(aliceVault.json().tenantId, "tenant-alpha");

    const bob = await login("bob", "tenant-bravo-password");
    const bobVaults = await app.inject({ method: "GET", url: "/v1/vaults", headers: { cookie: bob.cookie } });
    assert.deepEqual(bobVaults.json().items, []);
    const crossTenantRead = await app.inject({ method: "GET", url: `/v1/vaults/${aliceVault.json().id}`, headers: { cookie: bob.cookie } });
    assert.equal(crossTenantRead.statusCode, 404);
    const crossTenantDelete = await app.inject({ method: "DELETE", url: `/v1/vaults/${aliceVault.json().id}`, headers: { cookie: bob.cookie, "x-csrf-token": bob.csrf } });
    assert.equal(crossTenantDelete.statusCode, 404);

    const adminVaults = await app.inject({ method: "GET", url: "/v1/vaults", headers: { cookie: admin.cookie } });
    assert.ok(adminVaults.json().items.some((vault: { id: string }) => vault.id === aliceVault.json().id));
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("publishes administrator-managed models and Runtime profiles to Agent creators", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-model-catalog-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const models = (await app.inject({ method: "GET", url: "/v1/model-catalog" })).json<{ items: Array<{ id: string; endpointId: string; name: string; provider: string }> }>().items;
    const runtimes = (await app.inject({ method: "GET", url: "/v1/runtime-profiles" })).json<{ items: Array<{ id: string; default: boolean }> }>().items;
    assert.ok(models.some((model) => model.name === "deterministic-local-harness"));
    assert.ok(runtimes.some((runtime) => runtime.default));
    const selected = models[0]!;
    const runtime = runtimes.find((item) => item.default)!;
    const agent = await app.inject({
      method: "POST", url: "/v1/agents",
      payload: { name: "catalog-agent", model: { provider: selected.provider, name: selected.name, endpointId: selected.endpointId }, baseAgent: runtime.id }
    });
    assert.equal(agent.statusCode, 201, agent.body);
    assert.equal(agent.json().model.endpointId, selected.endpointId);
    assert.equal(agent.json().baseAgent, runtime.id);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("recovers in-flight Sessions after a control-plane restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-recovery-"));
  const databasePath = join(root, "test.db");
  const first = await buildApp({ databasePath, dataDir: root, seed: true });
  await first.close();

  const store = new Store(databasePath);
  store.update<Session>("sesn-snowmountain-demo", {
    status: "waiting_approval",
    pendingApproval: {
      id: "appr-interrupted",
      call: { id: "call-interrupted", name: "bash", input: { command: "pwd" } },
      reason: "test",
      createdAt: new Date().toISOString()
    }
  });
  store.close();

  const restarted = await buildApp({ databasePath, dataDir: root, seed: true });
  try {
    const recovered = (await restarted.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo" })).json<Session>();
    assert.equal(recovered.status, "failed");
    assert.equal(recovered.pendingApproval, undefined);
    assert.match(recovered.lastError ?? "", /control-plane restart/);
    const events = (await restarted.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" })).json<{ items: SessionEvent[] }>().items;
    assert.equal((events.at(-1)?.payload as { stopReason?: { type?: string } }).stopReason?.type, "control_plane_restart");

    const retried = await restarted.inject({
      method: "POST",
      url: "/v1/sessions/sesn-snowmountain-demo/interactions",
      payload: { content: "retry after restart", wait: true }
    });
    assert.equal(retried.statusCode, 200, retried.body);
  } finally {
    await restarted.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("drains a queued interaction persisted before startup", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-queue-"));
  const databasePath = join(root, "test.db");
  const initial = await buildApp({ databasePath, dataDir: root, seed: true });
  await initial.close();

  const store = new Store(databasePath);
  const job = store.enqueueInteraction("sesn-snowmountain-demo", "persisted queue probe");
  store.close();

  const restarted = await buildApp({ databasePath, dataDir: root, seed: true });
  try {
    let session: Session | undefined;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      session = (await restarted.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo" })).json<Session>();
      if (session.status === "idle") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(session?.status, "idle");
    const completed = await restarted.inject({ method: "GET", url: `/v1/interaction-jobs/${job.id}` });
    assert.equal(completed.statusCode, 200, completed.body);
    assert.equal(completed.json().status, "completed");
  } finally {
    await restarted.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("serves the validated YAML Spec bundle with runtime facts", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-specs-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const response = await app.inject({ method: "GET", url: "/v1/specs" });
    assert.equal(response.statusCode, 200, response.body);
    const bundle = response.json<{ format: string; items: Array<{ dsl: string; metadata: { id: string } }>; runtimeFacts: Array<{ id: string }> }>();
    assert.equal(bundle.format, "snowmountain.spec.bundle/v1");
    assert.ok(bundle.items.some((item) => item.dsl === "snowmountain.spec/v1" && item.metadata.id === "session.lifecycle"));
    assert.ok(bundle.runtimeFacts.some((fact) => fact.id === "runtime.harness"));
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("resolves Session tools from the Agent active version and hides denied tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-tools-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const original = await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/effective-tools" });
    assert.equal(original.statusCode, 200, original.body);
    const originalTools = original.json<{ agentVersion: number; builtin: Array<{ name: string }> }>();
    assert.equal(originalTools.agentVersion, 1);
    assert.ok(originalTools.builtin.some((tool) => tool.name === "web_search"));

    const current = (await app.inject({ method: "GET", url: "/v1/agents/agent-snowmountain-guide" })).json<Agent>();
    const updated = (await app.inject({
      method: "PATCH",
      url: "/v1/agents/agent-snowmountain-guide",
      payload: { toolPolicies: { ...current.toolPolicies, web_search: "deny" } }
    })).json<Agent>();
    assert.equal(updated.version, 2);

    const beforeActivation = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/effective-tools" })).json<{ agentVersion: number; builtin: Array<{ name: string }> }>();
    assert.equal(beforeActivation.agentVersion, 1);
    assert.ok(beforeActivation.builtin.some((tool) => tool.name === "web_search"));

    const nextSession = (await app.inject({ method: "POST", url: "/v1/sessions", payload: { name: "v2-tools", agentId: updated.id, environmentId: "env-default" } })).json<Session>();
    const beforeActivationNext = (await app.inject({ method: "GET", url: `/v1/sessions/${nextSession.id}/effective-tools` })).json<{ agentVersion: number; builtin: Array<{ name: string }> }>();
    assert.equal(beforeActivationNext.agentVersion, 1);
    const activation = await app.inject({ method: "POST", url: `/v1/agents/${updated.id}/active-version`, payload: { version: 2 } });
    assert.equal(activation.statusCode, 200, activation.body);
    for (const sessionId of ["sesn-snowmountain-demo", nextSession.id]) {
      const activeTools = (await app.inject({ method: "GET", url: `/v1/sessions/${sessionId}/effective-tools` })).json<{ agentVersion: number; builtin: Array<{ name: string }> }>();
      assert.equal(activeTools.agentVersion, 2);
      assert.ok(!activeTools.builtin.some((tool) => tool.name === "web_search"));
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("requires explicit Credential references and rejects Environment secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-credentials-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const environment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      payload: { name: "unsafe-env", variables: [{ key: "TOKEN", value: "secret", secret: true }] }
    });
    assert.equal(environment.statusCode, 400, environment.body);
    assert.equal(environment.json().error, "environment_secret_not_allowed");

    const vault = (await app.inject({ method: "POST", url: "/v1/vaults", payload: { name: "model-vault" } })).json<{ id: string }>();
    const credential = (await app.inject({
      method: "POST",
      url: "/v1/credentials",
      payload: { name: "model-key", vaultId: vault.id, usage: "model", serverUrl: "https://models.example.com/v1", authType: "bearer", secret: "test-secret" }
    })).json<{ id: string }>();
    const agent = await app.inject({
      method: "POST",
      url: "/v1/agents",
      payload: { name: "explicit-model", model: { provider: "openai-compatible", name: "test-model", baseUrl: "https://models.example.com/v1", credentialId: credential.id } }
    });
    assert.equal(agent.statusCode, 201, agent.body);
    const wrongUsage = await app.inject({
      method: "POST",
      url: "/v1/agents",
      payload: { name: "wrong-binding", mcpServers: [{ id: "mcp", name: "MCP", url: "https://mcp.example.com/mcp", permission: "full", source: "manual", credentialId: credential.id }] }
    });
    assert.equal(wrongUsage.statusCode, 400, wrongUsage.body);
    assert.equal(wrongUsage.json().error, "credential_usage_mismatch");
    const deletion = await app.inject({ method: "DELETE", url: `/v1/credentials/${credential.id}` });
    assert.equal(deletion.statusCode, 409, deletion.body);
    assert.ok(deletion.json().dependents.some((edge: { source: string; relation: string }) => edge.source === agent.json().id && edge.relation === "uses-model-credential"));
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
