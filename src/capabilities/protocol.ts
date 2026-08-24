/**
 * 验收协议（Acceptance Protocol）
 *
 * 把「什么算好 + 怎么验证」从 Recipe 里抽成一个可独立校验、可版本化的概念。
 *
 * 为什么需要它：
 *   - verification 与 qualityBar 现在是散落在 Recipe 里的普通字段，
 *     写错断言（拼错 kind、漏 pattern、漏 contains）要拖到执行阶段 verifier 跑
 *     到 default 分支才崩；本模块让协议在进入执行前就能被静态校验。
 *   - schemaVersion 让协议未来演进（新增断言 kind、新增质量维度、字段改名）
 *     时可迁移、可追溯：历史证据卡记录自己由哪个版本的协议产出。
 *
 * 第一版只做地基：版本号 + 纯函数校验器。运行时 fail-fast 与协议演进迁移
 * 留到协议真正开始变化时再上（YAGNI）。
 */

import type { QualityBar, Recipe, VerificationCheck } from './types.js'

/** 验收协议 schema 版本。协议结构变更时 +1；证据卡记录本值用于历史迁移。 */
export const ACCEPTANCE_PROTOCOL_VERSION = 1

/** 当前协议支持的所有断言类型 */
const SUPPORTED_CHECK_KINDS = new Set(['file_exists', 'content_match', 'content_absent', 'dir_nonempty', 'browser_acceptance'])

/** 协议校验失败的一处问题：定位 + 人话原因 */
export interface ProtocolValidationError {
  /** 出错位置，如 verification[2] 或 qualityBar.checks */
  path: string
  /** 人话原因（可读给开发者/用户看） */
  message: string
}

function kindOf(check: VerificationCheck): string {
  return (check as { kind?: string })?.kind ?? ''
}

/**
 * 校验一组验收断言是否合法。
 * 纯函数，零副作用；返回空数组表示全部合法。
 */
export function validateVerificationChecks(checks: VerificationCheck[]): ProtocolValidationError[] {
  const errors: ProtocolValidationError[] = []

  if (!Array.isArray(checks)) {
    errors.push({ path: 'verification', message: '验收断言应为数组' })
    return errors
  }

  checks.forEach((check, i) => {
    const path = `verification[${i}]`
    const kind = kindOf(check)

    if (!kind || !SUPPORTED_CHECK_KINDS.has(kind)) {
      errors.push({ path, message: `断言类型「${kind || '缺失'}」不合法` })
      return // 类型不合法，不再检查后续字段
    }

    // browser_acceptance 用 spec（文件路径/URL）而非 pattern；其余断言必须非空 pattern
    if (check.kind === 'browser_acceptance') {
      if (typeof check.spec !== 'string' || check.spec.trim() === '') {
        errors.push({ path, message: 'browser_acceptance 缺少非空 spec（JSON 验收规格路径）' })
      }
      return
    }

    if (typeof check.pattern !== 'string' || check.pattern.trim() === '') {
      errors.push({ path, message: `${kind} 缺少非空 pattern` })
    }

    if (check.kind === 'content_match' && (typeof check.contains !== 'string' || check.contains === '')) {
      errors.push({ path, message: 'content_match 缺少非空 contains' })
    }

    if (check.kind === 'content_absent' && (typeof check.mustNotContain !== 'string' || check.mustNotContain === '')) {
      errors.push({ path, message: 'content_absent 缺少非空 mustNotContain' })
    }
  })

  return errors
}

/**
 * 校验质量门槛是否合法。undefined 视为合法（方案可不声明质量门槛）。
 * 纯函数，零副作用。
 */
export function validateQualityBar(bar: QualityBar | undefined): ProtocolValidationError[] {
  if (!bar) return []

  const errors: ProtocolValidationError[] = []

  if (typeof bar.bar !== 'string' || bar.bar.trim() === '') {
    errors.push({ path: 'qualityBar.bar', message: '质量门槛缺少一句话定位 bar' })
  }

  if (!Array.isArray(bar.checks) || bar.checks.some(c => typeof c !== 'string' || c.trim() === '')) {
    errors.push({ path: 'qualityBar.checks', message: '质量检查项应为非空字符串数组' })
  }

  if (!Array.isArray(bar.selfCheck) || bar.selfCheck.some(c => typeof c !== 'string' || c.trim() === '')) {
    errors.push({ path: 'qualityBar.selfCheck', message: '自查项应为非空字符串数组' })
  }

  return errors
}

/** 把校验错误格式化成人话（供 fail-fast 报错或测试诊断） */
export function formatProtocolErrors(errors: ProtocolValidationError[]): string {
  if (errors.length === 0) return ''
  return errors.map(e => `- ${e.path}: ${e.message}`).join('\n')
}

/**
 * 校验一个完整方案的验收协议（recipe 级断言 + 质量门槛 + 工作流每步断言）。
 * 返回空数组表示协议合法。resolver 在装配阶段调用本函数 fail-fast。
 */
export function validateRecipeProtocol(recipe: Recipe): ProtocolValidationError[] {
  const errors: ProtocolValidationError[] = [
    ...validateVerificationChecks(recipe.verification),
    ...validateQualityBar(recipe.qualityBar),
  ]
  for (const step of recipe.workflow ?? []) {
    const stepErrors = validateVerificationChecks(step.verification ?? [])
    for (const e of stepErrors) {
      errors.push({ path: `workflow[${step.id}].${e.path}`, message: e.message })
    }
  }
  return errors
}
