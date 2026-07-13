import type { Agent, Environment, PolicyDecision, ToolCall } from "@snowmountain/contracts";

const destructiveShell = [
  /\brm\s+-rf\s+(\/|~|\$HOME)\b/i,
  /\bgit\s+push\b.*\s--force(?:-with-lease)?\b/i,
  /\b(?:curl|wget)\b.*\|\s*(?:sh|bash)\b/i,
  /\b(?:shutdown|reboot|mkfs|dd\s+if=)\b/i,
  /\b(?:crontab|launchctl|systemctl\s+enable)\b/i
];

export function decidePolicy(call: ToolCall, agent: Agent, environment: Environment): PolicyDecision {
  const mode = agent.toolPolicies[call.name] ?? "deny";
  if (mode === "deny") return { effect: "deny", reason: `${call.name} is disabled for this agent`, rule: "tool.disabled" };
  if (mode === "approval") return { effect: "approval", reason: `${call.name} requires explicit approval`, rule: "tool.approval" };

  if (call.name === "bash") {
    const command = String(call.input.command ?? "");
    if (destructiveShell.some((pattern) => pattern.test(command))) {
      return { effect: "deny", reason: "Command crosses the destructive-action boundary", rule: "shell.destructive" };
    }
  }

  if (call.name === "web_fetch") {
    const rawUrl = String(call.input.url ?? "");
    try {
      const url = new URL(rawUrl);
      if (!environment.networkAllowlist.includes(url.hostname)) {
        return { effect: "deny", reason: `${url.hostname} is outside the environment capability grant`, rule: "network.egress" };
      }
    } catch {
      return { effect: "deny", reason: "Invalid network target", rule: "network.invalid-url" };
    }
  }

  return { effect: "allow", reason: mode === "workspace" ? "Allowed inside the session workspace" : "Allowed by agent policy", rule: `tool.${mode}` };
}
