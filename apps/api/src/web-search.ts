export type WebSearchProvider = "tavily" | "firecrawl";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

export interface WebSearchResponse {
  provider: WebSearchProvider;
  query: string;
  results: WebSearchResult[];
  answer?: string;
  creditsUsed?: number;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface SearchOptions {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  maxResults?: number;
}

function requiredKey(provider: WebSearchProvider, env: Record<string, string | undefined>): string | undefined {
  return provider === "tavily" ? env.TAVILY_API_KEY : env.FIRECRAWL_API_KEY;
}

function providersFor(env: Record<string, string | undefined>): WebSearchProvider[] {
  const configured = (env.WEB_SEARCH_PROVIDER ?? "auto").trim().toLowerCase();
  if (configured === "tavily" || configured === "firecrawl") return [configured];
  if (configured !== "auto") throw new Error(`Unsupported WEB_SEARCH_PROVIDER: ${configured}`);
  return (["tavily", "firecrawl"] as const).filter((provider) => Boolean(requiredKey(provider, env)));
}

async function parseJson(response: Response, provider: WebSearchProvider): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${provider} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${provider} returned invalid JSON`);
  }
}

async function searchTavily(query: string, key: string, maxResults: number, fetchImpl: FetchLike): Promise<WebSearchResponse> {
  const response = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      query,
      topic: "general",
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const body = await parseJson(response, "tavily") as {
    answer?: unknown;
    results?: Array<{ title?: unknown; url?: unknown; content?: unknown; score?: unknown; published_date?: unknown }>;
    usage?: { credits?: unknown };
  };
  const results = (body.results ?? []).flatMap((item): WebSearchResult[] => {
    if (typeof item.url !== "string" || !item.url) return [];
    return [{
      title: typeof item.title === "string" ? item.title : item.url,
      url: item.url,
      content: typeof item.content === "string" ? item.content : "",
      ...(typeof item.score === "number" ? { score: item.score } : {}),
      ...(typeof item.published_date === "string" ? { publishedDate: item.published_date } : {})
    }];
  });
  return {
    provider: "tavily",
    query,
    results,
    ...(typeof body.answer === "string" && body.answer ? { answer: body.answer } : {}),
    ...(typeof body.usage?.credits === "number" ? { creditsUsed: body.usage.credits } : {})
  };
}

async function searchFirecrawl(query: string, key: string, maxResults: number, fetchImpl: FetchLike): Promise<WebSearchResponse> {
  const response = await fetchImpl("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query, limit: maxResults, sources: ["web"] }),
    signal: AbortSignal.timeout(30_000)
  });
  const body = await parseJson(response, "firecrawl") as {
    data?: { web?: Array<{ title?: unknown; url?: unknown; description?: unknown; markdown?: unknown }> };
    creditsUsed?: unknown;
  };
  const results = (body.data?.web ?? []).flatMap((item): WebSearchResult[] => {
    if (typeof item.url !== "string" || !item.url) return [];
    return [{
      title: typeof item.title === "string" ? item.title : item.url,
      url: item.url,
      content: typeof item.markdown === "string"
        ? item.markdown.slice(0, 8_000)
        : typeof item.description === "string" ? item.description : ""
    }];
  });
  return {
    provider: "firecrawl",
    query,
    results,
    ...(typeof body.creditsUsed === "number" ? { creditsUsed: body.creditsUsed } : {})
  };
}

export async function searchWeb(queryInput: string, options: SearchOptions = {}): Promise<WebSearchResponse> {
  const query = queryInput.trim();
  if (!query) throw new Error("web_search query is required");
  if (query.length > 2_000) throw new Error("web_search query is too long");

  const env = options.env ?? process.env;
  const providers = providersFor(env);
  if (!providers.length) {
    throw new Error("web_search requires TAVILY_API_KEY or FIRECRAWL_API_KEY");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxResults = Math.min(10, Math.max(1, Math.trunc(options.maxResults ?? 5)));
  const failures: string[] = [];

  for (const provider of providers) {
    const key = requiredKey(provider, env);
    if (!key) {
      failures.push(`${provider}: API key is not configured`);
      continue;
    }
    try {
      return provider === "tavily"
        ? await searchTavily(query, key, maxResults, fetchImpl)
        : await searchFirecrawl(query, key, maxResults, fetchImpl);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`web_search providers failed (${failures.join("; ")})`);
}
