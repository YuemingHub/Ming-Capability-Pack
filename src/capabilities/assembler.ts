/**
 * Capability Assembler：把装配计划转成「可注入执行子代理的上下文」
 *
 * 第一刀只做两件事：
 *   1. 把命中方案的方法论（guidance）翻译成给执行子代理的人话要求；
 *   2. 诚实标注能力缺口——未装配的能力绝不假装已装配。
 * 真正「加载 skill / 激活 MCP / 安装插件」的动作留第二刀（走官方 API + dsh plugin 机制）。
 */

import type { CapabilityPlan } from './types.js'

/** 把装配计划转成追加到子代理 prompt 的上下文行 */
export function assembleContext(plan: CapabilityPlan): string[] {
  const lines: string[] = []

  if (plan.recipeName) {
    lines.push(`【本次装配方案】${plan.recipeName}（命中方式：${plan.matchedBy}）`)
  }

  if (plan.guidance.length > 0) {
    lines.push('【方案执行要求】')
    for (const g of plan.guidance) lines.push(`- ${g}`)
  }

  const missing = plan.capabilities.filter(c => !c.available)
  if (missing.length > 0) {
    lines.push('【能力缺口】以下能力当前未装配，请用现有可用工具尽力完成，不要假装使用了它们：')
    for (const m of missing) {
      const hint = m.installHint ? `（${m.installHint}）` : ''
      lines.push(`- ${m.ref.kind}:${m.ref.id} — ${m.ref.purpose}${hint}`)
    }
  }

  return lines
}
