# 贡献指南

感谢你对 Ming Capability Pack 的关注！

## 如何贡献

### 报告问题

如果你发现了 Bug 或有功能建议：

1. 检查 [Issues](https://github.com/YuemingHub/Ming-Capability-Pack/issues) 是否已存在
2. 如果没有，创建新 Issue，提供：
   - 清晰的标题
   - 详细的描述
   - 复现步骤（如果是 Bug）
   - 预期行为 vs 实际行为
   - 环境信息（Node.js 版本、OS 等）

### 提交代码

1. **Fork 仓库**

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature
   # 或
   git checkout -b fix/your-bugfix
   ```

3. **开发**
   - 遵循现有代码风格
   - 添加必要的注释
   - 确保类型安全

4. **验证**
   ```bash
   npm run typecheck
   npm run build
   ```

5. **提交**
   ```bash
   git commit -m "feat: add new feature"
   # 或
   git commit -m "fix: resolve bug"
   ```

   提交信息格式：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `refactor:` 代码重构
   - `perf:` 性能优化
   - `test:` 测试相关

6. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature
   ```

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 变量和函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 适当添加 JSDoc 注释

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 重点贡献领域

当前最需要贡献的领域：

1. **优化执行引导语**
   - 打磨 `executor.ts` 里 `buildPrompt()` 的提示词，让原生 Agent 完成得更稳、更贴合用户预期

2. **增强结果与证据**
   - 改进产物路径提取（`extractArtifacts`）
   - 丰富证据卡字段，让结果更可追溯

3. **完善降级与错误处理**
   - 子代理不可用、被取消、超限等情况的更友好处理

4. **完善文档**
   - 使用案例、真机测试记录、故障排查指南

## 社区

- GitHub Discussions: [讨论区](https://github.com/YuemingHub/Ming-Capability-Pack/discussions)
- 问题跟踪: [Issues](https://github.com/YuemingHub/Ming-Capability-Pack/issues)

## 行为准则

- 尊重他人
- 接受建设性批评
- 专注于对项目最有利的事情
- 帮助其他贡献者

## 许可证

贡献的代码将采用 MIT 许可证。
