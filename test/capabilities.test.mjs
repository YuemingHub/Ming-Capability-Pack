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
  RECIPES,
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

test('findRecipesByGoal 命中文字作品方案（写份简历）', () => {
  const found = findRecipesByGoal('帮我写一份简历')
  assert.ok(found.some(f => f.recipe.id === 'writing-document'))
})

test('findRecipesByGoal 命中总结提炼方案（总结长文）', () => {
  const found = findRecipesByGoal('这篇太长，帮我总结一下要点')
  assert.ok(found.some(f => f.recipe.id === 'summarize'))
})

test('findRecipesByGoal 命中表格数据整理方案（汇总表格）', () => {
  const found = findRecipesByGoal('把这张表汇总一下，统计每月的总数')
  assert.ok(found.some(f => f.recipe.id === 'data-table'))
})

test('findRecipesByGoal 写诗不命中文字作品（避免误伤创作类）', () => {
  const found = findRecipesByGoal('帮我写一首关于秋天的诗')
  assert.equal(found.some(f => f.recipe.id === 'writing-document'), false)
})

test('resolveCapabilities 消歧：「写份总结」归文字作品，「帮我总结」归总结提炼', async () => {
  const written = await resolveCapabilities(mockCtx(), { goal: '帮我写份年终总结' })
  assert.equal(written.recipeId, 'writing-document')
  const summarized = await resolveCapabilities(mockCtx(), { goal: '把这篇会议纪要总结一下' })
  assert.equal(summarized.recipeId, 'summarize')
})

test('findRecipesByGoal 命中表格整理而非报表（「表格汇总」归 data-table）', () => {
  const found = findRecipesByGoal('把销售数据表按月份汇总统计')
  const first = [...found].sort((a, b) => (b.hits.length - a.hits.length))[0]
  assert.equal(first.recipe.id, 'data-table')
})

test('findRecipesByGoal 命中大型复杂项目方案', () => {
  assert.ok(findRecipesByGoal('帮我做一个记账系统').some(f => f.recipe.id === 'big-project'))
  assert.ok(findRecipesByGoal('开发一个大型项目').some(f => f.recipe.id === 'big-project'))
  assert.ok(findRecipesByGoal('做个爬虫工具，自动抓取数据').some(f => f.recipe.id === 'big-project'))
})

test('findRecipesByGoal 存量项目也命中 big-project（修 bug/加功能/迷茫）', () => {
  assert.ok(findRecipesByGoal('我的项目里有个 bug，帮我修一下').some(f => f.recipe.id === 'big-project'))
  assert.ok(findRecipesByGoal('给我这个项目加个导出功能').some(f => f.recipe.id === 'big-project'))
  assert.ok(findRecipesByGoal('我接手了一个项目，看不懂，不知道下一步做什么').some(f => f.recipe.id === 'big-project'))
})

test('resolveCapabilities 分流：纯「做网站」归 personal-site，复杂/存量信号归 big-project', async () => {
  // 纯展示网站：personal-site 命中，big-project 不抢
  const simple = await resolveCapabilities(mockCtx(), { goal: '帮我做个网站展示我的作品' })
  assert.equal(simple.recipeId, 'personal-site')

  // 「带后台」这类复杂信号：加权让 big-project 接住，不被「做网站」通用词淹掉
  const withBackend = await resolveCapabilities(mockCtx(), { goal: '做一个带后台管理的网站，能注册登录' })
  assert.equal(withBackend.recipeId, 'big-project')

  // 系统/应用类：直接归 big-project
  const system = await resolveCapabilities(mockCtx(), { goal: '帮我做一个记账系统' })
  assert.equal(system.recipeId, 'big-project')

  // 存量项目（修 bug/加功能/迷茫）：归 big-project
  const fixBug = await resolveCapabilities(mockCtx(), { goal: '我的项目里有个 bug，帮我修一下' })
  assert.equal(fixBug.recipeId, 'big-project')
  const lost = await resolveCapabilities(mockCtx(), { goal: '我接手了一个项目，看不懂，不知道下一步做什么' })
  assert.equal(lost.recipeId, 'big-project')
})

test('big-project 方案：现状探测分流 + 暂停确认 + 发布步能力 + 质量门槛', () => {
  const r = getRecipe('big-project')
  assert.ok(r)
  // 大型项目没法一次做完：先探测现状（从 0 / 存量），再动手、验证、交付
  assert.ok(r.workflow.length >= 4)
  assert.ok(r.workflow.some(s => s.id === 'orient' && s.stopAfter)) // 动代码前先交底/迷茫给建议，等用户点头
  assert.ok(r.workflow.some(s => s.id === 'build'))
  assert.ok(r.workflow.some(s => s.id === 'verify'))
  // 发布步声明能力，缺失由中间件自动装配（dispatch）
  const deliver = r.workflow.find(s => s.id === 'deliver')
  assert.ok(deliver.capabilities.some(c => c.id === 'publish_deploy'))
  // 澄清问题都带翻译提示（用户大白话 → 系统逻辑）
  assert.ok(r.questions.every(q => q.translate))
  // 质量门槛：从 0 可运行、存量先看懂再改、不弄坏
  assert.match(r.qualityBar.bar, /验证过/)
  assert.ok(r.qualityBar.selfCheck.some(s => s.includes('TODO')))
  assert.ok(r.qualityBar.selfCheck.some(s => s.includes('盲改')))
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
  assert.equal(ppt.source, 'dsh-univer-office')
})

test('content-cards 方案命中多平台信息图且带品牌澄清', () => {
  const found = findRecipesByGoal('把文章做成能发公众号和小红书的信息图卡片')
  assert.ok(found.some(f => f.recipe.id === 'content-cards'))
  const r = getRecipe('content-cards')
  assert.ok(r)
  assert.ok(r.questions.some(q => q.key === 'brand'))
  assert.ok(r.questions.some(q => q.key === 'platform'))
  assert.ok(r.questions.every(q => q.translate))
  assert.ok(r.verification.some(v => v.kind === 'content_match' && v.contains === 'viewBox'))
})

test('content-cards 质量门槛：低密度 + 品牌化零工具痕迹', () => {
  const r = getRecipe('content-cards')
  assert.ok(r.qualityBar)
  const checks = r.qualityBar.checks.join('\n')
  assert.match(checks, /低密度/)
  assert.match(checks, /900×383|900x383|公众号封面/)
  assert.match(checks, /1080×1440|小红书/)
  assert.match(checks, /品牌/)
  // 新手艺标准：版式系统 + 色彩克制 + 移动端字号 + 杜绝 AI 味
  assert.match(checks, /边距|对齐全卡统一|间距/)
  assert.match(checks, /主色|对比/)
  assert.match(checks, /72px/)
  const guidance = r.guidance.join('\n')
  assert.match(guidance, /不用 emoji/)
  assert.match(guidance, /渐变只从主色衍生/)
  assert.match(guidance, /任何一张卡都不放段落文字|每张卡都不放段落文字/)
  // 负向验收：绝不能出现工具痕迹
  assert.ok(r.verification.some(v => v.kind === 'content_absent' && v.mustNotContain === 'Ming'))
  const self = r.qualityBar.selfCheck.join('\n')
  assert.match(self, /水印|由.+生成/)
  assert.match(self, /emoji|花哨渐变/)
  assert.match(r.guidance.join('\n'), /绝不出现 Ming|不出现 Ming|工具痕迹/)
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
    assert.equal('qualityBar' in entry, false)
  }
})

// ---------- 质量门槛（第一轮交付标准）----------

test('全部方案都声明第一轮交付质量门槛', () => {
  for (const r of RECIPES) {
    assert.ok(r.qualityBar, `方案 ${r.id} 应声明 qualityBar`)
    assert.ok(r.qualityBar.bar.length >= 5)
    assert.ok(r.qualityBar.checks.length >= 2, `方案 ${r.id} checks 太少`)
    assert.ok(r.qualityBar.selfCheck.length >= 2, `方案 ${r.id} selfCheck 太少`)
  }
})

test('personal-site 质量门槛直击「第一轮太朴素」痛点', () => {
  const r = getRecipe('personal-site')
  assert.ok(r)
  // 执行要求里不再让子代理「先用占位」，而是要求真实语义文案
  assert.ok(r.guidance.some(g => g.includes('绝不用 Lorem 占位')))
  // 质量门槛覆盖用户实测喊的痛点：视觉主题、真实文案、动效、适配
  const checks = r.qualityBar.checks.join('')
  assert.match(checks, /视觉主题/)
  assert.match(checks, /真实质感/)
  assert.match(checks, /动效|交互/)
  assert.match(checks, /移动端/)
  assert.match(r.qualityBar.bar, /高质感/)
})

test('personal-site 手艺标准：首屏目标 + 排版系统 + 禁默认样式 + 负向验收', () => {
  const r = getRecipe('personal-site')
  assert.ok(r)
  // 目的先行与排版/色彩系统写进执行要求
  const guidance = r.guidance.join('\n')
  assert.match(guidance, /3 秒内说清|3秒内说清/)
  assert.match(guidance, /字号阶梯|行高/)
  assert.match(guidance, /默认蓝链接|Times|默认样式/)
  assert.match(guidance, /移动端优先|390px/)
  // 验收里能自动拦截 Lorem 占位
  assert.ok(r.verification.some(v => v.kind === 'content_absent' && v.mustNotContain === 'Lorem'))
})

test('assembleContext 注入第一轮交付标准与自查清单', () => {
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
    qualityBar: {
      bar: '这一轮就交付「打开能直接展示的高质感网站」',
      checks: ['有明确的视觉主题', '有存在感的交互'],
      selfCheck: ['第一眼是否「有设计感」', '所有导航链接是否都能点击跳转'],
    },
  }
  const lines = assembleContext(plan)
  const text = lines.join('\n')
  assert.match(text, /第一轮交付标准/)
  assert.match(text, /这一轮就交付「打开能直接展示的高质感网站」/)
  assert.match(text, /有明确的视觉主题/)
  assert.match(text, /交付前自查/)
  assert.match(text, /第一眼是否「有设计感」/)
})

test('assembleContext 无质量门槛时不注入交付标准', () => {
  const plan = {
    goal: 'x',
    recipeId: null,
    recipeName: null,
    matchedBy: 'no-recipe',
    capabilities: [],
    guidance: [],
    delegate: { provider: 'spawn' },
    verification: [],
    executable: true,
    missingRequired: [],
  }
  const lines = assembleContext(plan)
  assert.ok(!lines.some(l => l.includes('第一轮交付标准')))
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

test('verifyChecks content_absent 抓出禁止内容（工具水印/占位）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ming-cap-absent-'))
  try {
    await writeFile(join(dir, 'card.svg'), '<svg viewBox="0 0 900 383">FamilySpace</svg>', 'utf-8')
    await writeFile(join(dir, 'bad.svg'), '<svg>由 Ming 生成</svg>', 'utf-8')
    await writeFile(join(dir, 'index.html'), '<html><body>hi</body></html>', 'utf-8')

    // 只查干净的 card.svg：通过
    const clean = await verifyChecks([{ kind: 'content_absent', pattern: 'card.svg', mustNotContain: 'Ming' }], dir)
    assert.equal(clean.passed, 1)
    // bad.svg 含 Ming：失败并点名文件
    const dirty = await verifyChecks([{ kind: 'content_absent', pattern: '**/*.svg', mustNotContain: 'Ming' }], dir)
    assert.equal(dirty.failed, 1)
    assert.match(dirty.results[0].detail, /bad\.svg/)
    // 不匹配任何文件：视为失败（无法证明干净）
    const empty = await verifyChecks([{ kind: 'content_absent', pattern: '*.txt', mustNotContain: 'x' }], dir)
    assert.equal(empty.passed, 0)
    // 对 HTML 用两个断言：包含 + 不含，独立工作
    const site = await verifyChecks(
      [
        { kind: 'content_match', pattern: 'index.html', contains: '<html' },
        { kind: 'content_absent', pattern: 'index.html', mustNotContain: 'Lorem' },
      ],
      dir,
    )
    assert.equal(site.passed, 2)
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
