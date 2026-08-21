// Ming Capability Pack - 演示脚本

import { mingAutoEnhanced } from './src/index.js'

const scenarios = [
  '我想做一个摄影作品集网站',
  '帮我把 CSV 数据可视化',
  '审查这段代码',
  '部署到生产环境',
  '生成 API 文档'
]

console.log('🚀 Ming Capability Pack - 增强版演示\n')

for (const scenario of scenarios) {
  const result = await mingAutoEnhanced(scenario, {
    showProgress: true,
    autoInstall: false,
    maxPlugins: 2
  })

  console.log('\n⏱️ 耗时: ' + result.elapsed + 'ms')
  console.log('━'.repeat(60))
}

console.log('\n✅ 演示完成!')
