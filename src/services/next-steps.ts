/**
 * 结果收尾：针对性下一步建议 + 校验提醒拼接。
 *
 * 从 ming-auto 抽出的纯函数，便于单元测试与内部导出。
 */

import type { ExecutionOutcome } from '../types.js'
import type { WorkflowResult } from './workflow.js'

/** 按失败原因给出可操作的下一步，而非千篇一律的套话 */
export function nextStepsFor(outcome: ExecutionOutcome): string[] {
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
export function workflowNextSteps(result: WorkflowResult): string[] {
  const steps = []
  if (result.stoppedAt) {
    // 暂停步（如「项目地图 + 下一步建议」）：用户确认/选择后说「继续」即可，从暂停步的下一步接着做。
    // resumeFrom 由 runWorkflow 在暂停时算出（stepResults 里只有已执行的步骤，不含下一步，不能靠它推断）
    const next = result.resumeFrom ?? result.stoppedAt
    steps.push(`看完上面的结果后，对 Ming 说「继续」，会从下一步接着做（workflowFrom=${next}）`)
    return steps
  }
  if (result.failureKind === 'capability-missing') {
    const blocked = result.stepResults.find(r => r.blockedBy)
    if (blocked?.blockedBy) {
      const ref = blocked.blockedBy.ref
      // 中间件已自动去市场找最好的（见摘要里的「建议装配/已自动安装」），
      // 这里不再让用户自己搜插件——小白用户只需要一句「确认」或直接「继续」。
      // 判定依据：摘要里出现「建议装配」= 社区源待确认；否则 = 官方源已自动装。
      const fromHint = `重启后对 Ming 说「继续」（workflowFrom=${blocked.step.id}），从失败步接着做，前面已完成的不重做`
      if (result.summary.includes('建议装配')) {
        steps.push(`能力「${ref.id}」缺失：中间件已在市场找到最佳工具（见上面摘要），回一句「确认」我就帮你装，装好后完全重启 DSH`)
        steps.push(fromHint)
      } else {
        steps.push(`能力「${ref.id}」缺失：中间件已自动安装官方工具，完全重启 DSH 后生效`)
        steps.push(fromHint)
      }
    }
  } else if (result.failureKind === 'step-failed' || result.failureKind === 'verification-failed') {
    const pit = result.pitfalls ?? []
    if (pit.length > 0) {
      for (const p of pit.slice(0, 3)) {
        steps.push(`若现象是「${p.symptom}」→ ${p.fix}`)
      }
    }
    steps.push('重跑同一目标再试一次；反复失败时把失败现象告诉我')
  } else {
    steps.push('查看上面列出的产出文件', '满意后可继续下一个任务')
  }
  return steps
}

/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
export function appendMissingNotice(outcome: ExecutionOutcome): string {
  const missing = (outcome.artifactChecks ?? []).filter(c => c.kind === 'missing')
  if (!outcome.success || missing.length === 0) return outcome.summary
  const lines = missing.map(m => `  - ${m.raw}`)
  return `${outcome.summary}\n\n⚠️ 校验提醒：以下汇报中的路径在本地未找到，请以实际磁盘为准：\n${lines.join('\n')}`
}
