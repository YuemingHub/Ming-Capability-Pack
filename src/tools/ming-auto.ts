/**
 * Ming 工具注册
 *
 * 用 Harness 真实的 defineTool API 注册 `ming_auto` 工具：
 * 用户用自然语言描述目标，Ming 一键转交给 Harness 原生 Agent 真正完成。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execute, resolveWorkdir } from '../services/executor.js'
import { writeEvidence } from '../services/evidence-collector.js'
import { appendMissingNotice, nextStepsFor } from '../services/next-steps.js'
import type { MingResult } from '../types.js'

/** 把规范结果渲染成给用户/模型看的中文文本 */
function formatResult(value: MingResult): string {
  const lines: string[] = [value.summary]

  if (value.artifacts.length > 0) {
    lines.push('', '产出：')
    value.artifacts.forEach(a => lines.push(`  - ${a}`))
  }

  if (value.evidence) {
    lines.push('', `证据卡：${value.evidence}`)
  }

  if (value.nextSteps.length > 0) {
    lines.push('', '接下来：')
    value.nextSteps.forEach(n => lines.push(`  - ${n}`))
  }

  return lines.join('\n')
}

export function registerMingAutoTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_auto',
    description: `Ming 智能助手：用户用自然语言描述想做的事，Ming 一键交给 Harness 原生 Agent 真正完成并产出真实文件。

适合：生成网站、处理图片/数据、整理文件、写文档、自动化工作流等任何可描述的任务。
提示：尽量说清「想要什么结果」，可附带文件路径或 URL。`,

    parameters: {
      goal: {
        type: 'string',
        required: true,
        description: '用户想完成的目标（自然语言，一句话或一段话）',
      },
      resources: {
        type: 'array',
        items: { type: 'string' },
        description: '可选：相关的文件路径或 URL',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean', required: true },
          mode: { type: 'string', required: true },
          summary: { type: 'string', required: true },
          artifacts: { type: 'array', required: true, items: { type: 'string' } },
          evidence: { type: 'string', required: true },
          nextSteps: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatResult(value as MingResult) }],
    },

    async execute(args, exec) {
      const goal = args.goal
      const resources: string[] = args.resources ?? []

      // 一键转交原生 Agent 执行
      const outcome = await execute(ctx, goal, resources, exec)

      // 收集证据（尽力而为，不阻断主流程）
      let evidencePath = ''
      try {
        const evidence = await writeEvidence({ goal, resources, outcome, workdir: resolveWorkdir(exec) })
        evidencePath = evidence.path
      } catch {
        /* 证据是尽力而为 */
      }

      const result: MingResult = {
        success: outcome.success,
        mode: outcome.mode,
        summary: appendMissingNotice(outcome),
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: nextStepsFor(outcome),
      }

      return result
    },
  }))
}
