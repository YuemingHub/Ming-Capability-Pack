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

console.log('🚀 Ming Capability Pack - 核心模块测试\n')

for (const scenario of scenarios) {
  console.log(`\n📝 "${scenario}"`)
  const intent = analyzeIntent(scenario)
  console.log(`   意图: ${intent.type}`)

  if (intent.requirements.length > 0) {
    const plugins = await findPluginsForCapability(intent.requirements[0], intent.searchTerms)
    if (plugins.length > 0) {
      console.log(`   推荐: ${plugins[0].name} (${plugins[0].stars} stars)`)
    } else {
      console.log(`   ⚠️ 未找到插件`)
    }
  } else {
    console.log(`   ⚠️ 无法识别意图`)
  }

  await new Promise(r => setTimeout(r, 100))
}

console.log('\n✅ 测试完成')
