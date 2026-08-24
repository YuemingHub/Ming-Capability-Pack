import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendAcceptanceRecord,
  computeVte,
  computeVteTrend,
  failedKindsOf,
  formatAcceptance,
  formatDeliveryReview,
  formatMingResult,
  formatVte,
  monthKeyOf,
  readAcceptanceHistory,
  summarizeAcceptance,
} from '../dist/internals.js'

// ---------- failedKindsOf ----------

test('failedKindsOf 只提取失败断言的 kind', () => {
  const results = [
    { check: { kind: 'file_exists', pattern: '*.html' }, passed: true, detail: '' },
    { check: { kind: 'content_match', pattern: 'x', contains: 'y' }, passed: false, detail: '' },
    { check: { kind: 'dir_nonempty', pattern: 'x' }, passed: false, detail: '' },
  ]
  assert.deepEqual(failedKindsOf(results), ['content_match', 'dir_nonempty'])
})

test('failedKindsOf 全通过时返回空数组', () => {
  const results = [{ check: { kind: 'file_exists', pattern: '*.html' }, passed: true, detail: '' }]
  assert.deepEqual(failedKindsOf(results), [])
})

// ---------- append + read 往返 ----------

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ming-acceptance-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('append 后 read 能读回记录且内容一致', async () => {
  await withTmp(async (dir) => {
    const record = {
      timestamp: '2026-01-01T00:00:00.000Z',
      recipeId: 'personal-site',
      recipeName: '搭建个人网站',
      passed: 2,
      failed: 1,
      failedKinds: ['content_match'],
    }
    const path = await appendAcceptanceRecord(dir, record)
    assert.match(path, /acceptance-history\.jsonl$/)

    const records = await readAcceptanceHistory(dir)
    assert.equal(records.length, 1)
    assert.deepEqual(records[0], record)
  })
})

test('read 在文件不存在时返回空数组', async () => {
  await withTmp(async (dir) => {
    const records = await readAcceptanceHistory(dir)
    assert.deepEqual(records, [])
  })
})

test('read 跳过坏行不丢整个历史', async () => {
  await withTmp(async (dir) => {
    await appendAcceptanceRecord(dir, {
      timestamp: 't1', recipeId: 'a', recipeName: 'A', passed: 1, failed: 0, failedKinds: [],
    })
    await appendAcceptanceRecord(dir, {
      timestamp: 't2', recipeId: 'b', recipeName: 'B', passed: 0, failed: 1, failedKinds: ['x'],
    })
    // 手动追加一行坏 JSON
    const { appendFile } = await import('node:fs/promises')
    await appendFile(join(dir, 'ming-evidence', 'acceptance-history.jsonl'), '{not-valid-json\n', 'utf-8')

    const records = await readAcceptanceHistory(dir)
    assert.equal(records.length, 2) // 坏行被跳过
  })
})

// ---------- summarizeAcceptance ----------

test('summarizeAcceptance 按方案聚合通过率', () => {
  const records = [
    { timestamp: 't1', recipeId: 'a', recipeName: 'A', passed: 3, failed: 1, failedKinds: ['x'] },
    { timestamp: 't2', recipeId: 'a', recipeName: 'A', passed: 2, failed: 0, failedKinds: [] },
    { timestamp: 't3', recipeId: 'b', recipeName: 'B', passed: 0, failed: 2, failedKinds: ['x', 'y'] },
  ]
  const summaries = summarizeAcceptance(records)
  assert.equal(summaries.length, 2)

  const a = summaries.find(s => s.recipeId === 'a')
  assert.equal(a.totalRuns, 2)
  assert.equal(a.totalPassed, 5)
  assert.equal(a.totalFailed, 1)
  assert.equal(a.passRate, 5 / 6)
  assert.equal(a.lastRunAt, 't2')

  const b = summaries.find(s => s.recipeId === 'b')
  assert.equal(b.totalRuns, 1)
  assert.equal(b.passRate, 0)
})

test('summarizeAcceptance 空记录返回空数组', () => {
  assert.deepEqual(summarizeAcceptance([]), [])
})

test('summarizeAcceptance 无断言记录时 passRate 为 null', () => {
  const records = [
    { timestamp: 't1', recipeId: 'x', recipeName: 'X', passed: 0, failed: 0, failedKinds: [] },
  ]
  const s = summarizeAcceptance(records)[0]
  assert.equal(s.passRate, null)
})

// ---------- formatAcceptance ----------

test('formatAcceptance 空列表给出「无记录」提示', () => {
  const text = formatAcceptance([])
  assert.match(text, /还没有验收记录/)
})

test('formatAcceptance 展示方案名、运行次数与通过率', () => {
  const summaries = [
    {
      recipeId: 'personal-site', recipeName: '搭建个人网站',
      totalRuns: 2, totalPassed: 5, totalFailed: 1, passRate: 5 / 6, lastRunAt: '2026-01-01',
    },
  ]
  const text = formatAcceptance(summaries)
  assert.match(text, /搭建个人网站/)
  assert.match(text, /2 次运行/)
  assert.match(text, /83%/) // 5/6 ≈ 83%
})

test('formatAcceptance 无断言记录时通过率显示为 —', () => {
  const summaries = [
    { recipeId: 'x', recipeName: null, totalRuns: 1, totalPassed: 0, totalFailed: 0, passRate: null, lastRunAt: 't' },
  ]
  const text = formatAcceptance(summaries)
  assert.match(text, /通过率 —/)
})

// ---------- formatMingResult：信任可见 ----------

test('formatMingResult 在本次验证后展示对应方案的累计健康度', () => {
  const text = formatMingResult({
    success: true,
    mode: 'executed',
    summary: '任务完成',
    artifacts: ['D:\\out\\index.html'],
    evidence: 'D:\\out\\evidence.json',
    nextSteps: [],
    recipe: '搭建个人网站',
    planSummary: '方案已装配',
    verificationSummary: '【独立验证】通过 3 / 3',
    acceptanceHealth: '验收健康度（按方案聚合）：\n\n- 搭建个人网站：2 次运行，通过率 100%（6 过 / 0 败），最近 2026-08-23',
  })

  assert.match(text, /【独立验证】通过 3 \/ 3/)
  assert.match(text, /验收健康度（按方案聚合）/)
  assert.match(text, /搭建个人网站：2 次运行，通过率 100%/)
  assert.match(text, /── 交付展示：请你过目 ──/)
  assert.match(text, /请你看一眼结果：符合你的预期吗？/)
})

test('formatMingResult 无验收历史时不展示健康度区块', () => {
  const text = formatMingResult({
    success: true,
    mode: 'executed',
    summary: '任务完成',
    artifacts: [],
    evidence: '',
    nextSteps: [],
    recipe: '',
    planSummary: '',
    verificationSummary: '',
    acceptanceHealth: '',
  })

  assert.equal(text, '任务完成')
})

// ---------- formatDeliveryReview：交付展示（第 4 次对话） ----------

test('formatDeliveryReview 展示产出数、独立检查与证据可回查，并邀请用户过目', () => {
  const text = formatDeliveryReview({
    success: true,
    mode: 'executed',
    summary: '任务完成',
    artifacts: ['D:\\out\\index.html', 'D:\\out\\style.css'],
    evidence: 'D:\\out\\evidence.json',
    nextSteps: [],
    recipe: '搭建个人网站',
    planSummary: '',
    verificationSummary: '【独立验证】通过 3 / 3',
    acceptanceHealth: '',
  })
  assert.match(text, /── 交付展示：请你过目 ──/)
  assert.match(text, /我做了 2 项产出，并已独立检查/)
  assert.match(text, /证据记录可回查：D:\\out\\evidence\.json/)
  assert.match(text, /请你看一眼结果：符合你的预期吗？哪里要调整？/)
})

test('formatDeliveryReview 无独立验证时如实说「已交付」而不谎称检查过', () => {
  const text = formatDeliveryReview({
    success: true,
    mode: 'executed',
    summary: '任务完成',
    artifacts: ['D:\\out\\a.txt'],
    evidence: '',
    nextSteps: [],
    recipe: '',
    planSummary: '',
    verificationSummary: '',
    acceptanceHealth: '',
  })
  assert.match(text, /我做了 1 项产出，已交付/)
  assert.doesNotMatch(text, /独立检查/)
  assert.doesNotMatch(text, /证据记录可回查/)
})

test('formatMingResult 失败任务不展示交付展示（用户需要的是坑位指引，不是复盘邀请）', () => {
  const text = formatMingResult({
    success: false,
    mode: 'executed',
    summary: '执行失败：能力缺失',
    artifacts: [],
    evidence: '',
    nextSteps: ['先装配 dsh-univer-office 再重试'],
    recipe: '',
    planSummary: '',
    verificationSummary: '',
    acceptanceHealth: '',
  })
  assert.doesNotMatch(text, /交付展示/)
  assert.match(text, /先装配 dsh-univer-office 再重试/)
})

test('formatDeliveryReview 修正迭代：明确「已按你意见修正、重新做并重新验证」，不因改过就跳过验证', () => {
  const text = formatDeliveryReview({
    success: true,
    mode: 'executed',
    summary: '已按意见调整首屏',
    artifacts: ['D:\\out\\index.html'],
    evidence: 'D:\\out\\evidence.json',
    nextSteps: [],
    recipe: '搭建个人网站',
    planSummary: '',
    verificationSummary: '【独立验证】通过 3 / 3',
    acceptanceHealth: '',
    revised: '首屏太朴素，改成深色科技风',
  })
  assert.match(text, /交付展示（已按你意见修正）/)
  assert.match(text, /首屏太朴素，改成深色科技风/)
  assert.match(text, /重新做、并重新独立检查过（不是改完就算）/)
  assert.match(text, /请再看一眼：这次符合你的预期了吗？/)
  // 诚实红线：修正迭代同样完整跑验收，不出现任何「没验证」的表述
  assert.doesNotMatch(text, /未验证|没检查/)
})

test('formatMingResult 修正迭代：交付展示带着修正请求，验证摘要照常展示', () => {
  const text = formatMingResult({
    success: true,
    mode: 'executed',
    summary: '已按意见调整首屏',
    artifacts: ['D:\\out\\index.html'],
    evidence: 'D:\\out\\evidence.json',
    nextSteps: [],
    recipe: '搭建个人网站',
    planSummary: '',
    verificationSummary: '【独立验证】通过 3 / 3',
    acceptanceHealth: '',
    revised: '首屏太朴素，改成深色科技风',
  })
  assert.match(text, /【独立验证】通过 3 \/ 3/)
  assert.match(text, /已按你意见修正/)
  assert.match(text, /请再看一眼/)
})

// ---------- 北极星 VTE ----------

test('monthKeyOf 从 ISO 时间戳取月份键', () => {
  assert.equal(monthKeyOf('2026-08-23T12:00:00.000Z'), '2026-08')
})

test('computeVte 只统计指定月份且整次验收通过的记录', () => {
  const records = [
    { timestamp: '2026-08-01T00:00:00Z', recipeId: 'a', recipeName: 'A', passed: 2, failed: 0, failedKinds: [] },
    { timestamp: '2026-08-15T00:00:00Z', recipeId: 'a', recipeName: 'A', passed: 1, failed: 1, failedKinds: ['x'] },
    { timestamp: '2026-07-20T00:00:00Z', recipeId: 'b', recipeName: 'B', passed: 3, failed: 0, failedKinds: [] },
    { timestamp: '2026-08-30T00:00:00Z', recipeId: 'b', recipeName: 'B', passed: 0, failed: 2, failedKinds: ['x'] },
  ]
  assert.equal(computeVte(records, '2026-08'), 1) // 只有第一条整次通过
  assert.equal(computeVte(records, '2026-07'), 1)
  assert.equal(computeVte(records, '2026-06'), 0)
})

test('computeVte 缺省用当前月', () => {
  const now = new Date().toISOString().slice(0, 7)
  const records = [{ timestamp: `${now}-15T00:00:00Z`, recipeId: 'a', recipeName: 'A', passed: 1, failed: 0, failedKinds: [] }]
  assert.equal(computeVte(records), 1)
})

test('computeVteTrend 返回近 N 个月从旧到新的趋势', () => {
  const records = [
    { timestamp: '2026-08-01T00:00:00Z', recipeId: 'a', recipeName: 'A', passed: 2, failed: 0, failedKinds: [] },
    { timestamp: '2026-07-01T00:00:00Z', recipeId: 'a', recipeName: 'A', passed: 1, failed: 0, failedKinds: [] },
  ]
  const trend = computeVteTrend(records, 3)
  assert.equal(trend.length, 3)
  // 月份键从旧到新递增
  for (let i = 1; i < trend.length; i++) {
    assert.ok(trend[i].month > trend[i - 1].month)
  }
  assert.equal(typeof trend[0].vte, 'number')
})

test('formatVte 展示当月与趋势', () => {
  const text = formatVte(3, [{ month: '2026-06', vte: 1 }, { month: '2026-07', vte: 2 }, { month: '2026-08', vte: 3 }])
  assert.match(text, /本月 VTE：3/)
  assert.match(text, /2026-08：3/)
})
