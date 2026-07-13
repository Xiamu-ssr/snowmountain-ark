import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SessionEvent } from "@snowmountain/contracts";
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
