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
        capabilities: [{ kind: 'tool', id: 'video_publish', source: 'dsh-video-clip', purpose: '把视频发布到短视频平台', trust: 'community' }],
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
    const result = await runWorkflow(
      mockCtx(subagents, []),
      makeExec(workdir),
      '目标',
      [],
      steps,
      workdir,
      {
        dispatch: {
          // 注入假市场：video_publish（不在 curated）→ 市场候选，不碰真实网络
          search: async () => ({
            ok: true,
            query: 'video',
            total: 1,
            plugins: [{
              id: 'dsh-video-clip', name: 'dsh-video-clip', owner: 'dshteam',
              url: 'https://example.com', category: 'media',
              description: { en: 'publish video to short-video platform', zh: '把视频发布到短视频平台' },
              stars: 200, installCount: 50, growth24h: 0, added: '', pushedAt: '',
              install: 'dsh plugin --profile web add dsh-video-clip',
            }],
          }),
        },
      },
    )
    assert.equal(result.success, false)
    assert.equal(result.failureKind, 'capability-missing')
    assert.equal(result.failedStepId, 'publish')
    assert.equal(publishedGoals.length, 1) // 只委派了第一步，发布步没被白跑
    assert.ok(publishedGoals[0].includes('建站'))
    assert.equal(result.stepResults[0].outcome?.success, true) // 前面步骤照常完成
    assert.equal(result.stepResults[1].blockedBy?.ref.id, 'video_publish')
    assert.deepEqual(result.pitfalls, [{ symptom: '没有发布能力', fix: '走 ming_install 装配' }])
    // 中间件自动去市场找最好的：缺能力时不甩给用户，给出「找最好的 → 回确认 → 重启继续」的闭环
    // 社区源必须如实说「待你确认」，绝不谎称已自动装好
    assert.match(result.summary, /中间件已去市场找到最佳工具/)
    assert.match(result.summary, /建议装配 dsh-video-clip/)
    assert.match(result.summary, /回一句「确认」/)
    assert.match(result.summary, /「继续」/)
    assert.doesNotMatch(result.summary, /已自动安装/) // 社区源只是建议，不是已装
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

test('runWorkflow 无效 workflowFrom：明确报错，绝不静默全跳过假装完成', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      { id: 'a', name: '第一步', goal: '做 A' },
      { id: 'b', name: '第二步', goal: '做 B' },
    ]
    const calls = []
    const subagents = makeSubagent([
      () => { calls.push('a'); return okRun('A 完成') },
      () => { calls.push('b'); return okRun('B 完成') },
    ])
    // 主模型传错 id（如把「继续」两个字当续跑点）→ 必须失败并说明，不能返回 success:true 骗用户「都做好了」
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '目标', [], steps, workdir, { workflowFrom: '继续' })
    assert.equal(result.success, false)
    assert.equal(result.failureKind, 'invalid-workflow-from')
    assert.deepEqual(calls, []) // 没有任何步骤被执行
    assert.match(result.summary, /没有这一步/)
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('runWorkflow stopAfter：本步验收通过后暂停，等用户确认再继续', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'ming-wf-'))
  try {
    const steps = [
      {
        id: 'orient',
        name: '现状探测',
        goal: '产出 PROJECT.md',
        stopAfter: true,
        verification: [{ kind: 'file_exists', pattern: 'PROJECT.md', note: '应有项目地图' }],
      },
      { id: 'build', name: '动手实现', goal: '改代码' },
    ]
    const calls = []
    const subagents = makeSubagent([
      async () => { await writeFile(join(workdir, 'PROJECT.md'), '# 项目\n\n怎么运行：node main.js\n'); return okRun('地图已生成') },
      () => { calls.push('build'); return okRun('实现完成') },
    ])
    const result = await runWorkflow(mockCtx(subagents), makeExec(workdir), '我迷茫，不知道下一步', [], steps, workdir)
    assert.equal(result.success, true)
    assert.equal(result.stoppedAt, 'orient')
    assert.equal(result.resumeFrom, 'build') // 暂停时算出下一步，供「继续」指引直接用
    assert.equal(result.stepResults.length, 1) // 停在 orient，build 没跑
    assert.deepEqual(calls, []) // 迷茫场景不擅自改代码
    assert.match(result.summary, /等你确认/)
    // 用户说「继续」→ workflowFrom=暂停步的下一步，orient 跳过、build 执行
    const resumed = await runWorkflow(mockCtx(subagents), makeExec(workdir), '继续', [], steps, workdir, { workflowFrom: 'build' })
    assert.equal(resumed.success, true)
    assert.equal(resumed.stoppedAt, undefined)
    assert.equal(resumed.stepResults[0].skipped, true) // orient 不重做
    assert.deepEqual(calls, ['build'])
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
})

test('workflowNextSteps 暂停步给出「继续」指引（指向下一步）', () => {
  const wf = {
    success: true,
    stoppedAt: 'orient',
    resumeFrom: 'build', // runWorkflow 暂停时算出下一步
    stepResults: [
      { step: { id: 'orient', name: '现状探测', goal: 'x' }, skipped: false, outcome: { success: true, summary: 'ok', artifacts: [] } },
    ],
    summary: '等你确认',
  }
  const steps = workflowNextSteps(wf)
  assert.ok(steps.some(s => s.includes('「继续」')))
  assert.ok(steps.some(s => s.includes('workflowFrom=build')))
  assert.ok(!steps.some(s => s.includes('workflowFrom=orient'))) // 绝不指向暂停步本身（会重跑并死循环）
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
  const steps = workflowNextSteps(wf)
  assert.ok(steps.some(s => s.includes('workflowFrom=publish')))
})

test('workflowNextSteps 缺能力且是社区建议时给「回确认」指引，不再让用户自己搜插件', () => {
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
    summary: '建议装配 sealos-skills',
  }
  const steps = workflowNextSteps(wf)
  // 中间件已自动推荐，这里只让用户「回确认」，不把搜插件的技术活推回给用户
  assert.ok(steps.some(s => s.includes('回一句「确认」')))
  assert.ok(steps.some(s => s.includes('workflowFrom=publish')))
  assert.ok(!steps.some(s => s.includes('ming_install（mode=search')))
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
