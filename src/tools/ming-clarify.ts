/**
 * `ming_clarify` 工具：对话式澄清引擎（clarify-first 用）
 *
 * 用户选「先对齐需求再做」后，主模型用它做多轮核对：
 *   1. 传入用户最新回答翻译后的答案（answers，可空）；
 *   2. 工具返回还缺哪些关键决策点（问题/选项/默认值/翻译提示）；
 *   3. 主模型把缺的用大白话问用户 → 翻译用户回答 → 再调用；
 *   4. done=true 时信息够了，用这些 answers 调 ming_auto 开始做。
 *
 * 设计要点：
 *   - 纯规则，零 LLM 消耗；「翻译」由主模型完成（它既看得到用户原话，也看得到翻译提示）；
 *   - 缺什么问什么，绝不重复问已确认的；
 *   - 用户可以一直说「你看着办」——主模型用默认值补全即可，绝不卡住。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { clarifyStatus, formatClarify } from '../capabilities/planner.js'
import { resolveCapabilities } from '../capabilities/resolver.js'

export function registerMingClarifyTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_clarify',
    description: 'Ming 澄清：用户选了「先对齐需求再做」后，用它做对话式核对。' +
      '传入用户最新回答翻译后的答案（answers），返回还缺哪些关键点（含问题/选项/默认值/翻译提示）。' +
      '把缺的问用户，把用户的大白话翻译成系统逻辑再传回来；返回 done=true 时信息够了，' +
      '把这些 answers 传给 ming_auto（strategy=clarify-first）开始做。只核对，不执行。',

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
      answers: {
        type: 'object',
        additionalProperties: true,
        description: '用户最新回答翻译后的答案（键值对，键对应上一轮返回的 missing.key）；可只传新增的',
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

    async execute(args: { goal: string; recipe?: string; answers?: Record<string, string> }) {
      const plan = await resolveCapabilities(ctx, { goal: args.goal, recipeId: args.recipe })
      const status = clarifyStatus(plan, args.answers)
      return { text: formatClarify(status) }
    },
  }))
}
