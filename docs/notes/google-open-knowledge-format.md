---
type: reading-note
title: Google Open Knowledge Format：格式，不是平台
description: Google OKF v0.1 的设计原则，以及它在雪山方舟和雪山 Market 中应该承担什么职责。
resource: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing
tags: [okf, knowledge, markdown, yaml, git, market]
timestamp: 2026-07-13T23:58:00+08:00
---

# Google Open Knowledge Format：格式，不是平台

原文：[Introducing the Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)，Google Cloud，2026-06-12。

## 一句话理解

OKF 不是知识库产品、RAG 服务或新的运行时。它是一个很薄的交换格式：**目录里的 Markdown 文件 + YAML frontmatter + 普通 Markdown 链接**。Google 希望不同人、不同 Agent、不同平台写出的“LLM wiki”可以无需翻译地互相消费。

## 三个设计原则

1. **最小主张**：每个 concept 只强制一个 `type` 字段；标题、资源、标签、时间等均可由生产者扩展。
2. **生产者与消费者独立**：人、导出流水线或 LLM 都可以生产；Agent、搜索索引或可视化工具都可以消费。
3. **格式而非平台**：不绑定云、数据库、模型、Agent 框架、SDK 或账号。价值来自说这种格式的参与者数量，而不是某家平台的控制力。

文件路径就是 concept 身份，普通 Markdown 链接把目录树扩展成图。`index.md` 用于渐进式披露，`log.md` 用于时间序列变化。Google 的参考实现还展示了一个完全静态的单文件图谱可视化器，这恰好说明“事实源”和“投影”应分开。

## 它解决什么，不解决什么

| 问题 | OKF 是否负责 | 原因 |
|---|---:|---|
| 让人和 Agent 都能读项目知识 | 是 | Markdown 本身就是共同表示 |
| 在 Git 中迁移、审查和版本化知识 | 是 | 只是文件，无专有运行时 |
| 统一 Skill、MCP、Tool 的业务语义 | 部分 | 可承载元数据，但不会替你定义资源协议 |
| 表达 Agent 的可执行权限与安装步骤 | 否 | 需要额外 Manifest/Schema |
| 表达业务状态机并生成测试 | 否 | 那是 Spec/DSL/契约层的问题 |
| 展示项目做到哪一步、依赖是否健康 | 否 | 需要从事实源计算出的项目投影视图 |

这正好纠正长对话中反复混在一起的三件事：OKF 是知识交换层；项目全局视图是投影层；精确 DSL 是行为契约层。

## 雪山方舟如何使用

- `docs/` 本身就是一个 OKF bundle，研究、架构、运行手册与决策都可被 Agent 直接遍历。
- `Session` 运行时不会把整个 bundle 一次塞进上下文，而是按 `index.md → concept → 关联 concept` 渐进取用。
- 索引、全文搜索、关系图都是消费者生成的缓存；删除后可以从 Git 事实源重建。

## 雪山 Market 如何扩展

Market 的每个资源仍是一份 OKF concept，但我们增加可执行 Manifest：

```yaml
---
type: skill
title: GitHub Pull Request Reviewer
description: 审查 PR 并输出结构化问题清单
resource: https://github.com/example/repo
tags: [github, review]
timestamp: 2026-07-13T00:00:00Z
market:
  id: github-pr-reviewer
  version: 1.2.0
  artifact: ./artifacts/github-pr-reviewer.tgz
  sha256: "..."
  permissions: [network:github.com, filesystem:workspace-read]
  runtime: skill-v1
---
```

`type` 保持 OKF 兼容；`market` 是雪山协议。网站只从本地 Git checkout 构建 `catalog.json` 和下载端点，不代替安装、不接管用户凭证，只给 Agent 提供可验证的来源、权限、依赖和安装指导。

## 我的理解

OKF 真正高明的地方不是 Markdown，而是克制。它只固定交换面，不试图占有生产端、消费端或运行时。雪山项目也应该照此处理：Market 定义最小资源合同，Ark 定义最小执行接口，具体模型、沙箱、UI 和索引器都可替换。格式的寿命才有机会长过当前最强的模型和 Harness。
