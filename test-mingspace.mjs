// Ming Capability Pack - 真实场景测试（Ming-space 项目）

import { mingAutoEnhanced } from './src/index.js'

const mingSpaceScenarios = [
  // 代码相关
  '审查代码质量',
  '运行测试用例',
  '修复 TypeScript 错误',
  '优化性能',

  // 部署相关
  '部署到生产环境',
  '配置 CI/CD',
  '设置监控告警',

  // 文档相关
  '生成 API 文档',
  '更新 README',

  // 数据相关
  '分析数据库性能',
  '优化 SQL 查询',

  // 安全相关
  '进行安全审计',
  '检查权限配置'
]

console.log('🚀 Ming Capability Pack - 真实场景测试（Ming-space）\n')
console.log('━'.repeat(70))

const results = []

for (const scenario of mingSpaceScenarios) {
  console.log(`\n📝 需求: "${scenario}"`)
  console.log('─'.repeat(70))

  const result = await mingAutoEnhanced(scenario, {
    showProgress: false,
    autoInstall: false,
    maxPlugins: 2
  })

  const topPlugin = result.recommendations[0]?.plugins[0]
  const score = topPlugin?.score?.toFixed(1) || 'N/A'

  results.push({
    scenario,
    success: result.success,
    plugin: topPlugin?.name || '无',
    stars: topPlugin?.stars || 0,
    score,
    elapsed: result.elapsed
  })

  await new Promise(r => setTimeout(r, 500))
}

console.log('\n\n' + '━'.repeat(70))
console.log('📊 测试结果汇总')
console.log('━'.repeat(70))

console.log('\n' + '场景'.padEnd(30) + '状态'.padEnd(10) + '推荐插件'.padEnd(25) + 'Stars'.padEnd(10) + '评分')
console.log('─'.repeat(80))

for (const r of results) {
  const status = r.success ? '✅' : '❌'
  const plugin = r.plugin.substring(0, 22)
  console.log(`${r.scenario.substring(0, 28).padEnd(30)}${status.padEnd(10)}${plugin.padEnd(25)}${String(r.stars).padEnd(10)}${r.score}`)
}

console.log('\n' + '━'.repeat(70))
console.log('✅ 测试完成!')
