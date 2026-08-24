# 开放验收协议（Acceptance Protocol）规范 v1

> **本文档是一份开放的规范，不绑定任何宿主、插件或实现。**
> 任何 agent 宿主（Claude / DSH / Codex / Gemini CLI …）或工具，只要按本文档
> 声明「什么算好」并产出符合本文档的验证结果与证据，即可互认。
> 参考实现：Ming Capability Pack 的 `src/capabilities/protocol.ts`、
> `src/capabilities/verifier.ts`、`src/services/evidence-collector.ts`（本规范的下游实现，非规范本身）。

## 0. 为什么需要它

AI Agent 执行任务的瓶颈已经从「怎么做到」转移到「**做到什么、什么算好、怎么证明做对了**」：

1. 模型越来越强，但「对你来说什么算好」永远是人的偏好，模型不会自动知道；
2. 模型会自信地「宣布完成」——完成与否不能由执行者自证，需要独立、可复核的证据；
3. 生态里已出现多个互不兼容的「验证」实现（本协议、kimi-atlas、skill-output-gate、dsh-verify 等），
   同一件事在宿主 A 和宿主 B 上的验收不可互通——这正是本协议要解决的结构性问题。

本协议把「一个任务交付合格的标准」从实现里抽出来，变成**可声明、可校验、可版本化、可跨宿主消费**的语言。

## 1. 核心概念

| 概念 | 英文 | 定义 |
| --- | --- | --- |
| 任务方案 | Task Recipe | 一个「可交付任务」的完整定义：触发场景、执行指引、验收断言、质量门槛、常见坑。**方案声明「什么算好」，执行器负责「怎么做到」。** |
| 验收断言 | Verification Check | 一条可独立检查的硬事实（文件存在 / 内容匹配 / 浏览器行为…）。断言是方案的一部分，在执行结束后由独立验证器执行，不依赖执行者自述。 |
| 质量门槛 | Quality Bar | 主观质量标准的声明（第一轮交付就达到的水平），与硬断言互补。硬断言验证「做没做」，质量门槛定义「好不好」。 |
| 验证结果 | Verification Result | 单条断言的执行结果，三态：`passed` / `failed` / `skipped`。 |
| 证据卡 | Evidence Card | 一次交付的不可变记录：目标指纹 + 发起方 + 方案 + 验证结果 + 产物。可回查、可审计。 |
| 验收指标 | Metrics | 从证据卡沉淀的聚合指标（通过率、真执行验证通过数 VTE），用于回答「这个方案历次交付靠不靠谱」。 |

## 2. 协议版本

```
ACCEPTANCE_PROTOCOL_VERSION = 1
```

- 协议结构发生**不兼容**变更时 +1（新增必填字段、重命名、改变语义）。
- 证据卡与验收历史必须记录产出自己的协议版本号，用于未来迁移与追溯。
- 兼容新增（新增可选字段、新增断言 kind）不 bump 主版本，但要在变更记录中登记。

## 3. 验收断言语言（v1 支持 5 种 kind）

一条断言是一个 JSON 对象，`kind` 必填。其余字段按 kind 而定。

```json
{ "kind": "file_exists",   "pattern": "index.html" }
{ "kind": "content_match", "pattern": "report.md", "contains": "结论：通过" }
{ "kind": "content_absent", "pattern": "**/*.html", "mustNotContain": "default.css" }
{ "kind": "dir_nonempty",  "pattern": "site/assets" }
{ "kind": "browser_acceptance", "spec": "acceptance/spec.json" }
```

| kind | 语义 | 必填参数 | 说明 |
| --- | --- | --- | --- |
| `file_exists` | 匹配的文件存在 | `pattern`（glob，含 `*.ext` 尾缀与 `**/` 递归） | 最基础的「产物在不在」 |
| `content_match` | 匹配文件的内容包含指定文本 | `pattern` + `contains` | 验证「内容对不对」 |
| `content_absent` | 匹配文件的内容**不**含指定文本 | `pattern` + `mustNotContain` | 负向验证：禁止内容（水印、占位符） |
| `dir_nonempty` | 目录下有文件 | `pattern` | 验证「产出了东西」 |
| `browser_acceptance` | 真实浏览器验收 | `spec`（dsh-verify 规格 JSON 的路径或 URL） | 验证「点了按钮有没有反应」这类文件断言验证不了的行为。**可选能力**：执行宿主未装配对应浏览器验收工具时，该断言标记 `skipped`（见 §4） |

每条断言可选带 `note`（人话说明这条在验什么，供展示给用户看）。

### 3.1 断言校验规则

- `kind` 必须是上表 5 种之一，否则协议不合法（fail-fast，在进入执行前就报错，不许拖到执行期崩）；
- 非 `browser_acceptance` 的断言必须有非空 `pattern`；
- `content_match` 必须有非空 `contains`；`content_absent` 必须有非空 `mustNotContain`；
- `browser_acceptance` 必须有非空 `spec`，且不适用 `pattern`（用错不算合法）。

## 4. 验证结果三态语义（诚实红线的落点）

一条断言的验证结果是三态之一：

| 状态 | 含义 | 对交付的影响 |
| --- | --- | --- |
| `passed` | 断言成立，事实确认 | 计为通过 |
| `failed` | 断言不成立，事实否定 | 计为失败（默认阻塞交付，除非调用方降级） |
| `skipped` | **未执行**——断言依赖的外部能力未装配（如 `browser_acceptance` 缺 dsh-verify） | **不计入通过，也不计入失败**；必须如实标注「未执行」 |

三条铁律：

1. **绝不谎报通过**：未执行（skipped）或失败（failed）在任何情况下都不得显示为「通过」。
2. **跳过 ≠ 失败**：skipped 不阻塞交付（否则在缺外部验收工具的默认环境里，交付会被不可用的断言卡死）；但显示时必须以 ⏭️ 等符号与「未执行」字样明确区分于 ✅/❌。
3. **结果可聚合**：汇总 = 通过的条数、失败的条数、跳过的条数；`failed + passed + skipped === 断言总数`。

### 4.1 小结格式（参考）

```
通过 2 / 3（跳过 1 项——外部验收能力未装配，未执行）
✅ 检查文件「index.html」存在
❌ 检查「report.md」包含「结论：通过」
⏭️ 真实浏览器验收「spec.json」（未执行）
```

## 5. 质量门槛（Quality Bar）

与硬断言互补的「主观质量标准」，三字段：

```json
{
  "bar": "第一轮交付就是拿得出手的成品：首屏目标清晰、无默认模板痕迹、能在浏览器正常打开",
  "checks": ["视觉/内容/交互/适配逐条要求"],
  "selfCheck": ["交付前必须自查的清单（全过再汇报完成）"]
}
```

- `bar`：一句话定位「第一轮交付是什么水平」，注入执行者 prompt，直接决定产出预期；
- `checks`：具体可检查的质量要求；
- `selfCheck`：执行者交付前必须逐条自查的清单。
- 方案可不声明质量门槛（视为合法）；声明了就必须满足三字段结构。

## 6. 证据卡（Evidence Card）schema

一次交付完成后，产出不可变证据卡。最小 schema：

```json
{
  "protocolVersion": 1,
  "goal": "用户原始目标（自然语言）",
  "goalHash": "目标 SHA-256 指纹（检测目标被篡改）",
  "source": "发起方（auto / plan / manual…）",
  "recipeId": "命中的任务方案 id（可为 null）",
  "timestamp": "ISO 时间戳",
  "artifacts": ["产物路径"],
  "verification": {
    "passed": 2,
    "failed": 0,
    "skipped": 1,
    "results": [ { "check": { "kind": "file_exists", "pattern": "index.html" }, "passed": true, "detail": "匹配 1 个文件" } ]
  }
}
```

- `goalHash` 用于检测「证据卡描述的目标」是否被注入篡改；
- 证据卡应当以追加（append-only）方式沉淀到历史，供指标聚合与人工回查。

## 7. 验收指标（v1 只定义两个）

| 指标 | 定义 | 用途 |
| --- | --- | --- |
| 方案通过率 | 该方案历次验收的 `passed / (passed + failed)`（skipped 不计） | 回答「这个方案靠不靠谱」 |
| VTE（真执行验证通过数） | 某月内整次任务验收 `failed === 0` 的交付次数 | 北极星：真实交付的健康度，而非「模型嘴上说过」 |

## 8. 跨宿主消费方式

本协议不关心谁执行、谁验证，只定义「声明的形状」与「结果的形状」：

1. **方案声明**：任何宿主把任务方案（含 `verification` + `qualityBar`）按 §3/§5 表达；
2. **独立验证**：任何宿主在交付后调用符合本协议的验证器（本规范参考实现，或 dsh-verify 等外部验证器）执行断言；
3. **证据沉淀**：按 §6 追加证据卡；
4. **指标消费**：任意查询工具按 §7 聚合。
5. **方案出口**：任务方案可导出为 Agent Skills（SKILL.md）标准形态——SKILL.md 的正文把验收断言转成人话清单（见参考实现 `src/capabilities/skill-md.ts`），宿主加载后即可理解「什么算好」。

## 9. 演进规则

- 主版本 bump 只发生在不兼容变更；每个版本号必须能在证据卡里被追溯；
- 新增断言 kind 属兼容变更，但必须在本文档 §3 表格登记后实现；
- 实现与规范冲突时，以本规范为准并修复实现。

## 10. 变更记录

- **v1（2026-08）**：初版——5 种断言 kind、三态语义、质量门槛、证据卡 schema、通过率 + VTE 指标。
