---
type: log
title: 雪山方舟知识库变更日志
description: OKF bundle 的时间序列变更记录。
timestamp: 2026-07-13T23:58:00+08:00
---

# 变更日志

## 2026-07-14

- 明确雪山方舟是数据库驱动的完整中台；只有雪山 Market 是 Git-first，OKF/DSL 是 SDD 对齐文档而非运行时。
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
