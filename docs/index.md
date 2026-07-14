---
type: index
title: 雪山方舟知识库
description: 雪山方舟与雪山 Market 的研究、产品设计和工程决策入口。
tags: [managed-agents, okf, architecture]
timestamp: 2026-07-13T23:58:00+08:00
---

# 雪山方舟知识库

本目录按 Google Open Knowledge Format（OKF）v0.1 的最小约定组织：一条概念一个 Markdown 文件、YAML frontmatter 提供结构化字段、普通 Markdown 链接组成知识图谱。它既能直接在 GitHub 阅读，也能被 Agent、静态站点和索引器消费。

## 原始资料与对话

- [Opus 4.6、SDD 与精确 DSL 长对话（结构化原文）](./sources/conversations/opus46-sdd-dialogue.md)
- [逐字原始粘贴](./sources/conversations/opus46-sdd-dialogue.raw.txt)

## 研究笔记

- [Google OKF：格式，不是平台](./notes/google-open-knowledge-format.md)
- [Managed Agents：把大脑、双手和历史分开](./notes/anthropic-managed-agents.md)
- [Claude Code Auto Mode：概率审批如何嵌入确定性边界](./notes/anthropic-auto-mode.md)
- [Containment：能力越强，越要限制爆炸半径](./notes/anthropic-containment.md)
- [长对话读书笔记：从对抗基模到设计收敛系统](./notes/opus46-sdd-dialogue-reading-notes.md)
- [火山方舟 Managed Agents 反向工程记录](./notes/volcengine-managed-agents-reverse-engineering.md)

## 工程原则

1. Session 是可恢复的追加事件流，不是模型上下文窗口。
2. Harness、Session、Sandbox 必须能独立失败、替换和扩缩容。
3. 凭证保留在 Vault 与代理层，绝不进入模型上下文或沙箱环境变量。
4. 环境层先做确定性隔离；模型分类器只做纵深防御。
5. Market 的 Git 数据是事实源；网站、搜索索引和安装说明都是投影。
6. OKF 管可移植知识，资源 Manifest 管可执行契约，两者不能混为一谈。
7. API 可持有 Vault/模型凭证但不能持有 Docker Socket；Worker 可以持有 Docker Socket，但不能持有业务凭证。
8. 排队任务必须落盘；已开始执行的任务在故障后显式失败，不自动重放可能有副作用的工具调用。
