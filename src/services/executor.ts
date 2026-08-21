/**
 * 执行引擎（薄转发器）
 *
 * 不重复造轮子：不自己写「意图分析 / 步骤规划 / 能力匹配」。
 * 用户用自然语言描述目标后，直接交给 Harness 原生的子代理 seam
 * （ctx.subagents）去完成——子代理自带 LLM 与工具，能自己理解、规划、执行。
 *
 * 子代理不可用时，降级为「计划模式」：把目标原样交回当前助手完成。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ExecutionOutcome } from '../types.js'

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

/**
 * 执行用户目标。
 */
export async function execute(
  ctx: Context,
  goal: string,
  resources: string[],
  exec: any,
): Promise<ExecutionOutcome> {
  const subagents = ctx.get('subagents') as SubagentRuntime | undefined
  const provider = pickProvider(subagents)

  if (subagents && provider && exec?.agent) {
    return executeViaSubagent(subagents, provider, goal, resources, exec)
  }

  return {
    mode: 'planned',
    success: false,
    summary:
      '当前环境未启用子代理执行引擎，无法委托执行。请直接用你自己的工具完成该目标并产出真实文件。',
    artifacts: [],
  }
}

async function executeViaSubagent(
  subagents: SubagentRuntime,
  provider: string,
  goal: string,
  resources: string[],
  exec: any,
): Promise<ExecutionOutcome> {
  const prompt = buildPrompt(goal, resources, resolveWorkdir(exec))

  try {
    const run = await subagents.start(provider, {
      label: `ming: ${truncate(goal, 40)}`,
      prompt: [{ type: 'text', text: prompt }],
      parent: exec.agent,
      signal: exec.signal,
    })

    let result: Awaited<SubagentRun['result']>
    try {
      result = await run.result
    } finally {
      try {
        await run.dispose()
      } catch {
        /* dispose 失败不掩盖主结果 */
      }
    }

    if (result.stopReason !== 'completed') {
      const reason = stopReasonText(result.stopReason)
      return {
        mode: 'executed',
        success: false,
        summary: `执行未完成：${reason}`,
        artifacts: [],
        error: reason,
      }
    }

    const text = result.output
      .filter(block => block.type === 'text')
      .map(block => block.text ?? '')
      .join('')

    return {
      mode: 'executed',
      success: true,
      summary: text.trim() || '任务已执行完成',
      artifacts: extractArtifacts(text),
    }
  } catch (error) {
    return {
      mode: 'executed',
      success: false,
      summary: '执行引擎调用失败',
      artifacts: [],
      error: String(error),
    }
  }
}

function buildPrompt(goal: string, resources: string[], workdir: string): string {
  const lines: string[] = [
    '你是 Ming 的执行助手。请完整地完成下面的任务，并产出真实结果（文件、脚本、网页等），不要只给建议。',
    '你可以使用可用的工具（读写文件、执行命令、子代理等）来完成它。',
    '',
    `【用户目标】\n${goal}`,
  ]

  if (resources.length > 0) {
    lines.push('', '【用户提供的资源】', ...resources.map(r => `- ${r}`))
  }

  lines.push('', `【工作目录】\n${workdir}`)
  lines.push('', '完成后，用简洁的中文汇报：做了什么、产出了哪些文件（绝对路径）、如何查看。')
  return lines.join('\n')
}

/** 从汇报文本里提取产物路径/URL（尽力而为） */
function extractArtifacts(text: string): string[] {
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

export function resolveWorkdir(exec: any): string {
  return exec.agent?.session?.header?.cwd ?? process.cwd()
}

function stopReasonText(stopReason: string): string {
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
