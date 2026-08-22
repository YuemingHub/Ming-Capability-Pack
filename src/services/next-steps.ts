/**
 * 结果收尾：针对性下一步建议 + 校验提醒拼接。
 *
 * 从 ming-auto 抽出的纯函数，便于单元测试与内部导出。
 */

import type { ExecutionOutcome } from '../types.js'

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
export function appendMissingNotice(outcome: ExecutionOutcome): string {
  const missing = (outcome.artifactChecks ?? []).filter(c => c.kind === 'missing')
  if (!outcome.success || missing.length === 0) return outcome.summary
  const lines = missing.map(m => `  - ${m.raw}`)
  return `${outcome.summary}\n\n⚠️ 校验提醒：以下汇报中的路径在本地未找到，请以实际磁盘为准：\n${lines.join('\n')}`
}
