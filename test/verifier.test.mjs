import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatVerification } from '../dist/internals.js'

// ---------- formatVerification 边界场景 ----------

test('formatVerification 空 results 返回空字符串', () => {
  const summary = { passed: 0, failed: 0, results: [] }
  assert.equal(formatVerification(summary), '')
})

test('formatVerification 全部通过时输出 ✅ 行与「通过 N / N」汇总', () => {
  const summary = {
    passed: 2,
    failed: 0,
    results: [
      {
        check: { kind: 'file_exists', pattern: '*.html' },
        passed: true,
        detail: '匹配 1 个文件：index.html',
      },
      {
        check: { kind: 'content_match', pattern: 'index.html', contains: '<html>' },
        passed: true,
        detail: '1 个文件包含「<html>」：index.html',
      },
    ],
  }
  const text = formatVerification(summary)
  assert.match(text, /【独立验证】通过 2 \/ 2/)
  assert.match(text, /✅ 检查文件「\*\.html」存在：匹配 1 个文件：index\.html/)
  assert.match(text, /✅ 检查「index\.html」包含「<html>」：1 个文件包含「<html>」：index\.html/)
})

test('formatVerification 有失败时同时出现 ✅ 和 ❌', () => {
  const summary = {
    passed: 1,
    failed: 1,
    results: [
      {
        check: { kind: 'file_exists', pattern: '*.html' },
        passed: true,
        detail: '匹配 1 个文件：index.html',
      },
      {
        check: { kind: 'content_match', pattern: 'index.html', contains: '不存在的文字' },
        passed: false,
        detail: '匹配的文件中均未包含「不存在的文字」',
      },
    ],
  }
  const text = formatVerification(summary)
  assert.match(text, /【独立验证】通过 1 \/ 2/)
  assert.ok(text.includes('✅'))
  assert.ok(text.includes('❌'))
})

test('formatVerification 全部失败时只出现 ❌', () => {
  const summary = {
    passed: 0,
    failed: 2,
    results: [
      {
        check: { kind: 'file_exists', pattern: '*.html' },
        passed: false,
        detail: '未找到匹配「*.html」的文件',
      },
      {
        check: { kind: 'dir_nonempty', pattern: 'assets' },
        passed: false,
        detail: '目录中未发现任何文件',
      },
    ],
  }
  const text = formatVerification(summary)
  assert.match(text, /【独立验证】通过 0 \/ 2/)
  assert.ok(!text.includes('✅'))
  assert.match(text, /❌ 检查文件「\*\.html」存在：未找到匹配「\*\.html」的文件/)
  assert.match(text, /❌ 检查目录「assets」非空：目录中未发现任何文件/)
})

test('formatVerification 单条结果输出完整单行', () => {
  const summary = {
    passed: 1,
    failed: 0,
    results: [
      {
        check: { kind: 'content_absent', pattern: '**/*.svg', mustNotContain: 'Ming' },
        passed: true,
        detail: '3 个文件均未包含「Ming」',
      },
    ],
  }
  const text = formatVerification(summary)
  assert.equal(
    text,
    '【独立验证】通过 1 / 1\n✅ 检查「**/*.svg」不含「Ming」：3 个文件均未包含「Ming」',
  )
})
