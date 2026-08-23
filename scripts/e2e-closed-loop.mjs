/**
 * 双模式 big-project 端到端闭环验证（无真机 DSH）
 *
 * 覆盖两条真实用户旅程：
 *   A. 从 0 开发：一句话 → 命中 big-project → orient 现状探测(暂停) → 用户「继续」→ build/verify/deliver
 *   B. 存量迷茫：一句话 → 命中 big-project → orient 给建议清单(暂停) → 不擅自改代码
 *   C. 能力缺口：curated 外的能力 → 真实走 DSH Marketplace 找最好的
 *
 * 子代理执行是 mock（本机无 DSH Harness），但 resolver / recipe / workflow / dispatch /
 * 市场搜索全部走真实构建产物与真实网络。
 */
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resolveCapabilities,
  getRecipe,
  runWorkflow,
  dispatchMissingCapabilities,
  workflowNextSteps,
} from '../dist/internals.js'

let failures = 0
function check(ok, label, extra = '') {
  const mark = ok ? '✅' : '❌'
  console.log(`  ${mark} ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const okRun = (text) => ({ output: [{ type: 'text', text }], stopReason: 'completed' })

/** mock 子代理：按调用顺序返回 handler；每个 handler 可写真实文件到 workdir */
function makeSubagent(workdir, handlers) {
  let i = 0
  return {
    list: () => ['spawn'],
    start: async (_provider, _request) => {
      const h = handlers[Math.min(i, handlers.length - 1)]
      i++
      return {
        id: `mock-${i}`,
        result: Promise.resolve(await h(workdir)),
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

const makeExec = (workdir) => ({ agent: { session: { header: { cwd: workdir } } }, signal: undefined })

async function scenarioA() {
  console.log('\n════════ 场景 A：从 0 开发「团队知识库系统」 ════════')
  const workdir = await mkdtemp(join(tmpdir(), 'ming-e2e-a-'))
  const goal = '帮我做一个团队知识库系统，能登录、传文档、搜文档，最好有个管理后台'
  console.log('① 用户说：', goal)

  const plan = await resolveCapabilities(mockCtx(makeSubagent(workdir, [])), { goal })
  check(plan.recipeId === 'big-project', 'Resolver 命中 big-project', `(实际: ${plan.recipeId})`)
  check(plan.executable, '方案可执行')
  console.log(`    匹配: ${plan.matchedBy}`)

  const recipe = getRecipe('big-project')
  const steps = recipe.workflow
  check(steps.length >= 4 && steps[0].id === 'orient' && steps[0].stopAfter, '工作流 orient 步带 stopAfter（动代码前先交底）')

  // orient 步：产出真实 PROJECT.md
  const subagents = makeSubagent(workdir, [
    async (wd) => { await writeFile(join(wd, 'PROJECT.md'), '# 团队知识库系统\n\n技术栈：前端页面 + Node 轻量后端 + SQLite\n目录结构：…\n怎么运行：npm start\n本次从 0 搭骨架\n', 'utf-8'); return okRun(`已产出 ${join(wd, 'PROJECT.md')}`) },
    async (wd) => { await mkdir(join(wd, 'src'), { recursive: true }); await writeFile(join(wd, 'src', 'main.js'), '// 入口'); await writeFile(join(wd, 'index.html'), '<html><body>登录</body></html>'); return okRun(`已实现骨架 ${join(wd, 'src', 'main.js')}`) },
    async (wd) => { await writeFile(join(wd, 'PROJECT.md'), '# 团队知识库系统\n\n怎么运行：npm start\n验证：npm start 成功启动，登录→传文档→搜索 走通\n', 'utf-8'); return okRun('验证通过，结果已写入 PROJECT.md') },
    async (wd) => { await writeFile(join(wd, 'README.md'), '# 怎么跑/怎么用\nnpm start\n', 'utf-8'); return okRun(`交付完成 ${join(wd, 'README.md')}`) },
  ])

  const r1 = await runWorkflow(mockCtx(subagents), makeExec(workdir), goal, [], steps, workdir)
  check(r1.success && r1.stoppedAt === 'orient', 'orient 步验收通过后暂停', `(success=${r1.success}, stoppedAt=${r1.stoppedAt})`)
  check(r1.stepResults.length === 1, '暂停在第一步，build 没跑', `(已执行 ${r1.stepResults.length} 步)`)
  const nextSteps1 = workflowNextSteps(r1)
  check(nextSteps1.some(s => s.includes('workflowFrom=build')), '暂停指引指向下一步 build', nextSteps1[0] ?? '')

  // 用户「继续」→ workflowFrom=build
  const r2 = await runWorkflow(mockCtx(subagents), makeExec(workdir), goal, [], steps, workdir, { workflowFrom: 'build' })
  check(r2.success && r2.stoppedAt === undefined, '「继续」后 build/verify/deliver 全部完成', `(success=${r2.success})`)
  check(r2.stepResults[0].skipped, 'orient 不重做（跳过）')
  check(r2.stepResults.filter(s => !s.skipped).length === 3, 'build/verify/deliver 三步真实执行')
  const files = ['PROJECT.md', 'README.md']
  for (const f of files) {
    check((await readFile(join(workdir, f), 'utf-8')).length > 0, `真实产物落盘: ${f}`)
  }
  await rm(workdir, { recursive: true, force: true })
  console.log('  结论：从 0 开发闭环走通（一句话 → 交底暂停 → 继续 → 交付）\n')
}

async function scenarioB() {
  console.log('════════ 场景 B：存量项目「迷茫看不懂」 ════════')
  const workdir = await mkdtemp(join(tmpdir(), 'ming-e2e-b-'))
  const goal = '我接手了一个项目，看不懂，不知道下一步做什么'
  console.log('① 用户说：', goal)

  const plan = await resolveCapabilities(mockCtx(makeSubagent(workdir, [])), { goal })
  check(plan.recipeId === 'big-project', '存量迷茫也归 big-project', `(实际: ${plan.recipeId})`)

  const steps = getRecipe('big-project').workflow
  let buildRan = false
  const subagents = makeSubagent(workdir, [
    async (wd) => { await writeFile(join(wd, 'PROJECT.md'), '# 存量项目地图\n\n现状：已有代码，但结构混乱\n怎么运行：npm start\n\n下一步做什么（按价值排序）：\n1. 补 README\n2. 修登录 bug\n3. 加导出功能\n', 'utf-8'); return okRun(`已产出 ${join(wd, 'PROJECT.md')}`) },
    async () => { buildRan = true; return okRun('（不应执行到 build）') },
  ])

  const r = await runWorkflow(mockCtx(subagents), makeExec(workdir), goal, [], steps, workdir)
  check(r.success && r.stoppedAt === 'orient', 'orient 产出建议清单后暂停', `(stoppedAt=${r.stoppedAt})`)
  check(buildRan === false, '迷茫场景不擅自改代码（build 未执行）')
  const projectMd = await readFile(join(workdir, 'PROJECT.md'), 'utf-8')
  check(projectMd.includes('下一步做什么'), 'PROJECT.md 含「下一步做什么」建议清单')
  await rm(workdir, { recursive: true, force: true })
  console.log('  结论：存量迷茫闭环走通（交底给建议 → 等用户选，不盲改）\n')
}

async function scenarioC() {
  console.log('════════ 场景 C：能力缺口 → 真实 DSH Marketplace ════════')
  const result = await dispatchMissingCapabilities([
    { kind: 'tool', id: 'video_edit', purpose: '把视频剪辑成短视频', trust: 'community' },
    { kind: 'tool', id: 'exotic-skill', purpose: '极稀有的能力', trust: 'community' },
  ])
  const video = result.entries.find(e => e.ref.id === 'video_edit')
  check(video && video.action === 'proposed' && video.source, '真实市场找到可装候选', `(source=${video?.source ?? '无'})`)
  check(video && video.command && video.command.includes('dsh plugin'), '给出可执行的安装命令')
  check(video && !video.command.includes('#path'), '绝不给跑不通的 #path 命令')
  const exotic = result.entries.find(e => e.ref.id === 'exotic-skill')
  check(exotic && exotic.action === 'not-found', '市场没有的诚实 not-found，不阻断')
  console.log(`  ${result.summary.split('\n').map(l => '  ' + l).join('\n')}`)
  console.log('  结论：能力缺口闭环走通（curated 外 → 真实市场找最好的 → 建议装 / 诚实 not-found）\n')
}

async function main() {
  console.log('Ming 双模式 big-project 端到端闭环验证')
  console.log('（子代理执行 mock，resolver/workflow/dispatch/市场全走真实代码与真实网络）')
  try {
    await scenarioA()
    await scenarioB()
    await scenarioC()
  } catch (e) {
    console.error('\n❌ 脚本异常：', e)
    failures++
  }
  console.log('\n════════ 结果 ════════')
  if (failures === 0) {
    console.log('全部闭环走通 ✅')
    process.exit(0)
  } else {
    console.log(`${failures} 项失败 ❌`)
    process.exit(1)
  }
}

main()
