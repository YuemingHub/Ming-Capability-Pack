/**
 * 能力织机（Ming Fabric）核心类型
 *
 * 用户目标 → Recipe（方案包）→ CapabilityPlan（装配计划）→ 装配 → 执行 → 验证 → 证据。
 *
 * Recipe 是「Ming 提前策展的能力组合」（含社区插件 / skill / MCP / 官方工具），
 * CapabilityPlan 是 Resolver 针对当前目标输出的可执行计划。
 * 实现形态（skill / MCP / plugin / tool）不是用户概念，用户只描述「想让什么变成真的」。
 */

/** 单个能力的实现形态 */
export type CapabilityKind = 'skill' | 'mcp' | 'tool' | 'plugin' | 'preset'

export interface CapabilityRef {
  kind: CapabilityKind
  /** 能力标识：skill / mcp / tool / plugin 的名字；preset 为预设名 */
  id: string
  /** 来源（社区插件时给出 npm 包名或 GitHub 仓库，用于安装指引） */
  source?: string
  /** 在方案中承担的角色（人话） */
  purpose: string
  /** 信任等级：bundled=本包自带；official=DeepSeek 官方；community=社区维护 */
  trust: 'bundled' | 'official' | 'community'
  /** 可选能力缺失不阻断闭环 */
  optional?: boolean
}

/** 验收断言：把「人想要的」转成可独立检查的事实 */
export type VerificationCheck =
  | { kind: 'file_exists'; pattern: string; note?: string }
  | { kind: 'content_match'; pattern: string; contains: string; note?: string }
  | { kind: 'content_absent'; pattern: string; mustNotContain: string; note?: string }
  | { kind: 'dir_nonempty'; pattern: string; note?: string }

/**
 * 质量门槛：Ming 替用户定义「什么算好」。
 *
 * 模型变强后「怎么做到」越来越便宜，产品的价值上移到「做到什么、什么算好」。
 * qualityBar 就是每个领域的「好」：第一轮交付就要达到，不是「先出个简单的再迭代」。
 * 与 verification（硬验收：文件存在/内容匹配）不同，qualityBar 是主观质量标准，
 * 靠子代理执行时对照自查，产出「拿得出手」而非「能跑就行」。
 */
export interface QualityBar {
  /** 一句话定位：第一轮交付是什么水平（注入子代理 prompt，直接决定产出预期） */
  bar: string
  /** 具体可检查的质量要求（视觉/内容/交互/适配等，逐条注入） */
  checks: string[]
  /** 交付前必须自查的清单（子代理执行完逐条自查，全过再汇报完成） */
  selfCheck: string[]
}

/** 工作流某一步常见的坑：用户「搞半天搞不定」的那些原因 + 修法 */
export interface Pitfall {
  /** 失败时的常见现象（人话） */
  symptom: string
  /** 对应的解决办法（人话） */
  fix: string
}

/** 工作流里的一个步骤：独立委派一次子代理执行，做完独立验收 */
export interface WorkflowStep {
  id: string
  name: string
  /** 本步要完成的事（给子代理的目标描述，会与用户原始目标合并） */
  goal: string
  /** 本步的执行要求（人话，注入子代理 prompt） */
  guidance?: string[]
  /** 本步需要但可能未装配的能力（如发布步需要 publish_deploy） */
  capabilities?: CapabilityRef[]
  /** 本步完成后的验收断言（不过则停在本步） */
  verification?: VerificationCheck[]
  /** 本步常见坑与修法（失败时给用户的具体提示） */
  pitfalls?: Pitfall[]
  /**
   * 本步验收通过后暂停工作流，等待用户确认/选择后再继续。
   * 用于「动用户代码前先交底」「迷茫时给出建议清单等用户选」这类产品决策确认点；
   * 用户对 Ming 说「继续」后，以 workflowFrom=本步 id 从下一步接着做。
   */
  stopAfter?: boolean
}

/** 执行前需要向用户澄清的关键问题（只问必要的，其余用默认值） */
export interface ClarifyQuestion {
  /** 答案在装配上下文里的键名（系统逻辑维度的标识） */
  key: string
  /** 用大白话问用户（用户不懂技术，不要用术语） */
  question: string
  /** 用户不回答时使用的默认值（保证 clarify-first 也能跑） */
  default: string
  /** 给用户的可选答案（供快速选择，用户也可自由输入） */
  options?: string[]
  /** 翻译提示：用户类似的大白话回答应翻译成什么系统逻辑，帮主模型把「人话」变成执行要求 */
  translate?: string
}

/** 执行策略：不同策略走不同的中间件调用链 */
export type StrategyKind = 'mvp-first' | 'clarify-first'

export interface StrategyOption {
  id: StrategyKind
  label: string
  description: string
  recommended?: boolean
}

/** 方案包（Recipe）：Ming 提前策展的能力组合 */
export interface Recipe {
  id: string
  name: string
  description: string
  /** 规则过滤触发词：目标里命中任一即进入候选 */
  triggers: string[]
  /** 命中后给执行子代理的额外上下文（人话，说明怎么做 / 用什么） */
  guidance: string[]
  capabilities: CapabilityRef[]
  /** 委派偏好 */
  delegate?: { provider: 'spawn' | 'fork' }
  /** 验收断言：执行结束后独立检查 */
  verification: VerificationCheck[]
  /** 多步工作流（逐步执行、逐步验收；缺省为单步直接委派） */
  workflow?: WorkflowStep[]
  /** 执行前可能需要澄清的关键问题（默认值兜底；策略 mvp-first 时跳过） */
  questions?: ClarifyQuestion[]
  /** 第一轮交付的质量门槛（Ming 替用户定义「什么算好」，注入子代理 prompt） */
  qualityBar?: QualityBar
}

/** 能力可用性探测结果 */
export interface CapabilityAvailability {
  ref: CapabilityRef
  available: boolean
  /** 不可用时的安装指引 */
  installHint?: string
}

/** Resolver 输出：装配计划 */
export interface CapabilityPlan {
  goal: string
  /** 命中的方案 id；未命中为 null（退回通用委派） */
  recipeId: string | null
  recipeName: string | null
  /** 命中原因：显式指定 / 规则触发词 / 未命中 */
  matchedBy: string
  capabilities: CapabilityAvailability[]
  /** 给执行子代理的额外上下文 */
  guidance: string[]
  delegate?: { provider: 'spawn' | 'fork' }
  verification: VerificationCheck[]
  /** 是否可执行：false 时至少一个必选能力缺失 */
  executable: boolean
  /** 缺失的必选能力（可执行时为 []） */
  missingRequired: string[]
  /** 多步工作流（方案声明时存在；单步方案为 undefined） */
  workflow?: WorkflowStep[]
  /** 方案声明的澄清问题（供 clarify-first 策略用；未命中方案为空） */
  questions?: ClarifyQuestion[]
  /** 方案声明的第一轮交付质量门槛（未命中方案为 undefined） */
  qualityBar?: QualityBar
}

/** 单个断言结果 */
export interface VerificationResult {
  check: VerificationCheck
  passed: boolean
  /** 人类可读的证据细节（匹配到哪些文件 / 为什么失败） */
  detail: string
}

export interface VerificationSummary {
  passed: number
  failed: number
  results: VerificationResult[]
}

/** 通用委派（未命中任何方案时的默认执行方式，与旧版 ming_auto 行为一致） */
export const DEFAULT_DELEGATE = { provider: 'spawn' as const }
