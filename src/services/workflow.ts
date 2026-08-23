/**
 * 工作流执行器（痛点 1：复杂工作流容易掉坑，「搞半天搞不定」）
 *
 * 方案声明多步工作流时，Ming 逐步执行、逐步独立验收：
 *   1. 每步先探测本步所需能力（缺了就不白跑，直接引导装配）；
 *   2. 委派一次子代理完成本步（复用薄转发器的预检/超时/产物校验）；
 *   3. 本步验收断言不过就停在本步，失败原因附上方案预写的「坑位与修法」——
 *      用户不需要自己排查「为什么搞不定」，Ming 直接告诉他哪一步、常见原因、怎么办；
 *   4. 支持 workflowFrom：装完能力重启后从失败步继续，不重做前面已完成步骤。
 */

import type { Context } from '@deepseek-ai/cordis'
import { probeCapabilities } from '../capabilities/resolver.js'
import { formatVerification, verifyChecks } from '../capabilities/verifier.js'
import type { CapabilityAvailability, Pitfall, WorkflowStep, VerificationSummary } from '../capabilities/types.js'
import { execute } from './executor.js'
import type { ExecutionOutcome } from '../types.js'

export interface WorkflowStepResult {
  step: WorkflowStep
  /** 本步执行产出；skipped 或 blockedBy 时为 undefined */
  outcome?: ExecutionOutcome
  /** 本步验收结果（本步声明了验收断言时存在） */
  verification?: VerificationSummary
  /** 因 workflowFrom 跳过（前面已完成，不重做） */
  skipped: boolean
  /** 本步因缺能力未执行 */
  blockedBy?: CapabilityAvailability
}

export type WorkflowFailureKind = 'step-failed' | 'verification-failed' | 'capability-missing'

export interface WorkflowResult {
  success: boolean
  stepResults: WorkflowStepResult[]
  /** 失败步 id（成功时为空） */
  failedStepId?: string
  failureKind?: WorkflowFailureKind
  /** 失败步的坑位（用户「搞半天搞不定」的那些原因的修法） */
  pitfalls?: Pitfall[]
  summary: string
  durationMs: number
}

export interface RunWorkflowOptions {
  /** 从某一步继续（跳过之前的步骤；用于装配能力重启后恢复） */
  workflowFrom?: string
  /** 装配上下文（方案要求 + 用户确认的方向），注入每个步骤的子代理 prompt */
  baseContext?: string[]
}

/** 组装给子代理的本步目标：原始目标 + 本步目标 + 上下文说明 */
function buildStepGoal(goal: string, step: WorkflowStep, resuming: boolean): string {
  const lines = [
    `【整体目标】\n${goal}`,
    '',
    `【当前这一步（${step.name}）】\n${step.goal}`,
  ]
  if (resuming) {
    lines.push('', '说明：前面的步骤在此前运行中已完成（产物已落盘），本步直接基于现有文件继续，不要重做。')
  }
  return lines.join('\n')
}

export async function runWorkflow(
  ctx: Context,
  exec: any,
  goal: string,
  resources: string[],
  steps: WorkflowStep[],
  workdir: string,
  options: RunWorkflowOptions = {},
): Promise<WorkflowResult> {
  const startedAt = Date.now()
  const stepResults: WorkflowStepResult[] = []
  const fromId = options.workflowFrom
  let reachedFrom = !fromId

  for (const step of steps) {
    // workflowFrom 之前的步骤标记跳过
    if (!reachedFrom) {
      if (step.id === fromId) {
        reachedFrom = true
      } else {
        stepResults.push({ step, skipped: true })
        continue
      }
    }

    // 本步能力探测：缺必选能力就不白跑，停在本步引导装配
    if (step.capabilities && step.capabilities.length > 0) {
      const caps = await probeCapabilities(ctx, step.capabilities)
      const missing = caps.find(c => !c.available && !c.ref.optional)
      if (missing) {
        stepResults.push({ step, skipped: false, blockedBy: missing })
        return {
          success: false,
          failedStepId: step.id,
          failureKind: 'capability-missing',
          stepResults,
          pitfalls: step.pitfalls,
          summary: `步骤「${step.name}」需要能力「${missing.ref.kind}:${missing.ref.id}」（${missing.ref.purpose ?? ''}）但本机未装配，未执行。请先装配该能力。`,
          durationMs: Date.now() - startedAt,
        }
      }
    }

    const resuming = fromId !== undefined && step.id === fromId
    const stepGoal = buildStepGoal(goal, step, resuming)
    const outcome = await execute(ctx, stepGoal, resources, exec, {
      contextual: [...(options.baseContext ?? []), ...(step.guidance ?? [])],
    })

    if (!outcome.success) {
      stepResults.push({ step, outcome, skipped: false })
      return {
        success: false,
        failedStepId: step.id,
        failureKind: 'step-failed',
        stepResults,
        pitfalls: step.pitfalls,
        summary: `步骤「${step.name}」执行失败：${outcome.summary}`,
        durationMs: Date.now() - startedAt,
      }
    }

    // 本步验收
    let verification: VerificationSummary | undefined
    if (step.verification && step.verification.length > 0) {
      verification = await verifyChecks(step.verification, workdir)
      if (verification.failed > 0) {
        stepResults.push({ step, outcome, verification, skipped: false })
        return {
          success: false,
          failedStepId: step.id,
          failureKind: 'verification-failed',
          stepResults,
          pitfalls: step.pitfalls,
          summary: `步骤「${step.name}」产出未通过验收：${formatVerification(verification)}`,
          durationMs: Date.now() - startedAt,
        }
      }
    }

    stepResults.push({ step, outcome, verification, skipped: false })
  }

  const skippedCount = stepResults.filter(r => r.skipped).length
  const doneCount = stepResults.length - skippedCount
  return {
    success: true,
    stepResults,
    summary: `工作流完成：${doneCount} 步执行成功${skippedCount > 0 ? `，${skippedCount} 步按「继续」跳过（此前已完成）` : ''}`,
    durationMs: Date.now() - startedAt,
  }
}

/** 汇总所有执行步的产出路径（供证据卡与汇报） */
export function collectWorkflowArtifacts(result: WorkflowResult): string[] {
  const out = new Set<string>()
  for (const r of result.stepResults) {
    for (const a of r.outcome?.artifacts ?? []) {
      if (a) out.add(a)
    }
  }
  return [...out]
}
