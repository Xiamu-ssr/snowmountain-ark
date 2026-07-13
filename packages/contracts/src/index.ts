export type ResourceKind =
  | "agent"
  | "environment"
  | "vault"
  | "credential"
  | "memory-store"
  | "session";

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
  baseUrl?: string;
  credentialId?: string;
}

export interface Agent extends BaseResource {
  kind: "agent";
  version: number;
  baseAgent: string;
  model: ModelConfig;
  systemPrompt: string;
  skillIds: string[];
  mcpIds: string[];
  subAgentIds: string[];
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
  lastValidatedAt?: string;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface MemoryStore extends BaseResource {
  kind: "memory-store";
  memories: MemoryEntry[];
}

export type SessionStatus = "idle" | "running" | "failed" | "stopped";

export interface Session extends BaseResource {
  kind: "session";
  agentId: string;
  environmentId: string;
  memoryStoreIds: string[];
  status: SessionStatus;
  inputTokens: number;
  outputTokens: number;
  workspacePath: string;
  lastError?: string;
}

export type SessionEventType =
  | "user"
  | "assistant"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "policy"
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
  name: ToolName;
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
  sha256?: string;
  permissions: string[];
  runtime: string;
  source: "local" | "remote";
}

export interface DependencyEdge {
  source: string;
  target: string;
  relation: string;
}

export type ManagedResource =
  | Agent
  | Environment
  | Vault
  | Credential
  | MemoryStore
  | Session;

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
