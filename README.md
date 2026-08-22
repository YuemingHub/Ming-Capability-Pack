# Ming Capability Pack

**用自然语言，一键调用 DeepSeek Harness 原生能力，真正把事做完。**

> 任何一个人，只要用自然语言描述「想做什么」，剩下的执行交给 Harness 原生子代理，
> 产出真实文件 + 证据卡。

## 它解决什么问题

Harness 已经很强（LLM + 工具 + 子代理），但普通用户面对空白对话框，
往往不知道该怎么把「想做的事」变成「真正被执行」。

Ming 只做一件事：**把自然语言一键转交给 Harness 原生能力真正执行**，
不重复造轮子，不给模糊建议，只交付真实产物。

## 安装

### 前置条件

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（桌面版或 CLI 版）
- 有 `dsh` 命令，或能找到 `dsh/lib/bin.js` 的绝对路径
- Node.js >= 22（Harness 自带即可，无需额外安装）

### 方式一：从 GitHub 安装（推荐）

```bash
# 把插件加到指定 profile（web / headless / 自定义名均可）
dsh plugin --profile <profile名> add github:YuemingHub/Ming-Capability-Pack
```

安装后**重启 Harness** 使 `ming_auto` 工具生效。

### 方式二：本地源码安装（开发者 / 离线环境）

```bash
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
cd Ming-Capability-Pack
npm install
npm run build

# 把当前目录作为插件源添加到 profile
dsh plugin --profile <profile名> add "$(pwd)"
```

### 方式三：DSH_HOME  profile 直装（高级）

在 Harness 数据目录下手动建立 profile 骨架（适合 CI / 自定义部署）：

```bash
# 1. 创建 profile 目录
mkdir -p "$DSH_HOME/profiles/ming"

# 2. 写入 profile package.json（声明 bundles 加载顺序）
cat > "$DSH_HOME/profiles/ming/package.json" <<'EOF'
{
  "name": "profile-ming",
  "dsh": {
    "bundle": {
      "layers": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-headless",
        "@mingworkbench/capability-pack"
      ]
    }
  }
}
EOF

# 3. 把本仓库的 dist/ 拷到 profile 的 node_modules
mkdir -p "$DSH_HOME/profiles/node_modules/@mingworkbench"
cp -r "/path/to/Ming-Capability-Pack" "$DSH_HOME/profiles/node_modules/@mingworkbench/capability-pack"
```

## 快速开始

### 在 Harness 对话框里使用（推荐日常使用）

启动 Harness 并指定 profile：

```bash
dsh --profile <profile名>
```

然后在对话框直接用自然语言描述任务：

```
我：帮我统计当前目录下所有 .md 文件的总行数
我：在桌面创建一个 index.html，展示一张简单的欢迎页
我：把 downloads/ 里超过 30 天的文件整理到 archive/
```

Ming 会自动调用 `ming_auto` 工具，把任务交给原生子代理执行，
完成后汇报做了什么、产出了哪些文件、证据卡在哪里。

### 用 CLI 包装器直接执行（适合脚本 / 自动化）

仓库自带 `bin/ming` / `bin/ming.cmd` / `bin/ming.js`，
可以把自然语言任务一键转发给 Harness：

```bash
# Unix / Git Bash
./bin/ming "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"

# Windows CMD / PowerShell
bin\ming.cmd "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"

# 指定 profile（默认是 ming）
DSH_PROFILE=web ./bin/ming "整理当前目录文件"

# 指定 dsh bin.js（当自动查找失败时）
DSH_BIN="E:/claw/DSH Desktop/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" ./bin/ming "帮我做个列表"
```

CLI 等价于把这句话喂给 Harness：

```bash
node "$DSH_BIN" --profile <profile名> "请调用 ming_auto 工具：<你的任务描述>"
```

### Headless 一次性任务（适合验证 / CI）

不进入交互界面，直接跑完退出：

```bash
dsh --profile <profile名> "请调用 ming_auto 工具：创建一个 hello.html，内容为 <h1>Hello Ming</h1>"
```

## 验证安装

### 交互式验证

```bash
dsh --profile <profile名>
```

输入：

```
请调用 ming_auto 工具：在当前目录创建 hello.html，内容为 <h1>Hello Ming</h1>
```

看到类似输出说明成功：

```
✅ 完成！
产出：
  - d:\openAI\dsh\hello.html
证据卡：
  - d:\openAI\dsh\ming-evidence\evidence-*.json
```

### CLI 冒烟验证

```bash
./bin/ming "在当前目录创建 hello.html，内容为 <h1>Hello Ming</h1>"
```

### 开发者：npm scripts

```bash
npm run typecheck   # TypeScript 类型检查
npm run build       # 构建 dist/
npm run smoke       # 冒烟：typecheck + build + 可选真机验证
```

`npm run smoke` 会先跑 `typecheck` 和 `build`，若配置了 `DSH_HOME` 与 `DSH_BIN`，
还会追加一次 headless 真机调用，确认 `ming_auto` 真正产出文件。

## 工作原理

```
自然语言目标
      ↓
ming_auto 工具（Ming 的薄转发入口）
      ↓
Harness 原生子代理（理解 + 规划 + 执行，自带 LLM 与工具）
      ↓
真实产物（文件 / 网页 / 脚本 / 数据）
      ↓
证据卡（ming-evidence/*.json）
```

核心原则：**不重复造轮子**。意图理解、步骤规划、任务执行全部复用 Harness 已具备的
能力，Ming 只是一个薄薄的适配层，负责「接收自然语言 → 匹配方案 → 装配能力 → 转交原生 Agent → 独立验证」。

### 方案包（Recipe）：自动装配

Ming 内置若干「方案包」：每个方案声明「触发场景 + 需要的技能/工具 + 验收断言」。
用户描述目标后，`ming_auto` 自动完成五步：

1. **匹配方案**：目标命中触发词即选中对应方案（也可用 `ming_catalog` 查看全部方案后，通过 `recipe` 参数显式指定）；
2. **装配**：把方案的方法论注入执行子代理，并诚实标注尚未装配的能力缺口（不假装已装配）；
3. **执行**：交给 Harness 原生子代理真正完成（未命中方案时退回通用委派）；
4. **验证**：执行结束后对方案声明的断言（文件存在 / 内容匹配 / 目录非空）做独立检查，不把「声称产出」当「确认产出」；
5. **留证**：命中的方案与验证结果一并写入证据卡。

### 先给选择，不连环追问

用户只说了目标（如「我想做个个人网站」）时，Ming 不立刻追问细节，
而是先由 `ming_plan` 给出两条执行策略让用户挑：

| 策略 | 行为 | 中间件调用链 |
| --- | --- | --- |
| `mvp-first`（推荐） | 用方案声明的默认值直接做，先出能看的 MVP，看完再迭代 | resolve → assemble(默认值) → execute → verify → evidence |
| `clarify-first` | 用 `ming_clarify` 对话式核对：缺什么问什么，把用户的大白话翻译成系统逻辑，信息够了就做 | resolve → 多轮澄清(翻译) → assemble(带答案) → execute → verify → evidence |

两条链都汇入 `ming_auto` 执行，区别只在装配上下文是否注入用户答案；
即使用户不回答澄清问题，`clarify-first` 也会用默认值兜底，绝不卡住等用户。

**翻译层**：用户不懂技术，Ming 替他翻译。每个方案声明「决策点 + 翻译提示」：
用户说「我想展示摄影作品」→ 翻译成「作品集结构（首页 + 分类 + 详情）」；
用户说「文艺一点」→ 翻译成「浅色背景 + 衬线字体 + 大图留白」。
澄清过程中用户随时可以说「你看着办」——用默认值兜底，信息够了立刻开始做。

当前内置方案：

| 方案 id | 名称 | 触发词示例 |
| --- | --- | --- |
| `tidy-downloads` | 整理下载/工作文件夹 | 整理、归档、分类、下载、清理 |
| `html-report` | 生成图文 HTML 报表 | 报表、周报、报告、html、网页、图表 |
| `personal-site` | 搭建个人网站/主页 | 个人网站、个人主页、作品集、portfolio、做网站、建站 |

方案以官方基础能力为主；社区插件（skill / MCP）自动装配是下一步重点，
方案里已预留 `source`（npm / GitHub）与安装指引。

## 递归防护

为了防止子代理无限委派，Ming 做了两层硬隔离：

1. **工具层**：子代理启动时传 `toolFilter: { deny: ['ming_auto'] }`，子代理的工具列表里根本看不到 `ming_auto`。
2. **提示词层**：prompt 明确要求"不要调用 ming_auto，也不要再次把任务转交他人"。

## 可靠性机制

v0.5 起在「薄转发」之外补了三件可靠性小事：

1. **资源预检**：`resources` 里长得像本地路径的资源会先做存在性检查，路径不存在时直接失败并说明缺哪个文件，不浪费一整轮子代理执行。
2. **执行超时**：默认 15 分钟。超时会中止子代理并如实上报（证据卡记录 `errorKind: timeout`）。可用环境变量调整：

   ```bash
   # 单位毫秒；例如调成 30 分钟
   MING_TIMEOUT_MS=1800000
   ```

3. **产物校验**：子代理汇报完成后，Ming 会对其中的本地路径逐项 `stat` 验证，结果写入证据卡的 `artifactChecks`（存在 / 大小 / 修改时间）；汇报里有但磁盘上没有的路径，会在结果摘要中附上「⚠️ 校验提醒」，不把「声称产出」当「确认产出」。

失败原因按 `errorKind` 分类（`engine-unavailable` / `resource-missing` / `timeout` / `aborted` / `max-tokens` / `refusal` / `error`），并给出针对性的下一步建议。

## 历史查询

除 `ming_auto` 外还内置 **`ming_history`** 工具：读取工作区 `ming-evidence/*.json`，
汇总最近的任务记录（时间 / 目标 / 成败 / 产物数 / 校验情况 / 耗时）。

在对话框里直接说「Ming 最近做过什么」「帮我找一下之前生成的文件」即可触发。

## 社区插件市场（1024Store）

除官方方案外，Ming 内置 **`ming_store_search`** 工具：搜索 DSH 社区插件市场
（[1024Store](https://api.deepseek1024.com)，DeepSeek Harness 插件的公开目录）——
当用户要求的能力本机尚未装配（如缺少某个文档解析、Office 处理插件）时，
用它找到「市场上真实存在、可安装」的插件，返回官方 `dsh plugin add` 安装命令，
交用户确认后装配；装好后再让 Ming 重跑目标即可复用。本工具只搜索与呈现，不执行安装。

匿名即可使用；GitHub 登录创建 API Key 可获更高配额，可选配置：

```bash
export MING_STORE_KEY=dsh_live_xxxx   # 可选；不配置则匿名请求
```
只读工具，不会执行新任务、也不会产生新证据卡。

## 项目结构

| 文件 / 目录 | 职责 |
| --- | --- |
| `src/index.ts` | 插件入口，注册工具 + 注入 systemPrompt |
| `src/capabilities/` | 能力织机：Recipe 方案目录、Resolver、Assembler、Verifier |
| `src/capabilities/planner.ts` | 策略选择：先跑 MVP / 先对齐需求 + 澄清问题解析 |
| `src/capabilities/store.ts` | 1024Store 客户端（能力目录外部事实源，网络失败优雅降级） |
| `src/tools/ming-plan.ts` | `ming_plan` 工具：先给选择（匹配方案 + 策略选项 + 澄清问题） |
| `src/tools/ming-clarify.ts` | `ming_clarify` 工具：对话式核对（缺什么问什么，翻译用户的话） |
| `src/tools/ming-auto.ts` | `ming_auto` 工具定义（目标 + strategy/answers → 方案匹配 → 委派 → 独立验证） |
| `src/tools/ming-catalog.ts` | `ming_catalog` 工具：查看内置方案包 |
| `src/tools/ming-store.ts` | `ming_store_search` 工具：搜社区插件市场给安装命令 |
| `src/tools/ming-history.ts` | `ming_history` 工具定义（读取证据卡汇总历史） |
| `src/services/executor.ts` | 薄转发器：预检 → 带超时委派子代理 → 产物校验 |
| `src/services/evidence-collector.ts` | 写证据卡 |
| `src/services/next-steps.ts` | 失败分类建议 + 校验提醒拼接（纯函数） |
| `src/types.ts` | 类型定义 |
| `src/internals.ts` | 内部纯函数导出面（供单元测试复用） |
| `bin/ming.js` | 跨平台 Node CLI 包装器 |
| `bin/ming` | Unix shell 包装器 |
| `bin/ming.cmd` | Windows CMD 包装器 |
| `cordis.patch.yml` | bundle patch 层（让 `dsh plugin add` 识别并激活本插件） |
| `scripts/smoke.js` | 冒烟验证脚本 |
| `test/` | 单元测试（node:test，零依赖） |

## 开发

```bash
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
cd Ming-Capability-Pack
npm install
npm run build
npm run typecheck
npm test
npm run smoke
```

## 常见问题

### `dsh` 不在 PATH

桌面版 Harness 的 `dsh` 没有注册成全局命令。直接用 Node 运行 bin.js：

```bash
node "E:/claw/DSH Desktop/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile ming "你的任务"
```

或设置 `DSH_BIN` 环境变量后使用 `bin/ming`：

```bash
export DSH_BIN="E:/claw/DSH Desktop/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js"
./bin/ming "你的任务"
```

### `DSH_HOME` 在哪

Harness 数据目录，默认：

- Windows：`%USERPROFILE%\.dsh`
- macOS / Linux：`~/.dsh`

里面包含 `profiles/` 和 `profiles/node_modules/`。

### 子代理会不会无限递归

不会。见上方「递归防护」。

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT License - 详见 [LICENSE](LICENSE).
