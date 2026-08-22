import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractArtifacts,
  kindFromStopReason,
  looksLikeLocalPath,
  resolveTimeoutMs,
  stopReasonText,
} from '../dist/internals.js'

test('extractArtifacts 提取 Windows 路径 / Unix 路径 / URL 并去重', () => {
  const text = [
    '已完成：D:\\work\\hello.html 和 /tmp/report.md',
    '详情见 https://example.com/page',
    '重复提到 D:\\work\\hello.html',
    '没有路径的普通句子不产生条目',
  ].join('\n')

  const found = extractArtifacts(text)
  assert.ok(found.includes('D:\\work\\hello.html'))
  assert.ok(found.some(p => p.endsWith('report.md')))
  assert.ok(found.includes('https://example.com/page'))
  assert.equal(found.filter(p => p === 'D:\\work\\hello.html').length, 1)
})

test('extractArtifacts 空文本返回空数组', () => {
  assert.deepEqual(extractArtifacts(''), [])
})

test('looksLikeLocalPath 区分路径与普通描述', () => {
  assert.equal(looksLikeLocalPath('https://example.com/a.md'), false)
  assert.equal(looksLikeLocalPath('http://x.dev'), false)
  assert.equal(looksLikeLocalPath('C:\\Users\\ming\\a.txt'), true)
  assert.equal(looksLikeLocalPath('docs/readme.md'), true)
  assert.equal(looksLikeLocalPath('./local.json'), true)
  assert.equal(looksLikeLocalPath('../up.csv'), true)
  assert.equal(looksLikeLocalPath('桌面上的报告'), false)
  assert.equal(looksLikeLocalPath('用户上传的图片'), false)
})

test('stopReasonText 覆盖已知与未知原因', () => {
  assert.equal(stopReasonText('aborted'), '任务被取消')
  assert.equal(stopReasonText('error'), '执行出错')
  assert.equal(stopReasonText('max-tokens'), '执行达到 token 上限，未能完成')
  assert.equal(stopReasonText('refusal'), '执行引擎拒绝了该任务')
  assert.match(stopReasonText('weird-reason'), /异常结束/)
})

test('kindFromStopReason 映射失败分类', () => {
  assert.equal(kindFromStopReason('aborted'), 'aborted')
  assert.equal(kindFromStopReason('max-tokens'), 'max-tokens')
  assert.equal(kindFromStopReason('refusal'), 'refusal')
  assert.equal(kindFromStopReason('error'), 'error')
  assert.equal(kindFromStopReason('anything-else'), 'error')
})

test('resolveTimeoutMs 默认 15 分钟，可用 MING_TIMEOUT_MS 覆盖', () => {
  const original = process.env.MING_TIMEOUT_MS
  try {
    delete process.env.MING_TIMEOUT_MS
    assert.equal(resolveTimeoutMs(), 15 * 60 * 1000)

    process.env.MING_TIMEOUT_MS = '60000'
    assert.equal(resolveTimeoutMs(), 60000)

    // 非法值回落默认
    process.env.MING_TIMEOUT_MS = 'not-a-number'
    assert.equal(resolveTimeoutMs(), 15 * 60 * 1000)
    process.env.MING_TIMEOUT_MS = '-5'
    assert.equal(resolveTimeoutMs(), 15 * 60 * 1000)
  } finally {
    if (original === undefined) delete process.env.MING_TIMEOUT_MS
    else process.env.MING_TIMEOUT_MS = original
  }
})
