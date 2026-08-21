# 开发指南

## 快速开始

### 前提条件

- Node.js 22+ 或 24+
- pnpm 包管理器
- DeepSeek Harness（用于测试）

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 监听文件变化，自动重新编译
pnpm dev
```

### 构建

```bash
# 编译为生产版本
pnpm build
```

### 类型检查

```bash
pnpm typecheck
```

## 项目结构

```
Ming-Capability-Pack/
├── src/
│   ├── index.ts                    # 插件入口
│   ├── types.ts                    # 类型定义
│   ├── services/                   # 核心服务
│   │   ├── intent-analyzer.ts      # 意图分析
│   │   ├── plugin-selector.ts      # 插件选择（核心算法）
│   │   ├── plugin-installer.ts     # 自动安装
│   │   ├── orchestrator.ts         # 智能编排
│   │   └── evidence-collector.ts   # 证据收集
│   └── tools/
│       └── ming-auto.ts            # 工具注册
├── dist/                           # 编译输出
├── package.json
├── tsconfig.json
├── README.md
├── DESIGN.md                       # 技术设计文档
└── CONTRIBUTING.md                 # 贡献指南
```

## 开发工作流

### 1. 本地测试

在 DeepSeek Harness 项目中测试插件：

```bash
# 构建插件
cd Ming-Capability-Pack
pnpm build

# 链接到 Harness（开发模式）
cd /path/to/deepseek-harness
pnpm link ../Ming-Capability-Pack

# 在 Harness 配置中添加插件
echo "- name: '@mingworkbench/capability-pack'" >> cordis.patch.yml

# 启动 Harness
pnpm dsh web
```

### 2. 测试插件功能

在 Harness Web UI 中：

```
用户：我想做一个摄影作品集网站
```

观察 Ming 的执行流程：
1. 意图分析
2. 插件搜索
3. 自动安装
4. 执行编排
5. 证据收集

### 3. 查看日志

Harness 控制台会显示 Ming 的执行日志：

```
🚀 Ming Capability Pack 正在加载...
✅ 核心服务已注册
✅ Ming 工具已注册
🎯 Ming 开始处理任务: 我想做一个摄影作品集网站
🔍 步骤 1/5: 分析意图...
✓ 意图分析完成: website-generation
🔎 步骤 2/5: 搜索最佳插件组合...
...
```

## 核心开发任务

### 添加新的意图类型

1. 在 `src/types.ts` 中添加枚举值
2. 在 `INTENT_CAPABILITY_MAP` 中添加映射
3. 在 `CAPABILITY_SEARCH_KEYWORDS` 中添加搜索关键词

### 优化插件选择算法

修改 `src/services/plugin-selector.ts` 中的 `calculateScore()` 方法。

### 添加新的执行策略

扩展 `src/services/orchestrator.ts`，添加依赖分析、并行执行等。

## 调试技巧

### 1. 查看插件市场 API 响应

```bash
curl "https://api.deepseek1024.com/v1/plugins/search?q=website&limit=5"
```

### 2. 测试意图分析

在 `intent-analyzer.ts` 中添加日志：

```typescript
this.ctx.logger.debug('LLM 输出:', llmOutput)
this.ctx.logger.debug('解析结果:', parsed)
```

### 3. 测试插件评分

在 `plugin-selector.ts` 中添加日志：

```typescript
this.ctx.logger.debug(`插件 ${plugin.name} 评分: ${score}`)
```

## 常见问题

### Q: 如何调整插件选择的权重？

A: 修改 `plugin-selector.ts` 中的权重值：

```typescript
score += popularityScore * 0.4  // 受欢迎程度权重
score += freshnessScore * 0.2   // 活跃度权重
score += relevanceScore * 0.25  // 相关性权重
score += compatibilityScore * 0.15  // 兼容性权重
```

### Q: 如何添加更多能力定义？

A: 在 `types.ts` 的 `CAPABILITY_SEARCH_KEYWORDS` 中添加：

```typescript
'new-capability': ['keyword1', 'keyword2', 'keyword3']
```

### Q: 如何处理插件冲突？

A: 在 `plugin-selector.ts` 的 `hasCategoryConflict()` 中添加冲突规则。

## 发布流程

### 1. 版本更新

```bash
# 更新版本号
npm version patch  # 或 minor / major
```

### 2. 构建

```bash
pnpm build
```

### 3. 发布到 npm

```bash
npm publish --access public
```

### 4. 创建 GitHub Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 支持

- GitHub Issues: [提问题](https://github.com/YuemingHub/Ming-Capability-Pack/issues)
- Discussions: [讨论区](https://github.com/YuemingHub/Ming-Capability-Pack/discussions)
