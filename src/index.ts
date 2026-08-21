/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件（薄适配层）：把自然语言目标一键转交给
 * Harness 原生能力（子代理 / 工具 / LLM）真正完成任务并产出文件。
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerMingAutoTool } from './tools/ming-auto.js'

export const name = '@mingworkbench/capability-pack'
export const version = '0.4.0'

/**
 * 硬依赖：tools（注册工具）+ systemPrompt（注入「何时用 ming_auto」提示）。
 * subagents 作为软依赖在运行期按需取用（见 executor）。
 */
export const inject = ['tools', 'systemPrompt']

export async function apply(ctx: Context): Promise<void> {
  ctx.logger.info('🚀 Ming Capability Pack 正在加载...')

  try {
    registerMingAutoTool(ctx)
    ctx.systemPrompt.section({
      name: 'tool:ming_auto',
      order: 110,
      text: [
        '当用户用自然语言描述「想完成的事情」时，调用 ming_auto 工具来真正完成它。',
        '例如：做一个网站、处理一批数据、整理文件、写文档、跑自动化流程、生成报表等。',
        '把用户的目标原样写进 goal 参数（一句话或一段话）；如有相关的文件路径或 URL，填进 resources。',
        'ming_auto 会把目标转交给一个全新的执行子代理，由它真正执行并产出真实文件；完成后按工具返回的产出文件路径向用户汇报。',
      ].join('\n'),
    })
    ctx.logger.info('✅ ming_auto 工具已注册')
    ctx.logger.info('💡 直接描述你想做的事，Ming 会帮你真正完成')
  } catch (error) {
    ctx.logger.error('❌ Ming Capability Pack 加载失败', error)
    throw error
  }
}
