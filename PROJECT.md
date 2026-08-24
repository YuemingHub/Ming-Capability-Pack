# 项目地图：Ming Capability Pack

> 本文档是项目的「活地图」——当前状态、结构、入口与验证方式。
> 历史决策与 tradeoff 见 `docs/EVOLUTION.md`；已知失败与教训见 `docs/FAILURES.md`。

## 项目是什么

Ming Capability Pack 是一个 DeepSeek Harness（DSH）插件，让普通用户通过**自然语言**一键调用 Harness 原生能力，真正完成并交付真实产物（文件、网页、脚本、数据等）。

核心价值不是「帮模型执行」，而是替用户定义「什么算好」：把用户的大白话翻译成系统逻辑，匹配方案包，装配能力，委派原生子代理执行，并独立验证结果。

护城河定位：**可信交付层**（质量门 + 独立验证 + 证据卡 provenance），而非执行层。

## 当前版本

- **版本**：v0.9.0（`package.json` + `src/index.ts` + 安装脚本同步）
- **测试**：175/175 全绿（`npm test`）
- **北极星**：VTE（月度真执行且验证通过任务数）+ MAP（月活 profile）

## 技术栈

| 类别 | 技术 / 工具 | 说明 |
| --- | --- | --- |
| 语言 | TypeScript | 源码语言，ESM 模块 |
| 运行时 | Node.js >= 22 | Harness 自带即可 |
| 构建 | tsup | 输出 dist/ |
| 测试 | node:test + node:assert/strict | 零依赖，*.test.mjs |
| 包管理 | npm | 仓库内用 npm scripts |
| CLI | bin/ming.js / bin/ming.cmd | 跨平台包装器 |

## 目录结构

```
Ming-Capability-Pack/
├── src/
│   ├── index.ts                 # 插件入口，注册工具 + 注入 systemPrompt
│   ├── internals.ts             # 内部纯函数导出面（供单元测试复用）
│   ├── types.ts                 # TypeScript 类型定义
│   ├── capabilities/            # 能力织机核心
│   │   ├── verifier.ts          # 验证器：formatVerification / verifyChecks
│   │   ├── planner.ts           # 策略选择 + 澄清问题解析
│   │   ├── resolver.ts          # 方案匹配 + 验收协议 fail-fast
│   │   ├── assembler.ts         # 装配上下文
│   │   ├── recommend.ts         # 推荐引擎
│   │   ├── recipes.ts           # 内置方案包
│   │   ├── dispatch.ts          # 能力缺口分发（curated/市场兜底，轻装配）
│   │   ├── protocol.ts          # 验收协议 v1（断言静态校验）
│   │   ├── skill-md.ts          # 方案包 → SKILL.md（Agent Skills 标准出口）
│   │   └── types.ts             # 能力域类型
│   ├── tools/                   # DSH 工具定义
│   │   ├── ming-auto.ts         # 执行 + 证据卡
│   │   ├── ming-plan.ts         # 规划 + 策略选择
│   │   ├── ming-clarify.ts
│   │   ├── ming-catalog.ts
│   │   ├── ming-store.ts
│   │   ├── ming-install.ts
│   │   ├── ming-history.ts
│   │   └── ming-acceptance.ts   # 验收健康度 + VTE 查询（只读）
│   └── services/                # 服务层
│       ├── executor.ts          # 薄转发器：预检 + 超时委派 + 产物校验
│       ├── installer.ts         # 安装服务
│       ├── workflow.ts          # 多步工作流执行器（resumeFrom 续跑）
│       ├── evidence-collector.ts # 证据卡 + provenance 溯源
│       ├── acceptance-log.ts    # 验收历史 JSONL 回填 + VTE 聚合
│       ├── browser-verify.ts    # 真实浏览器验收（dsh-verify，可选降级 skipped）
│       └── next-steps.ts        # 失败分类建议
├── docs/
│   ├── ECOSYSTEM.md             # 生态对比与差异化定位（战略依据）
│   ├── ACCEPTANCE_PROTOCOL.md   # 开放验收协议规范 v1（跨宿主，5-10 年资产）
│   ├── DELIVERY_EXPERIENCE.md   # 交付体验设计基准（5 次对话框架，人话词典）
│   ├── TASK_STANDARDS.md        # 领域任务标准库（策展机制 + 首批种子）
│   ├── EVOLUTION.md             # 演化记录（决策考古学）
│   └── FAILURES.md              # 已知失败与教训
├── dist/                        # 构建产物
├── test/                        # 单元测试（161 用例）
├── bin/                         # CLI 包装器
├── scripts/                     # 冒烟 / e2e / 安装脚本
├── ming-evidence/               # 验收历史数据（gitignored，不入库）
├── package.json                 # 项目配置 + scripts
├── tsconfig.json                # TypeScript 配置
├── tsup.config.ts               # 构建配置
└── README.md                    # 项目说明
```

## 入口

- **插件入口**：`dist/index.js`（注册 ming_plan / ming_auto / ming_acceptance 等工具）
- **内部函数导出**：`dist/internals.js`（暴露纯函数供测试复用）
- **CLI 入口**：`bin/ming.js` / `bin/ming.cmd`

## 如何运行与验证

```bash
npm install          # 安装依赖
npm run typecheck    # 类型检查（tsc --noEmit）
npm run build        # 构建 dist/（tsup）
npm test             # 全量测试（node --test，161 用例）
npm run e2e          # 双模式端到端闭环（mock 子代理，resolver/workflow/dispatch/市场全走真实代码）
npm run smoke        # 冒烟验证（真机 DSH_BIN/DSH_HOME 预留入口）
npm run cli          # CLI 入口
```

> 沙箱提示：本环境 `node --test` 默认 spawn 子进程会 EPERM，需用
> `node --test --test-isolation=none "test/*.test.mjs"`。`npm test` 已内置该参数。

## 核心机制

1. **方案包（Recipes）**：整理文件夹 / HTML 报表 / 信息图 / 演示文稿 / 个人网站 / 发布网站 / 大型复杂项目（big-project），每个带质量门槛与验收断言；可导出为跨宿主标准 SKILL.md。
2. **双模式 big-project**：从 0 开发（orient 交底暂停 → build → verify → deliver）与存量项目（修 bug / 加功能 / 迷茫给建议清单，不擅自改代码）。
3. **能力装配（轻装配）**：curated 官方能力自动装（用户无感）→ 社区能力一句确认 → 市场兜底（Marketplace 优先 + 1024Store 兜底），只给跑得通的命令（过滤 #path 不可装候选）；安装状态机 verified/pending/absent（未确认写入绝不报已装）；**通用缺口探测**：未命中方案时也从目标/资源推断可能需要的能力（视频/图片/表格/发布等），走市场找候选、社区源一句确认（forceConfirm 不自动装）；重型装配交给生态插件 dsh-plugin-autoevo。
4. **验收协议 v1**：verification / qualityBar 静态校验 fail-fast；每次独立验收追加 `ming-evidence/acceptance-history.jsonl`；`ming_acceptance` 查询各方案通过率与 VTE 北极星。
5. **证据卡 provenance**：goalHash（目标 SHA-256 指纹）+ source + recipeId，溯源可查。
6. **真实浏览器验收（可选）**：verification 支持 `browser_acceptance` 断言，对接 dsh-verify（JSON spec → 真实 Chromium → PASS/FAIL）；本机未装配时如实标记 skipped，不谎报通过、不阻塞交付。
7. **交付体验层**：完成时给「交付展示」（产出数 + 独立检查 + 证据可回查 + 请你过目），把验收判断权交还用户；完整设计基准见 `docs/DELIVERY_EXPERIENCE.md`（5 次对话框架）。

## 交付/部署

- **npm**：`@mingworkbench/capability-pack`（最新 0.9.0，`npm publish`）
- **GitHub**：`YuemingHub/Ming-Capability-Pack`（main 分支）
- **新人安装**：双击 `install-ming.cmd` 或复制 README 一键命令（走 npm 官方源/国内镜像）
