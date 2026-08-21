/**
 * Ming 工具注册
 *
 * 注册 ming_auto 工具，让 Agent 能够调用 Ming 的自动化能力
 */

import type { Context } from '@deepseek-ai/cordis'

export function registerMingTools(ctx: Context) {
  // 注册主工具：ming_auto
  ctx.tools.register({
    name: 'ming_auto',
    description: `Ming 智能助手 - 自动完成用户的任务需求

Ming 会：
1. 理解用户想要做什么
2. 从 DeepSeek Harness 的 1594+ 插件中自动选择最佳组合
3. 自动安装和配置所需插件
4. 智能编排执行
5. 提供完整的证据链

适用场景：
- 生成网站、工具、应用
- 处理数据、文件、图片
- 自动化工作流
- 任何可以用自然语言描述的任务

使用提示：
- 尽量详细描述你的需求
- 提供相关的资源（文件路径、URL等）
- Ming 会自动处理技术细节`,

    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: '用户想要完成的目标（用一句话描述）'
        },
        resources: {
          type: 'array',
          items: { type: 'string' },
          description: '用户提供的资源（文件路径、URL、数据等）'
        }
      },
      required: ['goal']
    },

    async execute(args, toolContext) {
      const { goal, resources = [] } = args

      ctx.logger.info(`🎯 Ming 开始处理任务: ${goal}`)

      try {
        // Step 1: 分析意图
        ctx.logger.info('🔍 步骤 1/5: 分析意图...')
        const intent = await ctx.mingIntentAnalyzer.analyze(goal)

        if (intent.confidence < 0.5) {
          return {
            success: false,
            error: '抱歉，我不太确定你想要做什么。能否更详细地描述一下？',
            suggestion: '例如："我想做一个展示摄影作品的网站"'
          }
        }

        ctx.logger.info(`✓ 意图分析完成: ${intent.type} (置信度: ${intent.confidence.toFixed(2)})`)

        // Step 2: 查找最佳插件
        ctx.logger.info(`🔎 步骤 2/5: 搜索最佳插件组合 (需要 ${intent.requirements.length} 个能力)...`)
        const plugins = await ctx.mingPluginSelector.findBestPlugins(intent.requirements)

        if (plugins.size === 0) {
          return {
            success: false,
            error: '抱歉，没有找到合适的插件来完成这个任务。',
            suggestion: '可以尝试换一种描述方式，或者手动搜索插件市场。'
          }
        }

        ctx.logger.info(`✓ 已选择 ${plugins.size} 个插件`)

        // 生成插件列表摘要
        const pluginSummary = Array.from(plugins.values()).map(p =>
          `  - ${p.name} (⭐${p.stars}, ${p.installCount}次安装)`
        ).join('\n')

        // Step 3: 自动安装
        ctx.logger.info('📦 步骤 3/5: 确保插件已安装...')
        const installResults = await ctx.mingPluginInstaller.ensureAllInstalled(plugins)

        const failedInstalls = Array.from(installResults.entries())
          .filter(([_, success]) => !success)

        if (failedInstalls.length > 0) {
          ctx.logger.warn(`${failedInstalls.length} 个插件安装失败`)
          return {
            success: false,
            error: `部分插件安装失败: ${failedInstalls.map(([cap]) => cap).join(', ')}`,
            pluginsSelected: pluginSummary
          }
        }

        ctx.logger.info('✓ 所有插件已就绪')

        // Step 4: 执行编排
        ctx.logger.info('⚙️ 步骤 4/5: 开始执行...')
        const executionResult = await ctx.mingOrchestrator.execute(plugins, {
          goal,
          resources,
          workDir: process.cwd()
        })

        if (!executionResult.success) {
          return {
            success: false,
            error: '执行过程中出现错误',
            steps: executionResult.steps,
            pluginsUsed: pluginSummary
          }
        }

        ctx.logger.info('✓ 执行完成')

        // Step 5: 收集证据
        ctx.logger.info('📋 步骤 5/5: 收集证据...')
        const evidence = await ctx.mingEvidenceCollector.collect({
          goal,
          intent,
          plugins: Array.from(plugins.values()),
          steps: executionResult.steps
        })

        ctx.logger.info('✓ 证据已保存')

        // 返回成功结果
        return {
          success: true,
          goal,
          summary: `✅ 任务完成！使用了 ${plugins.size} 个插件，执行了 ${executionResult.steps.length} 个步骤`,
          pluginsUsed: pluginSummary,
          steps: executionResult.steps,
          evidence: {
            path: evidence.path,
            id: evidence.card.id
          },
          artifacts: evidence.card.outcome.artifacts,
          nextSteps: [
            '查看生成的文件',
            '如果需要修改，请告诉我具体要改什么',
            '如果满意，可以继续下一个任务'
          ]
        }

      } catch (error: any) {
        ctx.logger.error('❌ Ming 执行失败', error)

        return {
          success: false,
          error: error.message,
          suggestion: '请检查错误信息，或者尝试更详细地描述需求'
        }
      }
    }
  })

  ctx.logger.info('✅ ming_auto 工具已注册')
}
