/**
 * Ming Capability Pack - 插件入口（简化版）
 *
 * 这是一个独立的智能插件管家，可以：
 * 1. 理解用户意图
 * 2. 调用插件市场 API 搜索插件
 * 3. 智能评分选择最佳插件
 * 4. 生成安装命令
 */

export const name = '@mingworkbench/capability-pack'
export const version = '0.1.0'

// ==================== 配置 ====================

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

// ==================== 知识图谱 ====================

const INTENT_CAPABILITY_MAP: Record<string, { capabilities: string[], keywords: string[] }> = {
  'website-generation': {
    capabilities: ['html-generation', 'css-styling', 'responsive-layout'],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static', '网站']
  },
  'image-processing': {
    capabilities: ['image-compression', 'format-conversion'],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', '图片']
  },
  'data-processing': {
    capabilities: ['data-parsing', 'data-visualization'],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph', '数据', '图表']
  }
}

const CAPABILITY_SEARCH_KEYWORDS: Record<string, string[]> = {
  'html-generation': ['html', 'static site', 'website generator', 'web builder'],
  'css-styling': ['css', 'style', 'theme'],
  'responsive-layout': ['responsive', 'mobile', 'adaptive'],
  'image-compression': ['image', 'compress', 'optimize'],
  'data-parsing': ['parse', 'csv', 'excel', 'json'],
  'data-visualization': ['chart', 'graph', 'visualization']
}

// ==================== 核心函数 ====================

/**
 * 分析用户意图
 */
export function analyzeIntent(userInput: string): { type: string, requirements: string[] } {
  const lower = userInput.toLowerCase()

  // 简单规则匹配
  for (const [intentType, config] of Object.entries(INTENT_CAPABILITY_MAP)) {
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return {
        type: intentType,
        requirements: config.capabilities
      }
    }
  }

  return {
    type: 'other',
    requirements: []
  }
}

/**
 * 搜索插件市场
 */
export async function searchPlugins(
  query: string,
  limit = 20
): Promise<{ id: string, name: string, stars: number, installCount: number, description: string }[]> {
  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${PLUGIN_MARKET_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`)
    }

    const data = await response.json()

    return data.results || []

  } catch (error) {
    console.error(`搜索失败: ${query}`, error)
    return []
  }
}

/**
 * 计算插件评分
 */
export function calculateScore(plugin: any): number {
  let score = 0

  // 受欢迎程度 (60%)
  score += Math.log10(plugin.stars + 1) * 15
  score += Math.log10(plugin.installCount + 1) * 10

  // 活跃度 (40%)
  if (plugin.pushedAt) {
    const daysSinceUpdate = (Date.now() - new Date(plugin.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 20 - daysSinceUpdate / 7)
  }

  return score
}

/**
 * 为能力搜索并评分插件
 */
export async function findPluginsForCapability(
  capability: string,
  topN = 3
): Promise<{ capability: string, plugins: any[] }> {
  const keywords = CAPABILITY_SEARCH_KEYWORDS[capability] || [capability]

  const allPlugins: any[] = []

  for (const keyword of keywords) {
    const plugins = await searchPlugins(keyword)
    allPlugins.push(...plugins)
  }

  // 去重
  const uniquePlugins = new Map<string, any>()
  for (const plugin of allPlugins) {
    if (!uniquePlugins.has(plugin.id)) {
      uniquePlugins.set(plugin.id, plugin)
    }
  }

  // 评分
  const scored = Array.from(uniquePlugins.values()).map(p => ({
    ...p,
    score: calculateScore(p)
  }))

  // 排序
  scored.sort((a, b) => b.score - a.score)

  return {
    capability,
    plugins: scored.slice(0, topN)
  }
}

/**
 * 主函数：分析意图并推荐插件
 */
export async function mingAuto(userInput: string) {
  console.log(`\n🎯 Ming: 分析需求: "${userInput}"\n`)

  // 1. 分析意图
  const intent = analyzeIntent(userInput)
  console.log(`📝 意图类型: ${intent.type}`)
  console.log(`🔧 所需能力: ${intent.requirements.join(', ')}`)
  console.log('')

  // 2. 为每个能力搜索插件
  const recommendations: any[] = []

  for (const capability of intent.requirements) {
    console.log(`🔎 搜索能力: ${capability}...`)
    const result = await findPluginsForCapability(capability)
    recommendations.push(result)

    if (result.plugins.length > 0) {
      console.log(`   ✅ 找到 ${result.plugins.length} 个候选插件`)
      console.log(`   ⭐ 最佳推荐: ${result.plugins[0].name} (${result.plugins[0].stars} stars)`)
    } else {
      console.log(`   ⚠️ 未找到插件`)
    }
    console.log('')
  }

  return {
    intent,
    recommendations
  }
}

// ==================== 直接运行 ====================

// 如果直接运行这个文件
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('index.ts')) {
  const testInput = process.argv[2] || '我想做一个摄影作品集网站'
  mingAuto(testInput).then(result => {
    console.log('\n✅ 分析完成')
    console.log(JSON.stringify(result, null, 2))
  })
}
