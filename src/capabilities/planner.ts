/**
 * Execution Planner：目标 → 策略选项 + 澄清问题
 *
 * 产品交互：用户只说「想让什么变成真的」，Ming 不连环追问，
 * 而是先给「怎么做的选择」，让用户挑一个方向再往下走。
 * 不同策略对应不同的中间件调用链：
 *   - mvp-first（推荐）：用默认值直接跑出能看的 MVP，看完再迭代（快链）；
 *   - clarify-first：先问方案声明的关键问题（只问必要的），按用户答案精确装配再跑（核对链）。
 * 两条链都汇入 ming_auto 执行，区别只在「装配上下文是否注入用户答案」。
 */

import type { Context } from '@deepseek-ai/cordis'
import { resolveCapabilities } from './resolver.js'
import type { CapabilityPlan, ClarifyQuestion, StrategyOption } from './types.js'

/**
 * 把方案声明的澄清问题解析成「注入执行子代理的方向」：
 * mvp-first 直接用默认值；clarify-first 优先用户答案、缺省回落到默认值。
 * 保证两条链都能跑，且「不问也能做、问了更贴合」。
 */
export function resolveAnswers(
  plan: Pick<CapabilityPlan, 'questions'>,
  strategy: string | undefined,
  answers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const questions = plan.questions ?? []
  if (questions.length === 0) return undefined
  const resolved: Record<string, string> = {}
  for (const q of questions) {
    const userValue = answers?.[q.key]
    resolved[q.key] = strategy === 'clarify-first' && userValue?.trim() ? userValue.trim() : q.default
  }
  return resolved
}

/** 恒有两个策略：先给选择，不做自由发挥 */
export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: 'mvp-first',
    label: '先跑一个能看的 MVP',
    description: '不打断你，直接用合理默认值做出来，你看完再提修改',
    recommended: true,
  },
  {
    id: 'clarify-first',
    label: '先对齐需求再做',
    description: '先问你几个关键问题（不超过 3 个），做得更贴合你的需要',
  },
]

export interface ExecutionPlan {
  plan: CapabilityPlan
  strategyOptions: StrategyOption[]
  /** 方案声明的澄清问题（clarify-first 时用；未命中方案时为空数组） */
  questions: ClarifyQuestion[]
}

export interface PlanInput {
  goal: string
  recipeId?: string
}

export async function planExecution(ctx: Context, input: PlanInput): Promise<ExecutionPlan> {
  const plan = await resolveCapabilities(ctx, input)
  return {
    plan,
    strategyOptions: STRATEGY_OPTIONS,
    questions: plan.questions ?? [],
  }
}

/** 把策略选项格式化成给主模型/用户看的文本 */
export function formatStrategyOptions(options: StrategyOption[]): string {
  const lines = ['你想怎么做？', '']
  for (const o of options) {
    lines.push(`- [${o.id}] ${o.label}${o.recommended ? '（推荐）' : ''}`)
    lines.push(`  ${o.description}`)
  }
  lines.push('', '把选中的 id（mvp-first / clarify-first）传给 ming_auto 的 strategy 参数即可。')
  return lines.join('\n')
}

// ---------- 对话式澄清（clarify-first）----------

/** 还没确认的决策点（主模型据此继续问用户） */
export interface ClarifyMissing {
  key: string
  question: string
  default: string
  options?: string[]
  translate?: string
}

export interface ClarifyStatus {
  /** 信息是否已够（所有决策点都有答案） */
  done: boolean
  /** 已确认的答案（用户大白话 → 系统逻辑的翻译结果） */
  confirmed: Record<string, string>
  /** 还没确认的决策点 */
  missing: ClarifyMissing[]
}

/**
 * 纯规则澄清引擎：缺什么就报告什么，信息够就 done。
 * 翻译（把用户的话变成系统逻辑）由主模型完成——它既看得见用户原话，也看得见翻译提示。
 * 主模型循环：问 missing 里的问题 → 翻译用户回答 → 再调用，直到 done → ming_auto 执行。
 */
export function clarifyStatus(
  plan: Pick<CapabilityPlan, 'questions'>,
  answers: Record<string, string> | undefined,
): ClarifyStatus {
  const questions = plan.questions ?? []
  const confirmed: Record<string, string> = {}
  const missing: ClarifyMissing[] = []
  for (const q of questions) {
    const value = answers?.[q.key]
    if (value && value.trim()) {
      confirmed[q.key] = value.trim()
    } else {
      missing.push({
        key: q.key,
        question: q.question,
        default: q.default,
        options: q.options,
        translate: q.translate,
      })
    }
  }
  return { done: missing.length === 0, confirmed, missing }
}

/** 把澄清状态格式化成给主模型/用户看的文本 */
export function formatClarify(status: ClarifyStatus): string {
  if (status.done) {
    const parts = Object.entries(status.confirmed).map(([k, v]) => `${k} = ${v}`).join('、')
    return `信息够了，已确认：${parts}。可以调用 ming_auto（strategy=clarify-first，answers 用这些值）开始做了。`
  }

  const lines = [`还需要确认 ${status.missing.length} 个关键点（可以回答，也可以说「你看着办」，我会用默认值）：`, '']
  for (const m of status.missing) {
    const opts = m.options?.length ? `（${m.options.join(' / ')}）` : ''
    lines.push(`- ${m.question}${opts}｜默认：${m.default}`)
    if (m.translate) {
      lines.push(`  翻译参考：${m.translate}`)
    }
  }
  lines.push('', '每确认一点就调用一次 ming_clarify 传入新答案；都确认了它会提示开始做。')
  return lines.join('\n')
}
