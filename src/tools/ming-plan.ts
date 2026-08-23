/**
 * `ming_plan` 工具：先给选择，不连环追问
 *
 * 用户只说「想让什么变成真的」时，本工具先规划：
 *   - 目标匹配到哪个方案（或走通用委派）
 *   - 两个策略选项（直接做一版完整的 / 先对齐需求，推荐前者）
 *   - 方案声明的关键澄清问题（最多 3 个，含默认值）
 * 主模型把选项呈现给用户 → 用户选定策略（必要时回答澄清问题）
 * → 再把 strategy（和 answers）传给 ming_auto 真正执行。
 * 只规划，不执行，不装配任何能力。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { formatStrategyOptions, planExecution } from '../capabilities/planner.js'
import type { ExecutionPlan } from '../capabilities/planner.js'

function formatPlan(ep: ExecutionPlan): string {
  const lines: string[] = []

  const p = ep.plan
  if (p.recipeName) {
    lines.push(`目标可套用方案「${p.recipeName}」（匹配：${p.matchedBy}），能力装配 ${p.capabilities.filter(c => c.available).length}/${p.capabilities.length}。`)
  } else {
    lines.push(`没有命中内置方案，将用通用委派完成（Ming 现有的全部工具都会可用）。`)
  }

  if (ep.questions.length > 0) {
    lines.push('', '选择「先对齐需求再做」时，只需确认以下问题（不答则用默认值）：')
    for (const q of ep.questions) {
      const opts = q.options?.length ? `（${q.options.join(' / ')}）` : ''
      lines.push(`- ${q.question}${opts}｜默认：${q.default}`)
    }
  }

  lines.push('', formatStrategyOptions(ep.strategyOptions))
  lines.push('', '提醒：用户提到「文档/文件/上传/素材」时，不要教用户上传或找路径——' +
    '素材的定位与读取由执行环节自己完成；澄清阶段最多问一次用户想要的内容方向。')
  return lines.join('\n')
}

export function registerMingPlanTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_plan',
    description: 'Ming 规划：用户刚提出一个目标时，先调用本工具规划执行方式——' +
      '返回匹配的方案、两个策略选项（直接做一版完整的 / 先对齐需求）与需要确认的关键问题。' +
      '把选项呈现给用户选定后，再调用 ming_auto（带上 strategy，必要时带 answers）真正执行。' +
      '本工具只规划不执行。',

    parameters: {
      goal: {
        type: 'string',
        required: true,
        description: '用户想完成的目标（自然语言）',
      },
      recipe: {
        type: 'string',
        description: '可选：已通过 ming_catalog 确认的方案 id',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text as string }],
    },

    async execute(args: { goal: string; recipe?: string }) {
      const ep = await planExecution(ctx, { goal: args.goal, recipeId: args.recipe })
      return { text: formatPlan(ep) }
    },
  }))
}
