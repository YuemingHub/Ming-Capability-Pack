import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assembleContext,
  findRecipesByGoal,
  getRecipe,
  recipeCatalog,
  resolveCapabilities,
  verifyChecks,
  matchesSimplePatternForTest,
} from '../dist/internals.js'

// ---------- mock Harness context（无真实子代理 / 无 skill） ----------

function mockCtx() {
  return {
    get: (key) => (key === 'skills' ? { list: async () => [] } : undefined),
    tools: { schemas: () => [] },
  }
}

// ---------- Resolver ----------

test('resolveCapabilities 规则命中整理方案且可执行', async () => {
  const plan = await resolveCapabilities(mockCtx(), { goal: '帮我把下载文件夹整理一下' })
  assert.equal(plan.recipeId, 'tidy-downloads')
  assert.equal(plan.executable, true) // fs_* 基础能力视为可用
  assert.equal(plan.missingRequired.length, 0)
  assert.match(plan.matchedBy, /^rules:/)
})

test('resolveCapabilities 显式指定方案', async () => {
  const plan = await resolveCapabilities(mockCtx(), { goal: '随便什么目标', recipeId: 'html-report' })
  assert.equal(plan.recipeId, 'html-report')
  assert.match(plan.matchedBy, /^explicit:/)
})

test('resolveCapabilities 未命中退回通用委派', async () => {
  const plan = await resolveCapabilities(mockCtx(), { goal: '帮我写一首诗' })
  assert.equal(plan.recipeId, null)
  assert.equal(plan.executable, true)
  assert.equal(plan.verification.length, 0)
})

test('resolveCapabilities 显式未知方案退回通用委派', async () => {
  const plan = await resolveCapabilities(mockCtx(), { goal: 'x', recipeId: 'no-such-recipe' })
  assert.equal(plan.recipeId, null)
  assert.match(plan.matchedBy, /explicit-unknown/)
})

// ---------- Recipe 规则匹配 ----------

test('findRecipesByGoal 命中整理文件夹方案', () => {
  const found = findRecipesByGoal('帮我把 downloads 文件夹整理一下，文件太多了')
  assert.ok(found.length >= 1)
  assert.equal(found[0].recipe.id, 'tidy-downloads')
})

test('findRecipesByGoal 命中 HTML 报表方案', () => {
  const found = findRecipesByGoal('把这周的数据做一份 HTML 周报')
  assert.equal(found[0].recipe.id, 'html-report')
})

test('findRecipesByGoal 未命中返回空', () => {
  assert.deepEqual(findRecipesByGoal('帮我写一首关于秋天的诗'), [])
})

test('getRecipe 按 id 精确获取', () => {
  const r = getRecipe('html-report')
  assert.ok(r)
  assert.ok(r.verification.length >= 2)
})

test('recipeCatalog 只暴露目录字段', () => {
  const catalog = recipeCatalog()
  assert.ok(catalog.length >= 2)
  for (const entry of catalog) {
    assert.ok(entry.id && entry.name && entry.description && Array.isArray(entry.triggers))
    assert.equal('capabilities' in entry, false)
  }
})

// ---------- Assembler ----------

test('assembleContext 输出方案名与执行要求', () => {
  const plan = {
    goal: '整理下载文件夹',
    recipeId: 'tidy-downloads',
    recipeName: '整理下载/工作文件夹',
    matchedBy: 'rules:整理',
    capabilities: [{ ref: { kind: 'tool', id: 'fs_*', purpose: '扫描与移动文件', trust: 'official' }, available: true }],
    guidance: ['先扫描目标目录', '完成后汇报'],
    delegate: { provider: 'spawn' },
    verification: [],
    executable: true,
    missingRequired: [],
  }
  const lines = assembleContext(plan)
  assert.ok(lines.some(l => l.includes('整理下载/工作文件夹')))
  assert.ok(lines.some(l => l.includes('先扫描目标目录')))
})

test('assembleContext 诚实标注能力缺口', () => {
  const plan = {
    goal: 'x',
    recipeId: 'r',
    recipeName: 'R',
    matchedBy: 'explicit:r',
    capabilities: [
      { ref: { kind: 'skill', id: 'no-such-skill', purpose: '图表', trust: 'community' }, available: false, installHint: '缺少 skill「no-such-skill」' },
    ],
    guidance: [],
    delegate: { provider: 'spawn' },
    verification: [],
    executable: false,
    missingRequired: ['skill:no-such-skill'],
  }
  const lines = assembleContext(plan)
  assert.ok(lines.some(l => l.includes('能力缺口')))
  assert.ok(lines.some(l => l.includes('no-such-skill')))
})

// ---------- Verifier ----------

test('verifyChecks 验证文件存在 / 内容匹配 / 目录非空', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ming-cap-test-'))
  try {
    await writeFile(join(dir, 'report.html'), '<html><body>hi</body></html>', 'utf-8')
    await writeFile(join(dir, 'data.csv'), 'a,b\n1,2', 'utf-8')
    await mkdir(join(dir, 'sub'))
    await writeFile(join(dir, 'sub', 'note.txt'), 'x', 'utf-8')

    const summary = await verifyChecks(
      [
        { kind: 'file_exists', pattern: '*.html' },
        { kind: 'content_match', pattern: '*.html', contains: '<html>' },
        { kind: 'content_match', pattern: '*.html', contains: '不存在的内容' },
        { kind: 'dir_nonempty', pattern: '**/*' },
      ],
      dir,
    )

    assert.equal(summary.passed, 3)
    assert.equal(summary.failed, 1)
    const failed = summary.results.find(r => !r.passed)
    assert.match(failed.detail, /未包含/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('verifyChecks 空断言列表', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ming-cap-empty-'))
  try {
    const summary = await verifyChecks([], dir)
    assert.equal(summary.passed, 0)
    assert.equal(summary.failed, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('matchesSimplePattern 简单通配', () => {
  assert.equal(matchesSimplePatternForTest('a.html', '*.html'), true)
  assert.equal(matchesSimplePatternForTest('b.txt', '*.html'), false)
  assert.equal(matchesSimplePatternForTest('deep/nested/report.html', '*.html'), true)
  assert.equal(matchesSimplePatternForTest('x', '*'), true)
})
