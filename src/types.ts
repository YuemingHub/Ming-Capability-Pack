/**
 * 类型定义
 *
 * Ming Capability Pack v0.3：薄适配层。
 * 意图理解、步骤规划、任务执行全部交给 Harness 原生 Agent（子代理 + LLM），
 * Ming 只负责「一键把自然语言转交给原生能力」并收集结果与证据。
 */

/** 一次执行的产出 */
export interface ExecutionOutcome {
  /** executed = 原生 Agent 已真正执行；planned = 引擎不可用时的降级 */
  mode: 'executed' | 'planned'
  success: boolean
  /** 给用户看的结果摘要 */
  summary: string
  /** 产出的文件/链接（绝对路径或 URL） */
  artifacts: string[]
  error?: string
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
}
