export interface AgentRuntime {
  run(sessionId: string, content: string): Promise<void>;
  stop(sessionId: string): boolean;
}
