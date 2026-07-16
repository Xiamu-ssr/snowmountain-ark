import type { Agent, PermissionMode, ToolName } from "@snowmountain/contracts";

export interface BuiltinToolDefinition {
  type: "function";
  function: {
    name: ToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const builtinFunctions: BuiltinToolDefinition["function"][] = [
  { name: "bash", description: "在 /workspace 中执行 shell 命令", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read", description: "读取 /workspace 内的 UTF-8 文件", parameters: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] } },
  { name: "write", description: "在 /workspace 内写入 UTF-8 文件", parameters: { type: "object", properties: { file_path: { type: "string" }, content: { type: "string" } }, required: ["file_path", "content"] } },
  { name: "edit", description: "精确替换工作区文件中的一个字符串", parameters: { type: "object", properties: { file_path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["file_path", "old_string", "new_string"] } },
  { name: "glob", description: "列出工作区文件", parameters: { type: "object", properties: { pattern: { type: "string" } } } },
  { name: "grep", description: "搜索工作区文件内容", parameters: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] } },
  { name: "web_fetch", description: "读取策略允许的 URL", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "web_search", description: "调用已配置的 Tavily / Firecrawl 搜索服务", parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "integer", minimum: 1, maximum: 10 } }, required: ["query"] } }
];

export const builtinToolDefinitions: BuiltinToolDefinition[] = builtinFunctions.map((item) => ({ type: "function", function: item }));

export function effectiveBuiltinTools(agent: Agent): Array<BuiltinToolDefinition & { permission: PermissionMode }> {
  return builtinToolDefinitions
    .filter((definition) => agent.toolPolicies[definition.function.name] !== "deny")
    .map((definition) => ({ ...definition, permission: agent.toolPolicies[definition.function.name] }));
}
