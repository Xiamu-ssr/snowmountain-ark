---
type: research-note
title: 雪山 Market 外部来源适配器与信任分层
description: 记录 ClawHub、Official MCP Registry、skills.sh、Anthropic Skills 与 Wind AIFin Market 的接入边界。
tags: [market, skill, mcp, registry, supply-chain, wind]
timestamp: 2026-07-14T22:40:00+08:00
---

# 雪山 Market 外部来源适配器与信任分层

这篇 OKF 笔记解释为何选择这些来源；实际字段和集成状态以雪山 Market Catalog 及 [`market.integration`](../../spec/contracts/market-integration.yaml) 为准。

## 结论

Market 不应继续靠人工添加四五个示例，但也不能把“大量抓取”误认为“能力可信”。正确模型是：**发现范围尽量广，执行信任默认最低，审查证据逐级提升。**

当前显式同步并提交 Git 的快照包含：

- ClawHub 下载量排序且未被标记 suspicious 的 400 条公开 Skill 元数据；
- Official MCP Registry 中 active + latest 的 302 个 MCP Server；
- Wind AIFin Market 的 90 个 Skill、7 个 MCP 和 1 个 Agent；
- 雪山本地 4 条人工审查样例。

总计 804 条。网站运行时只读该 Git 快照，不直接访问外部 Registry。

## 为什么是这些来源

### ClawHub

ClawHub 是 OpenClaw 的公开 Skill Registry，提供版本、搜索、CLI API、moderation 和公开目录复用规则。其公开文档允许第三方目录缓存公开读 API，但要求尊重限流、链接回 canonical listing，且不能暗示 ClawHub 为第三方站点背书。

因此雪山只缓存公开元数据和上游链接；`nonSuspiciousOnly=true` 只是排除已标记项，不代表 Skill 已经过雪山代码审查。所有条目继续标记 `prompt-injection`、`supply-chain` 与 `unreviewed-code` 风险。

### Official MCP Registry

官方 MCP Registry 明确定位为公共服务器元数据中心，并建议下游 Aggregator 定期同步、增加自己的分类和审查层。命名空间验证可以证明“谁发布”，但官方也明确把实际代码扫描交给包仓库和下游聚合器。

因此雪山保留 `namespace-verified`，但同时标记 `not-security-audited`。Codex 本机已安装的 Connector/MCP 可能包含用户私有信息，不进入公共 Market；公共发现统一来自 Registry。

### skills.sh 与 Anthropic Skills

skills.sh 是基于 GitHub/well-known 来源的开放 Skill Directory，并提供安装排行、安全审计和面向 Codex 等多种 Agent 的 CLI。它的官方 API要求 Vercel OIDC，因此当前只登记为候选来源，不绕过认证抓取。Anthropic 官方 Skills 仓库也登记为来源，但不同 Skill 的许可证不同，且大量条目已被上游目录索引，因此不重复复制内容。

### Wind AIFin Market

2026-07-14 对公开页面的观察显示 Wind 市场展示 7 MCP、90 Skill 和 1 Agent，并公开 `https://aifinmarket.wind.com.cn/skill.md` 作为安装入口。Skill API Key、账号、金融数据服务和安装流程仍由 Wind 管理；雪山只同步公开描述、分类、发布方与入口，不代理注册、收费、Key 或金融决策责任。

## 信任层级

| 层级 | 含义 | 能否自动安装 |
|---|---|---|
| `registry-listed` | 上游公开目录可发现 | 否 |
| `namespace-verified` | MCP 发布命名空间已验证 | 否 |
| `publisher-listed` | Wind 等发布方自己的公开条目 | 否 |
| `snowmountain-reviewed` | 雪山仓库内固定制品、哈希与人工审查 | 仍否；只提供安装指导 |

Registry、热度、Stars、下载量和发布方身份都是发现信号，不是安全结论。

## 参考

- [ClawHub](https://github.com/openclaw/clawhub)
- [Agent Skills 开放规范](https://agentskills.io/home)
- [Official MCP Registry](https://modelcontextprotocol.io/registry/about)
- [MCP Registry Aggregators](https://modelcontextprotocol.io/registry/registry-aggregators)
- [skills.sh API](https://skills.sh/docs/api)
- [Anthropic Agent Skills](https://github.com/anthropics/skills)
- [Wind AIFin Market](https://aifinmarket.wind.com.cn/#/market)
