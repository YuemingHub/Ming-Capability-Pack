import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatStoreResult, searchStorePlugins } from '../dist/internals.js'

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

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
    assert.match(text, /1024Store 搜「excel」/)
    assert.match(text, /dsh plugin --profile web add dsh-excel-tools/)
    assert.match(text, /需用户确认后执行安装命令/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
