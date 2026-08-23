/**
 * 验收历史回填（标准飞轮第二块基石）
 *
 * 把每次独立验收的结果结构化追加到工作区，积累成「每个方案历次验收通过率」
 * 的原始数据。第一版只做：追加 JSONL 原始记录 + 读回 + 纯函数聚合。
 * 不做分析 / 报表 / 趋势（YAGNI）——那些等数据真的攒起来再做。
 *
 * 落盘位置：<workdir>/ming-evidence/acceptance-history.jsonl
 * （ming-evidence/ 已被 .gitignore 忽略，不污染仓库）。
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { VerificationResult } from '../capabilities/types.js'

/** 一条验收记录（一次任务的独立验证结果） */
export interface AcceptanceRecord {
  /** ISO 时间戳 */
  timestamp: string
  recipeId: string | null
  recipeName: string | null
  passed: number
  failed: number
  /** 失败断言的 kind 列表（只记 kind，不记整个断言对象，避免膨胀） */
  failedKinds: string[]
}

/** 从验证结果里提取失败断言的 kind（供回填时精简记录） */
export function failedKindsOf(results: VerificationResult[]): string[] {
  return results.filter(r => !r.passed).map(r => r.check.kind)
}

/** 追加一条验收记录到历史（JSONL，每行一条）。返回历史文件路径。 */
export async function appendAcceptanceRecord(workdir: string, record: AcceptanceRecord): Promise<string> {
  const dir = join(workdir, 'ming-evidence')
  await mkdir(dir, { recursive: true })
  const filepath = join(dir, 'acceptance-history.jsonl')
  await appendFile(filepath, JSON.stringify(record) + '\n', 'utf-8')
  return filepath
}

/** 读回全部验收记录（文件不存在时返回空数组；坏行跳过，不因单条损坏丢弃整个历史） */
export async function readAcceptanceHistory(workdir: string): Promise<AcceptanceRecord[]> {
  const filepath = join(workdir, 'ming-evidence', 'acceptance-history.jsonl')
  let content: string
  try {
    content = await readFile(filepath, 'utf-8')
  } catch {
    return []
  }
  const records: AcceptanceRecord[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      records.push(JSON.parse(trimmed))
    } catch {
      /* 坏行跳过 */
    }
  }
  return records
}

/** 单个方案的验收聚合 */
export interface AcceptanceSummary {
  recipeId: string | null
  recipeName: string | null
  totalRuns: number
  totalPassed: number
  totalFailed: number
  /** 通过率 0~1；无任何断言记录时为 null */
  passRate: number | null
  lastRunAt: string | null
}

/** 纯函数：把原始记录聚合成「每个方案历次验收通过率」 */
export function summarizeAcceptance(records: AcceptanceRecord[]): AcceptanceSummary[] {
  const byRecipe = new Map<string, AcceptanceRecord[]>()
  for (const r of records) {
    const key = r.recipeId ?? '(generic)'
    const list = byRecipe.get(key) ?? []
    list.push(r)
    byRecipe.set(key, list)
  }

  const out: AcceptanceSummary[] = []
  for (const list of byRecipe.values()) {
    const totalPassed = list.reduce((s, r) => s + r.passed, 0)
    const totalFailed = list.reduce((s, r) => s + r.failed, 0)
    const totalChecks = totalPassed + totalFailed
    const last = list[list.length - 1]
    out.push({
      recipeId: last.recipeId,
      recipeName: last.recipeName,
      totalRuns: list.length,
      totalPassed,
      totalFailed,
      passRate: totalChecks > 0 ? totalPassed / totalChecks : null,
      lastRunAt: last.timestamp,
    })
  }
  return out
}

/** 把验收聚合格式化成给人/模型看的文本（纯函数，供查询工具与测试复用） */
export function formatAcceptance(summaries: AcceptanceSummary[]): string {
  if (summaries.length === 0) {
    return '当前工作区还没有验收记录（尚未有任何带验收的方案任务完成）。'
  }
  const lines = ['验收健康度（按方案聚合）：', '']
  for (const s of summaries) {
    const rate = s.passRate === null ? '—' : `${(s.passRate * 100).toFixed(0)}%`
    const name = s.recipeName ?? s.recipeId ?? '(通用委派)'
    lines.push(`- ${name}：${s.totalRuns} 次运行，通过率 ${rate}（${s.totalPassed} 过 / ${s.totalFailed} 败），最近 ${s.lastRunAt}`)
  }
  return lines.join('\n')
}

// ---------- 北极星 VTE（月度「真执行且验证通过」的任务数） ----------

/** 从 ISO 时间戳取月份键 YYYY-MM（本地时区） */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * 计算某月的 VTE：该月内整次任务验收通过（failed === 0）的记录条数。
 * month 缺省为当前月（YYYY-MM）。
 */
export function computeVte(records: AcceptanceRecord[], month?: string): number {
  const key = month ?? monthKeyOf(new Date().toISOString())
  return records.filter(r => monthKeyOf(r.timestamp) === key && r.failed === 0).length
}

/** 近 N 个月的 VTE 趋势（含当前月，从旧到新） */
export function computeVteTrend(records: AcceptanceRecord[], months = 3): Array<{ month: string; vte: number }> {
  const now = new Date()
  const out: Array<{ month: string; vte: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ month: key, vte: computeVte(records, key) })
  }
  return out
}

/** 把 VTE 与趋势格式化成人话（纯函数，供查询工具与测试复用） */
export function formatVte(currentVte: number, trend: Array<{ month: string; vte: number }>): string {
  const line = `本月 VTE：${currentVte}`
  if (trend.length === 0) return line
  const parts = trend.map(t => `${t.month}：${t.vte}`).join('，')
  return `${line}\n近 ${trend.length} 个月趋势：${parts}`
}
