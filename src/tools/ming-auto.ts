/**
 * Ming 工具注册（能力织机版）
 *
 * `ming_auto` 内部链路：目标 → Capability Resolver（规则/显式命中方案包）
 * → Assembler（装配上下文）→ 官方子代理执行 → Verifier（独立验证）→ 证据卡。
 *
 * 未命中任何方案时退回通用委派（与旧版行为一致）；命中了方案但必选能力缺失时
 * 诚实失败并给出安装指引，绝不假装已装配。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assembleContext } from '../capabilities/assembler.js'
import { resolveCapabilities } from '../capabilities/resolver.js'
import { formatVerification, verifyChecks } from '../capabilities/verifier.js'
import type { CapabilityPlan } from '../capabilities/types.js'
import { execute, resolveWorkdir } from '../services/executor.js'
import { writeEvidence } from '../services/evidence-collector.js'
import { appendMissingNotice, nextStepsFor } from '../services/next-steps.js'
import type { MingResult } from '../types.js'

/** 把规范结果渲染成给用户/模型看的中文文本 */
function formatResult(value: MingResult): string {
  const lines: string[] = [value.summary]

  if (value.recipe) {
    lines.push('', `方案：${value.recipe}`)
  }

  if (value.artifacts.length > 0) {
    lines.push('', '产出：')
    value.artifacts.forEach(a => lines.push(`  - ${a}`))
  }

  if (value.verificationSummary) {
    lines.push('', value.verificationSummary)
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
    description: `Ming 智能助手：用户用自然语言描述想做的事，Ming 自动匹配内置方案包并装配能力，
交给 Harness 原生 Agent 真正完成，产出真实文件并独立验证。

适合：生成网站、处理图片/数据、整理文件、写文档、自动化工作流等任何可描述的任务。
提示：尽量说清「想要什么结果」，可附带文件路径或 URL；若已通过 ming_catalog 确认方案，
可在 recipe 参数指定方案 id，否则 Ming 会自动匹配。`,

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
      recipe: {
        type: 'string',
        description: '可选：通过 ming_catalog 确认的方案 id；不传则自动匹配',
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
          recipe: { type: 'string', required: true },
          planSummary: { type: 'string', required: true },
          verificationSummary: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatResult(value as MingResult) }],
    },

    async execute(args, exec) {
      const goal = args.goal
      const resources: string[] = args.resources ?? []
      const workdir = resolveWorkdir(exec)

      // ① 能力解析：目标 → 装配计划
      const plan = await resolveCapabilities(ctx, { goal, recipeId: args.recipe })

      // 命中了方案但必选能力缺失：诚实失败，不执行
      if (plan.recipeId && !plan.executable) {
        const missing = plan.missingRequired.join('、')
        const result: MingResult = {
          success: false,
          mode: 'planned',
          summary: `已匹配方案「${plan.recipeName}」，但缺少必选能力（${missing}），未执行。` +
            `请先按指引装配能力后重试，或直接用自然语言描述目标让我用现有工具完成。`,
          artifacts: [],
          evidence: '',
          nextSteps: plan.capabilities
            .filter(c => !c.available)
            .map(c => c.installHint ?? `装配 ${c.ref.kind}:${c.ref.id}`),
          recipe: plan.recipeName ?? '',
          planSummary: buildPlanSummary(plan),
          verificationSummary: '',
        }
        return result
      }

      // ② 装配：把方案要求注入执行上下文
      const contextual = assembleContext(plan)

      // ③ 官方子代理执行（未命中方案时 contextual 为空，行为与旧版一致）
      const outcome = await execute(ctx, goal, resources, exec, { contextual })

      // ④ 独立验证：方案声明的验收断言
      let verificationSummary = ''
      let verification: { passed: number; failed: number; results: unknown[] } | undefined
      if (outcome.success && plan.verification.length > 0) {
        const summary = await verifyChecks(plan.verification, workdir)
        verification = { passed: summary.passed, failed: summary.failed, results: summary.results }
        verificationSummary = formatVerification(summary)
      }

      // ⑤ 证据卡
      let evidencePath = ''
      try {
        const evidence = await writeEvidence({
          goal,
          resources,
          outcome,
          workdir,
          recipe: plan.recipeId
            ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities }
            : undefined,
          verification,
        })
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
        recipe: plan.recipeName ?? '',
        planSummary: buildPlanSummary(plan),
        verificationSummary,
      }

      return result
    },
  }))
}

function buildPlanSummary(plan: CapabilityPlan): string {
  if (!plan.recipeId) return '未匹配到内置方案，走通用委派执行'
  const parts = [`方案「${plan.recipeName}」（匹配：${plan.matchedBy}）`]
  if (plan.capabilities.length > 0) {
    const available = plan.capabilities.filter(c => c.available).length
    const missing = plan.capabilities.filter(c => !c.available)
    parts.push(`能力装配：${available}/${plan.capabilities.length} 可用`)
    if (missing.length > 0) {
      parts.push(`未装配：${missing.map(m => `${m.ref.kind}:${m.ref.id}`).join('、')}`)
    }
  }
  return parts.join('；')
}
