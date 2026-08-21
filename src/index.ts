/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件：把自然语言需求翻译成「能力配方」，
 * 并通过 Harness 原生能力（子代理 / 工具 / LLM）真正完成任务。
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerMingAutoTool } from './tools/ming-auto.js'

export const name = '@mingworkbench/capability-pack'
export const version = '0.3.0'

/**
 * 硬依赖：tools（注册 ming_auto 工具必需）。
 * llm / subagents 作为软依赖在运行期按需取用（见 executor / intent-analyzer）。
 */
export const inject = ['tools']

export async function apply(ctx: Context): Promise<void> {
  ctx.logger.info('🚀 Ming Capability Pack 正在加载...')

  try {
    registerMingAutoTool(ctx)
    ctx.logger.info('✅ ming_auto 工具已注册')
    ctx.logger.info('💡 直接描述你想做的事，Ming 会帮你真正完成')
  } catch (error) {
    ctx.logger.error('❌ Ming Capability Pack 加载失败', error)
    throw error
  }
}
