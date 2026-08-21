# Ming Capability Pack

**用自然语言，一键调用 Harness 原生能力，真正把事做完。**

## 🎯 这是什么

Ming 是 DeepSeek Harness 的一个薄插件。任何人只要用自然语言描述「想做什么」，
Ming 就把这件事一键转交给 Harness 原生的 Agent（自带 LLM 与工具），
让它真正去执行——写文件、跑命令、生成网页、处理数据……而不是只给建议。

核心思路：**不重复造轮子**。意图理解、步骤规划、任务执行，全部复用 Harness 已经具备的能力；
Ming 只负责「接收自然语言 → 转交原生 Agent → 收集结果与证据」。

## 🚀 快速开始

### 前提条件

1. 已安装 DeepSeek Harness
2. Node.js 22+ 或 24+

### 安装

```bash
dsh plugin --profile web add @mingworkbench/capability-pack
```

### 使用

启动 Harness 后，直接在对话里描述你想做的事：

```
用户：我想做一个摄影作品集网站

Ming：
✅ 完成！
📄 网站: D:/.../portfolio/index.html
📋 证据卡: ming-evidence/evidence-1710000000000.json
```

支持任何可描述的任务：生成网站、处理图片/数据、整理文件、写文档、自动化工作流……

## 🧭 工作原理

```
自然语言目标
      ↓
ming_auto 工具（一键转交）
      ↓
Harness 原生子代理（理解 + 规划 + 执行）
      ↓
真实产物（文件 / 网页 / 脚本）
      ↓
证据卡（ming-evidence/*.json）
```

## 🏗️ 代码结构

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 插件入口，注册 `ming_auto` 工具 |
| `src/tools/ming-auto.ts` | 工具定义（goal + resources → 结构化结果） |
| `src/services/executor.ts` | 薄转发器：调用原生子代理执行 |
| `src/services/evidence-collector.ts` | 写证据卡 |
| `src/types.ts` | 类型定义 |

## 📖 开发

```bash
git clone https://github.com/YuemingHub/Ming-Capability-Pack.git
cd Ming-Capability-Pack

npm install     # 安装依赖
npm run build   # 构建
npm run typecheck  # 类型检查
```

详见 [DEVELOPMENT.md](DEVELOPMENT.md) 与 [DESIGN.md](DESIGN.md)。

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)。

## 🔗 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [问题反馈](https://github.com/YuemingHub/Ming-Capability-Pack/issues)

---

**让 AI 工具真正为普通人服务** 🚀
