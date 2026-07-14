import type { Agent, Credential, McpServerBinding } from "@snowmountain/contracts";
import { Store } from "./db.js";
import { openSecret, sealSecret } from "./vault.js";

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id?: string | number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ExposedMcpTool {
  exposedName: string;
  remoteName: string;
  binding: McpServerBinding;
  definition: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "server";
}

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

export async function fetchClientCredentialsToken(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}): Promise<{ accessToken: string; expiresAt: string }> {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (input.scopes?.length) body.set("scope", input.scopes.join(" "));
  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64")}`
    },
    body,
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OAuth token endpoint returned ${response.status}`);
  const payload = JSON.parse(text) as OAuthTokenResponse;
  if (!payload.access_token) throw new Error("OAuth token endpoint returned no access_token");
  const reportedLifetime = Number(payload.expires_in ?? 3600);
  const lifetimeSeconds = Number.isFinite(reportedLifetime) ? Math.max(60, reportedLifetime) : 3600;
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + lifetimeSeconds * 1000).toISOString()
  };
}

export class McpProxy {
  private readonly refreshes = new Map<string, Promise<string>>();

  constructor(private readonly store: Store) {}

  async listTools(agent: Agent): Promise<{ tools: ExposedMcpTool[]; errors: Array<{ bindingId: string; message: string }> }> {
    const tools: ExposedMcpTool[] = [];
    const errors: Array<{ bindingId: string; message: string }> = [];
    for (const binding of agent.mcpServers ?? []) {
      if (binding.permission === "deny") continue;
      try {
        const result = await this.rpc<{ tools?: McpTool[] }>(binding, "tools/list", {});
        for (const remote of result.tools ?? []) {
          const exposedName = `mcp__${safeName(binding.name)}__${safeName(remote.name)}`;
          tools.push({
            exposedName,
            remoteName: remote.name,
            binding,
            definition: {
              type: "function",
              function: {
                name: exposedName,
                description: `[MCP ${binding.name}] ${remote.description ?? remote.name}`,
                parameters: remote.inputSchema ?? { type: "object", properties: {} }
              }
            }
          });
        }
      } catch (error) {
        errors.push({ bindingId: binding.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { tools, errors };
  }

  async call(tool: ExposedMcpTool, args: Record<string, unknown>): Promise<unknown> {
    return this.rpc(tool.binding, "tools/call", { name: tool.remoteName, arguments: args });
  }

  private async accessToken(credential: Credential): Promise<string> {
    const current = openSecret(credential.secretCiphertext);
    if (credential.authType === "bearer") return current;
    if (current && current !== "oauth-pending" && (!credential.expiresAt || Date.parse(credential.expiresAt) > Date.now() + 60_000)) return current;
    const inFlight = this.refreshes.get(credential.id);
    if (inFlight) return inFlight;
    if (!credential.tokenUrl || !credential.clientId || !credential.clientSecretCiphertext) {
      throw new Error(`OAuth Credential ${credential.id} has expired and cannot refresh without token URL, client ID and client secret`);
    }
    const refresh = fetchClientCredentialsToken({
      tokenUrl: credential.tokenUrl,
      clientId: credential.clientId,
      clientSecret: openSecret(credential.clientSecretCiphertext),
      ...(credential.scopes ? { scopes: credential.scopes } : {})
    }).then(({ accessToken, expiresAt }) => {
      this.store.update<Credential>(credential.id, {
        secretCiphertext: sealSecret(accessToken),
        expiresAt,
        validationStatus: "valid",
        lastValidatedAt: new Date().toISOString()
      });
      return accessToken;
    }).finally(() => this.refreshes.delete(credential.id));
    this.refreshes.set(credential.id, refresh);
    return refresh;
  }

  private async headers(binding: McpServerBinding): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream"
    };
    if (!binding.credentialId) return headers;
    const credential = this.store.get<Credential>(binding.credentialId);
    if (!credential) throw new Error(`Credential not found: ${binding.credentialId}`);
    const secret = await this.accessToken(credential);
    if (secret && secret !== "oauth-pending") headers.authorization = `Bearer ${secret}`;
    return headers;
  }

  private async rpc<T>(binding: McpServerBinding, method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(binding.url, {
      method: "POST",
      headers: await this.headers(binding),
      body: JSON.stringify({ jsonrpc: "2.0", id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, method, params }),
      signal: AbortSignal.timeout(30_000)
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP ${binding.name} returned ${response.status}: ${body.slice(0, 300)}`);
    const payload = response.headers.get("content-type")?.includes("text/event-stream")
      ? body.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => JSON.parse(line) as JsonRpcResponse<T>).at(-1)
      : JSON.parse(body) as JsonRpcResponse<T>;
    if (!payload) throw new Error(`MCP ${binding.name} returned no JSON-RPC payload`);
    if (payload.error) throw new Error(`MCP ${binding.name}: ${payload.error.message}`);
    if (payload.result === undefined) throw new Error(`MCP ${binding.name} returned no result`);
    return payload.result;
  }
}
