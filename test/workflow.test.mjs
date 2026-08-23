/**
 * 工作流执行器单元测试：逐步执行 / 逐步验收 / 缺能力停步 / 断点续跑 / 坑位建议
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectWorkflowArtifacts, runWorkflow, workflowNextSteps } from '../dist/internals.js'

/** 每个 execute 调用返回一个 subagent run；handlers 按调用顺序消费 */
function makeSubagent(handlers) {
  let i = 0
  return {
    list: () => ['spawn'],
    start: async (_provider, _request) => {
      const h = handlers[Math.min(i, handlers.length - 1)]
      i++
      return {
        id: `mock-${i}`,
        result: Promise.resolve(await h()),
        dispose: async () => {},
      }
    },
  }
}

function mockCtx(subagents, schemas = []) {
  return {
    get: (key) => (key === 'subagents' ? subagents : key === 'skills' ? { list: async () => [] } : undefined),
    tools: { schemas: () => schemas },
  }
}

function makeExec(workdir) {
  return { agent: { session: { header: { cwd: workdir } } }, signal: undefined }
}

const okRun = (text) => ({ output: [{ type: 'text', text }], stopReason: 'completed' })
const failRun = () => ({ output: [{ type: 'text', text: '出错了' }], stopReason: 'error' })

test('runWorkflow 逐步执行，全部通过', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      {
        id: 'build',
        name: '建站',
        goal: '生成 index.html',
        verification: [{ kind: 'file_exists', pattern: '*.html', note: '应有 HTML' }],
      },
      {
        id: 'check',
        name: '校验',
        goal: '检查页面',
        guidance: ['确认是有效 HTML'],
        verification: [{ kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML' }],
      },
    ]
    const subagents = makeSubagent([
      async () => { await writeFile(join(workdir, 'index.html'), '<html><body>hi</body></html>'); return okRun('已生成 ' + join(workdir, 'index.html')) },
      () => okRun('校验通过'),
    ])
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '帮我建个网站', [], steps, workdir)
    assert.equal(result.success, true)
    assert.equal(result.stepResults.length, 2)
    assert.ok(result.stepResults.every(r => !r.skipped && r.outcome?.success))
    assert.equal(result.summary, '工作流完成：2 步执行成功')
    // 收集所有步骤的产物
    const artifacts = collectWorkflowArtifacts(result)
    assert.ok(artifacts.includes(join(workdir, 'index.html')))
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('runWorkflow 步骤执行失败：停在该步并带坑位', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      { id: 'a', name: '第一步', goal: '做 A' },
      { id: 'b', name: '第二步', goal: '做 B', pitfalls: [{ symptom: '卡在 X', fix: '改用 Y 方法' }] },
    ]
    const subagents = makeSubagent([() => okRun('完成 A'), () => failRun()])
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '目标', [], steps, workdir)
    assert.equal(result.success, false)
    assert.equal(result.failureKind, 'step-failed')
    assert.equal(result.failedStepId, 'b')
    assert.deepEqual(result.pitfalls, [{ symptom: '卡在 X', fix: '改用 Y 方法' }])
    assert.match(result.summary, /第二步/)
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('runWorkflow 验收不过：停在该步', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      {
        id: 'a',
        name: '产出页',
        goal: '生成 index.html',
        verification: [{ kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML' }],
      },
    ]
    // 子代理声称完成，但写入的内容不含 <html>
    const subagents = makeSubagent([async () => { await writeFile(join(workdir, 'index.html'), '空壳'); return okRun('完成') }])
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '目标', [], steps, workdir)
    assert.equal(result.success, false)
    assert.equal(result.failureKind, 'verification-failed')
    assert.equal(result.failedStepId, 'a')
    assert.equal(result.stepResults[0].verification.failed, 1)
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('runWorkflow 步骤缺能力：不白跑，停在本步引导装配', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      { id: 'a', name: '建站', goal: '做站点' },
      {
        id: 'publish',
        name: '发布',
        goal: '发布上线',
        capabilities: [{ kind: 'tool', id: 'publish_deploy', source: 'dsh-deploy-tools', purpose: '把静态网站发布到公开地址', trust: 'community' }],
        pitfalls: [{ symptom: '没有发布能力', fix: '走 ming_install 装配' }],
      },
    ]
    const publishedGoals = []
    const subagents = {
      list: () => ['spawn'],
      start: async (_provider, request) => {
        publishedGoals.push(String(request.prompt?.[0]?.text ?? ''))
        return {
          id: 'mock',
          result: Promise.resolve(okRun('站点建好了')),
          dispose: async () => {},
        }
      },
    }
    const result = await runWorkflow(mockCtx(subagents, []), makeExec(workdir), '目标', [], steps, workdir)
    assert.equal(result.success, false)
    assert.equal(result.failureKind, 'capability-missing')
    assert.equal(result.failedStepId, 'publish')
    assert.equal(publishedGoals.length, 1) // 只委派了第一步，发布步没被白跑
    assert.ok(publishedGoals[0].includes('建站'))
    assert.equal(result.stepResults[0].outcome?.success, true) // 前面步骤照常完成
    assert.equal(result.stepResults[1].blockedBy?.ref.id, 'publish_deploy')
    assert.deepEqual(result.pitfalls, [{ symptom: '没有发布能力', fix: '走 ming_install 装配' }])
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('runWorkflow workflowFrom 续跑：跳过已完成步骤', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      { id: 'a', name: '第一步', goal: '做 A' },
      { id: 'b', name: '第二步', goal: '做 B' },
      { id: 'c', name: '第三步', goal: '做 C' },
    ]
    const calls = []
    const subagents = makeSubagent([
      () => { calls.push('b'); return okRun('B 完成') },
      () => { calls.push('c'); return okRun('C 完成') },
    ])
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '目标', [], steps, workdir, { workflowFrom: 'b' })
    assert.equal(result.success, true)
    assert.equal(result.stepResults[0].skipped, true)
    assert.deepEqual(calls, ['b', 'c']) // a 不重做
    assert.match(result.summary, /1 步按「继续」跳过/)
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('workflowNextSteps 缺能力时给出搜索词与续跑指引', () => {
  const wf = {
    success: false,
    failureKind: 'capability-missing',
    failedStepId: 'publish',
    stepResults: [
      { step: { id: 'a', name: '建站', goal: 'x' }, skipped: false, outcome: { success: true, summary: 'ok', artifacts: [] } },
      {
        step: { id: 'publish', name: '发布', goal: 'x' },
        skipped: false,
        blockedBy: { ref: { kind: 'tool', id: 'publish_deploy', purpose: '把静态网站发布到公开地址' }, available: false },
      },
    ],
    pitfalls: [],
    summary: '缺能力',
  }
  const steps = workflowNextSteps(wf, { target: 'GitHub Pages' })
  assert.ok(steps.some(s => s.includes('ming_install')))
  assert.ok(steps.some(s => s.includes('把静态网站发布到公开地址')))
  assert.ok(steps.some(s => s.includes('workflowFrom=publish')))
  assert.ok(steps.some(s => s.includes('GitHub Pages')))
})

test('workflowNextSteps 执行失败时给出坑位修法', () => {
  const wf = {
    success: false,
    failureKind: 'step-failed',
    failedStepId: 'publish',
    stepResults: [{ step: { id: 'publish', name: '发布', goal: 'x' }, skipped: false, outcome: { success: false, summary: '挂了', artifacts: [] } }],
    pitfalls: [{ symptom: '没有发布能力', fix: '先走 ming_install 装配' }],
    summary: '失败',
  }
  const steps = workflowNextSteps(wf)
  assert.ok(steps.some(s => s.includes('若现象是「没有发布能力」→ 先走 ming_install 装配')))
})

test('workflowNextSteps 成功时给产出查看建议', () => {
  const wf = { success: true, stepResults: [], summary: '完成' }
  const steps = workflowNextSteps(wf)
  assert.ok(steps.some(s => s.includes('查看上面列出的产出文件')))
})
