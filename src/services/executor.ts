/**
 * 执行引擎（薄转发器）
 *
 * 不重复造轮子：不自己写「意图分析 / 步骤规划 / 能力匹配」。
 * 用户用自然语言描述目标后，直接交给 Harness 原生的子代理 seam
 * （ctx.subagents）去完成——子代理自带 LLM 与工具，能自己理解、规划、执行。
 *
 * 在「转交」之外补三件可靠性小事：
 *   1. 资源预检：resources 里的本地路径先验证存在性，避免浪费一整轮执行；
 *   2. 执行超时：默认 15 分钟（MING_TIMEOUT_MS 可调），超时中止并如实上报；
 *   3. 产物校验：对汇报中的本地路径逐一 stat，把「声称产出」变成「确认存在」。
 *
 * 子代理不可用时，降级为「计划模式」：把目标原样交回当前助手完成。
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ArtifactCheck, ErrorKind, ExecutionOutcome } from '../types.js'

/** 子代理服务的松散类型（避免强耦合 dsh-subagent 的具体类型名） */
interface SubagentRuntime {
  list(): string[]
  start(name: string, request: unknown): Promise<SubagentRun>
}

interface SubagentRun {
  id: string
  result: Promise<{
    output: Array<{ type: string; text?: string }>
    stopReason: string
  }>
  dispose(): Promise<void>
}

/** 默认执行超时：15 分钟。可用环境变量 MING_TIMEOUT_MS 覆盖（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export function resolveTimeoutMs(): number {
  const raw = Number(process.env.MING_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TIMEOUT_MS
}

function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text)
}

/** 只有「长得像路径」的资源才做存在性检查；普通描述性文字跳过 */
export function looksLikeLocalPath(text: string): boolean {
  if (isUrl(text)) return false
  return (
    /[\\/]/.test(text) ||
    /^[A-Za-z]:/.test(text) ||
    text.startsWith('./') ||
    text.startsWith('../') ||
    text.startsWith('~')
  )
}

export function resolveWorkdir(exec: any): string {
  return exec.agent?.session?.header?.cwd ?? process.cwd()
}

/**
 * 执行用户目标。
 */
export interface ExecuteOptions {
  /** 装配上下文：命中方案后注入给执行子代理的额外要求（见 capabilities/assembler） */
  contextual?: string[]
}

export async function execute(
  ctx: Context,
  goal: string,
  resources: string[],
  exec: any,
  options: ExecuteOptions = {},
): Promise<ExecutionOutcome> {
  const startedAt = Date.now()

  // 可靠性 1：资源预检——路径形态的资源不存在就直接失败，省一轮子代理执行
  const workdir = resolveWorkdir(exec)
  const missingResources = await findMissingResources(resources, workdir)
  if (missingResources.length > 0) {
    return {
      mode: 'planned',
      success: false,
      summary: `提供的资源中有 ${missingResources.length} 个本地路径不存在，已取消委派：${missingResources.join('、')}`,
      artifacts: [],
      error: `资源不存在：${missingResources.join(', ')}`,
      errorKind: 'resource-missing',
      durationMs: Date.now() - startedAt,
    }
  }

  const subagents = ctx.get('subagents') as SubagentRuntime | undefined
  const provider = pickProvider(subagents)

  if (subagents && provider && exec?.agent) {
    return executeViaSubagent(subagents, provider, goal, resources, exec, startedAt, options.contextual)
  }

  return {
    mode: 'planned',
    success: false,
    summary:
      '当前环境未启用子代理执行引擎，无法委托执行。请直接用你自己的工具完成该目标并产出真实文件。',
    artifacts: [],
    errorKind: 'engine-unavailable',
    durationMs: Date.now() - startedAt,
  }
}

async function executeViaSubagent(
  subagents: SubagentRuntime,
  provider: string,
  goal: string,
  resources: string[],
  exec: any,
  startedAt: number,
  contextual?: string[],
): Promise<ExecutionOutcome> {
  const workdir = resolveWorkdir(exec)
  const prompt = buildPrompt(goal, resources, workdir, contextual)

  // 可靠性 2：执行超时——组合父级取消信号与本地计时器
  let timedOut = false
  const deadline = withDeadline(exec.signal, () => {
    timedOut = true
  })

  try {
    const run = await subagents.start(provider, {
      label: `ming: ${truncate(goal, 40)}`,
      prompt: [{ type: 'text', text: prompt }],
      parent: exec.agent,
      signal: deadline.signal,
      // 显式锁定工作目录：让子代理落盘到当前会话工作区，而非 host 进程 cwd
      cwd: workdir,
      // 工具层硬隔离递归：子代理看不到 ming_auto，绝不会再次委派给自己
      toolFilter: { deny: ['ming_auto'] },
    })

    let result: Awaited<SubagentRun['result']>
    try {
      result = await run.result
    } finally {
      deadline.dispose()
      try {
        await run.dispose()
      } catch {
        /* dispose 失败不掩盖主结果 */
      }
    }

    const meta = {
      mode: 'executed' as const,
      durationMs: Date.now() - startedAt,
      provider,
      stopReason: result.stopReason,
    }

    if (result.stopReason !== 'completed') {
      if (result.stopReason === 'aborted' && timedOut) {
        return {
          ...meta,
          success: false,
          summary: `执行超时（超过 ${(resolveTimeoutMs() / 60000).toFixed(0)} 分钟），已中止。建议拆小任务，或设置 MING_TIMEOUT_MS 调大超时后重试。`,
          artifacts: [],
          error: 'timeout',
          errorKind: 'timeout',
        }
      }
      const reason = stopReasonText(result.stopReason)
      return {
        ...meta,
        success: false,
        summary: `执行未完成：${reason}`,
        artifacts: [],
        error: reason,
        errorKind: kindFromStopReason(result.stopReason),
      }
    }

    const text = result.output
      .filter(block => block.type === 'text')
      .map(block => block.text ?? '')
      .join('')

    // 可靠性 3：产物校验——「声称产出」逐项对照磁盘
    const candidateArtifacts = extractArtifacts(text)
    const artifactChecks = await verifyArtifacts(candidateArtifacts, workdir)

    return {
      ...meta,
      success: true,
      summary: text.trim() || '任务已执行完成',
      artifacts: candidateArtifacts,
      artifactChecks,
    }
  } catch (error) {
    if (timedOut) {
      return {
        mode: 'executed',
        success: false,
        summary: `执行超时（超过 ${(resolveTimeoutMs() / 60000).toFixed(0)} 分钟），已中止。建议拆小任务，或设置 MING_TIMEOUT_MS 调大超时后重试。`,
        artifacts: [],
        error: String(error),
        errorKind: 'timeout',
        durationMs: Date.now() - startedAt,
        provider,
      }
    }
    return {
      mode: 'executed',
      success: false,
      summary: '执行引擎调用失败',
      artifacts: [],
      error: String(error),
      errorKind: 'error',
      durationMs: Date.now() - startedAt,
      provider,
    }
  }
}

interface Deadline {
  signal: AbortSignal
  dispose(): void
}

/** 把父级取消信号与本地超时计时器合成一个 AbortSignal */
function withDeadline(parent: AbortSignal | undefined, onTimeout: () => void): Deadline {
  const controller = new AbortController()
  const onParentAbort = () => controller.abort(parent?.reason)

  if (parent) {
    if (parent.aborted) controller.abort(parent.reason)
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }

  const timeoutMs = resolveTimeoutMs()
  const timer = setTimeout(() => {
    onTimeout()
    controller.abort(new Error(`ming_auto 执行超时（${timeoutMs}ms）`))
  }, timeoutMs)

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
  }
}

async function findMissingResources(resources: string[], workdir: string): Promise<string[]> {
  const missing: string[] = []
  for (const resource of resources) {
    if (!looksLikeLocalPath(resource)) continue
    if (!(await pathExists(resource, workdir))) missing.push(resource)
  }
  return missing
}

async function pathExists(rawPath: string, workdir: string): Promise<boolean> {
  try {
    await stat(toAbsolute(rawPath, workdir))
    return true
  } catch {
    return false
  }
}

async function verifyArtifacts(
  candidates: string[],
  workdir: string,
): Promise<ArtifactCheck[]> {
  return Promise.all(candidates.map(candidate => verifyOne(candidate, workdir)))
}

async function verifyOne(raw: string, workdir: string): Promise<ArtifactCheck> {
  if (isUrl(raw)) return { raw, kind: 'url' }
  try {
    const info = await stat(toAbsolute(raw, workdir))
    return {
      raw,
      kind: 'file',
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    }
  } catch {
    return { raw, kind: 'missing' }
  }
}

function toAbsolute(rawPath: string, workdir: string): string {
  const trimmed = rawPath.replace(/[.,;]+$/u, '')
  if (isAbsolute(trimmed)) return trimmed
  const withoutTilde = trimmed.replace(/^~[\\/]/, '')
  return isAbsolute(withoutTilde) ? withoutTilde : resolve(workdir, withoutTilde)
}

function buildPrompt(goal: string, resources: string[], workdir: string, contextual?: string[]): string {
  const lines: string[] = [
    '你是 Ming 的执行助手。请完整地完成下面的任务，并产出真实结果（文件、脚本、网页等），不要只给建议。',
    '你可以使用可用的工具（读写文件、执行命令、子代理等）来完成它。',
    '重要：你正在执行一个被委派的具体任务，直接完成它；不要调用 ming_auto 工具，也不要再次把任务转交他人。',
    '',
    `【用户目标】\n${goal}`,
  ]

  if (contextual && contextual.length > 0) {
    lines.push('', ...contextual)
  }

  if (resources.length > 0) {
    lines.push('', '【用户提供的资源】', ...resources.map(r => `- ${r}`))
  }

  lines.push('', `【工作目录】\n${workdir}`)
  lines.push('', '完成后，用简洁的中文汇报：做了什么、产出了哪些文件（绝对路径）、如何查看。')
  return lines.join('\n')
}

/** 从汇报文本里提取产物路径/URL（尽力而为） */
export function extractArtifacts(text: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /[A-Za-z]:\\[^\s，。；、`"']+/g,
    /(?:\/|\.\/)[^\s，。；、`"']+\.[A-Za-z0-9]{1,5}/g,
    /https?:\/\/[^\s，。；、`"']+/gi,
  ]
  for (const re of patterns) {
    for (const m of text.match(re) ?? []) {
      found.add(m)
    }
  }
  return [...found]
}

function pickProvider(subagents?: SubagentRuntime): string | undefined {
  if (!subagents) return undefined
  const available = subagents.list()
  // spawn = 全新子代理，自带完整任务书；fork = 继承父级上下文。
  for (const preferred of ['spawn', 'fork']) {
    if (available.includes(preferred)) return preferred
  }
  return available[0]
}

export function kindFromStopReason(stopReason: string): ErrorKind {
  switch (stopReason) {
    case 'aborted':
      return 'aborted'
    case 'max-tokens':
      return 'max-tokens'
    case 'refusal':
      return 'refusal'
    default:
      return 'error'
  }
}

export function stopReasonText(stopReason: string): string {
  switch (stopReason) {
    case 'aborted':
      return '任务被取消'
    case 'error':
      return '执行出错'
    case 'max-tokens':
      return '执行达到 token 上限，未能完成'
    case 'refusal':
      return '执行引擎拒绝了该任务'
    default:
      return `异常结束（${String(stopReason)}）`
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}
