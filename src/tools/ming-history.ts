/**
 * Ming 历史查询工具
 *
 * 读取工作区 ming-evidence/ 下的证据卡，把过往任务与产出汇总给用户/模型。
 * 只读不写：历史查询绝不产生新的证据卡。
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolveWorkdir } from '../services/executor.js'
import type { HistoryEntry, HistoryResult } from '../types.js'

/** 证据卡的松散读取类型（兼容 schemaVersion 0 的旧卡） */
interface EvidenceCard {
  id?: string
  timestamp?: string
  goal?: string
  outcome?: {
    success?: boolean
    mode?: string
    artifacts?: string[]
    artifactChecks?: Array<{ raw: string; kind: string }>
    errorKind?: string
    durationMs?: number
  }
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function formatResult(value: HistoryResult): string {
  if (value.total === 0) {
    return '当前工作区还没有 Ming 任务记录（未找到 ming-evidence/ 目录或为空）。'
  }

  const lines: string[] = [
    `共 ${value.total} 条任务记录，展示最近 ${value.returned} 条：`,
    '',
  ]

  value.entries.forEach((e, i) => {
    const flag = e.success ? '✅' : '❌'
    const time = e.timestamp ? e.timestamp.replace('T', ' ').slice(0, 16) : '时间未知'
    const goal = truncate(e.goal || '(无目标记录)', 60)
    const detail = e.success
      ? `${e.artifactsCount} 个产物${e.missingCount > 0 ? `（其中 ${e.missingCount} 个未通过校验）` : ''}`
      : `失败（${e.errorKind || '原因未记录'}）`
    const duration = e.durationMs >= 0 ? ` · 耗时 ${(e.durationMs / 1000).toFixed(1)}s` : ''
    lines.push(`${i + 1}. ${flag} [${time}] ${goal}`)
    lines.push(`   ${detail}${duration}`)
  })

  lines.push('', '如需查看某条的完整证据卡，直接打开对应的 evidencePath 文件。')
  return lines.join('\n')
}

export function registerMingHistoryTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_history',
    description: `Ming 历史查询：查看之前通过 ming_auto 完成过的任务记录（时间、目标、成败、产物数量、耗时）。

适合：用户想回顾「Ming 最近做过什么」、找回之前任务的产出文件、或统计任务完成情况。
只读工具，不会执行任何新任务。`,

    parameters: {
      limit: {
        type: 'number',
        description: `可选：返回最近多少条记录，默认 ${DEFAULT_LIMIT}，最多 ${MAX_LIMIT}`,
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean', required: true },
          total: { type: 'number', required: true },
          returned: { type: 'number', required: true },
          entries: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                timestamp: { type: 'string', required: true },
                goal: { type: 'string', required: true },
                success: { type: 'boolean', required: true },
                mode: { type: 'string', required: true },
                artifactsCount: { type: 'number', required: true },
                missingCount: { type: 'number', required: true },
                errorKind: { type: 'string', required: true },
                durationMs: { type: 'number', required: true },
                evidencePath: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatResult(value as HistoryResult) }],
    },

    async execute(args, exec) {
      const workdir = resolveWorkdir(exec)
      const dir = join(workdir, 'ming-evidence')

      let rawLimit = Number(args.limit)
      if (!Number.isFinite(rawLimit)) rawLimit = DEFAULT_LIMIT
      const limit = Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)

      let files: string[]
      try {
        files = await readdir(dir)
      } catch {
        return { success: true, total: 0, returned: 0, entries: [] }
      }

      // 文件名形如 evidence-<Date.now()>.json，字典序倒排即按时间倒排
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse()
      const total = jsonFiles.length

      const entries: HistoryEntry[] = []
      for (const file of jsonFiles.slice(0, limit)) {
        try {
          const card = JSON.parse(await readFile(join(dir, file), 'utf-8')) as EvidenceCard
          const checks = card.outcome?.artifactChecks ?? []
          entries.push({
            id: String(card.id ?? file.replace(/\.json$/u, '')),
            timestamp: String(card.timestamp ?? ''),
            goal: truncate(String(card.goal ?? ''), 120),
            success: Boolean(card.outcome?.success),
            mode: String(card.outcome?.mode ?? ''),
            artifactsCount: (card.outcome?.artifacts ?? []).length,
            missingCount: checks.filter(c => c.kind === 'missing').length,
            errorKind: String(card.outcome?.errorKind ?? ''),
            durationMs: typeof card.outcome?.durationMs === 'number' ? card.outcome.durationMs : -1,
            evidencePath: join(dir, file),
          })
        } catch {
          /* 单张损坏的证据卡跳过，不影响其余 */
        }
      }

      return { success: true, total, returned: entries.length, entries }
    },
  }))
}
