import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Agent, Session, SessionEvent } from "@snowmountain/contracts";
import { buildApp } from "../src/app.js";

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

test("pins a Session to the Agent version selected at creation", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    const before = (await app.inject({ method: "GET", url: "/v1/agents/agent-snowmountain-guide" })).json<Agent>();
    assert.equal(before.version, 1);
    const updated = (await app.inject({ method: "PATCH", url: "/v1/agents/agent-snowmountain-guide", payload: { description: "new version" } })).json<Agent>();
    assert.equal(updated.version, 2);
    const originalSession = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo" })).json<Session>();
    assert.equal(originalSession.agentVersion, 1);
    const interaction = await app.inject({ method: "POST", url: "/v1/sessions/sesn-snowmountain-demo/interactions", payload: { content: "说明当前版本", wait: true } });
    assert.equal(interaction.statusCode, 200, interaction.body);
    const events = (await app.inject({ method: "GET", url: "/v1/sessions/sesn-snowmountain-demo/events" })).json<{ items: SessionEvent[] }>().items;
    assert.match(JSON.stringify(events.filter((event) => event.type === "assistant").at(-1)?.payload), /V1/);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("pauses an approval tool call and resumes after a human decision", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-api-"));
  const app = await buildApp({ databasePath: join(root, "test.db"), dataDir: root, seed: true });
  try {
    await app.inject({ method: "PATCH", url: "/v1/agents/agent-snowmountain-guide", payload: { toolPolicies: { bash: "approval", read: "workspace", write: "workspace", edit: "workspace", glob: "workspace", grep: "workspace", web_fetch: "approval", web_search: "approval" } } });
    const created = (await app.inject({ method: "POST", url: "/v1/sessions", payload: { name: "approval", agentId: "agent-snowmountain-guide", environmentId: "env-default" } })).json<Session>();
    const accepted = await app.inject({ method: "POST", url: `/v1/sessions/${created.id}/interactions`, payload: { content: "运行 probe" } });
    assert.equal(accepted.statusCode, 202, accepted.body);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const waiting = (await app.inject({ method: "GET", url: `/v1/sessions/${created.id}` })).json<Session>();
    assert.equal(waiting.status, "waiting_approval");
    assert.ok(waiting.pendingApproval);
    const resolution = await app.inject({ method: "POST", url: `/v1/sessions/${created.id}/approvals/${waiting.pendingApproval?.id}`, payload: { allowed: true } });
    assert.equal(resolution.statusCode, 200, resolution.body);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const finished = (await app.inject({ method: "GET", url: `/v1/sessions/${created.id}` })).json<Session>();
    assert.equal(finished.status, "idle");
    const events = (await app.inject({ method: "GET", url: `/v1/sessions/${created.id}/events` })).json<{ items: SessionEvent[] }>().items;
    assert.ok(events.some((event) => event.type === "approval_request"));
    assert.ok(events.some((event) => event.type === "approval_result"));
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
