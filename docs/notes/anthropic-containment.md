---
type: reading-note
title: Containment：能力越强，越要限制爆炸半径
description: Anthropic 三种隔离模式、真实失败案例和雪山方舟的安全边界。
resource: https://www.anthropic.com/engineering/how-we-contain-claude
tags: [containment, sandbox, vm, egress, credentials, security]
timestamp: 2026-07-13T23:58:00+08:00
---

# Containment：能力越强，越要限制爆炸半径

原文：[How we contain Claude across products](https://www.anthropic.com/engineering/how-we-contain-claude)，Anthropic Engineering，2026-05-25。

## 风险不是一个概率

部署风险至少包含两部分：失败概率与单次失败能造成的最大损害。模型训练和分类器可以降低前者；模型能力、工具和权限增长会持续放大后者。Containment 的任务是给后者加硬上限。

## 三类风险，三个防御面

| 分类 | 内容 |
|---|---|
| 用户误用 | 恶意或无知地要求危险动作 |
| 模型误行为 | 没人要求却做出有害行为；更强模型可能更善于绕过没写全的规则 |
| 外部攻击者 | 通过工具、文件、网络、运行时或代理注入和攻击 |

防御面则是环境、模型和外部内容。环境限制“能做什么”，模型层影响“倾向做什么”，外部内容控制“读到了什么”。模型防线永远有 miss rate，所以不能独立承担边界。

## 三种隔离模式

| 模式 | 适用人群 | 隔离 | 代价与爆炸半径 |
|---|---|---|---|
| 服务端临时容器 | claude.ai 代码执行 | gVisor + ephemeral filesystem | 启动成本低；只影响租户容器，但无持久本地工作区 |
| 人在回路的本机沙箱 | Claude Code 开发者 | macOS Seatbelt / Linux bubblewrap；工作区可写、网络默认拒绝 | 原生低延迟；依赖用户能读懂 bash，爆炸半径是本地工作区 |
| 密封本地 VM | Cowork 知识工作者 | 独立内核、文件系统和进程；只挂载选定目录 | VM 启动成本高；不依赖用户判断 shell，爆炸半径是挂载目录 |

Anthropic 的经验是：使用成熟 gVisor、seccomp、hypervisor 的边界守住了，自己写的配置加载与代理更容易出错。

## 四个特别值得记住的失败

### 1. “信任此目录”之前已经执行

项目本地配置在信任弹窗前被解析，恶意仓库可借 hook 执行代码。修复不是增加警告，而是把读取和执行延后到建立信任边界之后。项目打开、配置加载、localhost listener 都应像互联网输入一样对待。

### 2. 用户本身也是注入向量

一次内部红队钓鱼让员工粘贴看似普通的任务，其中夹带读取 AWS 凭证并外发的步骤；25 次中成功 24 次。因为指令来自用户，意图分类器没有异常可识别。只有文件边界和出口控制能阻断。

### 3. 允许域名不是允许“去这里”，而是授予“这里全部能力”

恶意工作区文件携带攻击者 API key，Agent 把文件上传到攻击者的 Anthropic 账号。代理正确允许了 `api.anthropic.com`，沙箱也没有逃逸，但数据仍然外泄。修复是在 VM 内使用能识别凭证来源的中间人代理：只接受当前 VM 的 Session token，拒绝攻击者嵌入的 key，并拦截可触发服务端抓取的 header。

### 4. 隔离也会隔开安全可见性

VM 把 Agent 与主机隔开，也把企业 EDR 挡在外面。OTLP 拉取日志能补一部分审计，但不等于实时监控。隔离强度和可观测性必须同时设计。

## Tool 与 Market 的特殊风险

- 本地工具可审计、可固定版本；远程 MCP 在安装后仍可能随时改变行为。
- 审计 connector 代码不等于审计它返回的数据；可信 GitHub 工具仍能把恶意 README 塞进上下文。
- 外部内容同时是传统供应链风险和 prompt-injection 风险。
- 多 Agent 可以隔离原始脏数据，但把子 Agent 输出默认提升为“内部可信”又会造成信任升级。
- 持久 Memory、工作区和 `CLAUDE.md` 会把注入从一次会话变成持续驻留。

## 对雪山方舟的直接决定

1. 默认 Sandbox：临时计算容器 + 独立 Session 工作区卷；网络默认拒绝。
2. 文件挂载必须声明 `read-only / read-write / read-write-no-delete`，并在验证前解析 symlink。
3. 域名 allowlist 在 UI 中显示为 capability grant，并细分方法、账号、凭证来源和数据方向。
4. Vault 只在代理层持有真实凭证；Sandbox 得到按 Session、目标和动作缩权的短期令牌。
5. 本地和远程 Market 资源显示不同信任级别、版本固定能力、哈希和持续审计状态。
6. 所有 Tool Result 进入上下文前可经过输入探针；Memory 在 Session 启动时重新扫描。
7. 事件、网络和文件审计通过 OTLP 导出；隔离与可观测性是同一个产品功能。

## 原文图示索引

- [模型能力与部署风险关系](https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F5ebc85c6325c7f59bd6c08950ff9beb1863f1345-1920x866.png&w=3840&q=75)
- [模型、环境、外部内容三层防御](https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F5fae1ecca4cd8aaefb9ac949348e96967f9a5100-1920x1080.png&w=3840&q=75)
- [Cowork VM 的隔离机制](https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2Fffc97a876bdeba2031ddaeef79a954e9b1b2d52a-1920x1080.png&w=3840&q=75)
- [Full-VM 与 Host-mode](https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2Fa81ed723d52f6fb2e7bc5ca51471496b1307101a-1920x1080.png&w=3840&q=75)
- [允许域名外泄与 MITM 修复](https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2Fbeb481a2e7b314f73ba37821a2c1f1ca470d7063-1920x1080.png&w=3840&q=75)
