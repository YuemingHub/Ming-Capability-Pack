// Ming Capability Pack - 完整模块（ESM 兼容）

import { analyzeIntent, findPluginsForCapability, calculateScore, searchPlugins } from './core.js'

/**
 * 主入口：分析用户需求并推荐插件
 */
export async function mingAuto(userInput) {
  console.log(`\n🎯 Ming: 分析需求...`)

  // 1. 分析意图
  const intent = analyzeIntent(userInput)

  if (intent.type === 'other') {
    return {
      success: false,
      intent,
      recommendations: [],
      message: '抱歉，我无法识别你的需求。请尝试更具体地描述，例如：\n- 我想做一个网站\n- 帮我压缩图片\n- 把数据可视化'
    }
  }

  console.log(`📝 意图类型: ${intent.type}`)
  console.log(`🔧 所需能力: ${intent.requirements.join(', ')}`)

  // 2. 为每个能力搜索插件
  const recommendations = []

  for (const capability of intent.requirements) {
    console.log(`\n🔎 搜索能力: ${capability}...`)

    const plugins = await findPluginsForCapability(capability, intent.searchTerms)

    if (plugins.length > 0) {
      console.log(`   ✅ 找到 ${plugins.length} 个候选插件`)
      console.log(`   ⭐ 最佳推荐: ${plugins[0].name} (${plugins[0].stars} stars)`)

      recommendations.push({
        capability,
        plugins
      })
    } else {
      console.log(`   ⚠️ 未找到插件`)
    }
  }

  // 3. 生成推荐
  const success = recommendations.length > 0

  const message = success
    ? `✅ 找到了 ${recommendations.length} 个能力的推荐插件！\n\n` +
      recommendations.map(r =>
        `📦 ${r.capability}:\n` +
        r.plugins.map((p, i) =>
          `   ${i + 1}. ${p.name} (${p.stars} stars)\n` +
          `      安装: ${p.install}`
        ).join('\n')
      ).join('\n\n')
    : '抱歉，没有找到合适的插件来完成这个任务。请尝试换一种描述方式。'

  return {
    success,
    intent,
    recommendations,
    message
  }
}

// 导出所有函数
export {
  analyzeIntent,
  findPluginsForCapability,
  calculateScore,
  searchPlugins
}

// 默认导出
export default mingAuto
