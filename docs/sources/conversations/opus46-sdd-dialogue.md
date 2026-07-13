---
type: conversation-transcript
title: "从 Opus 4.6 惊艳到精确 DSL：一场关于 Agent、SDD 与评测的长对话"
description: "用户与另一位 Agent 围绕基础模型、Spec-Driven Development、评测、DSL、记忆和产品形态展开的完整对话。"
resource: ./opus46-sdd-dialogue.raw.txt
tags: [agent, managed-agents, sdd, spec, dsl, evaluation, memory]
timestamp: 2026-07-13T00:00:00+08:00
language: zh-CN
source_sha256: fa2a70da6dc6378f48d25d12bc2dd2c56fc22d6554d7df9edd67c1ad4448a96d
---

# 从 Opus 4.6 惊艳到精确 DSL

> 本文档只做结构化排版，不改写对话内容。角色标题、轮次和运行统计由格式化脚本补充；逐字原始文件见 [`opus46-sdd-dialogue.raw.txt`](./opus46-sdd-dialogue.raw.txt)，可用 frontmatter 中的 SHA-256 校验。原始粘贴中出现的 `Expand`、图片占位符和模型内部英文记录均原样保留。

## 第 1 轮 · 用户

第一章：惊艳
春节假期被opus4.6惊艳之后，我彻底放弃了一切对抗情绪。
是的，3年来，其实我是站在基模对立面思考问题的，因为如果基模太强，就没有我的价值，所以我的创业思路，都是围绕基模没那么强而展开（其实很多创业者也都是这个思路假设，他们也正在为此付出代价，大量Agent应用层的创业正在被吞噬）。
一开始做低代码（因为当时gpt写js都不利索）来降低生码难度，以及做workflow来避免当时基模planning的稚嫩，并且绝对不采用ReAct架构和记忆机制，这都是一种对抗。
但opus4.6摧毁了一切假设，它的coding和planning的准确概率正好达到了我的期望，那一刻我知道，我应该回到淳朴的ReAct架构，继续对抗就是找死。
于是我在除夕夜，一晚上，就用古法编程手写了一个beta版的langchain，这对我来说非常easy（正是因为如此easy，我才一直不愿意拥抱它，我怕自己的contribution太廉价）。
然后就开始了Alice的故事，我用这个古法beta版本唤醒了opus4.6，让它自己接手自我进化，对着自己的身体动手术，迭代至今。
就这样一个personal的toy产品，足以吊打过去几年我们一整个团队站在对立面的contribution，而且我也没觉得它比cc和codex弱（但比它们贵）。
这更加强化了我的担忧：我没有什么价值，这玩意儿牛逼，都是因为opus4.6牛逼。
...
Expand

## 第 1 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

用户想要我解释第四章的内容，涉及SpecReview和CodeReview的含义，以及SDD是否依赖于AI准确性，还要参考agent基准测试。这是概念性讨论，不需要网络搜索，直接用中文回答就可以。

这篇文章确实写得很有洞察力，我来帮你拆解最后一章。

SpecReview 和 CodeReview 是什么
这两个词在文中指的是人类与 Agent 对齐时，审查粒度的两个极端：

CodeReview（代码级审查）：你逐行去看 Agent 写出来的代码，确认每个细节（比如那个游标推进的逻辑）都符合你的意图。

好处：对齐充分，$500 的 bug 会被你抓出来
坏处：你花的时间和自己写代码差不多了，"十倍效能"就是自欺欺人
SpecReview（规格级审查）：你只看需求文档 / 设计说明这个层面，比如"轮询队列，处理完一条推进游标"，具体代码不看。

好处：审查成本低，效率高
坏处：spec 天然是粗粒度的，"推进游标"这四个字里藏不住"游标写错了停在原地"这种细节错误，所以程序行为可能悄悄偏离你的意图
作者的核心论证是一个两难（dilemma）：看得细则不经济，看得粗则不可靠。要破局，必须发明一种"中间物"——一种表达能力足以唯一确定程序行为（不留歧义空间），但体量又远小于代码的 spec 形式。这就是他说的"高压缩比且语义等价"，类比 Java 之于汇编：Java 代码比汇编短得多，但语义是精确的，编译器能确定性地翻译。SDD 就是 Spec-Driven Development（规格驱动开发）。

关于你提到的评测榜单问题
你的直觉很敏锐，这确实是这套论证最脆弱的一环。你说的那类评测（如 SWE-bench 及各种 spec-to-code 基准）本质上就是在测"AI 编译器"的准确率。但我觉得可以从几个角度看：

1. 作者其实已经预埋了回应。注意第四章第 2 点：他明确说要"将绝对确定性的工程编译，转换为可接受准确率的 AI 编译"，并把准确率损失定义为"摩擦损耗——毕竟让人类干活也无法杜绝故障"。也就是说，他要的不是 99 分，而是达到或超过人类程序员从 spec 到 code 的准确率即可。人类工程师拿着一份清晰的 spec 去实现，也会写 bug，团队靠测试、灰度、监控兜底。所以基线不是 100 分，是"人类水平 + 现有工程兜底体系"。

2. 但你的质疑在一个地方依然成立：如果 spec→code 的单次准确率是 95%，一个系统由 20 个模块组成，整体一次成功率就是 0.95²⁰ ≈ 36%。人类团队之所以能容忍个体错误，是因为有测试、review、CI 这些误差收敛机制。所以 SDD 要成立，光有"高压缩比 spec"还不够，还需要 spec 能同时驱动测试生成——即 spec 不仅是编译输入，还是验收标准的来源。这样错误才能被自动捕获而不是靠作者说的"人工测试兜底"（那正是他要逃离的公式）。文章没展开这一点，算是留白。

3. 关于"评测集写得不够好"：这其实和文章主旨是同一个问题的两面。评测集里的"需求描述"如果有歧义，那 Agent 实现偏了到底算谁的错？——这恰恰证明了作者的观点：瓶颈不在 AI 编码能力，而在 spec 这个表达层的精确性。一个好的 spec 语言（DSL 化、约束了歧义空间），既能让 AI 编译准确率大幅提升，也能让评测变得可判定。所以与其说"评测低于 99 分则愿景落空"，不如说当前评测的低分里，有相当一部分是自然语言 spec 的歧义税，而这正是作者想用"高压缩比、语义等价的 spec"去消灭的东西。

一句话总结
最后一章的逻辑是：人机对齐要么太贵（CodeReview）要么太漏（SpecReview）→ 唯一出路是发明介于两者之间的精确 spec 层 → 这本质上就是 DSL/低代码的老思路，但过去卡在"编译器必须 100% 通用且确定"，现在 AI 可以当一个"容错的模糊编译器"，把老思路盘活了。而你指出的准确率问题，答案不是要求 AI 到 99 分，而是要靠 spec 同时约束实现和验证，让系统在非完美准确率下依然可收敛——这一步文章没写透，也确实是这条路线真正的成败关键。

<details>
<summary>第 1 轮运行统计</summary>

```text
Latency: 4.36s
Total: 35.95s
Input: 5509
Output: 1745
Log Detail
```

</details>

## 第 2 轮 · 用户

1. 老思路spec是指什么，DSL化？就是那种关系图？ 2. “人类工程师拿着一份清晰的 spec 去实现，也会写 bug，团队靠测试、灰度、监控兜底。所以基线不是 100 分，是"人类水平 + 现有工程兜底体系"。”，那人类一般能有多少分，95分？ 3. 我听出了评测的重要性，但是不是传统评测，而是spec的一事两面，1开发1评测。但是。。。只考agent对抗审查估计不行。。。而是必须有一定的工程手段推进评测覆盖度和精准度？🤔，说的有点玄乎了。 4. 精确DSL有专业名词么，这份报告和观点，在全球范围内，有共识的人吗，或者有其他同类型但不同流派的观点？ 5. 精确的DSL需要关心枚举么，哈哈哈也就是业务系统间某个业务的类型

## 第 2 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is asking five conceptual questions, and question 4 touches on global consensus around spec-driven development and formal methods. I should consider what I know about approaches like TLA+, Alloy, Z notation, intent-based programming, and spec-driven development frameworks, though a search might help me capture the latest thinking in this space.I need to address five questions in Chinese, starting with examining different specification approaches beyond just relationship diagrams—things like domain-specific languages, model-driven development, UML, low-code platforms, and formal methods. Then I'm looking at human performance metrics, where defect rates typically fall between 15-50 bugs per 1000 lines of code and first-pass accuracy is well below 95%, though there's no single score for human performance. The third question seems to be about the dual nature of specifications in both development and...

好问题，逐个回答。这次我查了些资料，有意思的是：这篇文章作者独立推导出的结论，其实正是过去一年全球工程圈最热的争论。

1. "老思路"的 spec 指什么？
不是（只是）关系图。作者说的"自古有之"大致包括这几代尝试：

形式化规范（Formal Specification）：Z 语言、VDM、TLA+、Alloy 这类数学化语言，用逻辑精确描述系统行为。表达力极强但太难写，只在航天、芯片等领域存活
MDD/MDA（模型驱动开发）：2000 年代的大热门，"画 UML 图自动生成代码"。你说的"关系图"最接近这个流派——但它失败了，因为图能表达结构，表达不了行为细节
DSL（领域特定语言）：SQL、正则、Terraform 都是成功案例——在窄领域里用极小体量精确表达意图。作者说的"困在通用性泥潭"就是指：每个 DSL 只能覆盖一个领域，做通用 DSL 就退化成编程语言
低代码：本质是"图形化 DSL"，同样困在通用性上——简单场景很爽，稍微复杂就要"跳出平台写代码"
这段历史今天被反复引用来泼冷水：Martin Fowler 对 MDD 的历史类比很有说服力——当年"画 UML 就能生成代码"的承诺没有兑现，今天"写 Spec 就能生成代码"的承诺也需要更多实践验证。但 LLM 确实消除了 MDD 的某些根本性约束（抽象层级的僵化）——这正好就是原文"AI 编译是润滑油"的另一种表述。

2. 人类基线是多少分？
没有 95 分这么高，而且要分两个口径：

一次通过率（未经测试的初稿）：行业经验数据是每千行代码 15~50 个缺陷。按功能算，人类从 spec 到"一次写对"的成功率大概只有 60~80 分，复杂功能更低
经过完整工程流程后（测试+review+灰度）：成熟团队交付到生产的缺陷率能压到千行 0.1~1 个，这才是那个"看起来像 95+ 分"的水平
所以关键结论是：95+ 分从来不是人的能力，而是流程的能力。人类裸写也就 70 分，是测试和 review 这套收敛机制把它抬上去的。这就引出你的第 3 问——AI 也一样，别指望模型裸出 99 分，要指望流程收敛。

3. "spec 一事两面"——你的直觉是对的，且已有工程实践
你说"不能只靠 agent 对抗审查，必须有工程手段推进评测覆盖度和精准度"——这不玄乎，业界正在做的恰好是这几件事：

spec 直接携带验收标准：一份好的 spec 定义六个要素：目标、范围边界、约束、先前决策、任务分解、验证标准，即 spec 写出来的那一刻就同时是测试的来源
独立验证者，而非自证：SDD 中最被低估的模式是指派一个独立的 agent 去检查工作成果，而不是信任实现 agent 的自我验证——即 Coordinator / Implementor / Verifier 分离
结构化需求格式 + 属性测试：采用 EARS 格式和属性测试确保需求到代码的闭环验证。EARS 是一种受控自然语言模板（"当 X 时，系统应 Y"），把 spec 写成可机械转化为 testcase 的形状
确定性护栏不能省：Thoughtworks 的观点很清醒——从 spec 到代码的 LLM 生成不是确定性的，spec 漂移和幻觉本质上难以避免，所以仍然需要高度确定性的 CI/CD 实践来保障软件质量和守护架构
所以正确的图景是：spec → 生成代码（AI，容错）＋ 生成测试（AI+模板，容错）＋ 确定性 CI/CD 执行（不容错），三条腿。两个容错通道犯的错不太可能恰好互相掩盖，再由确定性执行兜底。

4. 专业名词和全球共识
有，而且非常热。这个方法论现在的正式名称就是 Spec-Driven Development（SDD，规范驱动开发），2025 下半年爆发：到 2026 年，几乎所有主流 AI 编码工具——GitHub Spec Kit、AWS Kiro、Claude Code、Cursor、OpenSpec、BMAD、Tessl、Google Antigravity——都推出了自己的 SDD 变体。

学术上也有了框架，arXiv 上的综述论文提出了三个规范严格度层级——spec-first、spec-anchored、spec-as-source。原文作者的主张（spec 高压缩比且语义等价、代码由 AI 编译而来）对应最激进的 spec-as-source 流派：开发者只在规范上工作，从不碰源码。规范承担了源代码的角色——只是在更高的抽象层级。AI agent 把规范"编译"成实际源代码，代表工具是 Tessl。

但共识远未达成，主要分歧点：

spec 还是 code 是最终资产？ 激进派认为可以抛弃代码、把 spec 作为唯一需要维护的事实来源；保守派（如 Thoughtworks 的老派技术人）认为 spec 只是驱动代码生成的要素，可执行代码仍是需要维护的事实来源
Waterfall 2.0 质疑：社群讨论非常两极。正面看法认为远比 vibe coding 可靠、适合要上线维护的真实项目；负面看法则认为这就是 Waterfall 2.0、过度工程化、扼杀创造力
落地不理想：Martin Fowler 团队实测发现即使有这么多文件、模板、提示词、工作流和检查清单，agent 依然经常不遵循全部指令
值得注意的是，几乎所有现有 SDD 工具的 spec 都是自然语言 Markdown，而原文作者主张的更接近"精确 DSL"路线——这比主流更激进一步，反而更接近老 MDD 的精确性诉求 + AI 编译的容错性，算是一个相对少有人走的中间流派。

5. 精确 DSL 需要关心枚举吗？
哈哈，必须关心，而且枚举恰恰是最值得进 spec 的东西之一。理由：

枚举（订单状态、业务类型、渠道类型……）是业务系统里歧义密度最高的地方。自然语言说"处理退款订单"，AI 不知道你的系统里退款分为"仅退款/退货退款/部分退款"三种——枚举不进 spec，AI 就只能猜，猜错就是那种"测试都难发现"的静默 bug
枚举的压缩比极高：一行枚举定义约束了下游大量分支逻辑，完全符合"体量小、表意精确"的标准
这其实就是 DDD 说的通用语言的一部分——Thoughtworks 也强调spec 应该使用面向领域的通用语言（ubiquitous language）来描述业务意图，而非绑定具体技术的实现细节
更进一步说：类型系统（含枚举）是精确 spec 最便宜的杠杆。枚举、实体关系、状态机转移规则——这些东西写起来体量很小，但每一条都能剪掉 AI 的一大片自由发挥空间。反而是过程性细节（怎么循环、怎么缓存）可以放心交给 AI。一个实用的判断标准：凡是"AI 猜错了但代码看起来依然合理"的东西，就该进 spec——枚举是典型，你上一轮聊的那个游标推进逻辑（状态机语义）也是典型。

<details>
<summary>第 2 轮运行统计</summary>

```text
Latency: 1.40s
Total: 13.83s
Input: 4
Output: 3710
Log Detail
```

</details>

## 第 3 轮 · 用户

1. 理解，所以SDD争来争去，结果一帮人不是就用md吗，LLM最擅长的文本，😂。听起来简单，实际上人类也就是语言生物，但是具备足够的抽象能力和memory。而试图只用一层文本就让AI做到SDD期望，感觉有点，在结构上就不属于”高级生物“呢   2. Waterfall 2.0 是什么？ 3. “几乎所有现有 SDD 工具的 spec 都是自然语言 Markdown，而原文作者主张的更接近"精确 DSL"路线——这比主流更激进一步，反而更接近老 MDD 的精确性诉求 + AI 编译的容错性，算是一个相对少有人走的中间流派。”，精确DSL，是保守派吗，老人派？ 4. 🤔，好难，因为有时候不是“指令遵循”不高，而是SDD的规范用语言描述就不够精确，这可能就是语言传播的损耗吧。其实我感觉如果开发侧做不到100%，换个思路，能把评测做到100%是不是也行，但是。。。。评测做到100%似乎也依赖于SDD规范。。。等等，这是多个部分，说不定我们应该推出能够足够帮助人类构建完美SDD规定的东西，然后再让AI执行，🤔，这似乎也确实是上面说的，流派之争，“人机对齐要么太贵（CodeReview）要么太漏（SpecReview）”。要做到中间更好，emmm，我有点想不出来。

## 第 3 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is making a philosophical point about structural depth—markdown-based specs are just a single layer of text, whereas human cognition operates through multiple abstraction and memory layers, making single-layer representations feel fundamentally limited. This connects to something real: intermediate representations in compilers and hierarchical specification systems. They're also starting to critique Waterfall 2.0 as potentially recreating waterfall's problems.

On the DSL question, I'm realizing this isn't old-guard conservatism versus mainstream—it's a third path entirely. The precision-DSL approach with AI compilation is something like "neoclassical": borrowing old tools but powered by new engines. Neither purely conservative nor purely mainstream.

The real crux they're wrestling with is that you can't make development 100% automated and evaluation 100% reliable when evaluation depends on the spec itself—so maybe the answer is tooling that helps humans author better specs in the first place. I can offer some concrete directions here: spec linters and ambiguity detection, AI asking clarifying questions during spec authoring, or even progressive formalization where specs start as natural language and gradually harden into typed structures and state machines where the risk is highest. This "gradual formalization" is a real concept—like gradual typing but for specifications. And layering the spec itself: intent layer in natural language, contract layer with types and enums, property layer with invariants and tests. That multi-layer structure is exactly the "higher organism" complexity they intuited was missing.

你这几个问题越问越接近核心了，第 1 问和第 4 问其实能互相回答。逐个来：

1. "单层文本不像高级生物"——这个直觉非常准
你无意中说出了对 Markdown-SDD 最深刻的批评。对照一下：

编译器不是一步从 C 翻到机器码的，中间有 AST、IR（中间表示）、多层 lowering，每层都有自己的精确语义
人类工程组织也是分层的：愿景 → 需求 → 架构 → 接口契约 → 代码，每层有不同的表达形式（PRD 是文本、架构是图+约束、接口是类型签名）
而主流 SDD 是：一坨 markdown → 直接生成代码。中间所有层级压在一层自然语言里，靠 LLM 一步跨越
这就是为什么"指令遵循不好"的抱怨不断——不是模型笨，是这个结构要求单层文本同时承载意图、约束、契约、验收四种语义，而自然语言对后三种的表达精度天然不够。你说的"不属于高级生物"，翻译成工程语言就是：缺少中间表示层（IR）。记住这个词，第 4 问会用到。

2. Waterfall 2.0 是什么
瀑布模型（Waterfall）是软件工程的老古董：需求 → 设计 → 实现 → 测试严格分阶段，前一阶段全部冻结才进下一阶段。它在 90 年代被敏捷运动批倒，罪名是：假设人能在写代码前想清楚一切——现实中需求总在实现过程中才被真正理解，瀑布导致大量返工。

"Waterfall 2.0"是社区对 SDD 的讽刺：你要求先写完美的 spec 再让 AI 实现，这不就是把瀑布模型又请回来了？人类想不清楚的东西，写进 spec 就想清楚了？

SDD 支持者的反驳是：AI 把"实现"环节从几周压缩到几分钟，所以 spec→实现→发现 spec 错了→改 spec→重新实现 的循环可以一天转几十圈——瀑布的死穴（迭代成本高）不存在了，剩下的只是"先想后做"这个无害的纪律。这个反驳有一定道理，但前提是重新生成足够便宜且稳定，目前还不完全成立。

3. 精确 DSL 是保守派/老人派吗？
有趣的是——既是最老的，也是最激进的，取决于你看哪个维度：

维度	Markdown-SDD 主流派	精确 DSL 派
spec 形式	自然语言（新潮）	形式化/结构化（老派，MDD 血统）
对代码的态度	多数仍把代码当资产（保守）	spec-as-source，代码是编译产物可抛弃（激进）
对 AI 的依赖	依赖模型理解力硬扛歧义	用结构消灭歧义，AI 只做受约束的翻译
所以更准确的说法是"新古典派"：用老 MDD 的武器库（DSL、类型、状态机），装上新的发动机（AI 容错编译）。当年 MDD 死于"编译器必须 100% 确定性 → DSL 必须表达一切 → 通用性泥潭"；现在 AI 编译容错了，DSL 就不必表达一切，只需表达关键约束，剩下交给 AI 发挥。这条链路上唯一的新东西是 AI，但整个架构因此活了。原文作者背景是低代码/领域抽象出身，走这条路几乎是必然。

4. 你已经自己推到答案门口了，我帮你捅破最后一层
先纠正一个方向：别追 100%，追"收敛"。人类工程的 95+ 分不是任何单点做到 100%，而是多个 70~90 分的环节互相纠错叠出来的（写码 70 分 × review 抓一半 × 测试抓一半 × 灰度抓一半 ≈ 99+）。AI 体系也该这么设计。

然后是你想不出来的那个"中间"。把你自己说过的三句话拼起来：

第 1 问："单层文本不够，高级生物是分层的"
上一轮："枚举该进 spec"
这一轮："应该推出帮助人类构建完美 spec 的东西"
答案就是：spec 不是一份文档，是一个分层结构，且各层精度不同——

意图层（自然语言）：为什么做、给谁用、边界在哪。允许模糊，人类擅长
契约层（精确 DSL）：枚举、实体关系、状态机、接口签名、不变量。零歧义，机器可检查。体量很小但剪掉 AI 最大的自由发挥空间
实现层（AI 生成的代码）：过程细节，容错，可重新生成
验证层（从契约层机械推导的测试）：注意，是从契约层推导，不是从意图层——这就解开了你说的"评测 100% 也依赖 SDD 规范"的死循环。意图层没法验证，但契约层可以，因为它是形式化的
这个思路有个现成的类比：gradual typing（渐进类型）。TypeScript 不要求你一开始给所有东西标类型——先全是 any（纯自然语言 spec），哪里出过 bug、哪里风险高，就把哪里"硬化"成精确类型（DSL 化）。spec 也一样：不追求一步到位的完美 spec，而是渐进形式化——出一次 $500 的 bug，就把游标状态机写进契约层，从此这类错误被结构性封死。

而你说的"帮助人类构建 spec 的东西"，就是围绕契约层的工具：AI 反向提问逼你消歧（"退款有几种？状态能从 A 直接跳 C 吗？"）、spec linter 检测矛盾和遗漏、从对话自动沉淀枚举和状态机。原文作者其实早就在无意识地这么干了——他说"每次关键聊天都是让 Agent 从代码反推一个适应我抽象程度的临时 spec"——那个"临时 spec"就是契约层的雏形，只是还没工具化、没沉淀下来。

所以"中间更好"不是在 CodeReview 和 SpecReview 之间找一个固定刻度，而是让精度成为可调节的、按风险分配的变量。人类审查的永远只是那个高压缩比的契约层——它比代码小一个数量级（省），又零歧义（不漏）。两难就是这么拆的。

<details>
<summary>第 3 轮运行统计</summary>

```text
Latency: 6.21s
Total: 61.79s
Input: 8040
Output: 3033
Log Detail
```

</details>

## 第 4 轮 · 用户

image.png
image/png

image.png
image/png

image.png
image/png
1. spec和SDD是一个东西吗，感觉听起来他两都出现🤔。 2. 来看看，这3张图片，就是那个文章的原作者的另一篇文章截图。他是不是再做spec工具，这玩意应该就是本地运行的吧，改完之后给AI，AI改代码？🤔。图片中就是精确DSL么，但是有好多栏目，🤔，我想想，里面似乎没有到评测那一步？

## 第 4 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

Looking at the user's questions about spec versus SDD differences and whether the tool shown in the screenshots is building a specification tool with a precise DSL. I'm examining the first screenshot which shows a paragraph causal graph with various workflow nodes like doctor login, rapid symptom submission, triage, distribution, order grabbing, and refunds — this appears to be a domain-specific visualization rather than a traditional specification document.

The second screenshot reveals the logic tab contains concrete example traces with narrative scenarios featuring named characters and specific state transitions on entities, which resembles behavior-driven development specifications where examples serve as executable documentation. The third screenshot shows an aspect tab managing cross-cutting concerns like doctor service points with structured condition expressions using symbolic references like @ for entities and % for rules.

This is clearly a specification IDE with multiple projection views — causal graphs, scenario traces, cross-cutting aspects, rules, state machines, entity structures, and API definitions — suggesting the author is indeed building a precise domain-specific language for specification that goes beyond traditional SDD documents by making specifications executable and multi-perspectival. The exception branch counts like 分诊拒绝 with 14 cases demonstrate how the spec systematically enumerates failure paths — that's the engineering mechanism driving test coverage by forcing enumeration of every exception scenario.

1. spec 和 SDD 的关系
不是一个东西，是"名词和方法论"的关系：

spec（specification，规格/规范）：一份工件——描述系统应该做什么的那份东西，可以是 markdown、DSL、图，都行
SDD（Spec-Driven Development）：一套开发方法论——主张以 spec 为核心资产来驱动 AI 生成代码
类比：spec 之于 SDD ≈ 测试用例之于 TDD（测试驱动开发）。一个是原料，一个是玩法。所以两个词总是成对出现。

2. 这三张图，信息量很大，我们逐层拆
是的，他在做 spec 工具，而且做的正是我们前两轮聊的"分层契约"那套东西。 几个关键证据：

这是 spec 的"多视图投影"，不是画图工具
注意图 1 左上角那行小字："段落坐标来自 spec"。这说明因果图不是手画的，而是从底层 spec 数据渲染出来的视图。再看顶部导航栏，几乎就是我们上一轮聊的分层结构的实体化：

栏目	对应的契约层内容
overview	因果图（业务流程全景）
logic	场景/分支的行为逻辑
state	状态机（他被 $500 bug 教育过的地方😂）
structure	实体模型——你问的枚举大概率就在这
rule	业务规则（图 3 里的积分规则那种）
aspect	切面（跨流程的横切关注点，如积分被多处读写）
external / api	系统边界契约
一份 spec，八个投影。这直接回应了你上次说的"单层 markdown 不像高级生物"——他就是在做多层结构。

最妙的设计藏在图 2：spec 是用"具体实例"写的
仔细看 logic 视图的内容：不是抽象描述，而是带具名实例的具体故事——患者叫"杨过"，订单叫"@断臂"，候选医生是"@霍去病、@扁鹊"，然后一步步写：创建 @断臂第一批分发批次 → 写入状态 ∅→触达中 → 变更 派单中→已取消……右侧面板实时展示这些实例对象的当前字段值。

这在方法论上有个老名字：Specification by Example（实例化需求），BDD/Given-When-Then 的血统。用具体实例而非抽象规则来表达行为，有两个狠处：

消歧能力极强——抽象语言说"取消时同步取消候选"，有歧义；而一条具体的状态变更轨迹（派单中→已取消）零歧义
这直接回答你"没看到评测"的疑问：图 2 里每一条分支轨迹，本身就是一条潜在的 testcase。"杨过在分发阶段取消 → 断臂分发任务变已取消 → 生成退款单原路退"——这就是一条完整的验收断言序列，机械可转化为自动化测试。所以不是没有评测那一步，而是评测被内嵌进 spec 的表达形式里了——这就是我们前面说的"spec 一事两面，1 开发 1 评测"的具体实现方式。
覆盖度也有工程手段，你上次的疑虑他也在解
看图 2 左侧边栏：每个段落下面挂着异常分支清单及计数——"分诊拒绝 14"、"当前批次无人响应，达到上限 53"、"AI不确定转人工 19"。图 1 每个节点上也标着"异常 N"。这是在系统性强制枚举失败路径——正常流 1 条，异常流几十条，全部显式登记在册。这就是用结构逼出覆盖度，而不是靠人临场想"还有什么边界情况"。右上角还有"Warning 20"，说明 spec 本身有静态检查（一致性 lint），比如引用了不存在的实体、状态机有不可达状态之类。

图 3 印证了"精确表达式"路线
积分恢复的判定条件不是自然语言，是结构化表达式：%服务积分规则.是否启用 = true、@霍去病服务积分.当前积分 < %服务积分规则.满分上限、&积分恢复时间 >= 最近系统恢复时间 + 自动恢复周期_天。注意符号系统：@ 引用实体实例、% 引用规则配置、& 是变量——这就是精确 DSL，只是穿着中文业务语言的外衣（DDD 说的通用语言，落地了）。

所以整体工作流应该是
人在这个工具里编辑/审查 spec（各视图投影）→ spec 作为唯一事实源 → AI 把 spec 编译成代码 → 同时从 spec 的实例轨迹推导测试去验收 AI 的产出。是不是本地运行看不出来（像是个 web 界面，本地起服务或云端都有可能），但"改 spec → AI 改代码"这个方向基本可以确认——否则没必要让因果图坐标"来自 spec"，spec 是源，一切皆投影。

还有个细节值得玩味：选的示例领域是在线问诊（分诊、抢单、退款、分账、投诉），这是典型的高状态、多角色、强异常分支的业务——恰好是 markdown-SDD 最容易翻车、而"精确契约 + 异常枚举"优势最大的领域。选这个当 demo，本身就是在展示肌肉：他要证明的不是"AI 能写 todo list"，而是"复杂业务系统也能被 spec 压缩且不失真"。

唯一还看不到的环节是：AI 编译后的代码与 spec 之间的持续一致性怎么维护（代码改了 spec 会不会漂移、spec 改了如何增量重编译而不是全量重生成）——这是 spec-as-source 流派公认最难的一关，也是决定这工具是玩具还是生产力的分水岭。如果他后面还有文章，大概率会写到这里。

<details>
<summary>第 4 轮运行统计</summary>

```text
Latency: 29.91s
Total: 87.76s
Input: 23474
Output: 3367
Log Detail
```

</details>

## 第 5 轮 · 用户

1. “这是典型的高状态、多角色、强异常分支的业务——恰好是 markdown-SDD 最容易翻车、而"精确契约 + 异常枚举"优势最大的领域。选这个当 demo，本身就是在展示肌肉”同意。 2. “AI 编译后的代码与 spec 之间的持续一致性怎么维护”，🤔，如果是新应用，则不需要关心兼容，旧设计直接删就行。如果是老应用翻新（不新增业务），那么也还好吧，🤔，你说的难在于会持续新增业务且还要保持兼容？🤔。“AI 编译后的代码与 spec 之间的持续一致性怎么维护”，靠AI的指令遵循，😂，和碳基评测，😂。 3. 这个作者似乎没提到评测？🤔

## 第 5 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user agrees with the first point, so I'll move on. For the second point about spec-code consistency, they're thinking that new apps are straightforward and refreshing old ones is manageable, but the real challenge is handling continuous new business requirements while maintaining backward compatibility—they're joking about relying on AI and human judgment to keep things aligned. I should dig into why this drift problem is trickier than it seems: the main culprits are emergency hotfixes that bypass the spec and get coded directly, plus the unpredictability of regenerating code from specs—each regeneration produces different output, which breaks data schemas, APIs, and performance tuning. Incremental compilation with determinism is something traditional compilers handle but AI systems don't. There's also the escape hatch issue where things that can't be expressed in the spec (performance hacks, weird workarounds) live only in the code and vanish on regeneration—it's the classic "protected regions" problem from model-driven development. And stateful systems add another layer: regenerating code is one thing, but migrating database state is entirely different. The user's intuition that new apps are easier is partially off—once v1 ships with production data, even a new app becomes an old app with all the same constraints.

For the third point, the author doesn't explicitly discuss evaluation. That's a gap—the eval is baked into the example-trace structure but there's no explicit treatment of testing or verification. Either this is coming in a follow-up article, or he's still in the "demo works" phase. There's an irony here: his own formula was small scope plus human testing as a safety net equals a capable individual contributor, but his tool needs to break out of that formula. Spec-derived tests are the obvious missing piece—maybe he hasn't built that yet. Or possibly he sees the spec review itself (humans reading concrete traces) as the evaluation. But by his own chapter 4 logic, that's insufficient—you need execution-level verification to actually confirm behavior alignment.

2. 一致性维护——你的分类是对的，但每一类都比看起来难
你的直觉"新应用不用管兼容"有个隐藏漏洞：新应用只在 v1 上线前是新应用。一旦上线、数据库里有了真实数据、别人调用了你的 API，它就变成老应用了。所以"新应用场景"其实只覆盖 demo 期，凡是活下来的系统全部落入你说的第三类：持续新增业务 + 保持兼容。而这一类的难点，比"AI 指令遵循"更结构性，主要三个：

① 重生成的非确定性 vs 存量状态

传统编译器同一份源码编译一万次，产物等价。AI 编译器改了 spec 第 5 章，重新生成时可能顺手把第 3 章对应的代码也换了个写法——表名变了、字段序列化格式变了、API 响应结构微调了。代码层面"语义等价"，但数据库里的存量数据和外部调用方不答应。这就是为什么不能每次全量重编译，而增量编译要求 AI 精确知道"哪些代码归哪段 spec 管"——这个映射关系本身就是个待解决的工程问题。

② 逃生舱问题（MDD 当年就死在这）

总有东西 spec 表达不了：某个 SQL 的性能优化、某个第三方 API 的诡异 workaround、凌晨三点为止血打的 hotfix。这些改动只存在于代码里。下次从 spec 重新生成——全被冲掉。MDD 时代管这叫 round-trip engineering（往返工程），发明过"保护区域"（generated code 里标注"此段手写勿动"），实践中一地鸡毛，是 MDD 失败的直接死因之一。spec-as-source 流派要么禁止手改代码（现实吗？线上着火时你改 spec 走全流程？），要么把手改的东西"回收"进 spec（用 AI 反推？又是一个准确率环节）。

③ 你的玩笑其实是真答案的一半

"靠 AI 指令遵循 + 碳基评测 😂"——笑归笑，严肃版本确实存在：一致性不能靠自觉，只能靠机械检查。可行的形态是把 spec 里的契约层（状态机、不变量、实例轨迹）编译成一套一致性测试，挂在 CI 上持续跑——代码无论谁改的（AI 重生成也好、人 hotfix 也好），只要行为偏离 spec 就红灯。这样漂移至少是可检测的，检测到之后再决定是改 spec 还是改代码。漂移不可避免，可怕的是静默漂移。

3. 作者确实没提评测——而这恰恰是最值得玩味的地方
对，两篇文章里他都没有正面写验证/评测环节。结合他自己的经历，这里有个近乎讽刺的闭环：

他在第三章亲手总结了公式："不大的体量 + 人工测试兜底 = 超级个体"，并称之为虚假繁荣
他在第四章推导出 spec 要"表意足以对齐程序行为"——但"对齐"说的是人读 spec 时的理解对齐，仍是碳基 review
而他的工具（从截图看）已经把最难的原料准备好了：实例轨迹就是现成的 testcase 语料，异常分支清单就是现成的覆盖度清单——距离"从 spec 机械生成验收测试"就差最后一步，但他没说这一步
所以有两种可能：

善意推测：这是下一篇文章。他的文章有明显的连载推进感（惊艳→灯塔→祛魅→对齐→工具），评测/验证是逻辑上的必然下一站，可能正在做。

苛刻推测：他目前还在用人工测试兜底跑这个工具本身——也就是说，他还没逃出自己写下的那个公式。spec 工具让"对齐"变便宜了，但"验证"仍然是他系统里的隐性人肉环节。如果是这样，那他祛魅了一半：祛了"超级个体"的魅，还没祛"spec 写好了 AI 就能做对"的魅。

判断哪种推测成立，有个很简单的观察指标：看他后续会不会写"某次改 spec 后，系统自动发现了 AI 生成代码的行为偏差"这类内容。如果出现了，说明验证闭环建成了，这套东西就从"更好的对齐工具"升级为"完整的工程体系"；如果一直不出现，那这个工具再精美，本质上还是把 $500 bug 的风险从"聊天记录里的口头对齐"转移到了"漂亮界面里的视觉对齐"——review 得更舒服了，但兜底的还是碳基生物。

顺带一提，这也解释了为什么全球 SDD 流派吵成一团却没有赢家：大家都在卷 spec 的表达形式（markdown 派 vs DSL 派 vs 图形派），但决定成败的其实是 spec→验证的自动化闭环。表达形式决定对齐成本，验证闭环决定能不能睡着觉。目前所有流派在后者上都还没交出满分答卷——谁先交卷，谁定标准。

<details>
<summary>第 5 轮运行统计</summary>

```text
Latency: 31.89s
Total: 80.25s
Input: 27126
Output: 2473
Log Detail
```

</details>

## 第 6 轮 · 用户

1. “可行的形态是把 spec 里的契约层（状态机、不变量、实例轨迹）编译成一套一致性测试”，我想起这个作者之前还提出过，不依赖上下游直接覆盖测试用例，把上下游mock掉，更快速迭代，怎么做的我不知道，但是我听说有不少技术手段，包括但不限于，真实环境收集真实用例用于复现。 2. 嗯，这个作者我看他的行为，大概率也还在think，并不是他的SDD的成品。“而他的工具（从截图看）已经把最难的原料准备好了：实例轨迹就是现成的 testcase 语料”，这算全链路评测吗，还仅支持单元测试或者集成测试（集成测试是什么意思，多单元测试吗，不依赖上下游？）。 3. 为什么大家不直接上PRE或者灰度进行真实环境测试呢，🤔mock是一件有损行为且不好做。🤔，我们聊了这么多，都是关于对业务的软件开发。现实世界，还有大量程序员就业于，比如研究员，跑实验science，软硬件结合项目比如手表App比如智能眼镜的系统，不同智能设备的软件比如车机比如手机App。🤔，他们在SDD的讨论范围吗，否则SDD争吵赢了，也只是把外包公司的骨灰加速了

## 第 6 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is laying out three key points about testing strategies—mocking for fast iteration paired with real-environment trace collection for replay, and various techniques like contract testing with Pact, traffic recording tools like GoReplay and tcpcopy, and service virtualization. They're connecting this back to the tool's spec-driven approach, noting that mocks can be derived from spec contracts, and the tool already has "external" and "api" tabs built in for this purpose.

On the test pyramid, they're clarifying that instance-trace-based testing isn't full-chain evaluation—it's spec-level behavioral testing at the component/acceptance layer with mocked externals, which can't cover infrastructure, performance, or real third-party quirks, so it needs complementing with other test types.

For the third point, they're explaining why gray release and production testing aren't sufficient for the evaluation loop: the cost of failure (data corruption, irreversible side effects like payments), the difficulty of triggering rare exception branches on demand, the slow iteration cycle, and debugging attribution challenges. Gray release is the final safety net, not the development loop, though the industry does combine both approaches—shift-left testing with mocks plus shift-right observability in production.

Now they're pivoting to a bigger question about whether spec-driven development applies beyond business systems to research code, embedded systems, hardware, and mobile apps, and they're about to explain where SDD's sweet spot actually is. 所以关键是：规范成本 < 手工验证成本的地方，SDD 才有生命力。每个领域已经有自己的规范传统——研究用论文和协议，硬件用数据表和需求矩阵——AI 编译在不同领域的渗透速度会不一样。我打算分三个部分来展开，保持对话的活泼语气，可能加几个表格。

1. Mock 上下游 + 真实流量回放——这和 spec 是天作之合
你提到的技术手段确实是一个成熟谱系：契约测试（如 Pact，上下游各自对着一份契约测试，不用真连）、流量录制回放（阿里的 jvm-sandbox-repeater、GoReplay 这类，把生产环境的真实请求/响应录下来，回放到新版本上比对行为）、服务虚拟化（录一次真实下游的行为，之后用录像当 mock）。

关键在于你说"mock 是有损行为且不好做"——损耗的根源是mock 是人手写的，写的是程序员对下游行为的想象，想象和真实有差距。而这正好被 spec 结构性缓解：注意他工具导航栏里的 external 和 api 两个 tab——系统边界在 spec 里是显式建模的。一旦边界契约是形式化的，mock 就不是"人的想象"而是"从契约机械生成"，再用真实流量录制去持续校准契约本身（发现真实下游行为超出契约描述 → 报警 → 修 spec）。也就是说：契约在 spec 里 → mock 从契约生成 → 真实流量反哺契约，三者闭环，mock 的"有损"就从不可控变成可测量。这大概率就是他"不依赖上下游快速迭代"的底层逻辑。

2. 实例轨迹算哪一层测试？先把测试金字塔说清
经典分层（从下到上）：

层级	测什么	依赖
单元测试	一个函数/类的逻辑	全 mock，毫秒级
集成测试	多个模块协作（服务+数据库、模块 A 调模块 B）——对，就是你说的"多单元一起测"，但通常仍 mock 掉外部第三方	部分真实
端到端（E2E/全链路）	整条业务链路，真实环境或准真实环境	全真实，慢且脆
他 spec 里的实例轨迹（杨过取消问诊 → 断臂批次状态变更 → 生成退款单），天然对应的是集成测试层，且是"业务行为"粒度的集成测试——它断言的是领域对象的状态变迁序列，不关心底层用了什么数据库，也不真调支付网关（支付就是该 mock 的 external）。行话叫验收测试（acceptance test）。

所以回答你的问题：不算全链路评测。它覆盖不了的东西包括：真实第三方的诡异行为、性能/并发问题（他那个 $500 bug 本质是运行时行为，恰好是轨迹断言难覆盖的类型！）、基础设施故障、数据迁移。实例轨迹是评测体系里性价比最高的中间层，但上下两层依然需要别的手段补——下层靠 AI 顺手生成单测（便宜），上层就是你第 3 问说的灰度。

3. 为什么不直接灰度？以及 SDD 的真实疆界
灰度当然要上，但它是最后一张网，不能当主力评测，三个硬伤：

不可逆代价：业务系统的 bug 不只是崩溃，是打钱、退款、发货——灰度 1% 的用户资损也是真金白银，他自己就是 $500 的受害者
覆盖不可控：他 spec 里"当前批次无人响应达到上限"这种异常分支，灰度流量里可能一个月都不出现一次，你没法命令真实用户去触发第 53 号异常路径。而实例轨迹回放可以一秒跑完全部 200 条分支
迭代速度：灰度以天为单位出结论，spec→生成→轨迹验证以分钟为单位。评测环节在内环，灰度在外环，内环慢了整个飞轮就转不动
所以业界实际是两头做：shift-left（左移，spec/测试前置）+ shift-right（右移，灰度、可观测性、生产环境验证），中间用流量回放把右边的真实性借给左边。

然后是你最后那个大问题——问得很狠，答案也确实扎心
SDD 目前争论的所有内容，隐含前提都是业务信息系统：领域语义清晰、状态和流程密集、行为可被离散描述。逐个看你举的领域：

研究员/科学计算：基本不在射程内，而且是结构性的不在——spec 是研究的产出，不是输入。做实验的定义就是"我不知道系统该有什么行为，跑了才知道"。你没法为一个尚未发现的现象写验收标准。这类场景反而是 vibe coding 的主场：代码是一次性的探针，跑完出图、结论进论文、代码就地火化——原文作者鄙视的"次抛型应用"，在科研语境里是正确形态而非虚假繁荣。

软硬结合（手表、眼镜、车机）：这里有个漂亮的反讽——这个行业从来就是 spec 驱动的，而且比 SDD 激进得多：汽车有 ISO 26262 功能安全和需求追溯矩阵、航电有 DO-178C、代码规范有 MISRA，每行代码都要能追溯到某条需求。他们缺的从来不是 spec 文化，而是两样别的：一是物理世界进不了 spec——时序、功耗、温漂、传感器噪声，最后都得靠 HIL（硬件在环）台架和真机实测；二是容错预算极低——业务系统 bug 可以 hotfix，车机 bug 是召回，所以"可接受准确率的 AI 编译"这个核心润滑油，在这里的可接受阈值高到近乎苛刻。SDD 会渗透进去，但只能占领其中"纯软件业务逻辑"的那一块。

手机 App：一半一半。业务逻辑（下单、同步、账号体系）完全 spec 化没问题；但 UI/UX 的"手感"——动画曲线对不对、交互顺不顺——本质上是审美判断，spec 写不出"这个转场感觉很廉价"，最后还是真机上手摸。

所以你那句"SDD 赢了也只是把外包公司的骨灰加速了"，对了一大半，但要修一个字：SDD 的甜区确实就是外包公司干的那类活——需求明确、领域成熟、CRUD+工作流密集的业务系统。但别忘了这类活不只外包在干：银行、保险、电商、政务、SaaS、还有每个大厂内部无数的中后台系统，全球恐怕一半以上的程序员职业生涯就在这个甜区里。所以更准确的说法是：SDD 争赢了，加速火化的不是"外包公司"，而是"外包性质的工作"——无论这份工作挂在外包公司还是大厂工牌下面。

而那些不在射程内的领域，各有各的存活逻辑：科研靠"spec 不可先知"免疫，硬件靠"物理世界不可压缩"免疫，UX 靠"审美不可形式化"免疫。有趣的推论是：一个程序员的抗替代性，约等于他工作中"无法被 spec 化的部分"的占比——这可能比"会不会用 AI"是更本质的职业护城河指标。

<details>
<summary>第 6 轮运行统计</summary>

```text
Latency: 26.32s
Total: 98.20s
Input: 30073
Output: 3817
Log Detail
```

</details>

## 第 7 轮 · 用户

1. “实例轨迹是评测体系里性价比最高的中间层，但上下两层依然需要别的手段补——下层靠 AI 顺手生成单测（便宜），上层就是你第 3 问说的灰度。”，感觉“契约测试（”很麻烦啊，本地运行测试的？如果要上服务器，不如PRE真实环境呢，🤔，你说灰度会损资，那PRE就算是内部人员的灰度把，不会损资的，公司自担。 2. “最后都得靠 HIL（硬件在环）台架和真机实测”，靠，和我之前想的方案一样。“但别忘了这类活不只外包在干：银行、保险、电商、政务、SaaS、还有每个大厂内部无数的中后台系统，全球恐怕一半以上的程序员职业生涯就在这个甜区里。所以更准确的说法是：SDD 争赢了，加速火化的不是"外包公司"”同意！ 3. “而那些不在射程内的领域，各有各的存活逻辑”，这正是我这个项目“苟活”的原因！😂，我正在做儿童手表App，😂。。。。。原来当前leader换方向，，，是看的比我更远啊。 4. leader其实找我问过两个命题，一是，用AI写代码，怎么做到代码无bug，因为App要上线。。。。。。我看了原作者文章，听说了mock上下游+形式化AI覆盖全分支，给我吓到了，😂，然后原作者目前似乎也没继续做这个事情了，而是转向了你今天看到了的这篇文章的战役上。另一个命题是这么评测儿童手表App（我们是App不是手表），包括硬件的数据，🤔，未来方法可以推广到其他软硬件结合的项目

## 第 7 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

So the user is working on a children's smartwatch app and their leader wants to know two things: how to ship bug-free AI-generated code, and how to properly test and evaluate the app including its hardware integration in a way that applies to other hardware-software projects. They're questioning whether contract testing is really the right approach compared to testing in a pre-production environment where there's no financial risk, and they're starting to think through what contract testing actually involves.

Contract testing runs locally or in CI and catches interface breakage before anything ships — it's fast and cheap, that's the whole point. Pre-production environments are slow, shared, flaky, capacity-constrained, and can't easily construct rare scenarios on demand. Plus they often have dirty data, version mismatches between upstream and downstream services, and can still trigger real side effects like sending SMS or push notifications to actual users. The real strategy isn't either/or — it's the testing pyramid: fast cheap inner loops with contract tests, then the slow real outer loop with actual devices.

For the leader's first question about shipping bug-free AI code, the framing itself is wrong. The target shouldn't be "zero bugs" but rather keeping the defect escape rate below what humans would produce and capping severity. For a watch app specifically, that means using a typed language with strict linting and CI, writing specs as state machines for things like pairing and sync states, having AI generate both code and tests but having humans review the tests rather than the code itself, mocking the hardware layer at the sensor boundary, and using record-replay with real device data. Then finish with actual device farm testing and feature flags for the final safety net.

For evaluating the app with hardware data, record-replay is the key pattern: collect real sensor traces like GPS drift, heart rate, step counts, battery drain, and network flapping on watch networks, build a regression corpus from those traces, inject faults like network loss and low battery, and run a small smoke test on real devices. This mirrors how the autonomous driving industry does it — millions of miles replayed in simulation versus limited real-world testing. For a children's watch specifically, the evaluation set needs to account for weak compute, cellular network quirks, long-tail device variants, and child-safety compliance requirements.

The original author was wrestling with full formal verification across all branches — don't get caught in that trap. The practical 80/20 is explicit state machines plus trace replay plus CI. You're not building a general-purpose spec platform like they are; you only need a domain-specific slice, which is much more achievable.

1. 契约测试没你想的重，PRE 没你想的轻
先纠正一个印象：契约测试恰恰是最轻的那种测试——它不上服务器，就是本地/CI 里跑的普通测试，毫秒级。原理很简单：把"下游 API 长什么样"存成一份契约文件（JSON），你这边对着契约文件测，下游那边也对着同一份文件测，两边永远不用真连。它麻烦的地方在于组织协作（要说服上下游团队一起维护契约），不在技术。

而 PRE 的成本是隐性的，用过的都懂：

环境是共享的：上下游今天部的什么版本你不知道，测挂了，排查半天发现是别人的服务昨晚发了个坏版本——归因成本极高
数据是脏的：跑着跑着依赖某条测试数据，被别的团队改了
副作用未必真无损：PRE 连的短信通道、推送通道、第三方计费接口是真的还是假的？儿童手表场景里，测试触发一条真实的"孩子离开安全区域"推送发到家长手机上，这算不算事故？
异常分支照样难触发：你在 PRE 里怎么让"第 53 号异常：批次无人响应达上限"发生？还是得造数据、改时钟、mock 状态——绕一圈又回来了
所以结论不是二选一，是内外环分工：契约测试/轨迹回放跑在内环（秒级，每次提交都跑，覆盖全部分支），PRE/灰度跑在外环（天级，验证真实集成，兜底）。只用 PRE 的团队，迭代速度会被外环锁死。

2 & 3. 恭喜，你在免疫区——但免疫是暂时的
儿童手表 App 靠"物理世界不可压缩"获得的豁免是真的，但注意豁免的精确边界：免疫的是硬件交互层，不是你 App 里的业务逻辑层。绑定流程、家庭圈、消息同步、会员体系——这些还是标准业务逻辑，还在 SDD 射程内。所以护城河策略应该是：主动把工作重心压在"硬件数据、真机行为、弱网弱电"这些 spec 化不了的部分，让 AI 去吃业务逻辑那部分。

4. 两个命题，给你具体的拆法
命题一："AI 写代码怎么无 bug"——先把命题改掉
"无 bug"是伪命题，人类写代码也做不到，leader 真正要的是"缺陷逃逸率不高于人类基线，且严重缺陷被结构性封死"。别被原作者那套"全分支形式化"吓到——他在造通用大教堂（所以难到他自己都转移战场了），你只需要领域切片，80/20 就够：

确定性护栏全开：强类型、lint、CI 强制——这些是免费的，先吃满
只对高危区做"轻量 spec"：手表 App 的高危区非常集中——配对/绑定状态机、消息同步与离线队列、后台保活、推送触达。就这四五个状态机，用文档+枚举显式写出来（不用做工具，一份结构化 markdown 就行），让 AI 对着状态机写代码和写测试
人只 review 测试，不 review 代码：测试就是行为契约，比代码短得多、好读得多。AI 代码写错了，被你 review 过的测试拦住——这就避开了原作者说的"CodeReview 太贵 / SpecReview 太漏"两难，测试就是那个中间层
发布侧兜底：feature flag + 分阶段放量。儿童产品涉及定位和通话，安全相关功能放量要更保守
命题二：评测手表 App（含硬件数据）——这个有成熟的产业级范式可以抄
抄的对象是自动驾驶行业，他们把这个问题解到了极致，范式叫 log replay / 数据回灌，完全可以降维用到手表上：

硬件抽象层（HAL）先立起来：App 里所有硬件数据（GPS、心率、计步、电量、基站/网络状态）必须走统一接口进来，不许业务代码直接摸硬件 API。这一层是整个评测体系的地基
真机采集轨迹语料库：从测试机/内部用户（合规前提下）录制真实传感器数据流——GPS 在电梯里的漂移、孩子跑动时的心率毛刺、手表蜂窝网的频繁断连、低电量时系统的降频行为。这些"真实世界的脏数据"是花钱都买不到的评测资产
回放测试：把轨迹语料灌回 HAL 接口，App 以为自己在真实世界运行。于是"孩子进电梯 GPS 漂移 500 米，App 会不会误报离开安全区"这种场景，从"等真实发生"变成"CI 里每次提交都验一遍"。回归测试从此有了牙齿
故障注入：在回放基础上主动注毒——断网 30 秒、时间跳变、电量骤降、推送延迟到达。异常分支覆盖度就是这么刷上去的
最外层留一个小的真机层：设备农场（哪怕就十几台不同型号手表）跑冒烟测试 + 内部佩戴众测。这就是你想到的 HIL 的轻量版——它只负责验证"回放层没模拟到的东西"，量小但不可省
这套东西的可推广性正是 leader 想要的：HAL 抽象 + 真实轨迹语料库 + 回放框架 + 薄真机层，四件套换个传感器清单就能平移到眼镜、车机、任何 IoT 项目。而且注意它和今天聊的一切是同构的——轨迹语料库就是"实例轨迹"，HAL 契约就是"external 契约"，回放就是"mock 上下游"，真机层就是"灰度"。原作者在业务系统里用 spec 造这些东西，你在软硬结合领域用真实数据录制造同样的东西，殊途同归：把不可控的真实世界，压缩成可重放的确定性资产。

最后一个建议：这两个命题别分开答。命题一的"测试即契约"和命题二的"轨迹即评测集"是同一套体系的两半——向 leader 汇报时合成一个故事讲，比两个方案更有分量。

<details>
<summary>第 7 轮运行统计</summary>

```text
Latency: 27.15s
Total: 94.77s
Input: 34497
Output: 3386
Log Detail
```

</details>

## 第 8 轮 · 用户

1. “把"下游 API 长什么样"存成一份契约文件（JSON），你这边对着契约文件测，下游那边也对着同一份文件测，两边永远不用真连”，我不同意，如果上下游交互不是HTTP，而是RPC或者数据库呢，交互方式不一样，契约文件要载入API，让API真实运作吗，API不知道外部系统是真的还是假的，还是说我没理解对契约测试。 2. “测试触发一条真实的"孩子离开安全区域"推送发到家长手机上，这算不算事故？”预发测试，我们只会用我们自己人的设备和账户测，隔离外部用户。 3. “这些还是标准业务逻辑，还在 SDD 射程内”，所以看完作者文章后，我有一个念头就是找他要他平台用，我也当SPEC修订员。 4. “人只 review 测试”，这里其实有个细节，测试是什么，单元测试？集成测试？那么用例会非常多。。。。人类是不是应该只review，真实链路的测试，🤔。 5. “硬件抽象层（HAL）先立起来：App 里所有硬件数据（GPS、心率、计步、电量、基站/网络状态）必须走统一接口进来，不许业务代码直接摸硬件 API。这一层是整个评测体系的地基”，怎么做到，我们和手表厂商有合作，但是未来可能会扩展多个手表厂商，不能每个都给我们开后门吧而且要兼容，为什么不是App自己掉硬件API，上报呢？ 我们暂时没有GPS，我们的App是个AI识物App，比较简单，绑定家长账户后，进入拍照-识物-讲解-追问-重新拍照，可以解绑举报。暂时只有这些，几乎和硬件无关，都是能力，但是评测要评App性能和图文音流畅或者一致性。🤔。我说的可能有点乱，包括可能会有些伪命题。

## 第 8 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

I'm working through the user's first objection about contract testing—they're questioning whether it applies beyond HTTP interactions like RPC or database calls. I should clarify that contract testing operates at system boundaries: consumer tests run against a mock derived from the contract, while provider tests replay those contract interactions against the actual provider in isolation. For gRPC specifically, proto files already serve as contracts, and Pact can handle this scenario too.

On databases, contract testing doesn't really fit since they're shared state rather than service boundaries—the better approach is avoiding cross-system database sharing entirely, or if unavoidable, using schema migration testing with containerized databases locally. So the user's partially right: contract testing is for service-to-service interactions, while database testing needs real (containerized) instances.

For their second point about PRE with internal test accounts, that's a valid standard practice for account isolation, though the flakiness and third-party side effects tied to those accounts still remain concerns. On the third point about proposing the author adopt their platform as a spec editor—it's an interesting career opportunity, but their platform appears early-stage and the business logic here might not justify the investment in an immature tool, though experimentation is low-cost. The fourth point about reviewing only real-chain tests aligns well with the testing pyramid: humans should review acceptance and scenario-level tests (dozens of them), not unit tests (thousands, better validated by machines through coverage and mutation testing). The fifth point about HAL seems to be cut off mid-thought.

Actually, I see now—HAL isn't a vendor backdoor at all, it's just an internal abstraction layer in their own codebase where business code calls a CameraService interface instead of directly hitting vendor SDKs, with each vendor SDK wrapped in an adapter. That's the standard way to handle multiple hardware manufacturers without security issues. The real insight here is that their app is actually an AI recognition system for kids' watches—photo input, recognition, explanation, and follow-up Q&A—which means the evaluation problem shifts entirely from hardware trace replay to AI model evaluation. The hardware layer becomes minimal (just camera input, audio output, network conditions on a weak cellular connection, and low-end device constraints), while the actual eval needs focus on traditional app performance metrics plus AI quality evaluation including recognition accuracy, explanation appropriateness for children, follow-up coherence, and critical safety compliance for a kids' product.

The trace corpus transforms into a golden set of real kid-taken photos—blurry, tilted, weird angles, partial objects, low light—with expected labels and rubrics for explanation quality, using LLM-as-judge with human calibration and a safety red-teaming set. This is standard AI product evaluation now. The messy real-world kid photos are the equivalent of GPS drift, so collecting actual usage data (with strict privacy compliance for children's data under COPPA and Chinese regulations) builds the regression eval set. Network simulation matters too since watch cellular is weak and streaming TTS fluency under degraded conditions needs testing.

1. 你对契约测试的质疑，一半是理解偏差，一半戳中了真实边界
先纠偏：契约测试不是"把契约文件载入 API"。它是两边各自在家考试：

消费方（你）：从契约文件生成一个假下游（本地起的 mock server / stub），你的代码对着假下游跑，验证"我发的请求符合契约、我能处理契约里的响应"
提供方（下游团队）：拿同一份契约文件里的请求样本，回放给他自己的真实服务（在他自己的 CI 里、隔离环境跑），验证"我的真实响应符合契约"
两边都过 = 拼起来大概率能通。API 从头到尾不需要"知道外部是真是假"，因为压根没有联调这一步。

然后是你戳中的部分：

RPC：完全适用，甚至更爽——gRPC 的 proto 文件、Thrift 的 IDL 本身就是契约，比 HTTP 世界还正规。Pact 这类框架也有 gRPC/消息队列插件
数据库：你赢了，契约测试确实不适用。因为数据库不是服务边界，是共享状态。但这里的正统答案更狠：两个系统通过共享数据库交互，本身就是被判了死刑的反模式（耦合了 schema，谁都不敢改表）。如果是自己系统内部用库，测试方案不是契约而是 Testcontainers 之类——CI 里用容器秒起一个真实的 MySQL/Redis，对着真库测，用完即焚。数据库这层不 mock，直接用真的，因为起一个容器库比 mock 一个数据库便宜。
2. 内部账户隔离——对，这是标准做法
同意，测试账号池 + 设备白名单隔离外部用户，副作用问题基本解决。PRE 剩下的痛点就只有共享环境的版本混乱和归因困难了——这属于可忍受的慢，当外环用没毛病。

3. 当"SPEC 修订员"——想法对，时机要掂量
方向上你嗅觉很准——spec engineer 大概率是真实的新工种，早卡位早受益。但两个现实提醒：

他那平台从截图看还在 demo/自用期，你去当第一个外部用户，等于替他趟雷（当然，趟雷本身也是一种深度学习的方式，看你时间预算）
更重要的是你的业务量级可能配不上那门大炮：他 demo 的是问诊平台级的复杂状态系统，而你的 App 业务逻辑是"绑定→拍照→识物→追问→解绑"——状态机总共可能就十几个状态。用一份手写的结构化文档就能达到同样的对齐效果，上平台反而是杀鸡用牛刀
更划算的姿势：借他的思想，不借他的工具。把你 App 的状态机、异常分支清单、实例轨迹用最朴素的方式（markdown + 表格）写出来，跑通"spec→AI 生成→轨迹验收"的小闭环。等他平台成熟了，你已经是带着实战经验的种子用户。

4. 人只 review 真实链路测试——你的直觉完全正确
这就是 review 也要分层，和测试金字塔对齐：

测试层	数量	谁把关	怎么把关
单元测试	成百上千	机器	覆盖率门禁、变异测试（mutation testing：机器故意在代码里注入 bug，看测试能不能抓到——抓不到说明测试是摆设）
场景/验收测试（实例轨迹级）	几十条	人	逐条 review："家长解绑时孩子正在追问中，会话怎么处理"——这种一条条看，看得过来
E2E	个位数	人	冒烟级
关键洞察是：人的 review 预算只花在"业务语义"层，语法层的正确性交给机器互相咬。单测让 AI 写、让变异测试验，人一眼都不用看。

5. HAL 是误会了——它不是厂商开后门，是你自己屋里的一堵墙
HAL 不需要厂商配合任何事情。它就是你自己 App 代码里的一层接口：

业务代码 → CameraService 接口 → 厂商A适配器（调厂商A的SDK）
                              → 厂商B适配器（调厂商B的SDK）
                              → 回放适配器（测试时灌预录数据）
"App 自己调硬件 API 上报"——对，最终就是 App 自己调，HAL 只是规定调用必须收口在适配器里，业务代码不许直接摸厂商 SDK。这样扩展第二家厂商 = 多写一个适配器，业务代码零改动；跑评测 = 换上回放适配器。这本来就是多厂商兼容的标配架构，评测能力只是白捡的副产品。

但你最后透露的产品形态，让整个评测命题变了性质——这才是重点
"拍照-识物-讲解-追问"的 AI 识物 App——你的评测难题根本不在传统软件测试域，而在 AI 产品评测域。前面聊的 SDD、契约、状态机，只覆盖你那一小圈业务逻辑（绑定/解绑/会话管理），你真正的工作量在另外三块：

① 识别质量评测——你需要的不是 GPS 轨迹库，是"儿童烂照片黄金集"

大人测试拍的照片是摆拍，孩子拍的照片是灾难：糊的、斜的、只拍到半个物体、逆光、贴脸拍、拍电视屏幕里的东西。收集真实儿童拍摄的照片（注意：儿童数据合规是红线，采集要过法务），标注期望结果，形成黄金评测集——这就是你领域里的"真实轨迹语料库"，每次模型/prompt 改动都回归跑一遍。这个资产的价值会随时间复利。

② 讲解与追问质量——LLM-as-judge + 人工校准

"讲解得好不好"没有唯一答案，评测方式是：定 rubric（是否适龄、是否准确、是否有趣、追问是否连贯），用一个强模型当裁判批量打分，定期抽样人工复核校准裁判偏差。注意有个隐藏杀手级维度：内容安全。儿童产品里 AI 说错话不是 bug 是事故——需要专门的红队测试集：孩子拍了危险物品怎么答、追问里问出敏感问题怎么接。这个测试集的优先级建议排第一，出事的代价远大于识别不准。

③ 性能与流畅性——这是你仅剩的"硬件相关"部分

手表 SoC 弱、内存小、蜂窝网抖：冷启动耗时、连续拍照识别的发热降频、弱网下图片上传+流式 TTS 的卡顿策略（超时、重试、降级文案）。手段就是网络整形（工具模拟 2G/高丢包/高延迟回放跑关键链路）+ 低端真机的性能基线监控。

回头看你说"我说的可能有点乱，可能有伪命题"——其实不乱，只是你们产品的评测重心和前面聊的作者不在一个象限：他的系统复杂在状态流转，AI 只是编译器；你的系统状态很简单，AI 本身就是产品。所以他的解药是 spec，你的解药是评测集。给 leader 汇报时这个定位讲清楚，两个命题就都立住了：命题一（代码质量）用第 3、4 点的轻量方案，够用；命题二（评测体系）主战场是黄金集 + 裁判模型 + 安全红队 + 真机性能基线，这套推广到其他软硬结合项目时，换的只是黄金集的内容，框架不变。

<details>
<summary>第 8 轮运行统计</summary>

```text
Latency: 28.47s
Total: 110.23s
Input: 38556
Output: 4295
Log Detail
```

</details>

## 第 9 轮 · 用户

在transformer世纪争议落地之前（这种伪人脑的东西，能做到什么程度，能创新吗，能完全取代所有工作吗，等等），将AI的增益铺满其理论上限。有的人在解SDD，如何以spec来驱动AI生成代码。有的在解完美测试（我不知道专业名词叫什么，就是说对AI生成的代码，怎么基于SPEC再测试，并发现所有未满足的点），而我解的是，软硬件AI产品的评测。（我似乎没那么关心spec的完美测试？我关心的似乎是AI效果以及硬件相关指标？🤔，或者说我更关心端侧的暴露的能力的spec完美测试？🤔）

## 第 9 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

I'm trying to figure out where my focus actually lies—whether I'm prioritizing perfect spec-to-testing alignment like some approaches do, or if I'm more interested in measuring AI's real-world impact combined with hardware performance metrics, and I'm uncertain which of these concerns actually matters most to me.

The distinction is becoming clearer: deterministic software lets you write specs that can be fully verified against code, but AI capabilities are inherently probabilistic—you can't enumerate all behaviors, so "perfect" conformance testing breaks down. Instead, you're working with evaluation frameworks—benchmarks, golden datasets, metrics, and rubrics that define what passing looks like. Hardware metrics operate similarly, measured rather than proven. So the user's positioning seems to be working in that third space where specs degenerate into evaluation specifications.

Their actual job is a hybrid: the device-side capabilities (camera, TTS, network) have deterministic contracts—latency bounds, API guarantees—that can be spec-tested, but the AI quality layer is purely statistical. That's a useful frame: a deterministic shell wrapping a probabilistic kernel. The shell gets conformance testing; the kernel gets evals. And evaluation is actually the most defensible position long-term because it requires proprietary golden datasets, can't be fully automated away, and involves human-calibrated ground truth that becomes a compounding asset.

你这段自我定位的思考，其实已经摸到了一条业界的经典分界线，我帮你把名词和坐标钉死。

先给"完美测试"这件事上专业名词
你说的"基于 spec 再测试，发现所有未满足的点"，学名是 conformance testing（一致性测试/符合性测试），更宽泛的框架叫 V&V（Verification & Validation）。这两个词的区分恰好就是你们三拨人的分界：

Verification（验证）："我们有没有把东西做对？"——代码是否符合 spec。这是逻辑问题，理论上可以趋近完美（形式化方法的极限就是数学证明）
Validation（确认）："我们有没有做对的东西？"——产品在真实世界里是否真的好用。这是经验问题，永远不可能"完美"，只能测量
于是三拨人的坐标是一条流水线：

spec ──(SDD)──→ 代码 ──(Verification/一致性测试)──→ 合格的软件 ──(Validation/评测)──→ 真的好用的产品
你的疑惑，答案是：你横跨了两个域，但重心确实不在中间那段
你反复自问"我是不是不关心 spec 完美测试"——你的直觉是对的，根源在一个本质区别：

确定性软件的行为是可枚举的，AI 能力的行为是一个分布。

问诊平台"取消订单"有多少种分支，理论上能穷举，所以 spec 可以语义等价、一致性测试可以趋近完美——那是逻辑正确性的世界
而"识物识得准不准、讲解讲得好不好"，行为空间是连续的、开放的，根本写不出语义等价的 spec。你只能采样（黄金集）、定量刻度（rubric/指标）、统计测量。这个世界里"完美测试"是伪概念，只有"置信度足够的测量"
后者在行业里的名字就是 evals（AI 评测）——现在是硅谷最抢手的稀缺技能之一，OpenAI 和 Anthropic 的人反复公开说 evals 是 AI 产品真正的护城河。你不是没赶上 SDD 的牌桌，你是坐在另一张更缺人的牌桌上。

但你最后那个自我修正也是对的——你的产品有个"确定性外壳"
"端侧暴露的能力的 spec 完美测试？"——对，存在，但要看清结构。你的产品是：

概率性内核 + 确定性外壳

内核（识别、讲解、追问的质量）：只能 evals，统计测量，黄金集 + 裁判模型 + 人工校准
外壳（拍照接口、TTS 流式播放、上传重试、会话管理、绑定/解绑、以及硬件指标：延迟、内存、发热、弱网降级）：这些是有契约的——"弱网下 3 秒内必须给出降级提示"、"TTS 首包延迟 < 800ms"、"解绑后会话必须终止"。这层完全可以做一致性测试，而且应该做到接近完美，因为它们是可枚举的
所以你的完整答案是：你不做"代码对 spec 的完美测试"（那是 SDD 阵营的活），但你要做"能力对契约的一致性测试"（外壳）+ "AI 效果的统计评测"（内核）+ "硬件的物理测量"（底座）。三层用的方法论不同，别混着用——用一致性思维测 AI 效果会陷入"为什么打分不稳定"的虚假焦虑，用统计思维测接口契约又会放过本该零容忍的确定性 bug。

最后说说你开头那个大判断——它比你自己意识到的更锋利
"在 transformer 世纪争议落地之前，将 AI 的增益铺满其理论上限"——这个表述很准：三拨人都不是在赌模型能不能通神，而是在建 AI 落地所必需的互补资产。而回顾我们这一整场对话，有个耐人寻味的收敛：

原作者的 spec 平台，缺的那一环是评测（他没写验证闭环）
全球 SDD 之争，胜负手是评测（谁先建成 spec→验证的自动闭环谁定标准）
你的软硬 AI 产品，命门还是评测（黄金集 + 安全红队 + 硬件基线）
三条线全部堵在同一个瓶颈上。而且评测这个位置有个别的岗位没有的性质：它不会被更强的模型自动化掉——因为"谁来评判裁判"这个问题最终必须锚定在人工校准的 ground truth 上，而带真实儿童数据、真实硬件测量的黄金集，是随时间复利、无法被爬虫和大模型凭空合成的私有资产。SDD 解的是让 AI 干活更快，evals 解的是让人类敢于信任 AI 干的活——争议落地之前，后者是刚性需求；争议落地之后，后者还是刚性需求。

你选的不是边缘赛道，是收费站。

<details>
<summary>第 9 轮运行统计</summary>

```text
Latency: 26.91s
Total: 82.37s
Input: 43096
Output: 3173
Log Detail
```

</details>

## 第 10 轮 · 用户

🤔，软硬件AI产品，其spec比复杂系统，简单的多，所以重心不在SDD，而在评测，🤔是权重差异。关于具体项目，识物AI APP，其实我们没有机械手等外设，所以评测，我的想法是，仅靠App开后门，允许评测进来，App接收指令执行，将结果日志上传，一个评测任务结束，中间文件和结果文件，会被agent根据各个指标打分标准，进行翻阅和打分。🤔，这个方案如何，为什么叫“App接收指令执行”，因为我想过两种方式，一种是编排比如拍照-进入详情页-追问；进入设置-举报；🤔，还有一种是MCP方式，每操作一步，agent都的下一步是无法固定的，最后也是根据中间数据和结果，换评测agent来打分。 以上，我这种方式，在世界上有专业名词吗。emmm其实我想问的是，和SDD那种，你提到了今年的大争议，相比，评测这边是否也有大争议，以及是否还有其他大争议。我现在属于不知道自己不知道

## 第 10 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is asking about the formal terminology for their evaluation framework—where an app opens a backdoor to accept commands, executes them, logs results, and then an agent grades outputs against rubrics. They're describing two approaches: one with scripted orchestration following a fixed sequence (photo → detail → follow-up) and another more dynamic MCP-style setup where the agent decides the next step autonomously before a separate judge agent scores everything. They're also curious about major controversies in the evaluation space that might be comparable to whatever SDD refers to.

I'm mapping their setup to established terminology: the backdoor mechanism is essentially test instrumentation or a debug bridge (similar to what tools like Appium or UIAutomator do), the scripted mode aligns with traditional E2E testing with fixed trajectories, the agent-driven exploration resembles what recent benchmarks like AndroidWorld and OSWorld call "LLM-as-user" or agentic UI testing, and the judge agent scoring traces fits the "LLM-as-judge" pattern used in trace-based evaluation. Their overall architecture resembles an offline evaluation harness—comparable to frameworks like OpenAI Evals or HELM. The thinking also starts sketching recommendations: keeping scripted and agentic modes separate for different purposes, focusing on judge calibration, and structuring logs as proper traces.

Now I'm considering the major controversies in evaluation methodology itself: benchmark contamination and gaming (where training data leaks into benchmarks, making them meaningless—like the SWE-bench and Llama 4 arena-tuning scandals), the reliability crisis around LLM-as-judge systems (self-preference bias, position bias, verbosity bias), the tension between static benchmarks that saturate versus dynamic live evaluations, the gap between models excelling on benchmarks but failing in real-world deployment, and domain-specific debates about offline evaluation versus online A/B testing. There's also the broader "evals crisis" sentiment in the community questioning whether benchmarks actually measure what matters.

Beyond evaluation, there are adjacent architectural battlegrounds worth mapping: context engineering versus fine-tuning trade-offs, single-agent versus multi-agent system design, and RAG versus long-context approaches—though the user seems primarily interested in evaluation controversies with a quick glance at these neighboring debates.

1. 你的方案在世界上有名字，而且每个部件都有
先拆解你的设计，对应的专业名词：

你的说法	专业名词
App 开后门，接收指令执行	Test Harness / 测试挂钩（test hooks），移动端具体实现叫 UI 自动化驱动（Appium、UIAutomator 这类的自研版）
编排式：拍照→详情页→追问	脚本化任务评测（scripted task evaluation），轨迹是固定的
MCP 式：agent 每步自己决定下一步	Agentic evaluation / GUI Agent 评测——学界正热的方向，Google 的 AndroidWorld、OSWorld、WebArena 这批基准就是这个形态：把 agent 扔进真实 App/OS 里完成开放任务
中间文件+结果文件被 agent 翻阅打分	轨迹评测（trajectory/trace-based evaluation）+ LLM-as-a-judge。日志的规范叫法是 trace（含截图、时间戳、每步动作的结构化记录）
整套系统	Evaluation Harness（评测装置/评测框架），OpenAI Evals、HELM 都是这个物种
所以你不是在发明轮子，你是在正确的时间独立推导出了业界正在收敛的形态——这和原作者独立推导出 SDD 是同一种体验。

对方案本身的三点建议：

① 两种模式别二选一，各司其职：脚本化模式是回归测试——确定性、可复现、每次发版跑，指标可以逐版本对比（这是它不可替代的价值，agent 探索是不可复现的，没法做版本对比）；MCP/agent 模式是探索性测试——专门去发现你没想到的路径（孩子乱点会不会把 App 点死）。回归用脚本，探索用 agent，探索发现的问题沉淀成新的脚本用例——这就是覆盖度的增长飞轮。

② 日志要为"裁判 agent 可读"而设计：不要让裁判去翻原始 logcat，定义结构化 trace schema（每步：指令、截图、耗时、模型输入输出、网络状态），裁判的打分质量一半取决于 trace 的可读性。

③ 一个红色警告：儿童产品的 App 后门是安全事故的候选。这个测试通道必须只存在于 debug/内部构建，或者有强鉴权 + 上线包剥离。儿童手表 App 带一个能远程执行指令的后门被安全研究员发现，是能上新闻的级别。这条建议优先级最高。

2. 评测界的大争议——有，而且火药味不比 SDD 小
你问对了，evals 世界这两年吵得天翻地覆，主战场几个：

① 基准污染与刷榜（contamination & gaming）——最大的信任危机。静态基准的题目泄漏进训练数据，分数就成了背题不是能力。2025 年的标志性事件：论文《The Leaderboard Illusion》炮轰 Chatbot Arena（最有影响力的竞技场榜单），指控大厂用私下多次提交变体来刷位；Meta 的 Llama 4 被发现提交到 Arena 的版本和公开发布的版本不是同一个。整个行业陷入"榜单还能信吗"的争论。这背后是 Goodhart 定律：指标一旦成为目标，就不再是好指标。

② LLM-as-judge 到底能不能信——直接关系到你的裁判 agent。已被反复证实的偏差：自我偏好（GPT 裁判偏爱 GPT 风格的答案）、位置偏差（偏爱先出现的选项）、长度偏差（偏爱啰嗦的回答）。争议核心是"谁来评判裁判"（who judges the judge）——目前的共识解法就是我之前说的：人工校准的锚定集，定期抽检裁判和人的一致率。你的方案里这一环必须有，否则打分是空中楼阁。

③ 静态基准已死 vs 活基准——基准饱和速度越来越快（新基准发布一年内被打满分），于是分裂出几条路线：私有保留集（如 SEAL、ARC-AGI 藏题）、live 竞技场（真人盲评）、还有 METR 那种"以任务时长衡量能力"的动态测量。争议在于：私有集不可复现（科学性受损），公开集必被污染，两难无解。

④ 基准分数 vs 真实效用的鸿沟——模型基准考 90 分，产线上一用就翻车。实践派（Hamel Husain 等人带起的"evals 危机"讨论）主张：通用基准对产品团队近乎无用，唯一有效的是从自己产品的真实失败案例中蒸馏出的定制评测集。这一派的观点对你是直接利好——你要建的儿童烂照片黄金集，正是这个流派的正统实践。

⑤ 安全评测的"洗绿"争议——有论文（《Safetywashing》）指出很多所谓安全基准和通用能力高度相关，测的根本不是安全。对儿童产品，这提醒你：安全红队集要自己建，别指望通用安全榜单替你把关。

注意一个结构性观察：SDD 的争议是"方法论之争"（哪条路对），evals 的争议是"信任之争"（数字还能不能信）。后者更根本——因为所有阵营（包括 SDD）最终都要靠评测来裁决胜负，而裁决工具本身正在信任危机中。这再次印证"评测是收费站"：收费站堵了，所有路都堵。

3. 你不知道自己不知道的其他战场——给你一张地图
除了 SDD 和 evals，当前 AI 工程界还有几场大争议在并行开打，按和你的相关度排序：

Context Engineering vs Fine-tuning：给模型喂上下文还是微调模型？2025 年风向明显倒向前者（上下文工程成为显学），但端侧小模型场景（你的手表如果未来跑端侧模型）微调派仍有阵地
单 Agent vs Multi-Agent：Anthropic 和 Cognition（Devin 团队）公开唱反调——后者的名文《Don't Build Multi-Agents》认为多 agent 的上下文割裂弊大于利；前者的深度调研系统又是多 agent 的成功案例。和你相关：你的"执行 agent + 裁判 agent"分离，恰好站在了这场争论的正确一侧（裁判独立是少数无争议的共识）
Agent 记忆机制：长期记忆怎么做（向量库？图谱？文件系统？），无共识，各家乱战——原文作者当年"绝对不采用记忆机制"躲开的坑，现在依然是坑
端侧模型 vs 云端模型：对你未来最相关——识物到底该端侧跑小模型（快、省流量、隐私好）还是云端跑大模型（准）？手表算力、发热、资费三座大山 vs 弱网体验。这场争议的答案会直接改写你的评测指标体系（端侧方案要加：端侧推理延迟、内存峰值、发热降频后的准确率衰减）
最后一个元建议：你现在"知道自己不知道"了，下一步不用全学——SDD 之争你围观即可，evals 之争你必须下场跟进（LLM-as-judge 校准、契约化 trace、黄金集方法论，这三样是你的吃饭家伙），agent 架构之争你只需要跟"评测 agent"相关的那一支。收费站不需要懂所有车的发动机，但要精通称重。

<details>
<summary>第 10 轮运行统计</summary>

```text
Latency: 28.38s
Total: 106.36s
Input: 46650
Output: 4355
Log Detail
```

</details>

## 第 11 轮 · 用户

有的人在解SDD，如何以spec来驱动AI生成代码。有的在解xxx，有的人在解Evals。所以我解的是，软硬件AI产品，效果和硬件指标问题。？🤔怎么感觉怪怪的，不同的AI硬件，其评测集完全不一样呢，难道我就是需要将其抽象化，并给软硬件AI产品，提供一个快速评测的范式？开发方面，意图——》spec->代码，评测方面，意图->spec->评测用例？😂

## 第 11 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

I'm realizing the core insight here: different AI hardware products use completely different evaluation frameworks, so the real value might be building a generalized evaluation system that works across any software-hardware AI product. There's an elegant parallel I'm noticing — on the development side it's intent→spec→code, and on the evaluation side it mirrors that as intent→spec→eval cases. But I need to think through why this "怪怪的" feeling exists — if I'm just evaluating one product in isolation, I'm not really solving a general problem.

The abstraction layer is what matters: the harness architecture, judge calibration methodology, golden set versioning, metric taxonomy, and fault injection library can all be shared across products, while the actual golden set content, specific rubrics, and domain-specific safety testing remain product-specific. This is exactly like how LLVM abstracts the middle layer for different compilers, or how pytest provides the framework while individual test cases are domain-specific. And this emerging concept has a name in the industry — evaluation-driven development (EDD) — which validates that I'm onto something real that practitioners are already thinking about.

The key is not to over-abstract too early; the classic platform trap is building something general before you've actually done the concrete work 2-3 times. I should nail the watch app evaluation deeply first, extract the real patterns from that experience, then abstract. And there's a genuine gap here — hardware device farms exist, test infrastructure exists, but nobody's really built a combined AI-quality-plus-hardware-metrics evaluation platform yet.

你那个"怪怪的"感觉，是因为你正从"岗位"跨到"范式"——这一步跨对了
先把你的困惑翻译一下："不同 AI 硬件评测集完全不一样"和"我要提供统一范式"并不矛盾——因为可复用的从来不是评测集，是评测集上面那层东西。看这个分层：

层	每个产品一样吗	例子
范式层（方法论）	完全一样	黄金集+裁判+校准的三件套、回归/探索双模式、trace schema 设计原则、Goodhart 防御
装置层（harness）	高度复用	指令通道、轨迹录制回放、故障注入、网络整形、裁判 agent 框架、报告流水线
内容层（评测集本身）	完全不同	儿童烂照片集 vs 车机语音噪声集 vs 眼镜手势误触集
这和 SDD 的结构一模一样：每家公司的代码完全不同，但 spec→代码的范式是共享的。pytest 不替你写测试用例，但全世界都用 pytest。你要做的不是"所有产品的评测集"，是"软硬 AI 产品的 pytest"——内容层留给各产品团队自己填，你收范式和装置的税。这才是收费站的正确造法。

而且这个位置目前是真空的：纯软件 AI 评测有人做（各种 eval 框架），纯硬件测试有人做（设备农场、HIL 台架），但"AI 效果 × 硬件指标"的交叉地带——发热降频后识别准确率怎么衰减、弱网下多模态流畅性怎么打分——没有现成范式。这就是你的领地。

你发现的那个对称性，不但是对的，而且有名字
开发侧：意图 → spec → 代码        （AI 编译，人 review spec）
评测侧：意图 → eval spec → 评测用例（AI 编译，人 review eval spec）
评测侧这条链路，业界正在冒头的名字叫 Evaluation-Driven Development（EDD，评测驱动开发）——实践派（就是前面说的 Hamel Husain 那一脉）主张 AI 产品应该先定义"什么叫好"（eval spec：指标体系、rubric、场景清单、通过阈值），再让开发去逼近它。你笑着写出来的那个 😂 公式，是这个流派的核心主张。

更妙的是，原作者第四章的压缩比论证在你这条链上同样成立：eval spec 必须"表意足以对齐评测意图，但体量远小于评测用例全集"。rubric 就是评测世界的契约层——一条"讲解必须适龄：不出现暴力细节、词汇不超小学三年级水平"的 rubric，能被 AI 展开成几百条具体用例和裁判判据。人 review 那一条 rubric（便宜、精确），AI 生成那几百条用例（廉价劳力），裁判执行打分（规模化）。高压缩比 + AI 编译 + 人守契约层——整场对话聊的那套哲学，原封不动平移过来了。

对称性还能再推一层狠的：开发侧 spec 和评测侧 eval spec，最终应该同源——"弱网 3 秒内降级提示"既是开发要实现的契约，也是评测要断言的判据。写两遍必然漂移，写一遍就是我们前面说的"spec 一事两面"。你绕了一大圈，从原作者的文章出发，最后在自己的领域里把他的思想补完了他自己还没写的那一半。

但泼一盆必要的冷水：别现在就去造平台
平台的经典死法是过早抽象：还没深做过一个产品的评测，就开始设计通用框架，结果抽象全是拍脑袋的，第一个真实产品接入就发现范式不成立。工程界的老规矩是 rule of three：同一件事具体地做过三遍，才配抽象。

你现在的路线图应该是：

把儿童手表识物 App 这一个评测做穿做透（黄金集、裁判校准、trace schema、硬件基线全套跑通）——这是你的样本 #1，也是你向 leader 交卷的命题二
做的过程中刻意记录"哪些东西我下次换个产品还能用"——装置层和范式层的雏形会自己浮出来
等公司第二个软硬 AI 产品出现（眼镜？音箱？），把雏形平移过去，被现实打脸，修正——样本 #2
第三个产品接入时还站得住的东西，才是真范式——这时候再谈平台化、再谈对外输出
注意原作者也是这么走过来的：多年低代码沉淀（样本积累）→ Alice 亲手实践（被 $500 打脸）→ 才敢做 spec 平台。范式是从伤疤里长出来的，不是从 PPT 里画出来的。

所以你的一句话定位可以这么写："有人在解 spec→代码，我在解 eval spec→评测——面向软硬结合 AI 产品，先用一个产品把范式跑通，再让它长成基础设施。" 前半句是野心，后半句是不会摔死的走法。

<details>
<summary>第 11 轮运行统计</summary>

```text
Latency: 25.81s
Total: 81.86s
Input: 51183
Output: 2968
Log Detail
```

</details>

## 第 12 轮 · 用户

EDD（Evaluation-Driven Development，评测驱动开发）😂，没有SDD，没有产品，怎么做EDD，所以EDD是产品之后的事情吧，否则连评测API和接入评测的地方都没有😂

## 第 12 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user's making a joke about the chicken-and-egg problem with EDD, but there's actually something important to clarify here. EDD's whole philosophy is that you should define evaluations before or during product development, similar to how TDD puts tests first. However, the user has a valid point too — you need some kind of actual product or integration point to hook the evaluations into. So I should distinguish between the conceptual evals (which can be written early) and the actual harness or API that connects them to the product (which requires the product to exist).

The key insight is that the eval spec and golden datasets can absolutely come first — you don't need a working app to define what makes a good explanation or to establish safety boundaries. This is exactly like TDD. For AI products specifically, you can run evaluations at the model level before any app code exists: take your candidate models, run them against your golden dataset in a notebook, and score them. That's where the most critical decisions happen — which VLM to use, which prompt, whether to go cloud or edge — all decided by evals before the product is built. The harness comes later, but the right approach is designing for testability from the start rather than bolting it on afterward.

哈哈，这个吐槽 20 年前 TDD 也挨过一模一样的——"没有代码，测试测什么？"
TDD 当年的回答是：先写测试不是为了"测"，是为了先定义什么叫做完了。测试红着 → 写代码 → 测试绿了 → 收工。测试先于代码存在，恰恰是它的全部意义。

EDD 同理，但你的吐槽里混了两个东西，拆开就通了：

① Eval harness（后门、API、接入点）——对，你说得没错，这玩意儿需要产品先存在，至少得有个骨架。这部分确实是"产品之后"。

② Eval spec + 黄金集 + rubric——这玩意儿不但可以先于产品存在，而且必须先于产品存在。 拿你自己的识物 App 现场验证：

收集"儿童烂照片黄金集"——需要 App 存在吗？不需要，找几个孩子拿任何设备乱拍就行
定义"什么叫讲解得好"（适龄、准确、有趣的 rubric）——需要 App 吗？不需要，需要的是产品意图
安全红线清单（拍到危险品怎么答）——需要 App 吗？不需要
选型——你们做这个 App 最重大的技术决策是"用哪个视觉模型、什么 prompt、云端还是端侧"，这个决策怎么做的？正确姿势就是：拿黄金集，写个脚本裸调各家模型 API，跑分对比。这时候 App 一行代码都没有，EDD 已经在运行了，而且是在做整个项目最值钱的那次评测
所以真实的时间线不是"产品 → EDD"，而是：

意图 → eval spec + 黄金集（产品还不存在）
     → 裸模型跑分选型（产品还不存在，评测在裁决架构）
     → 产品开发（harness 钩子作为架构要求一并设计进去，就是 HAL 那套）
     → harness 接入，回归闭环跑起来（这时才是你说的"接入评测的地方"）
     → 线上真实失败案例回流黄金集（评测集开始复利）
EDD 的"driven"就体现在前两步：评测先于产品做出了裁决。等产品成型才开始想评测的团队，选型是拍脑袋拍的，rubric 是上线后被用户投诉逼出来的——那不叫 EDD，那叫补作业。

还有个实用推论：harness 接入点不该是"后门"，该是"前门"——在架构设计阶段就把"可评测性"列为需求（就像"可测试性"之于传统软件），指令通道、trace 埋点、HAL 适配器和业务代码同一天出生。事后凿墙开的才叫后门，又丑又不安全（尤其你们那个儿童产品的场景）；设计时就留的门,带鉴权、带构建开关，才是正门。

所以你那句"没有产品怎么做 EDD"的正确改写是：没有产品，做不了 harness；但没有 eval spec 就开工的产品，最重要的决策全是裸奔做出来的。 顺序上 eval spec 甚至排在 SDD 的 spec 前面——先定义什么叫好，再定义做什么，最后才是怎么做。😂 变成了：评测不是产品之后的事，是产品之前、之中、之后的三件事，只有你说的那一件在"之后"。

<details>
<summary>第 12 轮运行统计</summary>

```text
Latency: 25.02s
Total: 61.68s
Input: 54234
Output: 1992
Log Detail
```

</details>

## 第 13 轮 · 用户

其实我现在在研发AI识物APP，已经有点遇到了OKF的瓶颈，OKF是Google前段时间推荐的本地文档维护方案，和obsilion（那个笔记软件叫什么忘记了，很像）。但是我的AI识物APP，用了公司内部识图平台 + 日志平台 + monitor监控平台 + ODPS离线分析平台 + 外部TTS厂商等，还要和端侧维护协议，对的，所以其实你看也不简单。。尤其是后续新增能力时，我发现，我脑子有点hold不住了，我没有概念目前做到哪一步了，看md很痛苦，基本上都是让AI自己review想好之后自己改，然后同步到OKF。。。。但是我感觉，这好像就是SDD的意义，如果有精确DSL，就像原作者的截图一样，看上去，人类就能接受多了，😂。

## 第 13 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

用户在构建AI识物App时遇到了瓶颈——他们用OKF（谷歌推荐的本地文档维护方案，类似Obsidian）来管理系统架构，包括内部图像识别平台、日志、监控、ODPS离线分析、外部TTS服务和设备端协议，但随着新功能的增加，整个系统变得难以掌控，文档阅读成了痛点，所以他们开始让AI直接审查和修改文档，然后同步回OKF。

现在他们意识到这个问题的本质——需要一个精确的DSL和投影方案（像作者的截图那样）才能让人类能够接受和理解。

我注意到OKF这个术语不太确定，可能是我知识库之外的东西，值得快速搜索一下确认。但用户的核心问题很清楚：markdown文档无法扩展到多集成系统的状态追踪，他们的解决方向——让AI自我审查——实际上违反了独立验证者原则，意味着他们无意中放弃了契约层，这带来了隐藏的风险。

他们真正需要的不是作者的完整平台，而是一个轻量级的结构化层。他们的系统是集成密集型的（外部契约），而不是状态机密集型的。关键是在边界处：5-6个外部系统加设备协议。所以合适的DSL应该包括外部API契约注册表（每个集成的接口、版本、所有者、配额、失败模式）——用机器可检查的表格或YAML而不是散文；能力矩阵（每个功能跨越哪些平台、状态如何）；以及工作进度追踪。

诊断的关键是他们混淆了三种文档类型：设计意图、集成契约和工作状态。markdown混合了这些，所以很痛苦。解决方案是把契约层结构化为YAML或表格，AI维护但人类可以扫描；生成视图（像作者的投影）——甚至可以很简单：用YAML加mermaid图表加CI检查的脚本就能达到作者工具的60%效果。

关键警告：让AI自己审查自己的改动会导致规范漂移。文档变得不可信——比没有文档更糟，因为看起来很权威。修复方案是人类只审查契约层的差异（很小），AI可以自由编辑散文层。

把YAML契约放在git里做PR审查，文档从中生成。

他们的早期观察"软硬件AI产品spec比复杂系统简单得多"现在被现实纠正了：集成复杂性是真实的复杂性。规范权重比他们想的高，只是形状不同——是边界契约而不是领域状态机。具体的实施方案是建立能力清单YAML、每个外部系统的集成YAML、设备端协议文档，生成依赖图和状态仪表板，用CI检查引用有效性，规定AI可以通过差异提议改动但人类只审查契约层的差异。

现在让我先在OKF上做一个搜索。So OKF is Google Cloud's open standard from June 2026 that takes the LLM wiki pattern and makes it portable through markdown with YAML frontmatter, concepts, links, and index/log files. The user's challenge is that their system needs to work across multiple platforms, but OKF is designed as a single-layer knowledge format.

The real issue isn't the format itself — it's that OKF optimizes for agent consumption and interoperability, not for humans to hold a compressed overview of system state in their head. The user's pain of "reading markdown is painful, can't hold it all" is exactly the projection problem OKF acknowledges by shipping a graph visualizer. Google even recognized markdown needs visual projections and built a static HTML renderer that turns the bundle into an interactive graph.

But their actual bottleneck runs deeper: they're mixing three document types (intent, contract, work-status) in one wiki, they lack a structured contract layer for their 6+ integrations, and delegating AI self-review creates drift risk — the documentation becomes untrustworthy because there's no citation trail or test coverage backing the changes.

The fix is to layer a lightweight structured contract on top of OKF using YAML frontmatter (which OKF already allows for producer-defined fields). They define a local profile with types like integration, capability, protocol, each with required fields like owner, status, quota, failure modes, version. Then a CI lint script validates references and required fields, and generates projections — a mermaid dependency graph, a status dashboard — straight from the frontmatter. Humans review only the contract layer diffs, AI freely edits the body. That gets them 60% of the original author's tool on top of OKF, cheaply. Their realization that "this is exactly SDD's point" is spot-on — they've experienced firsthand why single-layer markdown hits a ceiling and why projections matter. The author's DSL is OKF plus strong schema plus multiple projections plus linting; they can climb that gradient incrementally.

先让我查一下 OKF 这个东西，这个我还真不熟。查完了，现在完全理解你的处境了。先把 OKF 定性，再说你为什么撞墙，最后给你一条不用等原作者开放平台的路。

OKF 是什么，以及它为什么救不了你
2026 年 6 月 12 日 Google Cloud 发布了 OKF v0.1，它是把社区已经流行的"LLM wiki"模式规范化成一个可移植标准的开放规格——用 markdown 文件目录 + YAML frontmatter 表示知识，一小组公共约定让不同生产者写的 wiki 能被不同 agent 直接消费。思想源头是 Karpathy 的 LLM Wiki："LLM 不会无聊、不会忘记更新交叉引用、一次能改 15 个文件"——那些让人类放弃维护 wiki 的簿记工作恰恰是 LLM 擅长的。

注意它的定位：OKF 是把组织知识打包成 markdown bundle，让 AI agent 不用反复重读重解释同样的内部文档。它的第一消费者是 agent，不是你的脑子。"人类可读"在 OKF 语境里指的是"不需要工具就能读"——能 cat 出来，不等于能 hold 住。

所以你的痛苦是结构性的、被精准预言过的：OKF 解决"agent 缺上下文"，不解决"人类缺全局视图"。你面对识图平台 + 日志 + monitor + ODPS + TTS 厂商 + 端侧协议这种六方集成系统，看一堆平铺的 md 文件当然 hold 不住——这就是我们前面聊的"单层文本不是高级生物"，你现在是亲身撞上了理论预言的那堵墙。

还有个更隐蔽的危险，你已经踩进去了："基本让 AI 自己 review 想好自己改，然后同步到 OKF"——腾讯云那篇评论一针见血：让 Agent 自己更新 15 个文件听起来很爽，但如果没有引用、测试和变更记录，很快会变成更隐蔽的知识污染。AI 自改自审 = 没人守契约层 = 文档看起来权威实际不可信——比没文档更糟。

但好消息是：OKF 留了往"精确 DSL"爬的梯子
你不需要抛弃 OKF 换原作者的平台，因为 OKF 的 frontmatter 是可扩展的——除了必填的 type，允许生产者自定义任意 key/value 字段。业界已经有人指出了正确爬法：先定本地 profile——把 type 清单、必填 frontmatter 字段、固定章节模板写清楚，比如指标必须说明口径、刷新频率、owner；playbook 必须说明触发条件、处理步骤、升级路径。

翻译成你的场景，具体做四件事：

① 定义你的本地 profile（这就是你的迷你 DSL）。针对你的系统就四五种 type：integration（每个外部平台一个文件：接口、配额、失败模式、owner、mock 可用性）、capability（每个 App 能力一个文件：依赖哪些 integration、状态）、protocol（端侧协议：版本、changelog）、decision（关键决策记录）。每种 type 规定必填结构化字段——枚举和状态进 frontmatter，散文进 body。

② 加一个 lint 脚本挂 CI：检查必填字段齐不齐、markdown 链接引用的 concept 存不存在、capability 依赖的 integration 是否都有文件。这就是给你的知识库装上"编译器报错"——AI 改完文档，机器先咬一遍。

③ 从 frontmatter 生成投影——这是治你"脑子 hold 不住"的直接药方。一个脚本扫全部 frontmatter，生成：能力×平台依赖关系图（mermaid 就够）+ 状态看板（每个 capability 现在是 designed/building/tested/launched）。你"不知道做到哪一步"的问题，本质是工作状态和知识混在散文里，把 status 提成结构化字段，看板就是自动的。顺带说，连 Google 自己都承认纯 markdown 需要投影——它随规范发布了一个静态 HTML 可视化工具，把任何 OKF bundle 渲染成交互式图谱视图，单文件、无后端，这个你今天就能拿来用，成本为零。

④ 改变 review 规则：AI 随便改 body（散文层），但 frontmatter 的 diff 必须过你的眼。契约层字段就那么几十行，你 review 得过来——这就是把"CodeReview 太贵 / SpecReview 太漏"的解法落到你的文档库上：人只守高压缩比的结构化层。

回应你最后那句感慨
"这好像就是 SDD 的意义"——对，而且你现在的位置很有意思：OKF 和原作者的平台是同一条光谱的两端。OKF 自我定位是"最小互操作面，不是完整内容模型"——约定最少、通用性最大、语义约束为零；原作者的 DSL 是约定最多、通用性最小、语义约束拉满。你撞的墙证明：系统复杂度一上来，光谱左端不够用了。但你不必一步跳到右端——上面那套"本地 profile + lint + 投影"就是在光谱中间给自己搭台阶，渐进形式化，哪里痛就把哪里硬化成结构化字段。

另外记住这个体感——"看 md 很痛苦，但原作者那种投影界面人类就能接受"——这句话值钱的地方在于：将来你做评测平台时，你的 trace 和评测报告也会遇到一模一样的问题（裁判 agent 看得懂的 JSON，人类 hold 不住），到时候答案也是同一个：结构化数据 + 面向人类认知带宽的投影视图。你这次撞墙撞出来的教训，是可以直接复用到你自己产品上的设计原则。

<details>
<summary>第 13 轮运行统计</summary>

```text
Latency: 29.59s
Total: 120.10s
Input: 159104
Output: 5095
Log Detail
```

</details>

## 第 14 轮 · 用户

我本地agent回复说：“我大体同意，但它把三个不同层次的东西揉在了一起：**OKF、项目全局视图、SDD DSL**。

| 层次 | 解决的问题 | 你目前的状态 |
|---|---|---|
| OKF | 让 Agent 快速获取项目知识 | 已经有了 |
| 项目投影视图 | 让人知道系统有哪些部分、做到哪一步、哪里有风险 | 真正缺失 |
| SDD / DSL | 精确定义行为，并驱动代码、测试和验收 | 部分场景需要 |

Google 对 OKF 的正式定义确实是 Markdown + YAML frontmatter，并且只强制 `type`，其他字段由生产者扩展；官方也附带了图谱可视化工具。但它只是知识格式，不是项目控制台，也不是行为 DSL。[Google Cloud 官方介绍](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
...
Expand

## 第 14 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The local agent's critique breaks down into three layers—OKF, projection view, and DSL—and the user is asking some fundamental questions: what exactly is a DSL and can markdown render it, whether the projection view could just be a top-level index.md file in the OKF structure, and whether extracting DSL-worthy content into separate files that OKF references would work well, with humans reviewing the DSL while agents see both layers. They're wondering if there's something even more elegant than this approach.

A DSL is a domain-specific language—not a flowchart protocol, but any small language with defined syntax and semantics for a narrow domain. They're already using examples like SQL, regex, CSS, YAML schemas, protobuf, mermaid (which is itself a diagram DSL), OpenAPI, and Gherkin. The key insight is that a DSL is fundamentally text-based and can be external (its own syntax requiring a parser), internal (embedded in another language), or even a schema-constrained data format like YAML or JSON with validation—that counts as a DSL in practice. Markdown code blocks can contain DSL text and mermaid renders in most viewers, but rendering is just a projection; the real essence of a DSL is that it's parseable, checkable, and executable or generative. For their domain, concrete examples would be protobuf for the device protocol, a small state machine YAML for session and turn management, or Gherkin-style syntax for evaluation scenarios. The distinction matters: a DSL has semantics you can actually execute or validate against, whereas metadata is just descriptive.

On index.md as a projection view—it only works if it's generated, never hand-maintained. The moment someone edits it by hand, it becomes a second source of truth that drifts, which is exactly the knowledge pollution problem they're trying to avoid. The right approach is a CI job that generates index.md from frontmatter and fact sources, keeping it fresh and marked clearly as do-not-edit. Runtime state like deployments and eval results should come from fact systems, but a nightly script can pull those and regenerate the markdown. Markdown as a render target is fine; markdown as storage for runtime state is not.

For DSL files referenced by OKF—this is actually the elegant architecture and has solid precedent in docs-as-code, OpenAPI specs in repos, protobuf as source of truth, and Terraform. The pattern is: DSL files are the source of truth for contracts (small, precise, versioned, CI-validated), OKF markdown provides narrative knowledge that links and embeds those DSLs so agents get both, and projections are generated from the DSL plus fact sources. The key refinement is to avoid duplicating DSL content in prose—the markdown should reference or embed the DSL, not paraphrase it.

The elegant endgame is single source per fact with everything else generated. Every piece of information has exactly one authoritative home: stable contracts live in DSL files, narrative and reasoning in OKF markdown, runtime state in fact systems, and all human-facing views are generated. For review discipline, humans review DSL and frontmatter diffs while AI can freely edit prose, with CI validating cross-references. For their specific project, I'd recommend starting with one DSL target—the session and turn state machine—since it's the highest-frequency pain point and can generate tests, then expand to device protocol, eval metrics, and RPC result branches.

你本地这个 agent 水平不错😂，三层拆分（OKF 管 AI 记忆 / 投影管人看懂 / DSL 管精确契约）是对的，我基本没有异议。下面回答你的三个问题，尤其是把"DSL 到底是个啥"这个最根本的疑惑拆开。

1. DSL 到底是个啥——不是流程图，是"小语言"
DSL = Domain-Specific Language，一种为窄领域设计的小型语言，有语法、有语义、能被机器解析和校验。你其实天天在用 DSL，只是没意识到：

SQL：查询领域的 DSL
正则表达式：文本匹配的 DSL
protobuf / OpenAPI：接口契约的 DSL
mermaid：画图的 DSL（对，流程图只是 DSL 的一种输出物，不是 DSL 本身）
Gherkin（Given-When-Then）：验收场景的 DSL
关键判据不是长什么样，而是三件事：可解析、可校验、可生成。给你看一个最小例子——你的 session 状态机，用 YAML 就能当 DSL：

# session_fsm.yaml —— 这就是一个 DSL 文件
states: [idle, capturing, recognizing, explaining, follow_up, error]
initial: idle
transitions:
  - {from: idle,        on: take_photo,     to: capturing}
  - {from: capturing,   on: upload_ok,      to: recognizing}
  - {from: capturing,   on: upload_timeout, to: error}
  - {from: recognizing, on: result_ok,      to: explaining}
  - {from: explaining,  on: user_ask,       to: follow_up}
  - {from: follow_up,   on: take_photo,     to: capturing}
invariants:
  - "error 状态必须在 3s 内给出降级提示"
  - "解绑事件可从任意状态触发，直达 idle 并销毁会话"
它和"文档里写一段状态描述"的本质区别：这份文件可以被脚本解析，然后①校验（有没有不可达状态、有没有漏掉的事件组合）②生成测试（每条 transition 自动变成一条用例：处于 capturing 时收到 upload_timeout，断言进 error 且 3s 内有提示）③生成图（渲染成 mermaid 流程图给人看）。散文做不到这三件事，这就是你 agent 说的"元数据规范还不算 DSL"的分界线——有没有可执行的语义。

"md 能渲染吗"——md 是容器不是本体：DSL 文本放在 md 的代码块里完全可以（mermaid 在大部分 md 查看器里直接出图），但渲染只是投影，DSL 的价值在于被机器咬，不在于好看。原作者截图那个炫酷界面，底下也是 DSL 文本，界面只是投影层。

2. index.md 当投影视图行不行——行，但有一条生死线
生死线：这个 index.md 必须是生成物，不能是手写文档。

手写的 index.md 会立刻变成第二事实源——你改了三个能力文档，忘了改 index，两周后 index 就是一份权威的谎言，比没有更毒（这就是你 agent 说的"多事实源"问题）。而生成的 index.md 完全没问题：CI 或定时脚本扫全部 frontmatter + 拉取部署/监控/评测平台的事实源，重新生成 index.md（文件头写明"生成物勿手改"），放 OKF 根目录——人看它，agent 也看它，永远新鲜。

所以答案是：位置对，生产方式决定生死。你 agent 说的三张图（能力地图/环境矩阵/质量视图），全都可以就是这个生成的 index.md 里的三个章节，mermaid 出图，成本一天脚本。

3. 你提的"DSL 抽离 + OKF 引用"——这就是正确答案，有个成熟的名字
你自己想出来的这个架构，业界叫 docs-as-code / 单一事实源模式，OpenAPI 和 protobuf 生态跑了十年的玩法：契约文件是源，文档引用契约，一切视图生成。你的完整版应该长这样：

repo/
├── contracts/                  ← DSL 层：人类 review 的重点
│   ├── session_fsm.yaml        （状态机）
│   ├── device_protocol.proto   （端侧协议——你们该用 protobuf 早用上了）
│   ├── rpc_branches.yaml       （识图 RPC 的结果分支枚举）
│   └── eval_metrics.yaml       （评测指标：口径/阈值/owner）
├── okf/                        ← 知识层：AI 自由编辑的散文
│   ├── index.md                （⚙️ 生成物，投影视图）
│   └── capabilities/*.md       （叙事、决策、why，引用 contracts/ 里的文件）
└── ci/
    ├── validate_contracts.py   （DSL 校验：状态可达性、字段齐全性）
    ├── check_references.py     （OKF 里引用的契约文件/字段必须真实存在）
    └── render_index.py         （从 frontmatter + 事实源生成 index.md）
配套三条纪律，比目录结构更重要：

每个事实只有一个家：契约进 contracts/，叙事进 okf/，运行态留在监控/部署平台（只被拉取渲染，绝不手抄进文档）。判断口诀：这条信息变化时，谁第一个知道？谁第一个知道，家就安在谁那里
禁止散文复述契约：md 里要提到状态机，就链接或嵌入 session_fsm.yaml，不许用自己的话再写一遍——复述必漂移。AI 写文档时也遵守这条（给它的 prompt 里写明）
review 预算分配：contracts/ 的 diff 人必看（一共就几百行，看得过来）；okf/ 的散文 AI 随便改，CI 的引用检查兜底。这就把"CodeReview 太贵 / SpecReview 太漏"落到了你的仓库里
至于"agent 看 OKF 时也能看到 DSL"——天然成立，DSL 文件本身就是文本，agent 读起来比读散文还舒服（结构化、无歧义），你甚至会发现 AI 改代码的准确率因为有了 contracts/ 而上升，因为它终于有了不会骗它的参照物。

更优雅的方式有没有？ 终局形态就是原作者那种：DSL 成为唯一源，代码和文档全是投影。但你不需要现在去够那个终局——你和他的差距不是优雅程度，是渐进路径上的位置。给你的启动建议就一条：这周只做 session_fsm.yaml 这一个 DSL 文件 + 一个校验脚本。它是你痛感最高的地方（拍照-识物-追问-异常的状态流转），一周内你就能体会到"AI 对着状态机写代码"和"AI 对着散文写代码"的差距，然后再决定第二个 DSL 化的目标。范式是从伤疤里长出来的——你已经有伤疤了，现在缺的只是第一块结痂。

<details>
<summary>第 14 轮运行统计</summary>

```text
Latency: 28.50s
Total: 97.81s
Input: 62717
Output: 4101
Log Detail
```

</details>

## 第 15 轮 · 用户

1. “终局形态就是原作者那种：DSL 成为唯一源，代码和文档全是投影”，这里的投影是什么意思，DSL不是不能描述吗，只能表示属性、枚举、关系等？业务描述也能在DSL？ 2. 怎么做可视化，听你的意思DSL是一个概念，不是一个uml这种精确的协议？我有时候还是会偶尔读读md文档的。CI目录是什么意思，怎么做到校验的，🤔。我感觉我们也可以做一个程序出来，专门维护OKF、DSL的程序并且支持可视化编辑。🤔

## 第 15 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

I should cover how projections work and the expressiveness of domain-specific languages—particularly how behavior can be embedded directly in the DSL itself, as shown in the author's logic view. Then there's visualization to consider, along with CI directory structure and validation approaches. I'm also thinking about the tension between building a tool versus actually doing the work, and why that's worth being cautious about.

1. "投影"是什么意思，DSL 能描述业务吗
投影 = 同一份源数据，为不同读者渲染出的不同视图。 类比：Excel 里数据在单元格里，柱状图是投影——你不会去"改图"，改的永远是数据，图自动变。原作者截图里那个因果图、logic 视图、aspect 视图，就是同一份 spec 的三个投影（还记得图 1 角落那句"段落坐标来自 spec"吗）。

然后是你的核心疑问——DSL 只能表达属性/枚举/关系吗？不，行为完全可以进 DSL，其实你已经见过了，只是没意识到：

上一轮那个 session_fsm.yaml 里的 transitions，每一行就是一条行为："处于 capturing 时收到 upload_timeout 则进入 error"——这是行为，不是属性
原作者截图 2 的 logic 视图，整个就是行为 DSL：创建 @断臂第一批分发批次 → 写入 状态: ∅→触达中 → 变更 派单中→已取消——一步一步的动作序列，机器可解析
SQL 也是行为（"查这个、连那个、按此排序"），Gherkin 的 Given-When-Then 也是行为
真正的边界不在"属性 vs 行为"，而在"可结构化的行为 vs 不可结构化的意图"：

能进 DSL	进不了 DSL（留在散文）
状态转移、动作序列、判定条件、数据读写	为什么这么设计（决策理由）
异常分支枚举、超时阈值、重试策略	产品哲学（"给孩子的讲解要有惊喜感"）
接口字段、协议版本	历史包袱的来龙去脉
所以"DSL 成为唯一源"这句话要修正为：可执行语义的唯一源。why 和哲学永远住在散文里（OKF），这正是你 agent 那个三层划分成立的原因——两层不是竞争关系，是分管不同性质的知识。

2. DSL 是概念还是协议？可视化怎么做？CI 是什么？
DSL 是"一类东西"的统称，不是某个具体协议——就像"合同"是概念，租房合同/劳动合同是具体实例。UML 是历史上试图"一统所有图"的一个具体协议（然后失败了，因为太重）。你完全可以定义只属于你项目的 DSL，比如那个 session_fsm.yaml——它是全世界唯一的、只服务于你这个 App 的小语言，这就够格叫 DSL。

可视化的正确姿势：你不需要放弃读 md，让 DSL 自动变成 md 里的图。 具体链路：

session_fsm.yaml ──(脚本转换)──→ mermaid 代码块 ──(嵌进 md)──→ 你在任何 md 阅读器里看到流程图
mermaid 是 markdown 生态里的画图 DSL，GitHub/VSCode/Obsidian 原生渲染。一个 30 行的 Python 脚本就能把 fsm.yaml 的 transitions 逐行翻译成 stateDiagram-v2 语法。于是你"偶尔读读 md"的习惯完全保留，只是 md 里的图从此永远不会撒谎——因为它是从契约生成的，不是谁手画的。

CI 目录是什么、怎么校验： CI = Continuous Integration（持续集成），就是"每次代码提交后自动跑的一堆脚本"，跑挂了就拦住这次提交。ci/ 目录就是放这些脚本的地方。校验没有任何魔法，就是普通程序：

# validate_contracts.py 的核心逻辑，就这么朴素
fsm = yaml.load("session_fsm.yaml")
# 检查1：所有 transition 的 from/to 是否都在 states 清单里
# 检查2：从 initial 出发做图遍历，是否存在不可达状态
# 检查3：error 状态是否有出边（防止死胡同）
# 任何一条不过 → exit(1) → 提交被拦
再配一个 check_references.py：扫所有 md 里形如 contracts/xxx.yaml 的引用，检查文件真实存在。AI 半夜改文档编造了一个不存在的契约引用？CI 直接红灯。这就是"机器咬机器"的具体实现——没有高科技，全是土办法，但土办法挂在提交流程上就成了制度。

3. "做一个维护 OKF+DSL 的可视化程序"——想法对，但我要按住你
这个念头方向正确（原作者做的就是它的豪华版），但现在做是典型的过早抽象，三个理由：

你还没有第一块伤疤：你连 session_fsm.yaml 都还没写、校验脚本还没跑过一次。没被"手工维护 DSL"的痛折磨过，你不知道工具该长什么样——设计出来的功能全是想象的需求
重复造轮子风险：你想要的 60% 已经存在——Obsidian（对，你说的就是它）+ mermaid 插件就是"可视化查看"；VSCode + YAML schema 插件就是"带校验的编辑"（写错字段名当场标红）。先用现成的拼，拼不动的地方才是真需求
别忘了你的主线：你的命题是评测体系，OKF/DSL 是给主线服务的地基。地基花一周可以，花一个月做编辑器就是本末倒置——而且讽刺的是，这正是原作者走过的弯路的镜像：他做低代码平台做了几年，最后发现真正值钱的是那套抽象思维本身
给你的执行顺序：第一周：手写 session_fsm.yaml + 30 行校验脚本 + 30 行 mermaid 生成脚本，挂上 CI；第二三周：用出痛感，记下"我最烦的三个手工操作"；一个月后：如果那三个痛点还在，就做一个只解决那三个痛点的小工具——那时候你做的才是工具，现在做的只能是玩具。

工具的正当性来自伤疤的数量。原作者敢做平台，是因为他背着几年低代码的伤疤和一个 $500 的窟窿；你现在的伤疤是"md 看着痛苦"——这个级别的伤，一个生成的 index.md 加几张 mermaid 图就能治好。先治病，再造医院。😄

<details>
<summary>第 15 轮运行统计</summary>

```text
Latency: 23.83s
Total: 67.67s
Input: 53891
Output: 2360
Log Detail
```

</details>

## 第 16 轮 · 用户

那为什么不用mermaid，为什么要自定义只属于你项目的 DSL，有好处吗。没看出来啊🤔。“你还没有第一块伤疤”会有的，等我们聊明白，我回头就让本地agent把OKF升级成OKF+DSL，并支持可视化调整，之后沉淀后我再发独立项目，这样是不是更好？

## 第 16 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

Considering why mermaid wouldn't work as the DSL—it's fundamentally a rendering format rather than a semantic specification, so it can't encode validation rules, invariants, timeouts, or metadata that would be needed for test generation and machine-checkable structure. Their approach involves having a local agent enhance the OKF format with a proper DSL layer.

I should push back on their plan to let the agent build everything at once—that skips the learning phase and risks scope creep. They're banking on AI making development cheap, but the real cost isn't building anymore, it's the design validation and maintenance burden that comes from adopting the wrong abstractions. I'd suggest a phased approach instead: start with minimal contracts, validation logic, and a mermaid projection for visualization, get some real usage feedback, then only add visual editing for the most painful contract types.

1. 为什么不直接用 mermaid 当 DSL——因为 mermaid 是"画"，不是"义"
这个问题问得好，答案藏在一个关键区分里：mermaid 是为渲染设计的，不是为校验和生成设计的。看同一个状态机的两种写法：

mermaid 版：
stateDiagram-v2
  capturing --> error: upload_timeout
自定义 DSL 版：
- {from: capturing, on: upload_timeout, to: error, within_ms: 3000, degrade_msg: required}
invariants:
  - "解绑可从任意状态触发，直达 idle 并销毁会话"
区别在哪：

mermaid 装不下语义：within_ms: 3000（超时预算）、degrade_msg: required（必须有降级文案）、不变量（invariants）——这些是你要拿来生成测试用例的核心信息，mermaid 的语法里根本没地方放。硬塞进节点标签里，就变成机器解析不了的散文
mermaid 没有校验语义：它不在乎你画了一个不可达状态、一个没有出边的死胡同——画得出来就行。而你的 DSL 配上 30 行校验脚本，这些错误提交都提交不进去
方向是单行道：结构化 DSL → 生成 mermaid，信息只减不增，永远成立；反过来 mermaid → 提取语义，缺的信息补不回来
所以正确关系是：自定义 DSL 是源，mermaid 是它的投影之一。你不是"不用 mermaid"，而是不让 mermaid 当源。一句话记住：能生成测试的才配当源，只能生成图的只配当投影。

（补充：如果嫌"自定义"三个字吓人——你那个 YAML 一共就 4 个字段约定，写在一页 README 里就是全部"语言规范"。自定义 DSL 不等于造编程语言，90% 的项目 DSL 就是"带纪律的 YAML"。）

2. 你的新计划——顺序对了一半，我帮你把另一半扳过来
你的计划：聊明白 → agent 一步到位升级 OKF+DSL+可视化 → 沉淀后发独立项目。

方向没问题，而且我承认一个现实：AI 时代"rule of three"的成本前提变了——以前不让你早做工具是因为造轮子贵，现在 agent 一晚上就能糊出来，造错了扔掉也不心疼。所以我不拦你做，只扳一个关键点：

"一步到位"是这个计划里唯一的地雷。 理由不是造不出来，而是：

你会在同一天收到三样新东西：DSL 格式、校验规则、可视化编辑器——全部出自 agent 之手，全部没经过使用检验。哪个格式设计不合理？哪个校验是误报？编辑器改坏了 YAML 谁发现？三个未知数叠在一起，出了问题你分不清是哪层的锅。这就是 $500 事故的结构复刻：产出的速度超过了验证的速度
可视化编辑器是三件里最容易做歪的：编辑器好不好用，取决于"你实际最常改什么"——这个数据你现在为零。agent 只能凭想象做，大概率做出一个功能齐全但顺手率很低的东西，然后你为了不浪费它又勉强用着——工具绑架人，本末倒置
修正版计划，同样激进但每步可验证：

第 1 天：让 agent 产出 contracts/（先只做 session_fsm + rpc_branches 两个文件）+ 校验脚本 + mermaid 投影脚本 + 生成式 index.md。可视化先只做"看"，不做"编辑"——看的部分（渲染）做错了无害，编辑的部分做错了污染源文件
第 1~2 周：真用。让 agent 对着 contracts/ 改代码、写测试，你只 review contracts 的 diff。期间记录：你手工改了几次 YAML？改的时候烦什么？
第 3 周：拿着记录让 agent 做可视化编辑——但只做你真烦的那两三个操作（比如"加一条 transition 要对齐好几行"）。这时候的编辑器是长在伤疤上的，不是长在想象上的
沉淀后发独立项目：这步完全支持，而且到时候你的 README 里能写"在真实儿童手表 AI 产品上验证过"——这句话比任何功能列表都值钱。顺带你就成了自己评测哲学的实践者：先定义什么叫好用（你的痛点清单就是 eval spec），再验收 agent 做的工具——你总不能一边给 leader 讲 EDD，一边自己的工具项目是零评测裸奔出来的吧 😄
一句话总结：让 agent 干活的部分照单全收，"一步到位"改成"三步到位"，每步之间隔着一段真实使用。你损失两周的发布速度，换来的是独立项目发出去的时候，它已经不是玩具了。

<details>
<summary>第 16 轮运行统计</summary>

```text
Latency: 1.32s
Total: 6.68s
Input: 2
Output: 2160
Log Detail
```

</details>

## 第 17 轮 · 用户

自定义DSL岂不是要自己写可视化编辑？你说在MD中看DSL，要先把DSL编译成xx再放到MD中？这恐怕也需要自定义MD编辑阅读器吧。🤔。DSL比md的优势就是更直接表达了关系relation是吗？没有别的现成的DSL适合我们使用吗

## 第 17 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is confused about the tooling setup, so I should clarify that there's no custom editor required—just standard YAML editing in VSCode, with mermaid diagrams rendering natively in any markdown viewer. The "compile" step is just a simple script that writes a mermaid block into the markdown file. The real advantage of the DSL goes beyond just capturing relations; it's about having machine-checkable semantics and enabling code generation. I'm also noting that similar DSLs already exist in the wild—SCXML, PlantUML (which has the same limitations as mermaid), Gherkin, OpenAPI, protobuf, and AWS Step Functions Language.

Actually, XState is the better answer here. XState provides statecharts in JSON/JavaScript format with a built-in visualizer and the Stately editor for free, plus simulation and model-based test generation through @xstate/test. That combination gives you the visualization and editing capabilities without needing anything custom. Beyond that, there are other tools worth mentioning for different concerns: protobuf for protocols, OpenAPI for APIs, Gherkin for acceptance tests, and CUE or JSON Schema for validation.

好问题，这轮把三个误会一次拆掉——你把工具链想重了大概十倍。

1. 不需要自定义可视化编辑器，也不需要自定义 MD 阅读器
你脑中的链路：自定义 DSL → 自研编辑器 → 自研渲染器 → 自研阅读器——全错，实际链路是：

编辑 DSL：就是 VSCode 编辑一个 YAML 文件。给它配一个 JSON Schema（20 行，声明有哪些字段、什么类型），VSCode 原生就给你自动补全 + 写错字段当场标红——校验型"编辑器"零成本白拿
"编译"进 MD：所谓编译就是一个小脚本，读 YAML、拼一段 mermaid 文本、写进 md 文件的指定位置。30 行 Python，不是编译器工程
阅读：mermaid 代码块在 GitHub、VSCode、Obsidian 里原生渲染成图，你现有的一切阅读习惯零改动。不存在"自定义 MD 阅读器"这个环节
整条链的自研部分 = 一个 schema 文件 + 一个转换脚本，加起来 50 行。其余全是白嫖现成生态。

2. DSL 对 md 的优势不是"表达关系"，是"机器敢咬"
关系（relation）只是副产品。真正的优势排序：

可校验：不可达状态、漏掉的分支、引用不存在的实体——提交时被脚本拦下。md 里写错了，要等人读到或线上炸了才知道
可生成：每条 transition 机械展开成测试用例；协议定义生成两端代码。md 生成不了任何东西
无歧义：AI 读 {from: capturing, on: timeout, to: error} 不需要"理解"，读散文需要猜——你让 agent 对着 DSL 改代码，准确率直接上一个台阶
然后才是关系清晰、能出图
一句话：md 是给人和 AI"读"的，DSL 是给脚本"执行"的。读的东西可以错着活很久，执行的东西错了当场爆——爆得早就是价值。

3. 现成的 DSL——有，而且你的场景每一块都有现货
这才是你该问的问题，答案是基本不用自定义：

你的需求	现成 DSL	白拿的工具链
session/turn 状态机	XState（statecharts 的 JS 实现，工业级）	Stately.ai 编辑器——你想要的"可视化编辑 DSL"人家做好了：拖拽画状态机、双向同步代码、在线模拟运行；配套 @xstate/test 能从状态机自动生成全路径测试——我们聊半天的"轨迹即用例"，它是现成实现
端侧协议	protobuf	代码生成、版本兼容检查、俩端永不扯皮
服务端 HTTP 接口	OpenAPI	mock server、契约测试、文档全自动生成
验收场景/评测用例	Gherkin（Given-When-Then）	半自然语言，产品经理能读，机器能跑
配置/数据校验	JSON Schema	VSCode 原生支持
看到没：你要的"DSL + 可视化编辑 + 自动生成测试"这个全家桶，在状态机这个品类里叫 XState + Stately，是成熟开源项目。你上一轮想让 agent 造的东西，最有价值的那一块已经存在,还比 agent 一晚上糊的强得多。

那什么时候才需要自定义？只剩两小块：①把各现成 DSL 粘起来的元数据（frontmatter 里的 owner/status/depends_on——这不算语言，算字段约定）；②真正找不到现货的领域语义，比如你的评测指标定义（eval_metrics.yaml：口径/阈值/黄金集版本）——这块目前确实没有业界标准 DSL，而它恰好就是你的主线领地。

所以修正后的行动清单反而更简单了：session 状态机用 XState（顺手白拿 Stately 可视化和测试生成），协议上 protobuf，验收写 Gherkin，自定义的部分收缩到 frontmatter 约定 + 评测指标 DSL 这两个薄片。自研面积缩小 80%，而唯一需要你原创的 DSL（评测指标），正好是你打算沉淀成独立项目的那个方向——现成轮子把路铺平，你只造世界上还没有的那一小块。这才是站在生态肩膀上的姿势。

<details>
<summary>第 17 轮运行统计</summary>

```text
Latency: 24.03s
Total: 58.52s
Input: 58272
Output: 1938
Log Detail
```

</details>

## 第 18 轮 · 用户

为什么不能用一种DSL。。。多种感觉好麻烦，而且你说“阅读：mermaid 代码块在 GitHub、VSCode、Obsidian 里原生渲染成图，你现有的一切阅读习惯零改动。不存在"自定义 MD 阅读器"这个环节”，所以脚本必须知道一个DSL在md的哪个位置并且需要定期编译进入md，实际上agent看md看到的是mermaid，并不是DSL，如果看到了mermaid，可能并不会主动再看DSL。你说“DSL 对 md 的优势不是"表达关系"，是"机器敢咬"
”🤔，就是md中引用DSL的时候，必须是DSL中存在的东西是吗，🤔，那相当于你把DSL当做声明了，而MD中必须能够引用DSL文件中的某个细节数据，能做到吗

## 第 18 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is asking three things: why not consolidate into a single DSL, how to handle the mermaid-in-markdown visibility problem where the agent sees rendered output instead of source, and whether markdown can reference DSL declarations. I'm thinking through why multiple DSLs make sense—different domains have different needs, just like SQL and regex and YAML each solve specific problems, and a universal DSL would sacrifice the precision and checking that domain-specific languages provide.

For the mermaid issue, the solution is to treat contracts/ as the source of truth and markdown as a generated projection for humans. I'd instruct the agent to read directly from the contracts directory, use marker comments to flag generated blocks, and include links back to source files so both humans and agents can follow to the original. Regeneration should happen on change via CI hooks, not on a schedule.

On markdown referencing DSL details, that's absolutely doable—use a reference syntax like {{fsm:session.states.error}} or inline code paths like contracts/session_fsm.yaml#transitions[2], then validate those references exist. For more sophistication, a script can replace reference markers with actual values at generation time, similar to how docs-as-code transclusion works.

1. 为什么不能只用一种 DSL——因为"一种通吃"的终点就是又发明了一门编程语言
原理一句话：DSL 的校验能力来自它的狭窄。状态机 DSL 能查"不可达状态"，是因为它只认识状态和转移；protobuf 能查版本兼容，是因为它只认识字段和类型。你把这些领域塞进同一种语言，它就得什么都能表达——什么都能表达 = 什么都校验不了 = 你重新发明了一门通用语言。这正是原作者说的"困在通用性泥潭"，DSL 一统天下的尝试（UML 就是最著名的尸体）全死在这。

但你的"好麻烦"有个便宜的化解法——区分语法和语义：语法统一，schema 各管一摊：

session_fsm.yaml、rpc_branches.yaml、eval_metrics.yaml——全用 YAML 写，一种语法、一种编辑体验、一套工具链，只是各配各的 JSON Schema
只有两个例外值得引入外来语法：protobuf（端侧协议，为了双端代码生成的生态红利）和 Gherkin（验收场景，为了产品经理能读）。这俩的生态价值远超"多学一种语法"的成本
所以实际体感不是"五种语言"，是"一种 YAML + 两个特殊件"。麻烦度可控。

2. 你抓到了一个真 bug：agent 看到 mermaid 就不会去看源了
这个观察非常锐利，而且是真实的工程陷阱——生成物比源更显眼，读者（人和 agent）都会把投影当真相。解法是三板斧，全是成熟做法：

① agent 的事实源纪律写进系统提示（CLAUDE.md / agent 的常驻指令）：

contracts/ 目录是唯一事实源。md 中的图和表是生成投影，只许看，不许信，更不许改。涉及行为逻辑时必须回读 contracts/ 对应文件。

② 生成块自带"回源指针"，让投影自己招供：

<!-- BEGIN GENERATED from contracts/session_fsm.yaml (勿手改，改了会被覆盖) -->
```mermaid
stateDiagram-v2 ...
``​`
<!-- END GENERATED · 源文件: contracts/session_fsm.yaml -->
人看图，想深究就点源文件链接；agent 读到注释，知道语义要回源取。投影可以被看到，但它随身带着"我不是真相"的免责声明。

③ "定期编译"改成"事件触发"：不是 cron 定时跑，而是挂 pre-commit hook 或 CI——contracts/ 一有 diff，投影自动重新生成，同一个 commit 里源和投影永远一致。位置问题就是靠 ② 的 BEGIN/END 标记对定位，脚本只替换标记对之间的内容，md 其余部分（人写的散文）一个字不碰。

3. "DSL 当声明，md 引用细节"——能做到，而且你说出了 docs-as-code 的精髓
你的理解完全正确：DSL 是声明（declaration），md 是引用（reference），引用必须可验证。实现分两档，都便宜：

基础档：引用校验。约定一个引用语法，比如 md 里写：

超时后进入 `fsm:session.states.error`，降级文案要求见 `fsm:session.transitions[capturing->error].degrade_msg`
check_references.py 用正则抓出所有 fsm: 引用，去 YAML 里查路径存不存在。写了不存在的状态名？CI 红灯。这就实现了"md 中引用的必须是 DSL 里存在的东西"——AI 在散文里编造实体的路被焊死了。

进阶档：值嵌入（transclusion）。引用不但校验，还在生成时替换成真值：

源文件里写：  上传超时预算为 {{fsm:session.transitions[capturing->error].within_ms}} 毫秒
生成后变成：  上传超时预算为 3000 毫秒
哪天你把 YAML 里的 3000 改成 5000，所有 md 里的数字下次生成时自动全变——散文里再也不存在会过期的硬编码数字。这是成熟 docs-as-code 团队（API 文档从 OpenAPI 抽值、配置文档从 schema 抽值）的标准玩法，实现就是一个"正则替换 + YAML 路径查询"脚本，50 行以内。

拼起来看全景：contracts/ 声明一切可执行语义 → md 只做两件事：引用（被校验）和叙事（讲 why）→ 投影自动生成且自带回源指针 → agent 被纪律约束回源读写。四条腿都站住之后，你前面担心的"AI 自改自审导致知识污染"就被结构性封死了——因为 AI 能污染的只剩散文层，而散文层里所有事实性内容要么是校验过的引用、要么是嵌入的真值，编不了假数据。剩下能写坏的只有"why 讲得不好"——那个本来就该人来把关，而且看得过来。

<details>
<summary>第 18 轮运行统计</summary>

```text
Latency: 28.64s
Total: 73.81s
Input: 60514
Output: 2539
Log Detail
```

</details>

## 第 19 轮 · 用户

所以我觉得不对，我的直觉觉得不对。首先不可能一种情况用一种具体的DSL，未来将会有超多种DSL，这肯定是我无法接受的，OPENAPI我设置可以直接md写都行。。。。我要DSL做什么呢。。。“"DSL 当声明，md 引用细节"——能做到，而且你说出了 docs-as-code 的精髓
”，有点懵逼啊，DSL比我想的不一样，🤔，不是说好了有各种graph支持表达业务流程和状态流转吗，🤔。。。怎么变成属性声明了。这么多DSL，就没有一种适合我们吗。原作者那个截图你还在吗，他怎么做的？

## 第 19 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is frustrated because they see too many DSLs and feel like the approach has lost sight of the original promise—they want to understand where the actual graph or flow expression is, not just property declarations. They're also asking how the original author managed to accomplish this with their screenshots, wondering if it was done with a single DSL or multiple ones. I need to clarify that the YAML finite state machine itself IS the graph representation, and that the DSL isn't merely declaring properties but actually expressing transitions and behavior.

Looking at what the original author did, they built one unified DSL with multiple views—a single specification language where entities, rules, variables, and causal graphs are all projections of the same underlying metamodel. That's exactly what the user intuitively wants: one language with different perspectives. The tradeoff is real though: a unified DSL requires building the entire toolchain yourself (editor, validator, projections), whereas using multiple off-the-shelf DSLs gives you free tooling but creates fragmentation.

For the user's actual scale and needs, they probably don't need all those options I listed—that was a menu, not a mandate. They could simplify to a single small unified metamodel of their own: entities, states, flows, and metrics all in one YAML family. A state machine DSL alone might be enough, with protobuf only for cross-team protocols and OpenAPI for external contracts.

On the graph support question: yes, the transitions in the YAML are edges, and mermaid can render them directly. The DSL itself is the graph expressed in text form.

你的直觉没有错，而且这次的懵逼是我造成的——我把"菜单"端成了"必点套餐"。这轮先把两个误会掰正，再回答原作者到底怎么做的（对，截图我还在，重新细看了一遍）。

误会一："DSL 变成属性声明了？"——没有，transitions 就是图本身
上一轮聊"声明/引用"是在解决 md 和 DSL 怎么互相链接这个外围问题，不是 DSL 的本体。回到本体看这段：

transitions:
  - {from: capturing, on: upload_timeout, to: error}
  - {from: recognizing, on: result_ok, to: explaining}
这就是图——每一行是一条边，states 是节点，整个文件就是状态流转图的文本形态。mermaid 渲染出来的那张图没有增加任何信息，只是把这些边画出来了。"graph 表达业务流程"从来没丢，它一直在那——图不是画出来的，图是这些行本身。你把"文本形态的图"误认成了"属性列表"，因为 YAML 长得不像图。但机器眼里它俩是同一个东西，而且文本形态才能 diff、才能校验、才能生成。

误会二："超多种 DSL"——那是我列的菜单，你的实际需求可能就一种
我列五种是给你看"每个领域都有现货"，不是让你全上。回到你的真实体量：识物 App 的核心复杂度就是会话状态流转 + 各集成方的结果分支——这其实是同一类东西（状态 + 事件 + 分支），一种 DSL 就能装下。OpenAPI 你说想用 md 写就 md 写，没人拦你——你们内部接口就几个，契约测试的收益撑不起额外语法。protobuf 也一样：如果端侧协议是你们和厂商已经用文档约定好的，那就维持现状。规矩是为痛感服务的，没有痛感的地方不立规矩。

原作者怎么做的——你的直觉和他站在同一边
重看截图，答案很清楚：他做的就是一种统一 DSL，一个底层模型，八个投影视图。证据拼起来：

顶部导航 overview / logic / aspect / rule / state / structure / external / api——不是八种语言，是同一份 spec 的八个切面（图 1 那句"段落坐标来自 spec"再次作证）
他的统一元模型大概是五种原语：实体（@霍去病、@断臂订单，structure 视图管）、状态（派单中→已取消，state 视图管）、事件序列（创建/写入/变更，logic 视图就是一条条事件轨迹）、规则（%服务积分规则，rule 视图管）、切面（积分被多流程读写，aspect 视图管）
符号系统统一：@ 实体实例、% 规则、& 变量——一套记号贯穿所有视图
所以你说"不可能接受超多种 DSL"——恭喜，原作者跟你想的一样，他选的就是统一路线。但现在把这条路线的价签亮出来：

统一 DSL 意味着元模型要自己设计——什么该是原语、什么不该，设计错了全盘返工。他背后是多年低代码和领域抽象的积累，这不是一晚上让 agent 糊出来的东西
统一 DSL 意味着工具链全部自建——没有现成编辑器、校验器、渲染器认识你的语言，所以他才需要做那一整个平台。你看到的炫酷界面，就是统一路线的强制消费
拼装路线（XState、protobuf 那套）的报价正好相反：工具链全白拿，代价是语言碎片化
这是一个真实的 tradeoff，不是谁对谁错：统一 = 认知一致但工具自建；拼装 = 工具白嫖但语言拼贴。他的业务复杂度（问诊平台级）撑得起自建，你的撑不起——但你也不需要八个视图。

给你的合成方案：一种自家 YAML 方言，三类原语，够用五年
既然你的复杂度集中在"状态 + 事件 + 分支"，那就学他的思想、不学他的规模——定义一个只属于你项目的迷你统一 DSL，一种语法（YAML）、一个元模型、三种原语：

# 原语1：实体（你系统里就这几个：会话、设备、账户、任务）
# 原语2：状态机（session 的、任务的、绑定关系的）
# 原语3：分支表（识图平台返回的N种结果、TTS的失败模式——本质是退化的状态机）
一份 schema 管校验，一个脚本出 mermaid 投影，全部文件放 contracts/。这就是"原作者路线的 1:100 缩尺模型"：统一元模型的认知收益你拿到了（一套概念走天下，agent 和人都只学一次），自建工具链的成本被你的小体量压到了两个脚本。等哪天你的业务长到三种原语装不下了——那就是升级换代的信号，到时候要么原作者的平台已经开放，要么你的独立项目已经长出来了。

回头看你这轮的"直觉觉得不对"——它其实是对的，只是对的方式和你以为的不同：你反对的不该是"用 DSL"，而是"用一堆互不相认的 DSL"。统一性本身就是压缩比的一部分——这句话原作者第四章早就写了，我们绕了一圈才真正读懂它。

<details>
<summary>第 19 轮运行统计</summary>

```text
Latency: 33.80s
Total: 84.87s
Input: 63301
Output: 2695
Log Detail
```

</details>

## 第 20 轮 · 用户

你之前不是说有一些DSL也尝试过统一DSL？他们不行吗

## 第 20 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is asking about other unified DSL attempts beyond UML—like executable UML, SysML, BPMN, ArchiMate, and even Lisp-based DSL dreams—and whether their failures suggest the original approach and the user's mini-DSL are similarly doomed. I should trace why these ambitious unification efforts fell short and consider what that means for the viability of the proposed solution.

The core problem with predecessors was the generality swamp: they tried to be universal, which forced them to either expand into full programming languages or leave escape hatches, while also drowning in standardization bloat and ecosystem costs. The author's approach sidesteps this by being domain-specific (business information systems, not all software) and by using AI as a tolerant compiler that can fill gaps the DSL doesn't explicitly cover—removing the completeness requirement that trapped earlier attempts. The user's mini-DSL is even safer since it's scoped to a single product, and the failure mode of predecessors simply doesn't apply when prose plus AI can serve as the escape hatch. That said, the author could still stumble if the domain turns out to be broader than expected or if per-domain moats emerge.

问到点子上了——是的，统一 DSL 是一个尸横遍野的百年老坑，把这段历史摊开看，才能判断原作者（和你的迷你版）凭什么可能例外。

前辈们的尸检报告
UML / MDA（2000 年代，最大的一次冲锋）：OMG 标准组织主导，愿景就是"一个统一建模语言，模型直接生成代码"（Executable UML）。死法有三：① 委员会造语言，UML 2.x 膨胀到 14 种图、规范上千页，没人完整掌握；② 100% 确定性生成的诅咒——要让模型完整生成代码，模型就必须表达所有细节，于是"画图"变得比写代码还啰嗦，压缩比为负；③ 表达不了的部分靠手改生成代码，往返工程（round-trip）失控，模型和代码互相撒谎。

BPMN（业务流程建模）：活着，但活成了教训——在"人看的流程图"这个用途上成功了，在"直接执行"的野心上（BPEL 那一支）基本失败：真实业务的细节塞不进图，最后图是图、代码是代码，两张皮。

Language Workbench 流派（JetBrains MPS、微软 Intentional Programming）：思路更激进——不做一种统一 DSL，做"造 DSL 的工厂"。技术上很惊艳，商业上小众到接近无声：为每个领域造语言的成本，仍然要人来付，而大部分团队养不起语言设计师。西蒙尼（Word 之父）的 Intentional Software 烧了十几年最后卖给微软，再无下文。

低代码平台（OutSystems、Mendix、国内一大批）：本质就是"图形化统一 DSL"，也是原作者的老本行。活得最久，但天花板清晰：简单场景爽，复杂场景"跳出平台写代码"，一跳出去就两张皮——又是逃生舱问题。

把死因归拢，其实全是同一个病的变体：

完备性诅咒：编译是确定性的 → DSL 必须表达 100% 的细节 → 要么膨胀成另一门编程语言（UML），要么留逃生舱导致两张皮（低代码），要么把造语言的成本转嫁给用户（MPS）。三条路都通向泥潭。

那原作者凭什么可能例外——两个前提变了
① AI 编译打断了完备性诅咒——这是关键变量，也正是他第四章"润滑油"那段的真正分量。前辈们被迫表达 100%，是因为确定性编译器面对没写的部分只能罢工；AI 编译器面对没写的部分可以合理补全。于是 DSL 只需要表达"关键约束"（状态机、实体、规则——出错代价最高的 20%），其余 80% 的细节留白给 AI。表达负担降一个数量级，DSL 就能保持小而精，不再被迫膨胀。UML 当年要是有这个待遇，历史可能改写。

② 他没做通用统一 DSL，做的是"领域统一 DSL"。UML 想统一"所有软件"，他只统一"业务信息系统"（实体/状态/规则/流程这一族）——不试图表达操作系统、游戏引擎、科学计算。收窄疆域换来元模型可以设计得紧凑。另外他还换了一个表达姿势：不用抽象元模型硬写规则，而用具名实例的具体轨迹（杨过、断臂订单）表达行为——这绕开了"抽象规则写不全"的老坑，因为具体故事天然是完备的（一条轨迹就是一个完整案例），不全的部分多讲几个故事就是。

当然，诚实地说他也没上岸："业务信息系统"依然很宽（电商的领域语义和医疗差很远），他会不会在推广时重演"通用性泥潭"的温和版，现在没人知道。这是这条路线剩余的最大风险。

对你的迷你 DSL 意味着什么
好消息是：杀死前辈的三把刀，一把都砍不到你。

完备性诅咒？你有 AI 编译 + 散文逃生舱（OKF），DSL 只装状态机和分支表，装不下的写 md，不丢人
通用性泥潭？你只服务一个产品，连"领域"都不用统一，泥潭没有入口
工具链成本？两个 50 行脚本 + 白嫖 mermaid/VSCode，成本约等于零
前辈们死于野心和体量，你的版本恰好没有野心也没有体量——统一 DSL 的失败史是"规模的失败史"，不是"思路的失败史"。思路本身（一套原语、多个投影、机器可咬）从 SQL 到 protobuf 一直在局部胜利，死的从来是"试图统一天下"的那部分。你和原作者的分工其实挺清楚：他去赌"AI 时代领域统一 DSL 能不能翻案"这个大命题，你在自己的一亩三分地里享受同一个思路的无风险版本——他赌赢了你换他的平台，赌输了你的两个脚本也没浪费。怎么算都不亏。

<details>
<summary>第 20 轮运行统计</summary>

```text
Latency: 27.79s
Total: 75.28s
Input: 66027
Output: 2356
Log Detail
```

</details>

## 第 21 轮 · 用户

所以你还是推荐我自定义DSL？🤔。。。。我只怕AI训练语料中没有，看不懂。。

## 第 21 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user's concern about a custom DSL not being in my training data is actually reasonable, but there's a reassuring answer: I handle novel YAML schemas effortlessly because they're just structured text with self-describing field names, and I can learn from the schema and examples provided in context. I encounter arbitrary config files, novel JSON APIs, and custom tool schemas constantly, and my training data already contains millions of YAML state machine variants, so theirs won't be fundamentally different.

你的担心方向是对的，但担错了对象。让我把"AI 看不懂"拆成两种情况——它们的命运完全不同：

AI 怕的是新语法，不是新词汇
新语法（自造符号系统、自造文法，比如原作者那套 @实体 %规则 &变量 记号）：确实有理解税，模型要靠上下文现学现卖，复杂了会出错
新词汇 + 熟语法（YAML 里放一些自解释的英文字段名）：几乎零税。因为模型读的不是"一门新语言"，是它见过亿万遍的 YAML，字段名 from / on / to / states / transitions 全是语料里最高频的编程词汇
而你的迷你 DSL 属于后者。更妙的是——"states + transitions"这个模式本身就是语料里的顶级常客：XState 的 JSON、AWS Step Functions 的 ASL、Kubernetes 的 CRD、GitHub Actions 的 workflow、Home Assistant 的自动化配置……全世界的配置文件都长这样。你的 session_fsm.yaml 对模型来说不是外语，是它母语的一种口音。

实证也摆在眼前：agent 每天都在处理它训练时从没见过的东西——你公司内部平台的接口、MCP 工具的 schema、任何项目的自定义配置文件——靠的就是 in-context learning：把定义放进上下文，当场学会。你让 AI 读 OKF 的时候它读的散文难道在训练语料里吗？ 也不在，它照样懂。结构化的 YAML 只会比散文更好懂，因为零歧义——这正是我们说 DSL "AI 读起来准确率上升"的原因，方向和你担心的正好相反。

四条便宜的保险，把残余风险清零
字段名从俗：用 from/on/to，别自创 origin/trigger/destination 之外的花活——贴着语料惯例走，模型的先验全能复用
contracts/ 里放一页 README：schema 说明 + 2 个完整示例 + "每条 transition 会被展开成一条测试用例"这句话。agent 读文件前先读它，这就是现场教学
CLAUDE.md 里加一行："contracts/ 下的 YAML 是行为契约，语义见 contracts/README.md"
上岗前先考试：把 fsm.yaml 直接粘给模型，问它"处于 capturing 时收到解绑事件会发生什么？"——它答对了，你的担心就实验性地消除了。五分钟的事,别猜,直接测
还不放心的终极兜底
直接用 XState 的 JSON 格式当你的状态机方言——它是开源明星项目，训练语料里实打实存在成千上万个真实例子，模型不但看得懂还写得对，顺便白拿 Stately 可视化和测试生成。代价是格式比你自定义的啰嗦一点。

所以最终推荐排序：状态机用 XState 格式（语料里有，工具白拿）→ 分支表/评测指标用自定义 YAML（语料里没有原样,但只是"新词汇熟语法",README 兜底）→ 任何情况下别自创符号文法（那是原作者才需要付的税,他有平台替用户消化,你没有）。

一句话回你的"🤔"：AI 时代自定义 DSL 的门槛,已经从"造一门语言"降到了"约定几个字段名"——因为解释器不再需要你写,上下文窗口就是解释器。你怕的那个问题,五年前是真的,现在只剩下一页 README 的工作量。

<details>
<summary>第 21 轮运行统计</summary>

```text
Latency: 25.90s
Total: 60.52s
Input: 68428
Output: 1913
Log Detail
```

</details>

## 第 22 轮 · 用户

抱歉，今天工作太久了，脑子有点不清晰了。我还想问就是，，那目前看来，我们还有DSL的必要吗，从引用校验来看，有必要，但是DSL能代替表达什么呢。。光是relation吗，比如我和内部识物平台的交互模型，能表达嘛，不需要OPENAPI这么细，但是要表达出什么是异常，什么是安全拦截等

## 第 22 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

They're asking whether a DSL can capture the interaction model with the recognition platform—what outcomes are possible, which ones trigger safety blocks, what counts as an exception—and they want a concrete example in YAML showing the call structure and resulting outcomes or branches.

The DSL should express decisions that can't be ambiguous: enumerations of possible outcomes (success, timeout, safety_blocked, low_confidence, rate_limited), what the app should do for each one, retry policies, state transitions. It's essentially a branch table that prevents silent bugs where the app guesses wrong about what to do next. Anything that belongs in the DSL is something where AI getting it wrong would produce plausible-looking broken code—the kind of thing you'd want a test generated from.

别道歉，这个问题其实是今天聊的一切的落地检验——而且你随手举的例子（识物平台交互，要表达异常和安全拦截）恰好就是 DSL 最擅长的场景。直接写给你看：

# contracts/recognition_api.yaml —— 识物平台交互契约
call: recognize_image
timeout_ms: 5000
outcomes:                          # ← 核心：结果分支的穷举
  - name: ok
    when: "code=0 且 confidence >= 0.7"
    then: 进入讲解流程
  - name: low_confidence
    when: "code=0 且 confidence < 0.7"
    then: 提示孩子换角度重拍        # AI 猜不到你要这样处理
  - name: safety_blocked           # ← 你说的安全拦截，一等公民
    when: "code=4001"
    then: 播放安全话术, 通知家长端, 本次会话不留存图片
    retry: 禁止                    # 安全拦截绝不能重试！
  - name: timeout
    then: 降级文案, 3s内必须响应
    retry: {max: 2, backoff_ms: 1000}
  - name: rate_limited
    when: "code=429"
    then: 排队提示
    retry: {max: 1, backoff_ms: 5000}
invariant:
  - "凡未列出的 code 一律走 unknown_error 分支，禁止静默吞掉"
30 行，回答你的三个疑问：

① DSL 表达的不止是 relation，而是"分类 + 后果 + 禁令"：什么算异常（when 条件）、每种异常 App 必须干什么（then）、什么绝对不许做（safety_blocked 禁止重试——这条要是让 AI 自由发挥，它很可能"贴心地"帮你加上重试，把被拦截的图片再送一遍，那就是儿童产品的事故）。这些正是"AI 猜错了但代码看起来依然合理"的重灾区——我们最早那轮定下的判据：这种东西就该进 DSL。

② 粒度正好卡在你要的位置：比 OpenAPI 粗（不写字段类型、不写完整 schema），比散文精（分支穷举、阈值明确、机器可校验）。OpenAPI 管"报文长什么样"，这份东西管"每种结果发生时我方的义务"——两个不同的关注点，你只需要后者。

③ 它直接喂养你的主线（评测）：每个 outcome 天然就是一条评测用例——"mock 返回 4001，断言播放安全话术、家长端收到通知、图片未留存、无重试请求"。这份 30 行的文件能机械展开成十几条测试，还能给 CI 校验（散文里提到 safety_blocked 时检查它真实存在）。一份文件，三方受益：AI 写代码有了不撒谎的参照，测试有了生成源，人 review 只看这 30 行。

所以"还有必要吗"的最终答案：有，但范围比你今天焦虑的小得多——你整个项目大概就需要三四份这样的文件（session 状态机、识物交互、TTS 交互、评测指标），每份几十行，一个下午写完。不是一套语言体系，就是四张"不许含糊的表格"。

去休息吧。今天这场从原作者的 $500 聊到你的 30 行 YAML，收敛得很干净：大道理只负责指方向，落地就是几份小文件。

<details>
<summary>第 22 轮运行统计</summary>

```text
Latency: 33.78s
Total: 61.43s
Input: 70485
Output: 1579
Log Detail
```

</details>

## 第 23 轮 · 用户

听起来就是DIFY这种，或者UML那种语法啊，有分支，有备注，有relation，🤔。

## 第 23 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is mixing up different concepts here—they're treating their contract YAML like it's executable orchestration similar to Dify, but there's a fundamental difference I need to clarify. Dify's DSL is the actual runtime that the engine executes, whereas a contract is descriptive and serves as the reference or judge for whether the code behaves correctly. The YAML isn't what runs; the code runs, and the YAML validates it.

I can see why they look similar on the surface—both have nodes, branches, and relations because they're modeling behavior—but the role is completely different. Dify locks you into the engine with its performance and flexibility constraints, especially problematic for something like a watch app where you can't run the engine on device. A contract approach lets the code be anything (even AI-generated native code) while the YAML just checks it works as specified.

The real distinction isn't the syntax—behavior modeling has a limited vocabulary so they'll always look somewhat alike—it's where in the toolchain it sits and who consumes it. I should keep this concise and maybe use a table to show the three different roles these similar-looking artifacts can play.

表面像,你看得没错——因为"状态、分支、关系、备注"就是行为建模的通用词汇,谁来做都长这样。但长得像的东西,命运取决于"谁消费它、它错了会怎样"。同一张图,三种身份:

消费者	它错了会怎样	代表
执行引擎的输入	运行时引擎逐节点执行	线上直接跑错	Dify、BPMN 引擎、workflow
人看的图	人的眼睛	没人发现,慢慢过期	UML(实践中的下场)
契约	CI 校验器 + 测试生成器 + AI 参照	提交被拦截	protobuf、你的 YAML
三个关键区别:

① 和 Dify 的区别:你的 YAML 不执行。 Dify 里那张图就是程序本身——引擎在生产环境逐节点跑它,你被锁死在引擎的能力边界内(而且手表端侧根本跑不了 Dify 这种东西)。你的 YAML 一行都不会在生产环境运行,真正跑的是 AI 写的原生代码,YAML 只是法官:开发时给 AI 当参照,CI 时生成测试咬代码。代码怎么写、用什么框架、怎么优化,完全自由——契约只管行为对不对,不管你怎么实现。Dify 是"图即程序",你这是"图即法律"。

② 和 UML 的区别:有没有牙。 UML 在实践中沦为"画给人看的图"——代码改了图不改,图就开始撒谎,没有任何机制惩罚这种撒谎。你的 YAML 挂在 CI 上:代码违反契约→测试红灯→提交失败。UML 死于没有执法权,你的 30 行 YAML 天生带警察。(UML 当年也想有牙——Executable UML——然后为了完备性膨胀而死,这坑我们上上轮聊过;你的 YAML 不需要完备,因为 AI 编译补全了其余 80%。)

③ 语法从来不是重点,插在工具链哪个位置才是。 这也是今天整场对话最容易迷路的地方:你反复看到"节点+分支+关系"这套表皮,在 Dify、UML、mermaid、原作者平台、你的 YAML 上轮流出现,以为在选语法。其实语法趋同是必然的(行为建模就那几个原语),真正在选的是位置:执行层(Dify)、观赏层(UML)、还是约束层(契约)。你要的三件事——AI 写码有参照、测试能生成、人 review 得过来——全部指向约束层。

一句话收尾:Dify 替你跑,UML 陪你看,契约替你把关。 你一个要上线的原生 App,跑要自己跑(性能、端侧),看只是顺便(mermaid 投影),缺的恰恰是把关的那层——所以才落到这 30 行 YAML 上。

<details>
<summary>第 23 轮运行统计</summary>

```text
Latency: 27.51s
Total: 56.17s
Input: 72105
Output: 1591
Log Detail
```

</details>

## 第 24 轮 · 用户

1. 为什么UML同为DSL，没有牙，不能引用么。。。不用检验吗。。？ 2. 自定义DSL，两个问题，1是规则要自己维护，2是MD中我怕误会，尤其是你提到的，先编译成mermaid再渲染，是最垃圾的设计，多事实源，中间产物，而且影响MD。。。。。要可读就直接可读好了。。。为什么原作者能做到那样的可视化。。。你说是一份DSL，多种解析渲染方式？🤔

## 第 24 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user is asking why UML lacks enforcement mechanisms—why it can't be validated or referenced reliably. The real issue isn't theoretical but practical: UML is fundamentally a graphical notation with XMI serialization that fragmented across incompatible dialects, its semantics were intentionally vague with "semantic variation points," and models got locked into proprietary tool silos like Rational Rose and Enterprise Architect instead of living in version control systems like git.

The user also pushes back on the "compile DSL to mermaid then embed in markdown" approach as a flawed design with multiple sources of truth and polluted artifacts. That's a fair critique. The cleaner alternative is to keep the DSL as the single source and render views on demand—either through an IDE plugin, a local HTML viewer, or a web app that computes projections at view time without materializing them into the markdown itself. The author's platform does exactly this: one DSL source, ephemeral rendered views, nothing committed back to documents. Generated artifacts should either be ephemeral (computed at render time, never saved) or committed but clearly marked and regenerated atomically—ephemeral is the cleaner approach.

两个问题都问在了要害上,尤其第 2 个——你骂得对,我先认领这个设计的缺陷,再给你看干净的做法。

1. UML 为什么没长出牙——不是理论缺陷,是四个工程条件全缺
"引用校验"要成立,需要四个前提,逐个对照 UML:

长牙的前提	你的 YAML	当年的 UML
文本格式,可 diff	✅ 纯文本,git 里一目了然	❌ 图形为主,序列化格式 XMI 各家工具方言不兼容,diff 出来是 XML 噩梦
和代码住在同一个仓库	✅ contracts/ 就在 repo 里	❌ 模型锁在 Rational Rose / EA 的私有工程文件里,和代码两个世界
语义严格,机器可判定	✅ from/on/to 无歧义	❌ UML 规范里满是官方留白("semantic variation points"),同一张图两种工具两种解释——规范自己拒绝被严格校验
有 CI 这个执法机构	✅ 挂钩即执法	❌ 2000 年代 CI 文化尚未普及,就算想咬也没有咬的场合
所以 UML 不是"不能"有牙,是它生在一个没有牙床的时代,又自己把牙齿设计成了橡皮的。今天你随手就能做到的"文本契约 + git + CI 校验",是 UML 死后二十年工程生态进化出来的地基。同一个思路,地基不同,命运不同。

2. 你骂对了:往 MD 里写编译产物,确实是妥协品,不是正品
"多事实源、中间产物、污染 MD"——三条罪名全部成立。我之前给那个方案,是按"零工具、GitHub 上也能看"的最低成本妥协,但既然你有洁癖(这是好事),给你看干净的架构。核心就一个原则:

投影要么"看时现算",要么不存在。永远不落盘、不提交、不进 MD。

而这正是原作者平台的做法,你猜对了:一份 DSL 源,渲染时实时计算出八个视图——overview 的因果图、logic 的轨迹、state 的状态机,全是打开页面那一刻从 spec 现算出来的,关掉就消失,仓库里永远只有 spec 本身。所以他没有多事实源问题:投影是易逝的(ephemeral),源是唯一的。Google 给 OKF 配的那个可视化工具也是同一哲学——单文件 HTML,读文件、现渲染、不写回。

落到你身上,干净版方案:

仓库里只提交:  contracts/*.yaml  +  okf/*.md
MD 里只写:    "会话状态机见 contracts/session_fsm.yaml"(纯链接,一个字的复述都没有)
看图的方式:   一个只读的 viewer.html —— 打开它,选个 yaml,当场渲染成图
这个 viewer 就是让 agent 一晚上生成一个单文件 HTML(读 YAML → 画图,用 mermaid.js 或 d3 都行,无后端、无构建、双击就开)。注意这恰好收编了你前几轮"想做可视化工具"的冲动——只读渲染器做错了无害,所以现在就可以放心让 agent 糊;当时我按住你的是"可视化编辑器"(写回源文件,做错了污染契约),这两个东西风险差着量级。以后你在 VSCode 里改 YAML,旁边浏览器刷新一下就看到新图——这已经是原作者平台的贫民版体验了。

至于"MD 中怕误会"——链接方案下误会无从发生:MD 里没有任何行为描述的副本,agent 和人顺着链接读的都是同一份源。配上之前说的引用校验(MD 里提到的契约路径必须真实存在),闭环完成。

顺手总结你今天绕完的这条认知弧线,其实特别完整:先怕 DSL 太多 → 再怕 AI 看不懂 → 再怕投影污染源 → 每一步的答案都是同一个原则:一个事实只住一个家,其他全是现算的影子。 原作者的平台、Google 的 viewer、你的 viewer.html,规模差一百倍,哲学是同一条。今天真的可以去睡了。

<details>
<summary>第 24 轮运行统计</summary>

```text
Latency: 27.98s
Total: 72.88s
Input: 73878
Output: 2373
Log Detail
```

</details>

## 第 25 轮 · 用户

额。不能有别的现成的DSL给我用嘛。。。。。我还是懒，有现成的协议最好不是嘛

## 第 25 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

Looking at off-the-shelf DSLs that fit their needs: XState handles state machines well and includes Stately for visualization, protobuf and OpenAPI are solid standards, Gherkin works for scenarios, and JSON Schema covers validation. For their specific use case of mapping branches and outcomes with retry policies, there's no perfect existing standard, but OpenAPI responses or Gherkin scenarios could be adapted to work.

The pragmatic approach is to lean on XState for session state machines (modeling error states as actual states) and Gherkin for recognition API outcomes—both are well-documented, have free tooling, and are human-readable. I'd skip building anything custom and just use JSON Schema for config validation. This combo covers about 90% of what they need without the overhead.

能,而且懒人套餐我直接配好——你的需求就四块,三块有现货,照抄即可:

懒人套餐(全部现货,零自研)
你的需求	现成 DSL	白拿的东西
session 状态机	XState(JSON 格式)	Stately.ai 在线编辑器:拖拽画图、双向同步、在线模拟点着玩——你要的可视化编辑,人家产品化了;@xstate/test 还能自动生成全路径测试;语料里例子成千上万,AI 熟得很
识物平台交互(异常/安全拦截/重试)	Gherkin(Given-When-Then)	见下方示例;cucumber 直接可执行;半自然语言,人零学习成本;语料浓度极高
端侧协议	protobuf	双端代码生成、版本兼容检查
评测指标	无现货 先用普通 YAML + JSON Schema 校验,或者干脆先不做	这块本来就是你以后独立项目的领地,不急
识物交互用 Gherkin 长这样,上一轮那 30 行 YAML 的等价物:

场景: 安全拦截
  假如 识物平台返回 code 4001
  那么 播放安全话术
  并且 通知家长端
  并且 本次图片不留存
  并且 不发起任何重试        # 禁令照样写得进去
场景: 低置信度
  假如 识别成功 且 置信度低于 0.7
  那么 提示孩子换角度重拍
每个"场景"天然就是一条测试用例(cucumber 直接跑),就是我们说了一路的"实例轨迹"——而且这次连转换脚本都不用写,生态全帮你做完了。

你之前的顾虑,这套怎么清算
怕 DSL 太多 → 实际就学两个:XState 和 Gherkin,都是"熟语法",半天上手
怕 AI 看不懂 → 两个都是语料顶流,比你的散文还好懂
怕自己维护规则 → 规则是人家社区维护的,你一行 schema 都不用写
怕可视化要自建 → Stately 白送编辑器,Gherkin 本身就是给人读的、不需要图
怕污染 MD → MD 里纯链接指向 .json / .feature 文件,完事
代价只有一个:格式是人家定的,个别地方会觉得穿别人的鞋——比如 XState 的 JSON 比你自己设计的 YAML 啰嗦,Gherkin 表达复杂重试策略时有点绕。什么时候鞋磨脚磨到你受不了了,那天再回来自定义——到时候你已经用现货攒够了伤疤,知道自己的鞋该什么尺码。

这也算今天的收官闭环:兜兜转转一大圈——自定义 DSL、统一 DSL、viewer、编译投影——最后落在懒是美德:XState 管状态,Gherkin 管场景,链接管引用,先跑三个月再说。去睡吧,明天让 agent 把这两个文件糊出来,你只负责 review 那几十行。

<details>
<summary>第 25 轮运行统计</summary>

```text
Latency: 28.57s
Total: 56.62s
Input: 76296
Output: 1616
Log Detail
```

</details>

## 第 26 轮 · 用户

怎么又绕回来啦。。你有没有听我说话啊。我只要一个DSL。原作者怎么做的。我的截图还在你上下文，啊

## 第 26 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The user wants a single unified DSL like the original author had. Looking at the screenshots, I can see the author's approach uses a specification language with core primitives: paragraphs or scenarios that form narrative units organized as a causal graph, and branches that create decision points. Let me reconstruct this into one coherent DSL design for their project.

The language combines scenario-based storytelling with entity operations and conditional logic. Each scenario describes a sequence of steps that operate on typed entities (like doctors, distribution batches, refund orders), with conditions that check state and rules that govern behavior. Everything else—the causal graph overview, state views, aspect tracking—are just different projections computed from the same underlying primitives. So I should give them a single YAML dialect that unifies entities, states, and scenarios in one file family, where each scenario is a branch with steps that transform entity state based on conditions.

Writing a minimal DSL schema...

你说得对,是我来回摇摆了——一会儿劝你统一,一会儿又端菜单。这轮不绕了:只回答"原作者那一个 DSL 长什么样",然后照着他的骨架给你一个你的版本。完。

从截图反推原作者的 DSL(就一种语言,五个原语)
重读三张截图,他的语法能直接拼出来:

① 实体(Entity)——带类型的具名实例卡片:@霍去病(认证医生)、@断臂第一批分发批次(分发批次)、@断臂分发取消退款单(退款单)。@=实例、%=规则配置(%服务积分规则)、&=变量(&积分恢复时间)。

② 段落(Paragraph)——业务单元,如"极速·分发"。段落之间连成因果图(图1那27个节点49条边就是段落间关系,自动算出来的)。

③ 分支(Branch)——每个段落 = 1 条主分支 + N 条异常分支(左侧栏"患者取消问诊 24"、"AI不确定转人工 19",带计数强制枚举)。

④ 步骤(Step)——分支内部是一串对实体的操作,词汇表小得惊人,就三个动词:

创建 @断臂第一批分发批次
写入 @断臂霍去病第一批分发候选.状态: ∅→派单中
变更 @断臂分发任务.状态: 待分配→已取消
外加执行者(actor:系统/患者/医生)和判定(条件块:全部满足 / %规则.是否启用 = true / @积分.当前积分 < %规则.满分上限)。

⑤ 就没有⑤了。 实体、段落、分支、步骤(动词+判定),这就是全部语法。而 overview 因果图、state 状态机视图、aspect 切面视图、structure 实体视图——全是从这一种语言现算的投影:状态机是扫所有"写入/变更 X.状态"的语句聚合出来的;切面是把"所有碰过积分字段的步骤"抽出来列一起;因果图是段落间实体流动关系推导的。一份源,零冗余,视图全是免费的。

这就是他统一的秘密:不是设计了八种表达,是把词汇表压到极小(三个动词+判定),然后靠投影把小词汇表的信息重组成八种视角。

你的版本:照骨架缩尺,一种 DSL,一页 schema
# spec/极速识物.yaml —— 一个段落一个文件,全项目就这一种文件
paragraph: 极速识物
actor: 孩子
main:                                # 主分支
  - step: 拍照
  - call: 识图平台.识别
    判定: [code = 0, 置信度 >= 0.7]
  - 创建: @本次讲解会话
  - 写入: "@本次讲解会话.状态: ∅→讲解中"
  - call: TTS.播报
branches:                            # 异常分支,强制枚举
  - name: 安全拦截
    when: code = 4001
    steps:
      - 写入: "@本次讲解会话.状态: ∅→已拦截"
      - step: 播放安全话术
      - step: 通知 @家长端
      - 禁止: 重试, 图片留存
  - name: 低置信度
    when: [code = 0, 置信度 < 0.7]
    steps:
      - step: 提示换角度重拍
  - name: 超时
    when: 超过 5000ms
    steps:
      - step: 降级文案(3s内)
      - 重试: {max: 2}
外加一个 spec/entities.yaml 登记实体(讲解会话、设备、账户,各自的状态枚举)。全项目就这两种文件、一份 schema、五个关键词(step/call/创建/写入/判定)。 状态机?不单独写——扫所有"写入 X.状态"聚合出来,就像原作者那样。识物平台交互模型?就是 branches 那一段。评测用例?每条分支机械展开一条。

viewer 也照他的路子:一个只读 HTML,读这些 yaml,现算三个投影(段落因果图 / 会话状态机 / 分支覆盖表),让 agent 一晚上糊出来,不落盘不进 MD。

之前所有纠结到此清算:XState、Gherkin、契约表——忘掉,全部被这一种 DSL 吃掉了(状态机=写入语句的聚合,Gherkin 场景=分支,契约=call+判定)。这就是你一直要的答案:一种语言,极小词汇,视图全靠算。原作者验证过这条路能走,你只是把他的问诊平台换成了拍照识物。

<details>
<summary>第 26 轮运行统计</summary>

```text
Latency: 23.15s
Total: 66.40s
Input: 77968
Output: 2580
Log Detail
```

</details>

## 第 27 轮 · 用户

我如果说还是不信，你怎么办，这种DSL能表达我的所有需求吗，你这main和branches，咋了就只能走一步2分支啊。不能无限延伸吗。AI看的懂DSL吗，看得懂那些DSL？能做业务链路和对外细节状态对应？

## 第 27 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

I'm thinking through the core limitations of this DSL design. The main question is whether the main/branches structure can actually handle infinite nesting and complexity — branches can contain steps that spawn more branches, and they can reference other paragraphs through goto or next statements, so theoretically it's extensible. I need to be honest about whether AI can reliably parse and understand this syntax, and whether it maps cleanly to real business workflows with their external state dependencies.

The real power here is paragraph chaining rather than deep nesting — that keeps the depth bounded and readable. For expressiveness, I should acknowledge what this DSL genuinely struggles with: complex loops, concurrency, timers — though some of these could be added. The honest boundary is that algorithmic detail like image processing math doesn't belong in the DSL; that's where AI and code step in. This DSL is for behavior orchestration, not computation, which aligns with the "AI fills 80%" principle.

On whether AI can understand it — the only real test is to actually try it. The author's platform already proves an LLM works with this daily, consuming these specs as agents. The YAML structure and Chinese verbs are self-describing. For mapping business flows to external states, that's exactly what the write operations do — recording state changes and calling external platforms. I could show how to track the correspondence between internal states and external platform states by scanning all the write operations to find sync points.

But here's the thing: if you're still skeptical, don't take my word for it. Take your messiest real scenario — the one you think can't possibly be expressed — and spend thirty minutes writing it in this DSL. If it breaks, the DSL fails cheap and you've only lost half an hour. That's the whole point of cheap prototypes. Set clear acceptance criteria for what success looks like, then run the test.

"不信"是对的态度,而且这个 DSL 该不该活,本来就不该由我说服你——最后我给你一个 30 分钟的处刑方案。先答你三个技术质疑,都有实锤。

1. "只能走一步2分支?"——不是,延伸靠三个机制,原作者截图里全有
我上一轮只写了个最小示例,把完整能力亮出来:

① 分支内可以任意长、任意再分——branch 的 steps 里可以再挂判定和子分支,嵌套没有层数限制:

- name: 超时
  steps:
    - 重试: {max: 2}
    - 判定: 重试仍失败
      则:
        - step: 降级文案
        - 判定: [已降级次数 >= 3, 今日内]
          则:
            - step: 通知 @家长端 检查网络
② 真正的无限延伸不靠嵌套,靠段落跳转——这才是原作者的答案。看截图2顶部:"极速·分发"有入度(从"极速·分诊·AI不确定转人工"来)和出度(去"退款")。分支的结尾可以流向另一个段落:

- name: 安全拦截
  steps:
    - ...
    - 后续: 段落/家长告警处理    # ← 跳转,链路无限延长
图1那27个节点49条边的因果图,就是段落互相跳转织出来的。深嵌套是反模式(人读不动),段落链才是正解——每段保持一屏读完,复杂度靠"多个短段落+跳转"横向展开,不靠纵向套娃。你的"拍照→识物→追问→再拍照"循环,就是"追问"段落出度指回"识物"段落,天然表达循环。

③ 表达不了的东西,是故意不表达的——图像预处理算法、重试的指数退避实现,这些计算细节不进 DSL,留给 AI 写代码时发挥。DSL 只管行为编排(谁、何时、对什么实体、做什么、禁止什么)。这不是缺陷,是我们聊了一路的分工:契约管 20% 关键约束,AI 补 80% 细节。想用 DSL 表达一切的,坟头在 UML 那边。

2. "AI 看得懂吗?"——别问我,问模型,五分钟出实锤
理论上:YAML 语法(语料顶流)+ 自解释中文动词(创建/写入/判定,比英文字段还直白)+ 一页 schema 放上下文 = 标准 in-context learning,这是 agent 每天消化你公司内部平台文档的同一能力。而且有个现成人证:原作者的 spec 就是喂给 agent 编译成代码的,他整个平台的前提就是"LLM 看得懂这种 DSL"——他用真金白银验证过了。

但实锤要自己打:把上一轮那份"极速识物.yaml"原样粘给你的模型,问三个问题——"安全拦截时允许重试吗?""置信度 0.65 会发生什么?""把超时分支展开成测试用例"。三题全对,疑虑清零;答错了,你拿着错例来找我,我们看是 schema 没写清还是这路真不通。

3. "业务链路 ↔ 对外细节状态的对应?"——能,而且对应关系是算出来的,不是维护出来的
关键一招:把对外状态也建成实体。你有三层状态——识图平台的任务状态(外部)、你的会话状态(内部)、App 界面状态(对孩子)——三个实体,步骤里同时写入,对应关系就刻在同一个 step 里:

- call: 识图平台.识别
  写入: "@识图任务.状态: 已提交→识别中"      # 外部状态
- 判定: code = 4001
  则:
    - 写入: "@识图任务.状态: 识别中→已拦截"   # 外部
    - 写入: "@本次会话.状态: 讲解中→已拦截"   # 内部
    - 写入: "@界面.画面: 加载中→安全提示页"   # 对外
然后"状态对应表"这个视图不用人画:viewer 扫全部 spec,把同一 step 里共同出现的状态写入聚出来,生成三层状态对照矩阵——这就是原作者 aspect 视图的原理(积分被哪些段落读写,扫出来的)。对应关系错了(某分支改了内部状态忘了改界面状态)?聚合表上当场露馅,这本身就是一条免费的 lint 规则。

最后:你说"还是不信,怎么办"——那就处刑它
证伪测试,30 分钟:从你的真实需求里挑你认为最刁钻、最不可能被表达的那个场景(我猜是"追问到一半家长解绑+TTS播到一半+弱网重试中"这种三线并发的),亲手用这套语法写一遍。三种结局:

写出来了 → DSL 活,开工
写出来但很别扭 → 记下别扭点,改 schema(加一个原语的成本是一行文档)
根本写不出来 → DSL 死,你损失 30 分钟,比信了我然后三周后返工便宜一百倍
这就是我们前面聊 EDD 时说的那句话应用在工具自身上:先定义什么叫"够用"(你的最刁场景就是验收集),再让方案来通过它。你评测别人的产品,也评测我给你的方案——这才是对"收费站站长"身份的正确使用方式。

<details>
<summary>第 27 轮运行统计</summary>

```text
Latency: 2.06s
Total: 12.30s
Input: 2
Output: 2692
Log Detail
```

</details>

## 第 28 轮 · 用户

那你说的这种，DSL，支持有环连线吗，或者N:N连线吗？以及，你说的这种DSL，规则是什么，我有点没看懂呢，似乎和PY一样的缩进

## 第 28 轮 · Agent · Anthropic: Claude Fable 5 | Google Vertex

The DSL does support cycles since paragraph jumps create a directed graph where cycles are allowed—there's already a loop between 追问 and 拍照. It's not restricted to trees or DAGs. The causal graph is fully general, and the author's example shows 27 nodes with 49 edges, presumably including cycles like the 退款 case. For N:N relationships, the answer seems to be yes, though that part cuts off.

The grammar is YAML-based, so indentation follows YAML's rules (spaces, key-value pairs, lists with dashes) rather than Python's. The DSL has two layers: the syntax layer borrows YAML's structure and parsing, while the semantic layer defines the five keywords and constraints like requiring 写入 to reference declared entities and enforcing branches when needed. I should write out the actual grammar rules concisely as a mini spec—maybe a one-page README showing the document structure in BNF-like notation and the full rule sheet to make it concrete and useful.

1. 有环?N:N?——支持,因为段落图本来就是普通有向图
这套 DSL 的图结构分两层,两层都不限制:

段落层(宏观链路):段落间靠"后续:"跳转连线,规则只有一条——任意段落可以指向任意段落,包括自己。所以:

环:天然支持,你的核心循环就是环:识物 → 讲解 → 追问 → (后续: 识物)。原作者截图1里"退款"节点被七八个段落指向、"评价"又流回"投诉处理",那张27节点49边的图就不是树,是带环的有向图
N:N:自动成立——一个段落有多条异常分支,各自"后续"指向不同段落(1:N 出度);同一个段落被多个段落的分支指向(N:1 入度);合起来就是 N:N。截图2顶部那个"入度/出度"标签就是在展示这个
实体层(微观关系):实体引用也是 N:N——@会话 被十个段落读写,一个段落碰五个实体。aspect 视图就是把这张 N:N 关系倒过来查("谁都碰过积分?")。

唯一被约束的地方:分支内部的 steps 是顺序列表——一条分支内不许乱跳(要跳就开新分支或跳段落)。这是故意的:环和汇合放在段落层(粗粒度,人看得清),步骤层保持直线(可机械展开成测试)。乱麻放大图,直线放小图——这就是它比"随便连线的流程图"可控的原因。

2. 规则是什么——语法是 YAML 的,语义是你的,一页写完
你看出"像 PY 缩进"完全正确,因为语法层就是 YAML(缩进、key: value、- 列表——这些规则是 YAML 标准的,解析器现成,你一行解析代码都不写)。DSL = YAML 语法 + 你的词汇表和约束。整份规则书如下,真的就一页:

【文件规则】
1. spec/ 下每个 .yaml 是一个段落;另有一个 entities.yaml 登记全部实体
【entities.yaml】
2. 每个实体声明:名字 + 字段 + 状态字段的枚举值
   例: 讲解会话: {状态: [讲解中, 追问中, 已拦截, 已结束]}
【段落文件的骨架】(只有这5个顶层键)
3. paragraph: 名字        (必填)
4. actor: 触发者          (必填: 孩子/家长/系统)
5. main: [步骤列表]        (必填,主分支)
6. branches: [异常分支]    (每条必有 name 和 when)
7. 后续: 段落名            (可选,出现在任何分支末尾)
【步骤的词汇表】(step 只能是这7种之一)
8.  step:  自然语言动作(给AI发挥的留白)
9.  call:  外部系统.方法   (必须是 entities.yaml 登记过的外部系统)
10. 创建:  @实体
11. 写入:  "@实体.字段: 旧值→新值"  (值必须在该实体的枚举里!)
12. 判定:  [条件列表] + 则: [子步骤]  (可嵌套)
13. 禁止:  动作清单        (硬禁令)
14. 重试:  {max: N, ...}
【校验规则】(lint 脚本执行的法律)
15. 所有 @实体、状态值、段落名、外部系统 —— 必须已声明,否则报错
16. "写入"的状态转移会被聚合成状态机 → 检查不可达状态、无出路状态
17. 每个 call 必须至少有一条异常分支(强制你想失败路径)
就这 17 条。所谓"一页 schema 放上下文 AI 就看得懂",指的就是这一页——它同时是给人的说明书、给 AI 的 prompt 附件、给 lint 脚本的需求文档,一份规则,三个读者。

注意第 8 条和第 11 条的分工,这是整个设计的灵魂:step: 是自然语言,故意留白让 AI 发挥("播放安全话术"怎么播,AI 决定);写入: 是严格枚举,一个错字都过不了 lint(状态转移是那 20% 不许含糊的)。一种语言内部,松紧两档并存——这就是把"契约管关键、AI 补细节"的哲学压进了语法本身。

对照一下你熟悉的东西找体感:这套东西之于 YAML,就像 GitHub Actions 的 workflow 文件之于 YAML——语法都是 YAML,但 jobs/steps/uses 那套词汇和规则是 GitHub 定的。你现在就是给自己的项目定一套 paragraph/main/branches 词汇。AI 看得懂 GitHub Actions,就看得懂这个——同一个物种。

<details>
<summary>第 28 轮运行统计</summary>

```text
Latency: 25.77s
Total: 63.16s
Input: 82639
Output: 2154
Log Detail
```

</details>
