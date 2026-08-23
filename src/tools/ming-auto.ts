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
import { dispatchMissingCapabilities } from '../capabilities/dispatch.js'
import { resolveAnswers } from '../capabilities/planner.js'
import { resolveCapabilities } from '../capabilities/resolver.js'
import { formatVerification, verifyChecks } from '../capabilities/verifier.js'
import type { CapabilityPlan } from '../capabilities/types.js'
import { execute, resolveWorkdir } from '../services/executor.js'
import { writeEvidence } from '../services/evidence-collector.js'
import { appendMissingNotice, nextStepsFor, workflowNextSteps } from '../services/next-steps.js'
import { collectWorkflowArtifacts, runWorkflow, type WorkflowResult } from '../services/workflow.js'
import type { ExecutionOutcome, MingResult } from '../types.js'

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
提示：先调用 ming_plan 查看策略选择（直接做一版完整的 / 先对齐需求），再按用户选择把 strategy 传进来；
选 clarify-first 时先用 ming_clarify 对话式核对，把翻译成系统逻辑的答案放进 answers 再执行。
也可直接指定 recipe 方案 id。`,

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
      strategy: {
        type: 'string',
        enum: ['mvp-first', 'clarify-first'] as const,
        description: '可选：执行策略。mvp-first 用默认值直接做（默认）；clarify-first 用 ming_clarify 核对后翻译成的系统逻辑答案装配再做',
      },
      answers: {
        type: 'object',
        additionalProperties: true,
        description: '可选：clarify-first 时经 ming_clarify 核对并翻译成系统逻辑的答案（键值对）；缺失项用默认值',
      },
      workflowFrom: {
        type: 'string',
        description: '可选：多步工作流从某一步继续（跳过之前的步骤）。工作流某步缺能力装好后，用户说「继续」时传入失败步的 step id',
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

    async execute(
      args: {
        goal: string
        resources?: string[]
        recipe?: string
        strategy?: 'mvp-first' | 'clarify-first'
        answers?: Record<string, string>
        workflowFrom?: string
      },
      exec,
    ) {
      const goal = args.goal
      const resources: string[] = args.resources ?? []
      const workdir = resolveWorkdir(exec)

      // ① 能力解析：目标 → 装配计划
      const plan = await resolveCapabilities(ctx, { goal, recipeId: args.recipe })

      // 命中了方案但必选能力缺失：中间件自动去装配（curated 优先 → 市场兜底 → 可信源自动装/社区源一句确认），
      // 但不阻断第一版交付——先用现有工具完成，装好的工具重启 DSH 后对后续迭代生效
      let dispatchNotice = ''
      let dispatchNextSteps: string[] = []
      if (plan.recipeId && !plan.executable) {
        const missingRefs = plan.capabilities.filter(c => !c.available && !c.ref.optional).map(c => c.ref)
        const dispatch = await dispatchMissingCapabilities(missingRefs)
        if (dispatch.entries.length > 0) {
          dispatchNotice = `方案「${plan.recipeName}」缺 ${missingRefs.length} 个能力，中间件已自动装配：\n${dispatch.summary}\n\n本次先用现有工具交付第一版，装好的工具重启 DSH 后对后续迭代生效。`
          dispatchNextSteps = dispatch.entries
            .filter(e => e.action === 'proposed' && e.command)
            .map(e => `回「确认」帮你装 ${e.source}（${e.reason}）`)
        }
      }

      // ② 装配：把方案要求 + 用户确认的方向注入执行上下文
      const answers = resolveAnswers(plan, args.strategy, args.answers)
      const contextual = assembleContext(plan, answers)

      // ②' 多步工作流：逐步执行、逐步验收、失败带坑位、可断点续跑
      if (plan.workflow && plan.workflow.length > 0) {
        const wfResult = await runWorkflow(ctx, exec, goal, resources, plan.workflow, workdir, {
          workflowFrom: args.workflowFrom,
          baseContext: contextual,
        })
        return workflowToResult(wfResult, plan, goal, resources, workdir)
      }

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
        summary: [dispatchNotice, appendMissingNotice(outcome)].filter(Boolean).join('\n\n'),
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: [...dispatchNextSteps, ...nextStepsFor(outcome)],
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
  if (plan.workflow && plan.workflow.length > 0) {
    parts.push(`多步工作流：${plan.workflow.map(s => s.name).join(' → ')}`)
  }
  return parts.join('；')
}

/** 多步工作流 → MingResult：失败时明确「哪一步 + 坑位修法」，成功时汇总步骤与证据；
 *  下一步建议由 workflowNextSteps 按暂停/缺能力/失败/成功分类给出，不再传 answers（已无用） */
async function workflowToResult(
  wf: WorkflowResult,
  plan: CapabilityPlan,
  goal: string,
  resources: string[],
  workdir: string,
): Promise<MingResult> {
  const failedOutcome = wf.stepResults.find(r => r.step.id === wf.failedStepId)?.outcome
  const outcome: ExecutionOutcome = {
    mode: 'executed',
    success: wf.success,
    summary: wf.summary,
    artifacts: collectWorkflowArtifacts(wf),
    error: wf.success ? undefined : wf.summary,
    errorKind: failedOutcome?.errorKind,
  }

  let evidencePath = ''
  try {
    const evidence = await writeEvidence({
      goal,
      resources,
      outcome,
      workdir,
      recipe: plan.recipeId ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities } : undefined,
    })
    evidencePath = evidence.path
  } catch {
    /* 证据是尽力而为 */
  }

  return {
    success: wf.success,
    mode: 'executed',
    summary: wf.stoppedAt
      ? wf.summary
      : wf.success
        ? appendMissingNotice(outcome)
        : `工作流在「${wf.stepResults.find(r => r.step.id === wf.failedStepId)?.step.name ?? '某一步'}」停下：${wf.summary}`,
    artifacts: outcome.artifacts,
    evidence: evidencePath,
    nextSteps: workflowNextSteps(wf),
    recipe: plan.recipeName ?? '',
    planSummary: buildPlanSummary(plan),
    verificationSummary: workflowVerificationSummary(wf),
  }
}

function workflowVerificationSummary(wf: WorkflowResult): string {
  const lines: string[] = []
  for (const r of wf.stepResults) {
    if (r.skipped) {
      lines.push(`- ${r.step.name}：跳过（此前已完成）`)
    } else if (r.blockedBy) {
      lines.push(`- ${r.step.name}：未执行（缺能力 ${r.blockedBy.ref.kind}:${r.blockedBy.ref.id}）`)
    } else if (r.verification) {
      lines.push(`- ${r.step.name}：验收 ${r.verification.passed} 过 / ${r.verification.failed} 未过`)
    } else {
      lines.push(`- ${r.step.name}：已执行${r.outcome?.success ? '' : '（失败）'}`)
    }
  }
  return lines.join('\n')
}
