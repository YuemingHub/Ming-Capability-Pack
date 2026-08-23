/**
 * 能力推荐引擎单元测试：场景排序、推荐理由、搜索词推导
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRecommendationReason, rankCandidates, suggestQueryFor, tokensOf } from '../dist/internals.js'

const PLUGINS = [
  { name: 'dsh-static-deploy', desc: 'Static site deploy / GitHub Pages 免费静态托管', category: 'deploy', stars: 2300, installCount: 120 },
  { name: 'dsh-excel-tools', desc: 'Excel 报表工具，表格读写与汇总', category: 'office', stars: 132, installCount: 50 },
  { name: 'dsh-video-gen', desc: 'AI 视频生成，做宣传短片', category: 'media', stars: 9000, installCount: 400 },
]

function textOf(p) { return `${p.name} ${p.desc} ${p.category}` }
function signalOf(p) { return { stars: p.stars, installCount: p.installCount } }

// ---------- tokensOf ----------

test('tokensOf 切分中英文混合并滤掉短词', () => {
  const tokens = tokensOf('把静态网站 发布到 GitHub Pages，免费托管')
  assert.ok(tokens.includes('github'))
  assert.ok(tokens.includes('发布到'))
  assert.ok(tokens.includes('把静态网站'))
  assert.ok(!tokens.includes('把'))
  assert.ok(!tokens.includes('到'))
})

// ---------- rankCandidates ----------

test('rankCandidates 优先用户已确认方向（scenario 权重最高）', () => {
  // 用户要做「GitHub Pages 静态托管」，场景词里含 github pages
  const ranked = rankCandidates(PLUGINS, {
    query: '网站 发布 托管',
    scenario: ['GitHub Pages'],
  }, textOf, signalOf)
  assert.equal(ranked[0].candidate.name, 'dsh-static-deploy')
})

test('rankCandidates 场景未命中时按需求关键词排序', () => {
  const ranked = rankCandidates(PLUGINS, { query: 'excel 报表' }, textOf, signalOf)
  assert.equal(ranked[0].candidate.name, 'dsh-excel-tools')
})

test('rankCandidates 记录命中的查询词与场景词', () => {
  const ranked = rankCandidates(PLUGINS, { query: 'excel', scenario: ['报表'] }, textOf, signalOf)
  assert.ok(ranked[0].scenarioHits.includes('报表'))
  assert.ok(ranked[0].queryHits.includes('excel'))
})

test('rankCandidates 高星但无关的插件不会压过相关插件', () => {
  // video-gen 有 9000 星，但跟「excel 报表」无关 → excel-tools 应排前面
  const ranked = rankCandidates(PLUGINS, { query: 'excel 报表 表格' }, textOf, signalOf)
  assert.equal(ranked[0].candidate.name, 'dsh-excel-tools')
})

// ---------- buildRecommendationReason ----------

test('buildRecommendationReason 先讲场景匹配再补热度', () => {
  const reason = buildRecommendationReason(
    'dsh-static-deploy Static site deploy GitHub Pages',
    { query: '网站 发布', purpose: '把静态网站发布到公开地址', scenario: ['GitHub Pages'] },
    { stars: 2300, installCount: 120 },
    { scenarioHits: ['github pages'], queryHits: ['发布'] },
  )
  assert.match(reason, /命中你确认的方向/)
  assert.match(reason, /github pages/)
  assert.match(reason, /补上缺口能力：把静态网站发布到公开地址/)
  assert.match(reason, /社区热选/)
  assert.match(reason, /120 次安装/)
})

test('buildRecommendationReason 无命中时给兜底说明', () => {
  const reason = buildRecommendationReason('whatever', { query: 'x' }, { stars: 0, installCount: 0 })
  assert.match(reason, /供对比/)
})

// ---------- suggestQueryFor ----------

test('suggestQueryFor 无英文关键词时用能力 id 的具体 token（publish_deploy → publish）', () => {
  const q = suggestQueryFor('把静态网站发布到公开地址，生成可访问的链接', 'publish_deploy')
  assert.equal(q, 'publish')
})

test('suggestQueryFor 优先 purpose 里的英文关键词（excel）', () => {
  const q = suggestQueryFor('读取 Excel 数据（已装社区插件提供）', 'excel_read')
  assert.equal(q, 'excel')
})

test('suggestQueryFor 跳过泛化动词（read/convert）取更具体的 token', () => {
  assert.equal(suggestQueryFor(undefined, 'excel_read'), 'excel')
})

test('suggestQueryFor 中文兜底：剥句首虚词后取短词', () => {
  const q = suggestQueryFor('把文档转成图片', 'doc2img')
  // 无英文关键词、id token 太短，退回中文：剥掉「把」后取前 2 字
  assert.equal(q, '文档')
})

test('suggestQueryFor 无 purpose 且 id 无有效 token 时兜底 id', () => {
  assert.equal(suggestQueryFor(undefined, 'modlens'), 'modlens')
})
