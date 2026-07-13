import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, Environment, ToolCall } from "@snowmountain/contracts";
import { defaultToolPolicies } from "@snowmountain/contracts";
import { decidePolicy } from "../src/policy.js";

const now = new Date().toISOString();
const agent: Agent = {
  id: "agent-test", kind: "agent", name: "test", description: "", createdAt: now, updatedAt: now,
  version: 1, baseAgent: "test", model: { provider: "mock", name: "mock" }, systemPrompt: "",
  skillIds: [], mcpIds: [], subAgentIds: [], tags: [],
  toolPolicies: { ...defaultToolPolicies, bash: "full", web_fetch: "full" }
};
const environment: Environment = {
  id: "env-test", kind: "environment", name: "test", description: "", createdAt: now, updatedAt: now,
  packages: [], variables: [], filesystemMode: "read-write-no-delete", networkAllowlist: ["api.example.com"]
};

function call(name: ToolCall["name"], input: Record<string, unknown>): ToolCall {
  return { id: "call-test", name, input };
}

test("blocks destructive shell even when tool has full access", () => {
  const decision = decidePolicy(call("bash", { command: "git push origin main --force" }), agent, environment);
  assert.equal(decision.effect, "deny");
  assert.equal(decision.rule, "shell.destructive");
});

test("treats an egress allowlist as a capability grant", () => {
  assert.equal(decidePolicy(call("web_fetch", { url: "https://api.example.com/data" }), agent, environment).effect, "allow");
  const denied = decidePolicy(call("web_fetch", { url: "https://evil.example/data" }), agent, environment);
  assert.equal(denied.effect, "deny");
  assert.equal(denied.rule, "network.egress");
});

test("returns approval instead of silently executing approval tools", () => {
  const approvalAgent = { ...agent, toolPolicies: { ...agent.toolPolicies, bash: "approval" as const } };
  assert.equal(decidePolicy(call("bash", { command: "pwd" }), approvalAgent, environment).effect, "approval");
});
