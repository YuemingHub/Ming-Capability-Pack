import mingAuto from './src/index.js'

console.log('🚀 Ming Capability Pack - 演示\n')

// 测试多个场景
const scenarios = [
  '我想做一个摄影作品集网站',
  '帮我压缩这些图片',
  '把 CSV 数据可视化成图表'
]

for (const scenario of scenarios) {
  console.log('\n' + '='.repeat(60))
  console.log(`📝 用户需求: "${scenario}"`)
  console.log('='.repeat(60))

  const result = await mingAuto(scenario)

  console.log('\n' + result.message)

  await new Promise(r => setTimeout(r, 1000))
}

console.log('\n\n✅ 演示完成!')
