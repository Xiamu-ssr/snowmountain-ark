import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Agent, Credential, Vault } from "@snowmountain/contracts";
import { Store } from "../src/db.js";
import { McpProxy } from "../src/mcp.js";
import { openSecret, sealSecret } from "../src/vault.js";

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

test("refreshes an expired OAuth client-credentials token outside the Sandbox", async () => {
  let tokenRequests = 0;
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (request.url === "/token") {
        tokenRequests += 1;
        assert.equal(request.headers.authorization, `Basic ${Buffer.from("client:secret").toString("base64")}`);
        assert.match(body, /grant_type=client_credentials/);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ access_token: "fresh-access-token", expires_in: 3600 }));
        return;
      }
      assert.equal(request.headers.authorization, "Bearer fresh-access-token");
      const rpc = JSON.parse(body) as { id: string };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { tools: [] } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("OAuth test server did not bind");
  const root = await mkdtemp(join(tmpdir(), "snowmountain-oauth-"));
  const store = new Store(join(root, "test.db"));
  try {
    const vault = store.create<Vault>("vault", { kind: "vault", name: "Test Vault", description: "" });
    const credential = store.create<Credential>("credential", {
      kind: "credential", name: "OAuth MCP", description: "", vaultId: vault.id,
      serverUrl: `http://127.0.0.1:${address.port}/mcp`, authType: "oauth",
      secretCiphertext: sealSecret("expired-token"), expiresAt: new Date(0).toISOString(),
      clientId: "client", clientSecretCiphertext: sealSecret("secret"),
      tokenUrl: `http://127.0.0.1:${address.port}/token`, scopes: ["mcp.read"]
    });
    const agent = store.create<Agent>("agent", {
      kind: "agent", name: "OAuth Agent", description: "", version: 1,
      baseAgent: "test", model: { provider: "mock", name: "mock" }, systemPrompt: "",
      skillIds: [], mcpIds: [], subAgentIds: [], tags: [],
      toolPolicies: { bash: "deny", read: "deny", write: "deny", edit: "deny", glob: "deny", grep: "deny", web_fetch: "deny", web_search: "deny" },
      mcpServers: [{ id: "oauth-server", name: "OAuth Server", url: credential.serverUrl, permission: "full", source: "manual", credentialId: credential.id }]
    });
    const proxy = new McpProxy(store);
    assert.deepEqual((await proxy.listTools(agent)).errors, []);
    assert.deepEqual((await proxy.listTools(agent)).errors, []);
    assert.equal(tokenRequests, 1);
    const refreshed = store.get<Credential>(credential.id);
    assert.equal(openSecret(refreshed!.secretCiphertext), "fresh-access-token");
    assert.ok(Date.parse(refreshed!.expiresAt ?? "") > Date.now());
  } finally {
    store.close();
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});
