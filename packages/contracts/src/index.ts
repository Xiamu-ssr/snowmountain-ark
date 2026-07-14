export type ResourceKind =
  | "agent"
  | "environment"
  | "vault"
  | "credential"
  | "memory-store"
  | "session"
  | "api-key";

export type ToolName =
  | "bash"
  | "read"
  | "write"
  | "edit"
  | "glob"
  | "grep"
  | "web_fetch"
  | "web_search";

export type PermissionMode = "full" | "workspace" | "approval" | "deny";

export interface BaseResource {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelConfig {
  provider: "mock" | "openai-compatible";
  name: string;
  baseUrl?: string | undefined;
  credentialId?: string | undefined;
  endpointId?: string | undefined;
  displayName?: string | undefined;
  contextWindow?: number | undefined;
  inputPricePerK?: number | undefined;
  cachedInputPricePerK?: number | undefined;
  outputPricePerK?: number | undefined;
  rpm?: number | undefined;
  tpm?: number | undefined;
}

export interface McpServerBinding {
  id: string;
  name: string;
  url: string;
  permission: Exclude<PermissionMode, "workspace">;
  credentialId?: string | undefined;
  source: "preset" | "manual" | "market";
  description?: string | undefined;
}

export interface Agent extends BaseResource {
  kind: "agent";
  version: number;
  baseAgent: string;
  model: ModelConfig;
  systemPrompt: string;
  skillIds: string[];
  mcpIds: string[];
  mcpServers?: McpServerBinding[] | undefined;
  subAgentIds: string[];
  subAgentVersions?: Record<string, number> | undefined;
  toolPolicies: Record<ToolName, PermissionMode>;
  tags: string[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface Environment extends BaseResource {
  kind: "environment";
  packages: string[];
  variables: EnvironmentVariable[];
  networkAllowlist: string[];
  filesystemMode: "read-only" | "read-write" | "read-write-no-delete";
}

export interface Vault extends BaseResource {
  kind: "vault";
}

export interface Credential extends BaseResource {
  kind: "credential";
  vaultId: string;
  serverUrl: string;
  authType: "bearer" | "oauth";
  secretCiphertext: string;
  mcpServerId?: string | undefined;
  mcpServerName?: string | undefined;
  clientId?: string | undefined;
  clientSecretCiphertext?: string | undefined;
  expiresAt?: string | undefined;
  validationStatus?: "unvalidated" | "valid" | "invalid" | undefined;
  lastValidatedAt?: string | undefined;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface MemoryStore extends BaseResource {
  kind: "memory-store";
  memories: MemoryEntry[];
}

export type SessionStatus = "idle" | "running" | "waiting_approval" | "failed" | "stopped";

export interface SessionResourceConfig {
  cpu: number;
  memoryMiB: number;
  maxRuntimeSeconds: number;
  networkMode: "deny" | "allowlist";
}

export interface PendingApproval {
  id: string;
  call: ToolCall;
  reason: string;
  createdAt: string;
}

export interface Session extends BaseResource {
  kind: "session";
  agentId: string;
  agentVersion: number;
  environmentId: string;
  memoryStoreIds: string[];
  status: SessionStatus;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  workspacePath: string;
  resourceConfig: SessionResourceConfig;
  pendingApproval?: PendingApproval | undefined;
  startedAt?: string | undefined;
  stoppedAt?: string | undefined;
  lastError?: string | undefined;
}

export type SessionEventType =
  | "user"
  | "assistant"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "policy"
  | "model_request_start"
  | "model_request_end"
  | "approval_request"
  | "approval_result"
  | "mcp_use"
  | "mcp_result"
  | "subagent_use"
  | "subagent_result"
  | "status"
  | "error";

export interface SessionEvent<T = unknown> {
  id: string;
  sessionId: string;
  sequence: number;
  type: SessionEventType;
  payload: T;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface PolicyDecision {
  effect: "allow" | "deny" | "approval";
  reason: string;
  rule: string;
}

export interface MarketEntry {
  id: string;
  type: "skill" | "mcp" | "tool" | "agent";
  title: string;
  description: string;
  version: string;
  tags: string[];
  resource: string;
  downloadUrl: string;
  sha256?: string | undefined;
  permissions: string[];
  runtime: string;
  source: "local" | "remote";
}

export interface DependencyEdge {
  source: string;
  target: string;
  relation: string;
}

export interface ApiKey extends BaseResource {
  kind: "api-key";
  keyPrefix: string;
  keyHash: string;
  lastUsedAt?: string | undefined;
  revokedAt?: string | undefined;
}

export interface MonitoringSummary {
  sessions: number;
  running: number;
  waitingApproval: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
  modelRequests: number;
}

export type ManagedResource =
  | Agent
  | Environment
  | Vault
  | Credential
  | MemoryStore
  | Session
  | ApiKey;

export const defaultToolPolicies: Record<ToolName, PermissionMode> = {
  bash: "approval",
  read: "workspace",
  write: "workspace",
  edit: "workspace",
  glob: "workspace",
  grep: "workspace",
  web_fetch: "approval",
  web_search: "approval"
};
