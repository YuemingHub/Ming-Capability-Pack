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
├── dist/                           # 构建输出
├── package.json
├── tsconfig.json
├── README.md
├── DESIGN.md
└── CONTRIBUTING.md
```

## 真机测试

1. 构建：

```bash
npm run build
```

2. 装到 Harness：

```bash
dsh plugin --profile web add @mingworkbench/capability-pack
```

3. 在 Harness Web UI 里说一句需求，观察三点：

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
