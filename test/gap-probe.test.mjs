import test from 'node:test'
import assert from 'node:assert/strict'
import { probeGenericCapabilityGaps, dispatchMissingCapabilities } from '../dist/internals.js'

const ref = (id, purpose = '') => ({ kind: 'tool', id, purpose, trust: 'community' })

// ---------- probeGenericCapabilityGaps：通用能力缺口探测 ----------

test('probe：视频目标推断出视频制作能力', () => {
  const gaps = probeGenericCapabilityGaps('帮我把我拍的素材剪辑成一个短视频')
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].id, 'video')
  assert.match(gaps[0].purpose, /视频/)
})

test('probe：图片目标 + 图片资源文件推断出图片处理能力', () => {
  const gaps = probeGenericCapabilityGaps('给我家小猫画一幅画', ['C:\\Users\\kid\\Pictures\\mimi.jpg'])
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].id, 'image_edit')
})

test('probe：资源文件名含 .mp4 也触发视频推断', () => {
  const gaps = probeGenericCapabilityGaps('帮我把这段录像剪一下', ['D:\\cam\\party.mp4'])
  assert.equal(gaps.some(g => g.id === 'video'), true)
})

test('probe：表格目标推断出 excel 读取能力', () => {
  const gaps = probeGenericCapabilityGaps('把这张表里的数据整理出来', ['data.xlsx'])
  assert.equal(gaps.some(g => g.id === 'excel_read'), true)
})

test('probe：无能力关键词的目标返回空（不制造噪音）', () => {
  const gaps = probeGenericCapabilityGaps('帮我想想明天吃什么')
  assert.deepEqual(gaps, [])
})

test('probe：同一能力多个关键词只出现一次（去重）', () => {
  const gaps = probeGenericCapabilityGaps('帮我剪辑这个视频，做成短视频')
  const ids = gaps.map(g => g.id)
  assert.equal(ids.filter(id => id === 'video').length, 1)
})

test('probe：目标与资源结合，多个能力同时推断', () => {
  const gaps = probeGenericCapabilityGaps('把我的照片整理成 ppt 汇报', ['D:\\photos\\a.jpg'])
  const ids = gaps.map(g => g.id)
  assert.ok(ids.includes('ppt_create'))
  assert.ok(ids.includes('image_edit'))
})

// ---------- dispatchMissingCapabilities + forceConfirm：低置信度不自动装 ----------

test('forceConfirm：curated 官方能力也不自动装，走一句确认', async () => {
  let installed = ''
  const result = await dispatchMissingCapabilities([ref('infra_ops', '数据库/SSH/Docker 基础运维')], {
    forceConfirm: true,
    install: async (source) => { installed = source; return { ok: true } },
  })
  assert.equal(installed, '') // 低置信度推断，官方源也不静默装
  assert.equal(result.installedCount, 0)
  assert.equal(result.proposedCount, 1)
  assert.equal(result.entries[0].action, 'proposed')
  assert.match(result.entries[0].command, /dsh-base/)
})

test('forceConfirm：市场兜底候选仍走一句确认', async () => {
  const result = await dispatchMissingCapabilities([ref('video', '视频制作/剪辑')], {
    forceConfirm: true,
    search: async () => ({
      ok: true, query: 'video', total: 1,
      plugins: [
        { id: 'dsh-video-clip', name: 'dsh-video-clip', owner: 'dshteam', url: '', category: 'media', description: { en: 'clip and edit video into short clips', zh: '视频剪辑成短视频' }, stars: 200, installCount: 50, growth24h: 0, added: '', pushedAt: '', install: 'dsh plugin --profile web add dsh-video-clip' },
      ],
    }),
  })
  assert.equal(result.entries[0].action, 'proposed')
  assert.equal(result.installedCount, 0)
})

test('forceConfirm：市场没有替代时诚实 not-found，不阻断', async () => {
  const result = await dispatchMissingCapabilities([ref('video', '视频制作')], {
    forceConfirm: true,
    search: async () => ({ ok: true, query: 'video', total: 0, plugins: [] }),
  })
  assert.equal(result.notFoundCount, 1)
  assert.equal(result.entries[0].action, 'not-found')
})
