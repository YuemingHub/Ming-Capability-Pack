/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件，提供智能插件选择和编排能力
 */

import type { Context } from '@deepseek-ai/cordis'
import { IntentAnalyzer } from './services/intent-analyzer.js'
import { PluginSelector } from './services/plugin-selector.js'
import { PluginInstaller } from './services/plugin-installer.js'
import { Orchestrator } from './services/orchestrator.js'
import { EvidenceCollector } from './services/evidence-collector.js'
import { registerMingTools } from './tools/ming-auto.js'

export const name = '@mingworkbench/capability-pack'
export const version = '0.1.0'

/**
 * 插件主入口
 * 在 Harness 加载时被调用
 */
export async function apply(ctx: Context) {
  ctx.logger.info('🚀 Ming Capability Pack 正在加载...')

  try {
    // 1. 注册核心服务
    ctx.plugin(IntentAnalyzer)
    ctx.plugin(PluginSelector)
    ctx.plugin(PluginInstaller)
    ctx.plugin(Orchestrator)
    ctx.plugin(EvidenceCollector)

    ctx.logger.info('✅ 核心服务已注册')

    // 2. 注册工具（让 Agent 能调用）
    registerMingTools(ctx)

    ctx.logger.info('✅ Ming 工具已注册')

    // 3. 监听用户消息（可选：自动识别任务型意图）
    ctx.on('user/message', async (event, next) => {
      try {
        // 简单识别是否包含任务型关键词
        const taskKeywords = ['我想', '帮我', '生成', '创建', '做一个', '制作']
        const hasTaskIntent = taskKeywords.some(kw => event.content.includes(kw))

        if (hasTaskIntent) {
          ctx.logger.debug(`🎯 Ming 检测到可能的任务意图: ${event.content.substring(0, 50)}...`)
          // 不拦截，只是记录，让 Agent 决定是否调用 ming_auto
        }
      } catch (error) {
        ctx.logger.warn('Ming 意图检测失败', error)
      }

      return next()
    })

    ctx.logger.info('✅ Ming Capability Pack 加载完成')
    ctx.logger.info('💡 提示：对话中说出需求，Ming 会自动帮你完成')

  } catch (error) {
    ctx.logger.error('❌ Ming Capability Pack 加载失败', error)
    throw error
  }
}
