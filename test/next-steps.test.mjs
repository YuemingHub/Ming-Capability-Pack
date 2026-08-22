import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendMissingNotice, nextStepsFor } from '../dist/internals.js'

const successOutcome = {
  mode: 'executed',
  success: true,
  summary: '任务完成',
  artifacts: ['D:\\work\\hello.html'],
  artifactChecks: [{ raw: 'D:\\work\\hello.html', kind: 'file', bytes: 24 }],
}

test('成功任务返回标准三步建议', () => {
  const steps = nextStepsFor(successOutcome)
  assert.equal(steps.length, 3)
  assert.match(steps[0], /产出文件/)
})

test('每种失败原因都有对应的针对性建议', () => {
  for (const errorKind of [
    'engine-unavailable',
    'resource-missing',
    'timeout',
    'aborted',
    'max-tokens',
    'refusal',
    'error',
  ]) {
    const steps = nextStepsFor({ ...successOutcome, success: false, errorKind })
    assert.ok(steps.length > 0, `errorKind=${errorKind} 应有非空建议`)
  }
})

test('timeout 建议提到 MING_TIMEOUT_MS', () => {
  const steps = nextStepsFor({ ...successOutcome, success: false, errorKind: 'timeout' })
  assert.ok(steps.some(s => s.includes('MING_TIMEOUT_MS')))
})

test('appendMissingNotice 成功但有缺失产物时附加提醒', () => {
  const outcome = {
    ...successOutcome,
    artifacts: ['D:\\work\\hello.html', 'D:\\work\\missing.css'],
    artifactChecks: [
      { raw: 'D:\\work\\hello.html', kind: 'file', bytes: 24 },
      { raw: 'D:\\work\\missing.css', kind: 'missing' },
    ],
  }
  const text = appendMissingNotice(outcome)
  assert.match(text, /校验提醒/)
  assert.ok(text.includes('D:\\work\\missing.css'))
})

test('appendMissingNotice 全部验证通过时不附加提醒', () => {
  const text = appendMissingNotice(successOutcome)
  assert.equal(text, '任务完成')
})

test('appendMissingNotice 失败任务不附加提醒', () => {
  const outcome = {
    ...successOutcome,
    success: false,
    summary: '执行未完成：任务被取消',
    artifactChecks: [{ raw: 'D:\\work\\gone.txt', kind: 'missing' }],
  }
  assert.equal(appendMissingNotice(outcome), '执行未完成：任务被取消')
})
