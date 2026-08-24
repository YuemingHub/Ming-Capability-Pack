/**
 * 通用能力缺口探测（Generic Capability Gap Probe）
 *
 * 装配断路的修复：dispatch 原本只在「命中了方案且方案声明能力缺失」时触发，
 * 未命中方案的任务（如「做个视频」）即使市场里有能装的能力，装配机制也根本不上场。
 * 本模块补上这一段：从目标文本与资源文件名推断「可能需要」的能力，
 * 交给 dispatch 走市场找候选——社区源一句确认，绝不自动装。
 *
 * 与方案内声明的能力缺口不同：这里是「低置信度推断」（可能需要 vs 确定需要），
 * 所以配套使用 dispatch 的 forceConfirm：所有候选都走「一句确认」，不自动装。
 */

import type { CapabilityRef } from './types.js'

/** 关键词 → 能力缺口 的推断规则（只放高置信词，避免噪音；来源优先级靠 curated/市场） */
const GAP_RULES: ReadonlyArray<{ keywords: readonly string[]; ref: CapabilityRef }> = [
  {
    keywords: ['视频', '短视频', '剪辑', 'vlog', '动画', '片头', '录像', '.mp4', '.mov', '.avi', '.webm', 'video'],
    ref: { kind: 'tool', id: 'video', purpose: '视频制作/剪辑', trust: 'community' },
  },
  {
    keywords: ['画', '图片', '照片', '图像', '海报', '.jpg', '.jpeg', '.png', '.gif', '.webp', 'photo', 'image'],
    ref: { kind: 'tool', id: 'image_edit', purpose: '图片处理/绘制', trust: 'community' },
  },
  {
    keywords: ['表格', 'excel', 'xlsx', 'csv', '电子表格', '数据表'],
    ref: { kind: 'tool', id: 'excel_read', purpose: '读取/编辑表格数据', trust: 'community' },
  },
  {
    keywords: ['ppt', '演示文稿', '幻灯片', '汇报'],
    ref: { kind: 'tool', id: 'ppt_create', purpose: '制作演示文稿', trust: 'community' },
  },
  {
    keywords: ['数据库', 'sql', '写查询'],
    ref: { kind: 'tool', id: 'db_ops', purpose: '连接数据库写 SQL', trust: 'community' },
  },
  {
    keywords: ['知识库', 'rag', '文档问答'],
    ref: { kind: 'tool', id: 'knowledge_rag', purpose: '把文档变成可查询的知识库', trust: 'community' },
  },
  {
    keywords: ['发布', '上线', '部署', '让别人能看', '公开访问'],
    ref: { kind: 'tool', id: 'publish_deploy', purpose: '发布到公开地址', trust: 'community' },
  },
]

/**
 * 从目标文本 + 资源文件名推断可能需要的能力缺口。
 * 纯函数、零副作用；返回去重后的 CapabilityRef 列表（无命中返回空数组）。
 */
export function probeGenericCapabilityGaps(goal: string, resources: string[] = []): CapabilityRef[] {
  const text = `${goal}\n${resources.join('\n')}`.toLowerCase()
  const found = new Map<string, CapabilityRef>()
  for (const rule of GAP_RULES) {
    if (rule.keywords.some(k => text.includes(k.toLowerCase()))) {
      found.set(rule.ref.id, rule.ref)
    }
  }
  return [...found.values()]
}
