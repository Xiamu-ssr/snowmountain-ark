---
type: log
title: 雪山方舟知识库变更日志
description: OKF bundle 的时间序列变更记录。
timestamp: 2026-07-13T23:58:00+08:00
---

# 变更日志

## 2026-07-14

- Market 扩展为多来源 Git 快照：接入 ClawHub 400 条、Official MCP Registry 302 条、Wind AIFin Market 98 条，加上 4 条本地审查样例共 804 条，并补齐来源、分类、验证层级、许可证、访问条件与风险标签。
- Tool 解析改为 Session → 固定 Agent Version → Runtime 内置 Tool / MCP 动态发现 / 子 Agent；deny Tool 不再暴露给模型，并新增 Session 有效 Tool API 与人类投影。
- Vault 契约改为显式 Credential binding：模型与 MCP 分别在 Agent Version 绑定；Environment 拒绝 secret 变量，Sandbox 防御性过滤旧 secret 数据。
- Spec Viewer 固定文案与核心 YAML 标题改为中文，并新增 `tool.resolution`、`credential.binding` 两份高密度契约；OKF 仅作为按需知识链接。
- 纠正对话归属：SDD/DSL 长对话对象是 Claude Fable 5，Opus 4.6 是话题起点而非对话模型。
- 移除 Managed Agents 侧栏中的 SDD 业务栏目，建立内容无关的独立 Spec Viewer。
- 新增六份 `snowmountain.spec/v1` YAML 契约、JSON Schema、语义校验、引用/覆盖检查和生成式 Viewer bundle；CI 会拒绝不可达状态、越界能力、断裂引用与过期投影。
- 明确部署 Agent 使用自研简易 Harness 的 deterministic 模式（无 LLM 推理），OpenAI-compatible 循环只是可选适配器；SDK runtime 仍标记为 partial/planned。
- 依据火山方舟真实表单收敛 Environment/Session：人类只选择依赖、变量和绑定资源，文件权限与 CPU/内存等由平台 Sandbox Policy 托管。
- 明确 Memory 当前只支持显式 CRUD/绑定读取，不会从 Session 或 context compact 自动沉淀。
- 定位 Market “offline”根因是服务器无法建立到 GitHub Pages 的出站 TLS；改为连接独立部署的本地 Market 实例，同时保留公开 Viewer URL。
- 修正 Market 本地镜像生成的详情链接，使 Ark 卡片始终指向公开 Git endpoint；无请求体的 POST 不再错误声明 JSON body。
- 新增 Runtime/Sandbox/Memory 决策笔记，明确 Docker/runc 当前边界以及 gVisor、microVM 与 SDK adapter 的演进位置。

- 明确雪山方舟是数据库驱动的完整中台；只有雪山 Market 是 Git-first。OKF 是知识文档，Spec DSL 是开发对齐契约，两者都不替代运行时数据库。
- 完成登录、CSRF、防爆破限流、审计事件与生产 Cookie 边界。
- 将 Docker Socket 从 API 进程移到独立、共享 Token 鉴权的 Sandbox Worker；Worker 不持有 Vault 或模型凭证。
- 增加 SQLite 持久 Interaction Queue、最多四路并发、排队恢复与运行中断显式失败语义。
- 增加 OAuth Client Credentials 换取、过期刷新与刷新并发合并；client secret 只在代理层解密。
- 增加生产 Compose、Nginx HTTPS、安全响应头、在线 SQLite 备份和证书续期脚本。
- 因阿里云对未备案域名拦截 HTTP-01，改用 Let’s Encrypt `shortlived` Profile 的公网 IP 证书；证书约六天有效并自动续期。
- 本地通过 API、Queue、MCP/OAuth、Sandbox Worker、策略、工作区持久性等 16 项自动化测试。
- 在公网人类控制台完成 Agent、Session、审批、Docker Sandbox 写读与完整事件时间线验收；工具结果明确记录 `driver: docker`。
- 重启 API 后，登录 Session、Managed Session、事件日志和 `/workspace/runtime-probe.txt` 均恢复，并成功读取重启前文件。
- 公网子路径验收修复了 Agent 版本接口绕过 API Base、初始事件快照覆盖 SSE 新事件、代理链路 SSE 坏帧三个生产问题；轮询降级与实时流现可安全合并，干净浏览器标签页无应用错误或警告。

## 2026-07-13

- 逐字归档并结构化格式化 194,936 字符的用户对话，保留原始 SHA-256 校验值。
- 阅读 Google OKF v0.1 介绍和三篇 Anthropic Engineering 原文。
- 在已登录的火山方舟控制台检查 Agent、Session、Environment、Credentials Vault、Memory 的资源模型与创建字段。
- 在真实 Managed Agent Session 中完成 `/workspace` 文件写入、读取与同 Session 跨任务持久性探针。
