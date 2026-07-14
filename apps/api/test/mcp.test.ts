import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Agent } from "@snowmountain/contracts";
import { Store } from "../src/db.js";
import { McpProxy } from "../src/mcp.js";

test("discovers and calls a Streamable HTTP MCP through the proxy", async () => {
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const rpc = JSON.parse(body) as { id: string; method: string; params?: Record<string, unknown> };
      const result = rpc.method === "tools/list"
        ? { tools: [{ name: "echo", description: "Echo a value", inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] } }] }
        : { content: [{ type: "text", text: String((rpc.params?.arguments as Record<string, unknown>)?.value ?? "") }] };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("MCP test server did not bind");
  const root = await mkdtemp(join(tmpdir(), "snowmountain-mcp-"));
  const store = new Store(join(root, "test.db"));
  try {
    const agent = store.create<Agent>("agent", {
      kind: "agent", name: "MCP Agent", description: "", version: 1,
      baseAgent: "test", model: { provider: "mock", name: "mock" }, systemPrompt: "",
      skillIds: [], mcpIds: [], subAgentIds: [], tags: [],
      toolPolicies: { bash: "deny", read: "deny", write: "deny", edit: "deny", glob: "deny", grep: "deny", web_fetch: "deny", web_search: "deny" },
      mcpServers: [{ id: "echo-server", name: "Echo Server", url: `http://127.0.0.1:${address.port}/mcp`, permission: "full", source: "manual" }]
    });
    const proxy = new McpProxy(store);
    const discovered = await proxy.listTools(agent);
    assert.deepEqual(discovered.errors, []);
    assert.equal(discovered.tools.length, 1);
    assert.equal(discovered.tools[0]?.exposedName, "mcp__echo_server__echo");
    const result = await proxy.call(discovered.tools[0]!, { value: "snowmountain" });
    assert.match(JSON.stringify(result), /snowmountain/);
  } finally {
    store.close();
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});
