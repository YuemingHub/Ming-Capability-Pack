import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  runBrowserAcceptance,
  verifyChecks,
  formatVerification,
  validateVerificationChecks,
  exportRecipeToSkillMd,
} from '../dist/internals.js'

async function withWorkdir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ming-browser-verify-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('browser_acceptance 缺 dsh-verify：如实标记 skipped，不谎报通过也不计失败', async () => {
  await withWorkdir(async (dir) => {
    await mkdir(join(dir, 'site'))
    await writeFile(join(dir, 'index.html'), '<html><body>hello</body></html>')

    const summary = await verifyChecks(
      [
        { kind: 'file_exists', pattern: 'index.html' },
        { kind: 'browser_acceptance', spec: 'site/spec.json' },
      ],
      dir,
    )
    assert.equal(summary.passed, 1)
    assert.equal(summary.failed, 0) // 跳过不计入失败，不误阻断交付
    assert.equal(summary.skipped, 1)
    const skipped = summary.results.find(r => r.check.kind === 'browser_acceptance')
    assert.equal(skipped?.passed, false)
    assert.equal(skipped?.skipped, true)
    assert.match(skipped?.detail ?? '', /未装配 dsh-verify/)
  })
})

test('formatVerification：跳过的断言用 ⏭️ 显示并注明未执行', async () => {
  await withWorkdir(async (dir) => {
    const summary = await verifyChecks([{ kind: 'browser_acceptance', spec: 'spec.json' }], dir)
    const text = formatVerification(summary)
    assert.match(text, /⏭️/)
    assert.match(text, /跳过 1 项/)
    assert.match(text, /未执行/)
    assert.doesNotMatch(text, /✅/)
  })
})

test('browser_acceptance 装配可用：注入执行器后可如实判定 PASS / FAIL', async () => {
  await withWorkdir(async (dir) => {
    const base = {
      probe: async () => true,
      run: async () => ({ code: 0, output: 'PASS - all checks green\n' }),
    }
    const pass = await runBrowserAcceptance('spec.json', dir, base)
    assert.equal(pass.passed, true)
    assert.equal(pass.skipped, undefined)
    assert.match(pass.detail, /PASS/)

    const fail = await runBrowserAcceptance('spec.json', dir, {
      probe: async () => true,
      run: async () => ({ code: 1, output: 'FAIL - toggle did nothing\n' }),
    })
    assert.equal(fail.passed, false)
    assert.equal(fail.skipped, undefined)
    assert.match(fail.detail, /未通过/)
  })
})

test('browser_acceptance 协议校验：spec 必填、pattern 不适用不误报', () => {
  // 合法：有 spec
  const ok = validateVerificationChecks([{ kind: 'browser_acceptance', spec: 'spec.json' }])
  assert.deepEqual(ok, [])
  // 非法：缺 spec
  const bad = validateVerificationChecks([{ kind: 'browser_acceptance' }])
  assert.equal(bad.length, 1)
  assert.match(bad[0].message, /缺少非空 spec/)
  // 不支持的 kind 仍被拒绝
  const unknown = validateVerificationChecks([{ kind: 'magic_check', pattern: '*' }])
  assert.equal(unknown.length, 1)
  assert.match(unknown[0].message, /不合法/)
})

test('SKILL.md 能表达 browser_acceptance 断言', () => {
  const recipe = {
    id: 'publish-site-check',
    name: '发布网站验收',
    description: '对发布的网站做真实浏览器验收',
    triggers: ['验收'],
    guidance: ['用浏览器打开页面验证'],
    capabilities: [],
    verification: [
      { kind: 'file_exists', pattern: 'index.html', note: '页面存在' },
      { kind: 'browser_acceptance', spec: 'acceptance.json', note: '真实浏览器验收' },
    ],
  }
  const md = exportRecipeToSkillMd(recipe)
  assert.match(md, /真实浏览器验收/)
  assert.match(md, /dsh-verify/)
})
