import assert from "node:assert/strict";
import test from "node:test";
import { searchWeb } from "../src/web-search.js";

test("uses Tavily first and returns a compact normalized result", async () => {
  let authorization = "";
  const result = await searchWeb("managed agents", {
    env: { WEB_SEARCH_PROVIDER: "auto", TAVILY_API_KEY: "tvly-test", FIRECRAWL_API_KEY: "fc-test" },
    fetchImpl: async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({
        results: [{ title: "Managed agents", url: "https://example.com/agents", content: "Durable harness", score: 0.9 }],
        usage: { credits: 1 }
      }), { status: 200 });
    }
  });
  assert.equal(authorization, "Bearer tvly-test");
  assert.equal(result.provider, "tavily");
  assert.equal(result.results[0]?.content, "Durable harness");
  assert.equal(result.creditsUsed, 1);
});

test("falls back to Firecrawl when Tavily fails", async () => {
  const calls: string[] = [];
  const result = await searchWeb("agent sandbox", {
    env: { WEB_SEARCH_PROVIDER: "auto", TAVILY_API_KEY: "tvly-test", FIRECRAWL_API_KEY: "fc-test" },
    fetchImpl: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("tavily")) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({
        success: true,
        data: { web: [{ title: "Sandbox", url: "https://example.com/sandbox", description: "Isolated execution" }] },
        creditsUsed: 2
      }), { status: 200 });
    }
  });
  assert.deepEqual(calls, ["https://api.tavily.com/search", "https://api.firecrawl.dev/v2/search"]);
  assert.equal(result.provider, "firecrawl");
  assert.equal(result.results[0]?.content, "Isolated execution");
});

test("fails clearly when no provider is configured", async () => {
  await assert.rejects(() => searchWeb("hello", { env: {} }), /requires TAVILY_API_KEY or FIRECRAWL_API_KEY/);
});
