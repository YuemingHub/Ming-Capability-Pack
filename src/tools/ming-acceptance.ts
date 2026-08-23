/**
 * `ming_acceptance` 工具：查询验收健康度
 *
 * 只读工具：读取工作区的验收历史，聚合成「每个方案历次验收通过率」，
 * 让用户 / 主模型能看到标准飞轮攒下的数据。不执行任何任务，不写任何文件。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { formatAcceptance, readAcceptanceHistory, summarizeAcceptance } from '../services/acceptance-log.js'
import { resolveWorkdir } from '../services/executor.js'

export function registerMingAcceptanceTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_acceptance',
    description: 'Ming 验收健康度查询：查看各方案历次验收的通过率（运行次数、通过/失败数、最近运行时间）。' +
      '适合：用户想知道「我的方案验收情况如何」「哪个方案质量最稳」。只读工具，不执行任务、不写文件。',

    parameters: {},

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

    async execute(_args, exec) {
      const workdir = resolveWorkdir(exec)
      const records = await readAcceptanceHistory(workdir)
      const summaries = summarizeAcceptance(records)
      return { text: formatAcceptance(summaries) }
    },
  }))
}
