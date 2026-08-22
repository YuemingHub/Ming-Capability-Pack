# 开发指南

## 快速开始

### 前提条件

- Node.js 22+ 或 24+
- npm 或 pnpm
- DeepSeek Harness（用于真机测试）

### 安装依赖

```bash
npm install
```

### 构建 / 类型检查

```bash
npm run build        # 构建 dist/
npm run typecheck    # 类型检查
npm run dev          # 监听模式（开发用）
```

## 项目结构

```
Ming-Capability-Pack/
├── src/
│   ├── index.ts                    # 插件入口（name / inject / apply）
│   ├── types.ts                    # 类型定义
│   ├── services/
│   │   ├── executor.ts             # 薄转发器：调用原生子代理
│   │   └── evidence-collector.ts   # 写证据卡
│   └── tools/
│       └── ming-auto.ts            # ming_auto 工具定义
├── bin/
│   ├── ming.js                     # Node CLI 包装器（跨平台）
│   ├── ming                        # Unix shell 包装器
│   └── ming.cmd                    # Windows CMD 包装器
├── scripts/
│   └── smoke.js                    # 冒烟验证脚本
├── dist/                           # 构建输出
├── package.json
├── tsconfig.json
├── README.md
├── DESIGN.md
└── CONTRIBUTING.md
```

## 冒烟验证

```bash
# 基础冒烟（typecheck + build；跳过真机）
npm run smoke

# 真机冒烟（需要 Harness 环境）
DSH_HOME="C:\Users\Administrator\.dsh" DSH_BIN="E:/claw/DSH Desktop/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" npm run smoke
```

## CLI 直接调用

```bash
# 把自然语言任务直接交给 Harness 执行
node bin/ming.js "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"

# Unix shell（Git Bash / WSL / macOS / Linux）
./bin/ming "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"

# Windows CMD / PowerShell
bin\ming.cmd "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"

# 指定 profile（默认是 ming）
DSH_PROFILE=web ./bin/ming "整理当前目录文件"
```

CLI 等价于：

```bash
node "$DSH_BIN" --profile <profile名> "请调用 ming_auto 工具：<你的任务描述>"
```

## 真机测试

### 方式一：CLI 包装器（推荐开发用）

```bash
npm run cli -- "创建一个 hello.html，内容为 <h1>Hello Ming</h1>"
```

### 方式二：Harness 对话框

1. 构建并安装插件（见 README 「安装」章节）
2. 启动 Harness：

```bash
dsh --profile <profile名>
```

3. 在对话框输入：

```
请调用 ming_auto 工具：在当前目录创建 hello.html，内容为 <h1>Hello Ming</h1>
```

4. 验证三点：
   - 是否调用了 `ming_auto` 工具；
   - 是否派生了子代理真正执行（而非只回文案）；
   - 是否生成了产物文件与 `ming-evidence/*.json` 证据卡。

## 调试技巧

- 看 `apply` 里的日志确认工具是否注册成功；
- 看 `ming-evidence/*.json` 确认完整执行链路；
- 在 `executor.ts` 里加 `ctx.logger.debug(...)` 排查子代理调用与 stopReason。

## 发布流程

1. 更新版本：

```bash
npm version patch   # 或 minor / major
```

2. 构建并发布：

```bash
npm run build
npm publish --access public
```
