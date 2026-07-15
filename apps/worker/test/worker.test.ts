import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Environment, Session, ToolCall } from "@snowmountain/contracts";
import { Sandbox } from "../../api/src/sandbox.js";
import { buildWorker } from "../src/app.js";

const now = new Date().toISOString();
const session: Session = {
  id: "sesn-remote", kind: "session", name: "remote", description: "", createdAt: now, updatedAt: now,
  agentId: "agent", agentVersion: 1, environmentId: "env", memoryStoreIds: [], status: "idle",
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, workspacePath: "/workspace",
  resourceConfig: { cpu: 1, memoryMiB: 512, maxRuntimeSeconds: 3600, networkMode: "full" }
};
const environment: Environment = {
  id: "env", kind: "environment", name: "env", description: "", createdAt: now, updatedAt: now,
  packages: [], variables: [], networkAllowlist: [], filesystemMode: "read-write-no-delete"
};

test("keeps the API client separate from an authenticated Sandbox Worker", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-worker-"));
  const worker = await buildWorker({ token: "worker-secret", dataDir: root, image: "alpine:3.20", driver: "local" });
  try {
    await worker.listen({ host: "127.0.0.1", port: 0 });
    const address = worker.server.address();
    if (!address || typeof address === "string") throw new Error("Worker did not bind");
    const denied = await worker.inject({ method: "POST", url: "/v1/provision", payload: { sessionId: session.id } });
    assert.equal(denied.statusCode, 401);
    const traversal = await worker.inject({
      method: "POST", url: "/v1/provision",
      headers: { authorization: "Bearer worker-secret" },
      payload: { sessionId: "../../outside" }
    });
    assert.equal(traversal.statusCode, 400);
    const sandbox = new Sandbox({ dataDir: join(root, "client-unused"), driver: "remote", image: "unused", workerUrl: `http://127.0.0.1:${address.port}`, workerToken: "worker-secret" });
    await sandbox.provision(session.id);
    const write: ToolCall = { id: "write", name: "write", input: { file_path: "/workspace/probe.txt", content: "remote-worker" } };
    const read: ToolCall = { id: "read", name: "read", input: { file_path: "/workspace/probe.txt" } };
    await sandbox.execute(write, session, environment);
    const result = await sandbox.execute(read, session, environment) as { content: string };
    assert.equal(result.content, "remote-worker");
  } finally {
    await worker.close();
    await rm(root, { recursive: true, force: true });
  }
});
