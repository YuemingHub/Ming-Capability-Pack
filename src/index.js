// Ming Capability Pack - 增强版主模块（带自动安装和进度显示）

import { analyzeIntent, findPluginsForCapability, calculateEnhancedScore } from './core.js'
import { installPluginsBatch, getInstalledPlugins } from './installer.js'

/**
 * 主入口：分析用户需求并推荐插件（增强版）
 */
export async function mingAutoEnhanced(userInput, options = {}) {
  const {
    showProgress = true,
    autoInstall = false,
    maxPlugins = 3
  } = options

  const startTime = Date.now()
  const progress = []

  // 1. 显示分析进度
  if (showProgress) {
    console.log('\n' + '━'.repeat(60))
    console.log('🚀 Ming Capability Pack - 智能插件推荐')
    console.log('━'.repeat(60))
    console.log(`\n📝 用户需求: "${userInput}"`)
    console.log('\n🔍 正在分析需求...')
    progress.push({ step: '分析需求', status: '完成' })
    await sleep(300)
  }

  // 2. 分析意图
  const intent = analyzeIntent(userInput)

  if (intent.type === 'other') {
    console.log('\n⚠️ 无法识别需求，请尝试更具体地描述')
    console.log('例如：\n- 我想做一个网站\n- 帮我压缩图片\n- 把数据可视化')
    return { success: false, intent, recommendations: [] }
  }

  if (showProgress) {
    console.log(`✅ 意图识别: ${intent.description}`)
    console.log(`🔧 所需能力: ${intent.requirements.join(', ')}`)
    progress.push({ step: '意图识别', status: '完成' })
    await sleep(200)
  }

  // 3. 搜索插件
  if (showProgress) {
    console.log('\n🔎 搜索最佳插件...')
    progress.push({ step: '搜索插件', status: '进行中' })
  }

  const recommendations = []

  for (const capability of intent.requirements) {
    const plugins = await findPluginsForCapability(capability, intent.searchTerms, intent.scene)

    if (plugins.length > 0) {
      const best = plugins[0]
      const scoreBreakdown = best.scoreBreakdown || {}

      if (showProgress) {
        console.log(`\n📦 ${capability}:`)
        console.log(`   ⭐ ${best.name} (${best.stars} stars)`)
        console.log(`   📊 评分: ${best.score.toFixed(1)} 分`)
        console.log(`      - 基础分: ${scoreBreakdown.base?.toFixed(1) || 'N/A'}`)
        console.log(`      - 场景适配: ${scoreBreakdown.sceneFitness?.toFixed(1) || 'N/A'}`)
        console.log(`      - 依赖复杂度: ${scoreBreakdown.dependency || 'N/A'}`)
        console.log(`   📝 安装命令: ${best.install || `dsh plugin add ${best.id}`}`)
      }

      recommendations.push({ capability, plugins })
    } else {
      if (showProgress) {
        console.log(`\n⚠️ ${capability}: 未找到推荐插件`)
      }
    }
  }

  progress.push({ step: '搜索插件', status: '完成' })

  // 4. 自动安装（可选）
  let installResults = []
  if (autoInstall && recommendations.length > 0) {
    if (showProgress) {
      console.log('\n📦 开始自动安装...')
      progress.push({ step: '自动安装', status: '进行中' })
    }

    const pluginsToInstall = recommendations
      .slice(0, maxPlugins)
      .map(r => r.plugins[0])

    installResults = await installPluginsBatch(pluginsToInstall)
    progress.push({ step: '自动安装', status: '完成' })
  }

  // 5. 生成推荐报告
  const report = generateReport(intent, recommendations, installResults)

  if (showProgress) {
    console.log('\n' + '━'.repeat(60))
    console.log('📊 推荐报告')
    console.log('━'.repeat(60))
    console.log(report.summary)
    console.log('\n💡 使用提示:')
    console.log('   1. 复制上面的安装命令执行')
    console.log('   2. 或重新运行并加上 --auto-install 参数自动安装')
    console.log('   3. 安装后刷新 Harness 即可使用')
    console.log('━'.repeat(60))
  }

  const elapsed = Date.now() - startTime

  return {
    success: recommendations.length > 0,
    intent,
    recommendations,
    installResults,
    report,
    elapsed,
    progress
  }
}

/**
 * 生成推荐报告
 */
function generateReport(intent, recommendations, installResults) {
  const lines = []

  lines.push(`✅ 找到了 ${recommendations.length} 个能力的推荐插件：`)

  for (const rec of recommendations) {
    const best = rec.plugins[0]
    const installResult = installResults.find(ir => ir.plugin.name === best.name)

    lines.push(`\n📦 ${rec.capability}:`)
    lines.push(`   ⭐ ${best.name} (${best.stars} stars)`)
    lines.push(`   📝 ${best.description?.zh || best.description?.en || '无描述'}`)
    lines.push(`   📥 ${best.install || `dsh plugin add ${best.id}`}`)

    if (installResult) {
      lines.push(`   状态: ${installResult.success ? '✅ 已安装' : '❌ 安装失败'}`)
    }
  }

  return {
    summary: lines.join('\n'),
    details: recommendations.map(r => ({
      capability: r.capability,
      plugin: r.plugins[0],
      reason: getRecommendationReason(r.plugins[0])
    }))
  }
}

/**
 * 获取推荐理由
 */
function getRecommendationReason(plugin) {
  const reasons = []

  if (plugin.stars > 10000) reasons.push('极高人气')
  else if (plugin.stars > 1000) reasons.push('高人气')
  else if (plugin.stars > 100) reasons.push('有一定人气')

  if (plugin.installCount > 1000) reasons.push('广泛使用')
  else if (plugin.installCount > 100) reasons.push('较多人使用')

  if (isRecentlyUpdated(plugin)) reasons.push('活跃维护')

  if (reasons.length === 0) reasons.push('综合评分最高')

  return reasons.join('、')
}

/**
 * 检查是否最近更新
 */
function isRecentlyUpdated(plugin) {
  if (!plugin.pushedAt) return false

  const daysSinceUpdate = (Date.now() - new Date(plugin.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate < 30
}

/**
 * 工具函数：休眠
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== 导出 ====================

export {
  generateReport,
  getRecommendationReason,
  isRecentlyUpdated
}

export default mingAutoEnhanced
