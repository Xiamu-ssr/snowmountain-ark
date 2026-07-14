# 雪山方舟 Spec Profile

`spec/` 是意图和代码之间的机器可校验对齐层，不是第二套知识库，也不是运行时状态。

一个事实只允许一个权威位置：

- `docs/` 中的 OKF 面向 Agent，保存研究、动机、读书笔记和决策背景；
- `spec/contracts/*.yaml` 中的 DSL 保存人类需要高密度审查的状态、关系、能力边界、不变量和验收条件；
- 源代码保存实现；
- SQLite、事件流和部署系统保存运行事实；
- `spec/generated/bundle.json` 与 Spec Viewer 只是投影，不能被反向编辑成第二事实源。

因此读书笔记属于 OKF，但不要求全部渲染到 Spec Viewer。Viewer 主要渲染 DSL，只把 `knowledge` 路径作为按需追溯链接。这里所谓 Contracts（契约）就是 `spec/contracts/`，没有必要再把 OKF 拆成两份相互复制的 Markdown。

## DSL 结构

每份 `snowmountain.spec/v1` YAML 都包含：

- `intent`：压缩后的目的和结果，链接而不复制 OKF；
- `contract`：按 kind 区分的可解析语义；
- `implementation`：实现该契约的代码路径；
- `verification`：证明契约成立的测试与断言；
- `specRefs`：其他契约依赖。

支持 `state-machine`、`capability-policy`、`component`、`data-lifecycle` 和 `integration`。语法由 `schema/snowmountain-spec.schema.json` 定义；`scripts/spec.mjs` 继续检查状态可达性、引用完整性、实现/测试/evidence 文件存在、能力隔离和 Viewer 投影漂移。

```sh
pnpm spec:build   # 校验并重新生成 Viewer bundle
pnpm spec:check   # 校验，并在生成投影与 DSL 不一致时失败
```

Viewer 本身不包含雪山方舟项目数据。项目名、状态、状态迁移、能力矩阵、知识链接和 YAML 原文全部来自 API 数据源。
