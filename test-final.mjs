import { analyzeIntent, findPluginsForCapability } from './src/core.js'

const scenarios = [
  '我想做一个摄影作品集网站',
  '帮我压缩这些图片',
  '把 CSV 数据可视化',
  '帮我生成视频字幕',
  '写一篇文章',
  '自动发送邮件',
  '帮我写一个函数',
  '批量重命名文件'
]

console.log('🚀 Ming Capability Pack - 最终测试\n')

let success = 0
let fail = 0

for (const scenario of scenarios) {
  console.log(`\n📝 "${scenario}"`)
  const intent = analyzeIntent(scenario)
  console.log(`   意图: ${intent.type}`)

  if (intent.requirements.length > 0) {
    const plugins = await findPluginsForCapability(intent.requirements[0], intent.searchTerms)
    if (plugins.length > 0) {
      console.log(`   ✅ 推荐: ${plugins[0].name} (${plugins[0].stars} stars, 评分:${plugins[0].score.toFixed(1)})`)
      success++
    } else {
      console.log(`   ⚠️ 未找到插件`)
      fail++
    }
  } else {
    console.log(`   ⚠️ 无法识别意图`)
    fail++
  }

  await new Promise(r => setTimeout(r, 600))
}

console.log('\n\n📊 测试结果:')
console.log(`✅ 成功: ${success}/${scenarios.length} (${(success/scenarios.length*100).toFixed(0)}%)`)
console.log(`❌ 失败: ${fail}/${scenarios.length}`)
