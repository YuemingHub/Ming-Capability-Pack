# Ming Capability Pack

**用自然语言，一键调用 Harness 原生能力，真正把事做完。**

> 任何一个人，只要用自然语言描述「想做什么」，剩下的技术部分由 Ming 和 Harness 完成。

## 这是什么

Ming 是 DeepSeek Harness 的一个薄插件。它**不重复造轮子**——不自己实现意图理解、
步骤规划、任务执行，而是把这些全部转交给 Harness 原生 Agent（自带 LLM 与工具），
让它真正去执行并产出文件。Ming 只做一件事：**把「你的自然语言目标」一键转交给
原生 Agent，再把结果和证据整理给你**。

- ✅ 真正完成任务：写文件、跑命令、生成网页、处理数据、自动化工作流……
- ✅ 产出真实文件，而不是只给建议
- ✅ 每次执行自动留一张证据卡（做了什么、产出了什么）

## 安装

### 前置条件

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- 安装只需要 `dsh` 命令；Node.js 仅在从源码构建时需要

### 方式一：npm（推荐）

```bash
dsh plugin --profile web add @mingworkbench/capability-pack
```

### 方式二：从 GitHub 安装

```bash
dsh plugin --profile web add github:YuemingHub/Ming-Capability-Pack
```

### 方式三：本地源码安装（开发者）

```bash
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
dsh plugin --profile web add ./Ming-Capability-Pack
```

> `--profile` 可以是任意 profile 名（`web` / `tui` / `headless`），
> 取决于你想在哪个 Harness 界面里用 Ming。装完重启 Harness 生效。

### 常见问题：`dsh` 不在 PATH

桌面版 Harness 的 `dsh` 没有注册成全局命令。用 `node` 直接运行它，并设置
`DSH_HOME` 指向你的 Harness 数据目录（包含 `profiles/` 的那个目录）即可：

```bash
# 1. 找到 dsh CLI —— 在 Harness 安装目录的 node_modules 里，例如：
#    <Harness 安装目录>/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js

# 2. 设置 DSH_HOME
export DSH_HOME="<你的 Harness 数据目录>"        # macOS / Linux
# Windows PowerShell:
# $env:DSH_HOME = "<你的 Harness 数据目录>"

# 3. 安装
node "<第 1 步找到的 bin.js 路径>" plugin --profile web add @mingworkbench/capability-pack
```

## 使用

安装并重启 Harness 后，直接在对话里用自然语言描述你想做的事：

```
我：帮我把这个月的账单整理成一个表格，并算出总支出。
Ming：✅ 完成！已生成 D:/.../账单汇总.csv，总支出 ¥4,213.50

我：给我做一个摄影作品集网站。
Ming：✅ 完成！网站已生成 D:/.../portfolio/index.html
```

任何能描述的任务都可以：生成网站、处理图片/数据、整理文件、写文档、跑自动化脚本……

每次执行后，Ming 会在工作目录下生成一张证据卡（`ming-evidence/evidence-*.json`），
记录这次的目标、执行方式、产出文件清单和下一步建议。

## 工作原理

```
自然语言目标
      ↓
ming_auto 工具（Ming 的入口，一键转交）
      ↓
Harness 原生子代理（理解 + 规划 + 执行）
      ↓
真实产物（文件 / 网页 / 脚本 / 数据）
      ↓
证据卡（ming-evidence/*.json）
```

核心原则：**不重复造轮子**。意图理解、步骤规划、任务执行全部复用 Harness 已具备的
能力，Ming 只是一个薄薄的适配层，负责「接收自然语言 → 转交原生 Agent → 收集结果」。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 插件入口，注册 `ming_auto` 工具 |
| `src/tools/ming-auto.ts` | 工具定义（goal + resources → 结构化结果） |
| `src/services/executor.ts` | 薄转发器：调用原生子代理执行 |
| `src/services/evidence-collector.ts` | 写证据卡 |
| `src/types.ts` | 类型定义 |
| `cordis.patch.yml` | bundle patch 层（让 `dsh plugin add` 识别并激活本插件） |

## 开发

```bash
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
cd Ming-Capability-Pack
npm install       # 安装依赖
npm run build     # 构建（产出 dist/）
npm run typecheck # 类型检查
```

详见 [DEVELOPMENT.md](DEVELOPMENT.md) 与 [DESIGN.md](DESIGN.md)。

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT License - 详见 [LICENSE](LICENSE)。
