/**
 * 类型定义
 *
 * Ming Capability Pack v0.5：薄适配层。
 * 意图理解、步骤规划、任务执行全部交给 Harness 原生 Agent（子代理 + LLM），
 * Ming 只负责「一键把自然语言转交给原生能力」并收集结果与证据。
 */

/** 单个产物的本地校验结果 */
export interface ArtifactCheck {
  /** 从汇报文本中提取的原始字符串 */
  raw: string
  /**
   * file = 本地路径确认存在；
   * url  = 链接，不做本地校验；
   * missing = 声称产出但本地未找到（需警惕）
   */
  kind: 'file' | 'url' | 'missing'
  /** 文件大小（字节），仅 file 时存在 */
  bytes?: number
  /** 最后修改时间（ISO 8601），仅 file 时存在 */
  modifiedAt?: string
}

/** 失败原因分类（驱动针对性 nextSteps 与证据卡归因） */
export type ErrorKind =
  | 'engine-unavailable'
  | 'resource-missing'
  | 'timeout'
  | 'aborted'
  | 'max-tokens'
  | 'refusal'
  | 'error'

/** 一次执行的产出 */
export interface ExecutionOutcome {
  /** executed = 原生 Agent 已真正执行；planned = 引擎不可用时的降级 */
  mode: 'executed' | 'planned'
  success: boolean
  /** 给用户看的结果摘要 */
  summary: string
  /** 产出的文件/链接（绝对路径或 URL，来自子代理汇报） */
  artifacts: string[]
  /** 对 artifacts 的逐项本地校验（尽力而为） */
  artifactChecks?: ArtifactCheck[]
  error?: string
  errorKind?: ErrorKind
  /** 执行元信息（随证据卡落盘） */
  durationMs?: number
  provider?: string
  stopReason?: string
}

/** ming_auto 工具返回给模型的规范值 */
export interface MingResult {
  success: boolean
  mode: 'executed' | 'planned'
  summary: string
  artifacts: string[]
  /** 证据卡文件路径 */
  evidence: string
  nextSteps: string[]
  /** 命中的方案名（未命中任何方案时为空字符串） */
  recipe: string
  /** 装配计划摘要（命中了什么能力、有无缺口） */
  planSummary: string
  /** 独立验证摘要（文件存在/内容匹配等断言结果） */
  verificationSummary: string
}

/** ming_history 单条历史记录 */
export interface HistoryEntry {
  id: string
  timestamp: string
  goal: string
  success: boolean
  mode: string
  /** 声称的产物数 */
  artifactsCount: number
  /** 校验未通过（本地不存在）的产物数 */
  missingCount: number
  /** 失败原因分类；成功时为空字符串；durationMs < 0 表示未知 */
  errorKind: string
  durationMs: number
  evidencePath: string
}

/** ming_history 工具返回给模型的规范值 */
export interface HistoryResult {
  success: boolean
  total: number
  returned: number
  entries: HistoryEntry[]
}
