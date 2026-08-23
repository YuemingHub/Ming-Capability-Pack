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
  planExecution,
  clarifyStatus,
  formatClarify,
  resolveAnswers,
  STRATEGY_OPTIONS,
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

// ---------- Planner / 策略选择 ----------

test('planExecution 恒给两个策略选项，推荐 mvp-first', async () => {
  const ep = await planExecution(mockCtx(), { goal: '我想做个个人网站' })
  assert.equal(ep.strategyOptions.length, 2)
  assert.equal(ep.strategyOptions[0].id, 'mvp-first')
  assert.equal(ep.strategyOptions[0].recommended, true)
  assert.equal(ep.strategyOptions[1].id, 'clarify-first')
})

test('planExecution 命中个人网站方案并带澄清问题', async () => {
  const ep = await planExecution(mockCtx(), { goal: '帮我做个个人网站，展示我的作品' })
  assert.equal(ep.plan.recipeId, 'personal-site')
  assert.ok(ep.questions.length >= 3)
  assert.ok(ep.questions.some(q => q.key === 'theme' && q.default))
})

test('planExecution 未命中方案时无澄清问题', async () => {
  const ep = await planExecution(mockCtx(), { goal: '帮我写一首诗' })
  assert.equal(ep.plan.recipeId, null)
  assert.equal(ep.questions.length, 0)
})

test('resolveAnswers mvp-first 全部用默认值', () => {
  const plan = {
    questions: [
      { key: 'theme', question: '主题？', default: '个人介绍' },
      { key: 'style', question: '风格？', default: '简洁现代' },
    ],
  }
  const resolved = resolveAnswers(plan, 'mvp-first', { theme: '用户自己说的主题' })
  assert.deepEqual(resolved, { theme: '个人介绍', style: '简洁现代' })
})

test('resolveAnswers clarify-first 优先用户答案，缺省回落默认', () => {
  const plan = {
    questions: [
      { key: 'theme', question: '主题？', default: '个人介绍' },
      { key: 'style', question: '风格？', default: '简洁现代' },
    ],
  }
  const resolved = resolveAnswers(plan, 'clarify-first', { theme: '个人博客' })
  assert.deepEqual(resolved, { theme: '个人博客', style: '简洁现代' })
})

test('resolveAnswers 无澄清问题时返回 undefined', () => {
  assert.equal(resolveAnswers({ questions: [] }, 'mvp-first', {}), undefined)
})

test('assembleContext 注入用户确认的方向', () => {
  const plan = {
    goal: 'x',
    recipeId: 'personal-site',
    recipeName: '搭建个人网站/主页',
    matchedBy: 'rules:个人网站',
    capabilities: [{ ref: { kind: 'tool', id: 'fs_*', purpose: 'x', trust: 'official' }, available: true }],
    guidance: ['先搭骨架'],
    delegate: { provider: 'spawn' },
    verification: [],
    executable: true,
    missingRequired: [],
  }
  const lines = assembleContext(plan, { theme: '个人博客', style: '深色科技' })
  assert.ok(lines.some(l => l.includes('用户已确认的方向')))
  assert.ok(lines.some(l => l.includes('theme：个人博客')))
})

test('STRATEGY_OPTIONS 导出两个固定策略', () => {
  assert.equal(STRATEGY_OPTIONS.length, 2)
})

// ---------- 对话式澄清（clarify-first）----------

test('clarifyStatus 缺什么报告什么，信息够就 done', () => {
  const plan = {
    questions: [
      { key: 'theme', question: '用途？', default: '作品展示' },
      { key: 'style', question: '风格？', default: '简洁' },
      { key: 'scope', question: '范围？', default: '首页' },
    ],
  }
  const s1 = clarifyStatus(plan, {})
  assert.equal(s1.done, false)
  assert.deepEqual(s1.missing.map(m => m.key), ['theme', 'style', 'scope'])
  assert.deepEqual(s1.confirmed, {})

  const s2 = clarifyStatus(plan, { theme: '个人博客', style: '文艺清新' })
  assert.equal(s2.done, false)
  assert.deepEqual(s2.confirmed, { theme: '个人博客', style: '文艺清新' })
  assert.deepEqual(s2.missing.map(m => m.key), ['scope'])

  const s3 = clarifyStatus(plan, { theme: '个人博客', style: '文艺清新', scope: '单页' })
  assert.equal(s3.done, true)
  assert.equal(s3.missing.length, 0)
})

test('clarifyStatus 空回答视为未确认', () => {
  const plan = { questions: [{ key: 'theme', question: '用途？', default: '作品展示' }] }
  const s = clarifyStatus(plan, { theme: '  ' })
  assert.equal(s.done, false)
  assert.equal(s.missing.length, 1)
})

test('clarifyStatus 无问题时立即 done', () => {
  const s = clarifyStatus({ questions: [] }, {})
  assert.equal(s.done, true)
})

test('personal-site 澄清问题带翻译提示', () => {
  const r = getRecipe('personal-site')
  assert.ok(r)
  assert.ok(r.questions.every(q => q.translate))
  assert.match(r.questions.find(q => q.key === 'style').translate, /文艺/)
})

test('formatClarify 未完成时给出问题与翻译参考', () => {
  const plan = {
    questions: [{ key: 'theme', question: '网站用途？', default: '作品展示', translate: '展示作品→作品集' }],
  }
  const s = clarifyStatus(plan, {})
  const text = formatClarify(s)
  assert.match(text, /网站用途/)
  assert.match(text, /翻译参考/)
  assert.match(text, /你看着办/)
})

test('formatClarify 完成时提示开始做', () => {
  const plan = { questions: [{ key: 'theme', question: '用途？', default: '作品展示' }] }
  const s = clarifyStatus(plan, { theme: '个人博客' })
  const text = formatClarify(s)
  assert.match(text, /信息够了/)
  assert.match(text, /theme = 个人博客/)
})

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

test('findRecipesByGoal 命中信息图方案', () => {
  const found = findRecipesByGoal('把这段会议纪要变成一张信息图')
  assert.ok(found.some(f => f.recipe.id === 'infographic'))
})

test('findRecipesByGoal 命中演示文稿方案', () => {
  const found = findRecipesByGoal('帮我做一套介绍我们产品的 PPT')
  assert.ok(found.some(f => f.recipe.id === 'presentation'))
})

test('findRecipesByGoal 未命中返回空', () => {
  assert.deepEqual(findRecipesByGoal('帮我写一首关于秋天的诗'), [])
})

test('getRecipe 按 id 精确获取', () => {
  const r = getRecipe('html-report')
  assert.ok(r)
  assert.ok(r.verification.length >= 2)
})

test('infographic 方案带翻译提示与 SVG 验收断言', () => {
  const r = getRecipe('infographic')
  assert.ok(r)
  assert.ok(r.questions.every(q => q.translate))
  assert.ok(r.verification.some(v => v.kind === 'content_match' && v.contains === 'viewBox'))
  assert.ok(r.capabilities.some(c => c.kind === 'skill' && c.id === 'modlens' && c.optional))
})

test('presentation 方案可选依赖 ppt_create（缺失不阻断）', () => {
  const r = getRecipe('presentation')
  assert.ok(r)
  assert.ok(r.questions.every(q => q.translate))
  const ppt = r.capabilities.find(c => c.id === 'ppt_create')
  assert.ok(ppt)
  assert.equal(ppt.optional, true)
  assert.equal(ppt.source, 'dsh-office-tools')
})

test('findRecipesByGoal 命中发布网站方案', () => {
  const found = findRecipesByGoal('帮我发布网站上线，让别人能打开看')
  assert.ok(found.some(f => f.recipe.id === 'publish-site'))
})

test('publish-site 方案声明 3 步工作流，deploy 在发布步且必选', () => {
  const r = getRecipe('publish-site')
  assert.ok(r)
  assert.ok(r.questions.every(q => q.translate))
  // 发布能力从方案级移到工作流「发布」步（逐步探测，缺了停在本步引导装配）
  assert.ok(r.workflow && r.workflow.length === 3)
  assert.deepEqual(r.workflow.map(s => s.id), ['prepare-site', 'check-site', 'publish'])
  const publishStep = r.workflow.find(s => s.id === 'publish')
  assert.ok(publishStep)
  const deploy = publishStep.capabilities.find(c => c.id === 'publish_deploy')
  assert.ok(deploy)
  assert.equal(deploy.optional, undefined) // 必选：缺了工作流停在本步，触发装配闭环
  assert.equal(deploy.trust, 'community')
  // 每步都有验收断言与坑位（失败时能给用户具体修法）
  assert.ok(r.workflow.every(s => s.verification?.length > 0))
  assert.ok(r.workflow.every(s => s.pitfalls?.length > 0))
  // 方案级只剩基础能力，规则命中即可执行（能力缺口交给工作流步骤级处理）
  assert.ok(r.capabilities.every(c => c.id !== 'publish_deploy'))
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
