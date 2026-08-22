/**
 * 端到端最小闭环 demo（不依赖 Harness 真机）：
 * 用户一句话 → Resolver 命中方案 → Assembler 装配 → 模拟执行 → Verifier 独立验证
 */
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resolveCapabilities,
  assembleContext,
  verifyChecks,
  formatVerification,
} from '../dist/internals.js'

// 模拟 Harness context（无子代理、无 skill，fs_* 视为基础能力）
const mockCtx = {
  get: (key) => (key === 'skills' ? { list: async () => [] } : undefined),
  tools: { schemas: () => [] },
}

const workdir = await mkdtemp(join(tmpdir(), 'ming-loop-demo-'))
console.log('工作目录:', workdir)

try {
  // ① 用户目标（一句话）
  const goal = '帮我把这周的销售数据整理成一份 HTML 周报，给老板看'
  console.log('\n① 用户目标:', goal)

  // ② 能力解析
  const plan = await resolveCapabilities(mockCtx, { goal })
  console.log('\n② 装配计划:')
  console.log('   方案:', plan.recipeName, '| 匹配:', plan.matchedBy)
  console.log('   可执行:', plan.executable)
  if (plan.capabilities.length) {
    console.log('   能力:', plan.capabilities.map(c => `${c.ref.kind}:${c.ref.id}(${c.available ? '可用' : '缺失'})`).join(', '))
  }

  // ③ 装配上下文（注入给执行子代理的要求）
  const context = assembleContext(plan)
  console.log('\n③ 注入执行子代理的装配上下文:')
  context.forEach(l => console.log('   ' + l))

  // ④ 模拟官方子代理执行（真实 Harness 环境下这步会真正跑 agent）
  console.log('\n④ [模拟执行] 子代理产出 report.html ...')
  await writeFile(join(workdir, 'report.html'), '<html><body><h1>本周销售周报</h1><table>...</table></body></html>', 'utf-8')

  // ⑤ 独立验证（不依赖 agent 的自我汇报）
  const summary = await verifyChecks(plan.verification, workdir)
  console.log('\n⑤ 独立验证:')
  console.log(formatVerification(summary) || '   （该方案未声明验证断言）')

  // ⑥ 现实回读
  const files = await readdir(workdir)
  console.log('\n⑥ 现实回读: 工作区现有文件 →', files.join(', '))

  const ok = summary.failed === 0
  console.log(`\n闭环结果: ${ok ? '✅ 人想要的结果已变成真实文件，且有独立证据' : '❌ 验证未通过'}`)
} finally {
  await rm(workdir, { recursive: true, force: true })
}
