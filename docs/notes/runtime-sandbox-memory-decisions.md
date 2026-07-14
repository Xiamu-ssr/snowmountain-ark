---
type: decision-note
title: Agent Runtime、Sandbox、资源与 Memory 的事实边界
description: 区分雪山方舟当前实现、火山方舟界面观察、外部运行时方案与下一步安全演进。
tags: [managed-agents, runtime, sandbox, memory, environment, session]
timestamp: 2026-07-14T21:30:00+08:00
---

# Agent Runtime、Sandbox、资源与 Memory 的事实边界

这篇笔记只解释 why，不复制契约。可执行边界以
[`agent.runtime`](../../spec/contracts/agent-runtime.yaml)、
[`sandbox.boundary`](../../spec/contracts/sandbox-boundary.yaml) 和
[`memory.lifecycle`](../../spec/contracts/memory-lifecycle.yaml) 为准；部署事实由 Spec Viewer 的 runtime facts 投影。

## 当前事实

- 雪山方舟目前使用自研的轻量 `Harness`。确定性模式不调用 LLM；另有一个 OpenAI-compatible Chat Completions 工具循环，但生产环境未配置模型凭证。因此当前线上演示不能被描述成 Claude Agent SDK 或 OpenCode 驱动。
- Sandbox 由独立 Worker 通过 Docker/runc 启动。容器默认无网络、只读根文件系统、删除 capabilities、启用 `no-new-privileges`，并限制 PID、CPU、内存和时长；Session 工作区单独持久化。它适合当前 beta 和受控租户，不应被宣传成敌对多租户的最终隔离边界。
- Memory 是显式资源：Session 绑定 Memory Store，运行时读取，写入通过可审计 CRUD 完成。当前没有从对话自动抽取长期记忆，也没有实现上下文 compact。

## 为什么运行时必须可替换

Session 身份、事件、Policy、Vault、Sandbox 和 Memory 属于方舟控制面，不应被某个模型 SDK 反向拥有。运行时适配器只能消费这些端口并回写同一种事件契约。

Claude Agent SDK 提供成熟的 Claude 工具循环，但偏 Claude 生态并运行在我们管理的进程中；Anthropic Managed Agents 则运行在 Anthropic 基础设施中，把它直接当底座会让雪山方舟退化成外部控制面的代理。OpenCode 更偏 provider-agnostic 的编码 Agent 服务，它的 TypeScript SDK 本质上是 Session/SSE REST 客户端，接入时同样要避免与方舟自身 Session 模型重复。

因此保留确定性 Harness 作为测试适配器，同时在统一 `AgentRuntime` 接口之后增加生产 SDK adapter，是比替换控制面更稳的路径。

## Docker、gVisor 与 microVM

三者不是“新旧版本”，而是不同隔离成本：

| 层级 | 适用范围 | 优势 | 主要代价 |
|---|---|---|---|
| Docker/runc | 受控 beta、内部任务 | 兼容性和吞吐最好，运维简单 | 与宿主共享内核，不能作为强敌对边界 |
| gVisor/runsc | 不受信用户代码、多租户中等风险 | 用户态应用内核拦截系统调用，仍兼容 OCI | 系统调用、网络和 I/O 有额外开销，兼容性需实测 |
| Firecracker microVM | 敌对多租户、高保证任务 | KVM 虚拟机边界、启动快、资源开销较小 | 镜像、网络、快照、调度和观测更复杂 |

近期合理演进是在当前 Worker 增加可插拔 runtime，在目标阿里云主机上先验证 gVisor `runsc` 的 syscall 兼容性与实际负载，再决定哪些风险等级升级到 microVM，而不是一次性把所有 Session 搬到最重方案。

## 为什么创建 Environment 不暴露文件读写，Session 不暴露 CPU/内存

2026-07-14 对已登录火山方舟界面的复核显示：Environment 创建表单只让人选择依赖、环境变量等可复现模板信息；Session 只绑定 Agent、Environment 等语义资源，没有 CPU/内存字段。文件系统边界和资源配额更适合作为平台不变量、套餐或管理员策略，而不是由每位 Agent 创建者逐次关闭安全约束。

雪山方舟此前把基础设施细节暴露得过多。人类表单现在遵循同一分层：Environment 管依赖与变量，Session 管资源绑定；高级 API 仍可保存资源策略，但普通创建流程不再把它伪装成业务必填项。

## Memory 不等于 compact

长期 Memory 保存的是跨 Session 的选择性状态，需要来源、删除、去重、隐私和人工控制；compact 解决的是单个 Session 的上下文窗口预算，产物可能是临时摘要。二者不能复用一个模糊的“自动记忆”开关。

火山方舟界面只明确说明创建 Session 时绑定 Memory Store、运行时读取，并提供人工添加 Memory；这不足以证明存在自动抽取算法。Anthropic Managed Agents 的公开设计也把 Memory 表示成挂载到 `/mnt/memory` 的文本，由 Agent 通过文件工具显式读写，而不是隐藏的 context compact。

如果以后增加自动抽取，必须先补一份独立 Spec：触发时机、来源事件、置信度、去重、敏感信息、撤回与人类确认都要成为可验证字段。

## 参考

- [Anthropic Managed Agents migration](https://platform.claude.com/docs/en/managed-agents/migration)
- [Anthropic Managed Agents environments](https://platform.claude.com/docs/en/managed-agents/environments)
- [Anthropic Managed Agents sessions](https://platform.claude.com/docs/en/managed-agents/sessions)
- [Anthropic Managed Agents memory](https://platform.claude.com/docs/en/managed-agents/memory)
- [gVisor documentation](https://gvisor.dev/docs/)
- [gVisor performance guide](https://gvisor.dev/docs/architecture_guide/performance/)
- [Firecracker](https://firecracker-microvm.github.io/)
- [OpenCode SDK](https://github.com/anomalyco/opencode-sdk-js)
