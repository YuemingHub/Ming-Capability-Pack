# 技术设计文档

## 设计原则

1. **不重复造轮子** — 意图理解、步骤规划、任务执行全部复用 Harness 原生能力，Ming 不另建引擎。
2. **一键适配** — 用户一句话 → 原生 Agent 真正完成，中间无需任何技术操作。
3. **可追溯** — 每次任务留一张证据卡。

## 架构

```
自然语言目标
      ↓
ming_auto（defineTool 注册的工具）
      ↓
executor（薄转发：ctx.subagents.start）
      ↓
Harness 原生子代理（LLM + 工具，真正执行）
      ↓
产出文件 + 证据卡
```

## 为什么不做自己的「意图分析 / 配方」引擎

Harness 原生的子代理本身就是完整的编码 Agent：它能理解自然语言、
自己拆步骤、用 bash / 读写 / 子代理等工具真正执行。再手写一套
「关键词意图分析 + 步骤配方目录」只会：

- **覆盖不全** —— 硬编码的规则永远落后于真实需求；
- **与原生 LLM 重复甚至冲突** —— 原生模型的理解能力远强于关键词匹配；
- **增加维护成本** —— 每类任务都要手写步骤清单。

所以 Ming 只做一件薄事：**把用户的话原样、完整地交给原生 Agent**。

## 关键实现点

### 1. 子代理调用（executor.ts）

```ts
const run = await ctx.subagents.start(provider, {
  label: `ming: ${goal}`,
  prompt: [{ type: 'text', text: buildPrompt(goal, resources, workdir) }],
  parent: exec.agent,      // 继承父级 Agent 上下文
  signal: exec.signal,     // 跟随外层取消
})
const result = await run.result   // { output, stopReason }
await run.dispose()
```

- provider 优先 `spawn`（全新子代理），回退 `fork`；
- `stopReason === 'completed'` 才算成功，否则返回可读的失败原因；
- 子代理不可用时降级为「计划模式」，把目标交回当前助手继续完成。

### 2. 工具注册（ming-auto.ts）

用 dsh-tools 的 `defineTool` 声明：

- `parameters`：`goal`（必填自然语言目标）+ `resources`（可选路径/URL）；
- `output.schema`：`success / mode / summary / artifacts / evidence / nextSteps`；
- `render`：把结构化结果渲染成中文摘要。

### 3. 证据卡（evidence-collector.ts）

每次任务写一张 JSON 到 `ming-evidence/evidence-<ts>.json`，记录目标、
资源与执行结果，便于追溯与验证。

## 能力装配闭环（v0.7 起）

方案声明的能力缺失时，不再「贴安装指引」了事，而是走一条可验证的闭环：

```
缺口（missingRequired）
      ↓
ming_install(mode=search)   → 1024Store 结构化候选（含「为什么配你」的匹配理由）
      ↓
主模型展示 → 用户选定（Ming 只提选项，不替用户决定）
      ↓
ming_install(mode=install)  → 解析「dsh plugin add」命令（parseInstallCommand 只接受该形态）
      ↓
spawn 执行（自动定位 dsh bin / profile，带超时）
      ↓
核对写入（profile package.json / node_modules，区分「已确认」与「需手动」）
      ↓
证据卡 + 「重启 DSH → 重跑目标」指引
```

安全红线：

- 只执行「dsh plugin add <source>」形态；市场返回的原始命令字符串**解析后用自己的参数重建**，绝不直接交给 shell；
- 安装永远等用户明确选定后才触发；搜索免费只读。

## 扩展点

- 想增强执行质量：调整 `buildPrompt()` 里的引导语；
- 想支持更多输入：在 `parameters` 里加字段；
- 想换执行后端：改 `executor.ts` 的 `execute()`。

## 安全考虑

- **密钥**：不保存、不硬编码任何凭据；执行能力来自 Harness 自身的沙箱与权限体系。
- **命令执行**：所有文件/命令操作由 Harness 原生子代理在既有权限边界内完成。
