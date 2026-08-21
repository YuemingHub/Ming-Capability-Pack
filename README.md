# Ming Capability Pack

**智能插件管家** - 让普通人能用 DeepSeek Harness 的 1594+ 插件

## 🎯 这是什么

Ming Capability Pack 是 DeepSeek Harness 的智能插件，帮助用户：
- 🤖 **用自然语言说出需求**，不需要懂技术术语
- 🔍 **自动从 1594+ 插件中选择最佳组合**，不需要自己研究
- 📦 **自动安装和配置**，不需要手动操作
- ⚙️ **智能编排执行**，不需要懂插件怎么组合
- ✅ **提供证据验证**，确保任务真的完成了

## 🚀 快速开始

### 前提条件

1. 已安装 DeepSeek Harness
2. Node.js 22+ 或 24+

### 安装

```bash
# 在 Harness 项目中安装
dsh plugin --profile web add @mingworkbench/capability-pack
```

### 使用

1. 启动 DeepSeek Harness:
```bash
dsh web
```

2. 在对话中使用自然语言描述需求，Ming 会自动识别并帮你完成：
```
用户：我想做一个摄影作品集网站

Ming：
🔍 分析意图...
✓ 理解：静态网站生成 + 图片展示

🔎 搜索最佳插件组合...
✓ 找到 3 个插件：
  - dsh-static-site-generator (⭐5368)
  - dsh-image-optimizer (⭐1200)
  - dsh-browser-preview (内置)

📦 自动安装...
✓ 插件已就绪

⚙️ 开始执行...
✓ HTML 生成完成
✓ 图片优化完成
✓ 预览准备就绪

✅ 完成！
📄 网站: D:/output/index.html
🖼️ 截图: D:/output/screenshot.png
📋 证据卡: evidence-2026xxxx.json
```

## 💡 支持的场景

目前支持的场景：
- ✅ 静态网站生成
- 🚧 数据可视化（开发中）
- 🚧 图片批处理（开发中）
- 🚧 文件自动化（开发中）

更多场景持续添加中...

## 🔧 工作原理

```
用户需求（自然语言）
    ↓
意图分析（理解要做什么）
    ↓
插件选择（从 1594+ 中筛选最佳）
    ↓
自动安装（确保插件可用）
    ↓
智能编排（按正确顺序执行）
    ↓
证据验证（确保结果正确）
    ↓
输出结果
```

## 🏗️ 核心能力

### 1. 意图分析引擎
理解用户的自然语言需求，转换为结构化的能力需求。

### 2. 智能插件选择器 ⭐
从 1594+ 插件中自动选择最佳组合，综合考虑：
- 受欢迎程度（stars + 安装次数）
- 活跃度（最近更新时间）
- 相关性（描述匹配度）
- 兼容性（插件间是否冲突）

### 3. 自动安装器
检查本地是否已安装，自动下载和配置缺失的插件。

### 4. 智能编排器
分析插件依赖关系，按正确顺序执行，处理数据传递。

### 5. 证据收集器
记录完整执行过程，验证结果正确性，生成可追溯的证据链。

## 📖 开发

```bash
# 克隆仓库
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
cd Ming-Capability-Pack

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck
```

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🔗 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [插件市场](https://api.deepseek1024.com)
- [问题反馈](https://github.com/YuemingHub/Ming-Capability-Pack/issues)

## 💬 联系我们

- GitHub Issues: [提问题](https://github.com/YuemingHub/Ming-Capability-Pack/issues)
- Discussions: [讨论区](https://github.com/YuemingHub/Ming-Capability-Pack/discussions)

---

**让 AI 工具真正为普通人服务** 🚀
