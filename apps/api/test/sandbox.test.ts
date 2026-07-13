import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Environment, Session, ToolCall } from "@snowmountain/contracts";
import { Sandbox } from "../src/sandbox.js";

const now = new Date().toISOString();
const session: Session = {
  id: "sesn-test", kind: "session", name: "test", description: "", createdAt: now, updatedAt: now,
  agentId: "agent-test", environmentId: "env-test", memoryStoreIds: [], status: "idle",
  inputTokens: 0, outputTokens: 0, workspacePath: "/workspace"
};
const environment: Environment = {
  id: "env-test", kind: "environment", name: "test", description: "", createdAt: now, updatedAt: now,
  packages: [], variables: [], networkAllowlist: [], filesystemMode: "read-write-no-delete"
};

function call(name: ToolCall["name"], input: Record<string, unknown>): ToolCall {
  return { id: `call-${name}`, name, input };
}

test("persists files across replaceable tool executions", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-sandbox-"));
  const sandbox = new Sandbox({ dataDir: root, driver: "local", image: "alpine:3.20" });
  try {
    await sandbox.execute(call("write", { file_path: "/workspace/runtime-probe.txt", content: "snowmountain-ark-managed-agent-probe" }), session, environment);
    const result = await sandbox.execute(call("read", { file_path: "/workspace/runtime-probe.txt" }), session, environment) as { content: string };
    assert.equal(result.content, "snowmountain-ark-managed-agent-probe");
    const pwd = await sandbox.execute(call("bash", { command: "pwd" }), session, environment) as { stdout: string };
    assert.equal(pwd.stdout.trim(), "/workspace");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects path traversal outside the session workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "snowmountain-sandbox-"));
  const sandbox = new Sandbox({ dataDir: root, driver: "local", image: "alpine:3.20" });
  try {
    await assert.rejects(() => sandbox.execute(call("write", { file_path: "../../escape.txt", content: "no" }), session, environment), /escapes the session workspace/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
