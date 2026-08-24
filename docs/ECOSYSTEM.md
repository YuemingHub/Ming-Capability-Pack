# 生态对比与差异化定位（ECOSYSTEM）

> 本文档回答一个战略问题：**在 GitHub 已有的宿主、标准、插件生态面前，Ming Capability Pack 还有没有必要存在？**
> 结论先行：**有，但必须收窄**——从「什么都能做的能力包」收窄为「方案层 + 交付体验层」，并主动复用生态已有能力，只在真正空白的点上投入。
>
> 调研时点：2026-08-24，star 数为当日 GitHub API 实测值，会随时间变化。

---

## 1. 生态全景（四层）

### 1.1 宿主层：`deepseek-ai/deepseek-harness`（190k★）

DeepSeek Harness（`dsh`）——「Everything is a Plugin」，基于 Cordis。宿主**原生提供**：

- 插件注册 / 生命周期 / 配置（Cordis）
- 子代理执行（subagents）
- 工具注册（tools + systemPrompt）
- 插件市场与安装（`dsh plugin add`，`dsh-market/dsh-market` 可视化市场）
- Web UI / 会话 / 历史

**含义**：我们 `index.ts` 的注册层、`executor.ts` 的委派层、安装命令，都是对宿主能力的薄封装。这是标准用法，不是罪，但也不构成价值。**不在这层投入**。

### 1.2 标准层：Agent Skills（`anthropics/skills` 171k★ + agentskills.io）

Skill 已成为跨宿主事实标准：一个文件夹 + `SKILL.md`（YAML frontmatter：`name` + `description` + 指令 + 资源），Claude Code / Codex / Gemini CLI / 各类 agent 通用。

**含义**：技能包载体不再需要私有格式。若我们的方案只是「教模型怎么做的指令」，就必须用 SKILL.md 表达（可移植、可跨宿主、符合生态）。

### 1.3 独立项目层：验证 / 质量门已是热门赛道

| 项目 | 定位 | 与我们的重叠 |
|---|---|---|
| `null0xxx/kimi-atlas`（251k★） | 多智能体质量校准编排器：**6-lens 确定性验证门（不让 LLM 判 pass/fail）**、115 个 vendored 官方 skills、状态机 + forward-only rollback、ContextGraph | **高**——「确定性独立验证」是它的核心哲学，与我们的 `verifier`（不依赖 LLM 判通过）几乎同构 |
| `ma-nucho-pro/supervisorLLM` | 通用多 agent 质量门：research / test / Red Team / verify / judge | 中高 |
| `rogerchappel/skill-output-gate` | 产出预检：evidence + verification + handoff 质量 | 中高 |

### 1.4 DSH 插件层：验证/装配类已有多个实现

- **验收/验证**：`dsh-stage-gate`（gate_open/check/list/close 验收治理）、`263311487-ux/dsh-verify`（真实 Chromium 浏览器验收）、`Viger1/dsh-preview`（无头浏览器验证）、`jinguanghai/...forge-gates`（真实计算验证门）、`TaurenMountain/dsh-llm-as-a-verifier`（LLM 验证）、`bwndlct/dsh-session-audit`（会话验证信号审计）
- **能力装配**：`klarkxy/dsh-plugin-autoevo`——**复用优先**：发现并审查 DSH 插件、安装前一次性确认、验证真实工具往返、最小适配——与我们的 `dispatch.ts` 高度同主题

---

## 2. 重叠区：生态已覆盖，该复用的（别再造）

| 我们的现状 | 生态已有 | 收窄后的处置 |
|---|---|---|
| `verifyChecks`（file_exists/content_match/content_absent/dir_nonempty） | 通用做法 + `dsh-verify`/`dsh-preview`（浏览器级）、`forge-gates`（计算级） | **保留**基础断言（方案级验收需要），**吸收**浏览器/计算级验证改为对接生态插件 |
| `dispatch.ts` 能力装配（curated/市场兜底） | `dsh-plugin-autoevo` 的 reuse-first | **参考/对齐**：复用「安装前一次性确认 + 验证真实工具往返」的设计，避免重复造 |
| Recipes 私有格式（`recipes.ts`） | SKILL.md 标准 | **改造**：方案包出口对齐 SKILL.md（frontmatter + 指令 + 资源），内部保留匹配规则与验收协议 |
| 插件市场/安装命令 | 宿主 `dsh plugin add` + `dsh-market` | **直接用**，不再发明 |

---

## 3. 差异区：生态里没有的（这才是存在的理由）

1. **「自然语言 → 方案」的意图分流层**
   模糊需求（「帮我做个团队知识库系统」「我接手一个项目看不懂」）→ 匹配**结构化方案**（含匹配规则、澄清翻译、双模式分流 big-project / personal-site）。
   Skills 生态只有「描述匹配」，没有「方案 + 工作流 + 验收标准 + 依赖装配」的组装概念。这是独有空白。

2. **方案级「什么算好」的声明式验收协议**
   带 schema 版本（`ACCEPTANCE_PROTOCOL_VERSION`）、静态校验 fail-fast（`protocol.ts`）、质量门槛（`qualityBar`）；配套**证据卡 provenance**（goalHash/source/recipeId）与 **VTE 北极星**（验收历史持续聚合指标）。
   生态里的验证项目解决「怎么验证」，没有解决「一次交付的完整验收标准长什么样、如何版本化演进、如何沉淀为可查询的信任资产」。

3. **面向小白用户的完整交付体验**
   策略选择（mvp-first / clarify-first）、大白话澄清翻译、多步暂停确认（orient 交底 → 等确认 → resumeFrom 续跑）、失败坑位指引、社区能力「回确认」才装。
   kimi-atlas 是给工程师的编码编排器；我们是给普通用户的任务中间件。**受众与交互深度不同**。

---

## 4. 收窄后的定位宣言

> **Ming = DSH 上的「方案层 + 交付体验层」。**
> 不造宿主已有的一切（插件机制、子代理、市场、安装）；
> 不造生态已有的单点能力（浏览器验证、计算验证、通用质量门、reuse-first 装配）；
> 只做三件事：
> ① 把模糊意图分流到**结构化方案**（含双模式 big-project）；
> ② 给每个方案定义**可版本化、可验证、可追溯的验收协议**（证据卡 + VTE）；
> ③ 把这一切包装成**小白用户能跟上的交付对话**（暂停/确认/续跑/坑位指引）。

---

## 5. 落地路线（按顺序）

1. **吸收**：验证执行对接生态能力——浏览器级用 `dsh-verify`/`dsh-preview`，计算级用 `forge-gates`；本仓库 `verifyChecks` 保留为方案级基础断言，作为 fallback。
2. **对齐**：方案包出口对齐 SKILL.md——`recipes.ts` 增加「导出为 SKILL.md」能力（frontmatter + 指令 + 资源清单），内部匹配规则/验收协议保持不变；实现跨宿主可移植。
3. **参考**：`dispatch.ts` 对齐 `dsh-plugin-autoevo` 的 reuse-first 设计（发现 → 一次性确认 → 验证真实工具往返 → 最小适配），不再重复发明。
4. **只保留**：方案编排层、验收协议 + 证据卡 + VTE、小白交付体验 三块核心，其余让位给生态。

---

## 6. 参考链接

- 宿主：https://github.com/deepseek-ai/deepseek-harness
- Agent Skills 标准：https://github.com/anthropics/skills · https://agentskills.io
- 独立同类：https://github.com/null0xxx/kimi-atlas · https://github.com/ma-nucho-pro/supervisorLLM · https://github.com/rogerchappel/skill-output-gate
- DSH 插件目录：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin · https://github.com/dsh-market/dsh-market
- 验证/装配类插件：`dsh-stage-gate` · `263311487-ux/dsh-verify` · `Viger1/dsh-preview` · `jinguanghai/deepseek-harness-forge-plugins#forge-gates` · `klarkxy/dsh-plugin-autoevo`
