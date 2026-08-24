import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchMissingCapabilities, CURATED_CAPABILITIES } from '../dist/internals.js'

const ref = (id, purpose = '') => ({ kind: 'tool', id, purpose, trust: 'community' })

test('curated 官方能力：中间件自动安装，用户无感', async () => {
  let installed = ''
  const result = await dispatchMissingCapabilities([ref('infra_ops', '数据库/SSH/Docker 基础运维')], {
    install: async (source) => { installed = source; return { ok: true } },
  })
  assert.equal(installed, '@deepseek-ai/dsh-base')
  assert.equal(result.installedCount, 1)
  assert.equal(result.entries[0].action, 'installed')
  assert.match(result.summary, /已自动安装 @deepseek-ai\/dsh-base/)
  assert.match(result.summary, /重启 DSH/)
})

test('curated 社区能力：给一句确认，不自动装', async () => {
  let installed = ''
  const result = await dispatchMissingCapabilities([ref('publish_deploy', '把项目发布到公开地址')], {
    install: async (source) => { installed = source; return { ok: true } },
  })
  assert.equal(installed, '') // 社区源绝不自动装
  assert.equal(result.proposedCount, 1)
  assert.equal(result.entries[0].action, 'proposed')
  assert.match(result.entries[0].command, /sealos-skills/)
  assert.match(result.summary, /建议装配 sealos-skills/)
})

test('市场兜底：未知能力去市场找最好的，选社区候选', async () => {
  const result = await dispatchMissingCapabilities([ref('video_edit', '把视频剪辑成短视频')], {
    search: async () => ({
      ok: true, query: 'video', total: 3,
      plugins: [
        { id: 'unrelated-tool', name: 'unrelated-tool', owner: 'x', url: '', category: 'other', description: { en: 'random stuff' }, stars: 999, installCount: 999, growth24h: 0, added: '', pushedAt: '', install: '' },
        { id: 'dsh-video-clip', name: 'dsh-video-clip', owner: 'dshteam', url: '', category: 'media', description: { en: 'clip and edit video into short clips', zh: '视频剪辑成短视频' }, stars: 200, installCount: 50, growth24h: 0, added: '', pushedAt: '', install: 'dsh plugin --profile web add dsh-video-clip' },
      ],
    }),
  })
  assert.equal(result.entries.length, 1)
  const e = result.entries[0]
  assert.equal(e.action, 'proposed') // 市场候选都是社区源 → 一句确认
  assert.equal(e.source, 'dsh-video-clip') // 相关度排序压过高星无关插件
  assert.match(e.reason, /视频/) // 理由先讲「配你」再补热度
  assert.match(e.command, /dsh plugin/)
})

test('市场没有替代：诚实标注 not-found，不阻断', async () => {
  const result = await dispatchMissingCapabilities([ref('exotic-skill', '稀有能力')], {
    search: async () => ({ ok: true, query: 'exotic', total: 0, plugins: [] }),
  })
  assert.equal(result.notFoundCount, 1)
  assert.equal(result.entries[0].action, 'not-found')
  assert.match(result.summary, /先用现有工具完成第一版/)
})

test('网络失败也优雅降级为 not-found', async () => {
  const result = await dispatchMissingCapabilities([ref('video_edit', '视频剪辑')], {
    search: async () => ({ ok: false, query: 'x', plugins: [], error: '网络不可达' }),
  })
  assert.equal(result.entries[0].action, 'not-found')
})

test('市场候选带 #path（monorepo 子目录装不上）被过滤，绝不给跑不通的命令', async () => {
  const result = await dispatchMissingCapabilities([ref('video_edit', '把视频剪辑成短视频')], {
    search: async () => ({
      ok: true, query: 'video', total: 2,
      plugins: [
        // 高星但 install 是 github 子目录路径：pnpm 把 # 当 git ref，装不上
        { id: 'open-design', name: 'dsh-runtime', owner: 'nexu-io', url: '', category: 'dev', description: { en: 'design runtime', zh: '设计运行时' }, stars: 91000, installCount: 64, growth24h: 0, added: '', pushedAt: '', install: 'dsh plugin --profile web add github:nexu-io/open-design#path:packages/dsh-runtime' },
        { id: 'dsh-video-clip', name: 'dsh-video-clip', owner: 'dshteam', url: '', category: 'media', description: { en: 'clip video into shorts', zh: '视频剪辑成短视频' }, stars: 200, installCount: 50, growth24h: 0, added: '', pushedAt: '', install: 'dsh plugin --profile web add dsh-video-clip' },
      ],
    }),
  })
  assert.equal(result.entries.length, 1)
  const e = result.entries[0]
  assert.equal(e.action, 'proposed')
  assert.equal(e.source, 'dsh-video-clip') // 装不上的高星候选被剔除，选能装的
  assert.match(e.command, /dsh-video-clip/)
})

test('官方源安装后未能确认写入：绝不谎报已自动安装', async () => {
  let installed = ''
  const result = await dispatchMissingCapabilities([ref('infra_ops', '数据库/SSH/Docker 基础运维')], {
    install: async (source) => { installed = source; return { ok: true, confirmed: false, detail: '未在 profile 中找到' } },
  })
  assert.equal(installed, '@deepseek-ai/dsh-base')
  assert.equal(result.entries[0].action, 'proposed') // 未确认生效 → 待确认，不报 installed
  assert.equal(result.entries[0].state, 'pending') // 状态机：pending，绝不 verified
  assert.equal(result.installedCount, 0)
  assert.match(result.entries[0].reason, /未能确认写入/)
  assert.doesNotMatch(result.summary, /已自动安装/)
})

test('装配状态机：verified/pending/absent 与 action 一一对应', async () => {
  // verified：官方源安装且确认写入
  const verified = await dispatchMissingCapabilities([ref('infra_ops', '运维')], {
    install: async () => ({ ok: true, confirmed: true }),
  })
  assert.equal(verified.entries[0].state, 'verified')
  assert.equal(verified.entries[0].action, 'installed')

  // pending：社区源一句确认 / 官方源装完未确认
  const pending = await dispatchMissingCapabilities([ref('publish_deploy', '发布')], {
    install: async () => ({ ok: true }),
  })
  assert.equal(pending.entries[0].state, 'pending')
  assert.equal(pending.entries[0].action, 'proposed')

  // absent：市场没有替代
  const absent = await dispatchMissingCapabilities([ref('exotic-skill', '稀有能力')], {
    search: async () => ({ ok: true, query: 'exotic', total: 0, plugins: [] }),
  })
  assert.equal(absent.entries[0].state, 'absent')
  assert.equal(absent.entries[0].action, 'not-found')
})

test('curated 库覆盖常见能力缺口，含官方来源与真实市场工具', () => {
  const ids = CURATED_CAPABILITIES.map(c => c.id)
  assert.ok(ids.includes('infra_ops'))
  assert.ok(ids.includes('ppt_create'))
  assert.ok(ids.includes('excel_read'))
  assert.ok(ids.includes('modlens'))
  assert.ok(ids.includes('db_ops'))
  assert.ok(ids.includes('knowledge_rag'))
  assert.ok(ids.includes('publish_deploy'))
  assert.ok(ids.includes('frontend_design'))
  const official = CURATED_CAPABILITIES.filter(c => c.trust === 'official')
  assert.ok(official.length >= 1) // 官方工具自动装的前提
  // 社区来源都是真实市场的安装源（含大厂/高星），不是拍脑袋编的名字
  const community = CURATED_CAPABILITIES.filter(c => c.trust === 'community')
  for (const c of community) {
    assert.ok(c.source.length > 0)
  }
  // 知识库与数据库这两个全栈场景关键能力必须有真实来源
  assert.equal(CURATED_CAPABILITIES.find(c => c.id === 'knowledge_rag').source, 'dsh-weknora')
  assert.equal(CURATED_CAPABILITIES.find(c => c.id === 'db_ops').source, 'dsh-data-agent')
})
