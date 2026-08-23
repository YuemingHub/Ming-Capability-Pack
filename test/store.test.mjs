import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatStoreResult, searchMarketplacePlugins, searchStorePlugins } from '../dist/internals.js'

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('searchMarketplacePlugins 成功解析并过滤不可装条目', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return fakeResponse({
      total: 2,
      results: [
        {
          fullName: 'volcengine/OpenViking#examples/dsh-memory-plugin',
          name: 'dsh-memory-plugin', owner: 'volcengine', repo: 'OpenViking',
          subpath: 'examples/dsh-memory-plugin',
          summary: 'memory and context bundle', summaryZh: '记忆与上下文插件',
          category: 'memory', license: 'AGPL-3.0', stars: 28916,
          npmPackage: null, installKind: 'github', install: null,
          installable: false, installOptions: [], riskFlags: ['terminal surface'],
          repoUrl: 'https://github.com/volcengine/OpenViking',
          url: 'https://dshmarketplace.dev/plugins/x',
        },
        {
          fullName: 'liustack/modlens',
          name: 'modlens', owner: 'liustack', repo: 'modlens',
          summary: 'visual bridge for text models', summaryZh: '为纯文本模型架起视觉桥梁',
          category: 'vision', license: 'MIT', stars: 2807,
          npmPackage: '@liustack/modlens', installKind: 'npm',
          install: 'dsh plugin --profile web add @liustack/modlens',
          installable: true, installOptions: [], riskFlags: [],
          repoUrl: 'https://github.com/liustack/modlens',
          url: 'https://dshmarketplace.dev/plugins/liustack-modlens',
        },
      ],
    })
  }
  try {
    const result = await searchMarketplacePlugins('modlens')
    assert.equal(result.ok, true)
    assert.equal(result.total, 2)
    // 不可装条目（install:null）被过滤，只剩真实可装的
    assert.equal(result.plugins.length, 1)
    assert.equal(result.plugins[0].name, 'modlens')
    assert.equal(result.plugins[0].description.zh, '为纯文本模型架起视觉桥梁')
    assert.equal(result.plugins[0].install, 'dsh plugin --profile web add @liustack/modlens')
    // URL 必须带 /api/v1 前缀——绝不能请求到 /plugins（根路径 HTML 页面，json 解析必炸）
    assert.match(requestedUrl, /\/api\/v1\/plugins\?q=modlens&limit=8/)
    assert.doesNotMatch(requestedUrl, /dshmarketplace\.dev\/plugins\?/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('searchMarketplacePlugins 网络失败优雅降级', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('ENOTFOUND dshmarketplace.dev')
  }
  try {
    const result = await searchMarketplacePlugins('memory')
    assert.equal(result.ok, false)
    assert.deepEqual(result.plugins, [])
    assert.match(result.error, /ENOTFOUND/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('searchMarketplacePlugins 空关键词直接返回错误不请求', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return fakeResponse({})
  }
  try {
    const result = await searchMarketplacePlugins('   ')
    assert.equal(result.ok, false)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('searchStorePlugins 成功解析搜索结果', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return fakeResponse({
      query: 'excel',
      total: 18,
      results: [
        {
          id: 'a/b',
          name: 'dsh-excel-tools',
          owner: 'a',
          url: 'https://github.com/a/b',
          category: 'tools',
          description: { en: 'Excel tools', zh: 'Excel 工具' },
          stars: 132,
          installCount: 0,
          growth24h: 0,
          added: '2026-08-22',
          pushedAt: '2026-08-22T09:45:29Z',
          install: 'dsh plugin --profile web add dsh-excel-tools',
        },
      ],
    })
  }
  try {
    const result = await searchStorePlugins('excel', { limit: 3, key: 'k' })
    assert.equal(result.ok, true)
    assert.equal(result.total, 18)
    assert.equal(result.plugins.length, 1)
    assert.equal(result.plugins[0].name, 'dsh-excel-tools')
    assert.match(requestedUrl, /\/v1\/plugins\/search\?q=excel&limit=3&sortBy=stars/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('searchStorePlugins 网络失败优雅降级', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('ENOTFOUND api.deepseek1024.com')
  }
  try {
    const result = await searchStorePlugins('excel')
    assert.equal(result.ok, false)
    assert.deepEqual(result.plugins, [])
    assert.match(result.error, /ENOTFOUND/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('searchStorePlugins 空关键词直接返回错误不请求', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return fakeResponse({})
  }
  try {
    const result = await searchStorePlugins('   ')
    assert.equal(result.ok, false)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('formatStoreResult 包含安装命令', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => fakeResponse({
    total: 1,
    results: [
      {
        id: 'a/b',
        name: 'dsh-excel-tools',
        owner: 'a',
        url: 'https://github.com/a/b',
        category: 'tools',
        description: { en: 'Excel tools', zh: 'Excel 工具' },
        stars: 132,
        installCount: 0,
        growth24h: 0,
        added: '2026-08-22',
        pushedAt: '2026-08-22T09:45:29Z',
        install: 'dsh plugin --profile web add dsh-excel-tools',
      },
    ],
  })
  try {
    const result = await searchStorePlugins('excel', { key: 'k' })
    assert.equal(result.ok, true)
    const text = formatStoreResult(result)
    assert.match(text, /DSH 插件市场搜「excel」/)
    assert.match(text, /dsh plugin --profile web add dsh-excel-tools/)
    assert.match(text, /需用户确认后执行安装命令/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
