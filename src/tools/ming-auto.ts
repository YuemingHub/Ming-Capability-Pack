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
import type { ExecutionOutcome, MingResult } from '../types.js'

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

/** 按失败原因给出可操作的下一步，而非千篇一律的套话 */
function nextStepsFor(outcome: ExecutionOutcome): string[] {
  if (outcome.success) {
    return ['查看上面列出的产出文件', '如需修改，直接告诉我改哪里', '满意后可继续下一个任务']
  }
  switch (outcome.errorKind) {
    case 'engine-unavailable':
      return [
        '当前环境未启用子代理执行引擎，可直接让我用自带工具完成该目标',
        '或在启用了子代理的 profile 中重试',
      ]
    case 'resource-missing':
      return ['检查上面列出的资源路径是否正确（注意大小写与盘符），修正后重试']
    case 'timeout':
      return ['把任务拆得更小一些再试', '或设置环境变量 MING_TIMEOUT_MS 调大超时时间']
    case 'aborted':
      return ['重新描述任务再试一次']
    case 'max-tokens':
      return ['把目标拆分成多个小步骤分次执行']
    case 'refusal':
      return ['换一种表述方式描述目标']
    default:
      return ['稍后重试', '若持续失败，可携带证据卡内容反馈问题']
  }
}

/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
function appendMissingNotice(outcome: ExecutionOutcome): string {
  const missing = (outcome.artifactChecks ?? []).filter(c => c.kind === 'missing')
  if (!outcome.success || missing.length === 0) return outcome.summary
  const lines = missing.map(m => `  - ${m.raw}`)
  return `${outcome.summary}\n\n⚠️ 校验提醒：以下汇报中的路径在本地未找到，请以实际磁盘为准：\n${lines.join('\n')}`
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
