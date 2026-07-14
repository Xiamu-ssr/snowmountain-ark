import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../docs/sources/conversations/opus46-sdd-dialogue.raw.txt", import.meta.url);
const outputPath = new URL("../docs/sources/conversations/opus46-sdd-dialogue.md", import.meta.url);

const source = await readFile(inputPath, "utf8");
const lines = source.replace(/\r\n/g, "\n").split("\n");
const sha256 = createHash("sha256").update(source).digest("hex");

const blocks = [];
let cursor = 0;
let turn = 1;

const nextIndex = (start, matcher) => {
  for (let index = start; index < lines.length; index += 1) {
    if (matcher(lines[index])) return index;
  }
  return lines.length;
};

const trimOuterBlanks = (value) => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "") start += 1;
  while (end > start && value[end - 1] === "") end -= 1;
  return value.slice(start, end);
};

const addTextBlock = (role, content, metadata = {}) => {
  const body = trimOuterBlanks(content);
  if (body.length === 0) return;
  blocks.push({ role, body, metadata });
};

const firstAgent = nextIndex(0, (line) => line.startsWith("Anthropic:"));
addTextBlock("user", lines.slice(0, firstAgent), { turn });
cursor = firstAgent;

while (cursor < lines.length) {
  if (!lines[cursor].startsWith("Anthropic:")) {
    const nextAgent = nextIndex(cursor, (line) => line.startsWith("Anthropic:"));
    addTextBlock("user", lines.slice(cursor, nextAgent), { turn });
    cursor = nextAgent;
    continue;
  }

  const model = lines[cursor];
  const telemetryStart = nextIndex(cursor + 1, (line) => line.startsWith("Latency:"));
  addTextBlock("assistant", lines.slice(cursor + 1, telemetryStart), { turn, model });

  if (telemetryStart >= lines.length) break;
  const logDetail = nextIndex(telemetryStart, (line) => line === "Log Detail");
  const telemetryEnd = Math.min(logDetail + 1, lines.length);
  const telemetry = lines.slice(telemetryStart, telemetryEnd);
  const nextAgent = nextIndex(telemetryEnd, (line) => line.startsWith("Anthropic:"));
  const userBody = lines.slice(telemetryEnd, nextAgent);

  blocks.push({ role: "telemetry", body: telemetry, metadata: { turn } });
  turn += 1;
  addTextBlock("user", userBody, { turn });
  cursor = nextAgent;
}

const output = [
  "---",
  "type: conversation-transcript",
  "title: \"从 Opus 4.6 惊艳到精确 DSL：与 Claude Fable 5 的长对话\"",
  "description: \"用户与 Claude Fable 5 围绕基础模型、Spec-Driven Development、评测、DSL、记忆和产品形态展开的完整对话。\"",
  "interlocutor: \"Anthropic: Claude Fable 5 | Google Vertex\"",
  "resource: ./opus46-sdd-dialogue.raw.txt",
  "tags: [agent, managed-agents, sdd, spec, dsl, evaluation, memory]",
  "timestamp: 2026-07-13T00:00:00+08:00",
  "language: zh-CN",
  `source_sha256: ${sha256}`,
  "---",
  "",
  "# 从 Opus 4.6 惊艳到精确 DSL",
  "",
  "> 本文档只做结构化排版，不改写对话内容。角色标题、轮次和运行统计由格式化脚本补充；逐字原始文件见 [`opus46-sdd-dialogue.raw.txt`](./opus46-sdd-dialogue.raw.txt)，可用 frontmatter 中的 SHA-256 校验。原始粘贴中出现的 `Expand`、图片占位符和模型内部英文记录均原样保留。",
  "",
];

for (const block of blocks) {
  if (block.role === "telemetry") {
    output.push(
      "<details>",
      `<summary>第 ${block.metadata.turn} 轮运行统计</summary>`,
      "",
      "```text",
      ...block.body,
      "```",
      "",
      "</details>",
      "",
    );
    continue;
  }

  const title = block.role === "user" ? "用户" : `Agent · ${block.metadata.model}`;
  output.push(`## 第 ${block.metadata.turn} 轮 · ${title}`, "", ...block.body, "");
}

await writeFile(outputPath, `${output.join("\n").trimEnd()}\n`, "utf8");

console.log(`Formatted ${blocks.length} blocks -> ${outputPath.pathname}`);
console.log(`SHA-256 ${sha256}`);
