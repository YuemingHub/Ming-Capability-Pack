import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCEPTANCE_PROTOCOL_VERSION,
  formatProtocolErrors,
  validateQualityBar,
  validateRecipeProtocol,
  validateVerificationChecks,
  RECIPES,
} from '../dist/internals.js'

// ---------- 版本常量 ----------

test('验收协议版本号为正整数', () => {
  assert.equal(typeof ACCEPTANCE_PROTOCOL_VERSION, 'number')
  assert.ok(Number.isInteger(ACCEPTANCE_PROTOCOL_VERSION))
  assert.ok(ACCEPTANCE_PROTOCOL_VERSION >= 1)
})

// ---------- validateVerificationChecks ----------

test('合法断言数组返回空错误列表', () => {
  const checks = [
    { kind: 'file_exists', pattern: '*.html' },
    { kind: 'content_match', pattern: '*.html', contains: '<html' },
    { kind: 'content_absent', pattern: '*.svg', mustNotContain: 'Ming' },
    { kind: 'dir_nonempty', pattern: '**/*' },
  ]
  assert.deepEqual(validateVerificationChecks(checks), [])
})

test('非数组输入报错', () => {
  const errors = validateVerificationChecks(undefined)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].path, 'verification')
})

test('未知断言类型报错并定位到下标', () => {
  const errors = validateVerificationChecks([
    { kind: 'file_exists', pattern: '*.html' },
    { kind: 'typo_kind', pattern: '*.html' },
  ])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].path, 'verification[1]')
  assert.match(errors[0].message, /typo_kind/)
})

test('缺少 pattern 报错', () => {
  const errors = validateVerificationChecks([{ kind: 'file_exists' }])
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /pattern/)
})

test('content_match 缺少 contains 报错', () => {
  const errors = validateVerificationChecks([{ kind: 'content_match', pattern: '*.html' }])
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /contains/)
})

test('content_absent 缺少 mustNotContain 报错', () => {
  const errors = validateVerificationChecks([{ kind: 'content_absent', pattern: '*.svg' }])
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /mustNotContain/)
})

// ---------- validateQualityBar ----------

test('undefined 质量门槛视为合法', () => {
  assert.deepEqual(validateQualityBar(undefined), [])
})

test('完整质量门槛合法', () => {
  const bar = { bar: '这一轮交付高质量成果', checks: ['检查 1', '检查 2'], selfCheck: ['自查 1'] }
  assert.deepEqual(validateQualityBar(bar), [])
})

test('质量门槛缺少 bar 报错', () => {
  const errors = validateQualityBar({ bar: '', checks: ['x'], selfCheck: [] })
  assert.equal(errors.length, 1)
  assert.equal(errors[0].path, 'qualityBar.bar')
})

test('质量门槛 checks 含空字符串报错', () => {
  const errors = validateQualityBar({ bar: 'ok', checks: ['x', ''], selfCheck: [] })
  assert.equal(errors.length, 1)
  assert.equal(errors[0].path, 'qualityBar.checks')
})

// ---------- formatProtocolErrors ----------

test('空错误列表返回空字符串', () => {
  assert.equal(formatProtocolErrors([]), '')
})

test('错误格式化为逐行人话', () => {
  const text = formatProtocolErrors([
    { path: 'verification[0]', message: '缺少 pattern' },
  ])
  assert.equal(text, '- verification[0]: 缺少 pattern')
})

// ---------- validateRecipeProtocol ----------

test('validateRecipeProtocol 对完整合法方案返回空错误', () => {
  const recipe = {
    id: 'test',
    name: 'test',
    description: 'test',
    triggers: ['test'],
    capabilities: [],
    verification: [{ kind: 'file_exists', pattern: '*.html' }],
    qualityBar: { bar: '交付高质量', checks: ['c1'], selfCheck: ['s1'] },
    workflow: [
      { id: 's1', name: 's1', goal: 'g', verification: [{ kind: 'content_match', pattern: '*.html', contains: '<html' }] },
    ],
  }
  assert.deepEqual(validateRecipeProtocol(recipe), [])
})

test('validateRecipeProtocol 捕获 recipe 级与 workflow 步级的非法断言并区分层级', () => {
  const recipe = {
    id: 'bad',
    name: 'bad',
    description: 'bad',
    triggers: ['bad'],
    capabilities: [],
    verification: [{ kind: 'typo', pattern: 'x' }],
    workflow: [
      { id: 's1', name: 's1', goal: 'g', verification: [{ kind: 'content_match', pattern: '*.html' }] },
    ],
  }
  const errors = validateRecipeProtocol(recipe)
  assert.equal(errors.length, 2)
  assert.equal(errors[0].path, 'verification[0]')
  assert.match(errors[0].message, /typo/)
  assert.equal(errors[1].path, 'workflow[s1].verification[0]')
  assert.match(errors[1].message, /contains/)
})

// ---------- 核心回归：所有内置方案协议必须合法 ----------

test('所有内置 recipe 的验收协议均合法', () => {
  assert.ok(RECIPES.length > 0, '应有内置方案')

  for (const recipe of RECIPES) {
    const errors = validateRecipeProtocol(recipe)
    assert.deepEqual(
      errors,
      [],
      `方案「${recipe.id}」的验收协议不合法：\n${formatProtocolErrors(errors)}`,
    )
  }
})
