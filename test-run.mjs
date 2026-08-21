// 内联测试 - 不依赖外部模块

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

// 知识图谱
const INTENT_CAPABILITY_MAP = {
  'website-generation': {
    capabilities: ['html-generation', 'css-styling', 'responsive-layout'],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static', '网站']
  },
  'data-processing': {
    capabilities: ['data-parsing', 'data-visualization'],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph', '数据', '图表']
  }
}

const CAPABILITY_SEARCH_KEYWORDS = {
  'html-generation': ['html', 'static site', 'website generator'],
  'css-styling': ['css', 'style', 'theme'],
  'responsive-layout': ['responsive', 'mobile'],
  'data-parsing': ['parse', 'csv', 'excel'],
  'data-visualization': ['chart', 'graph', 'visualization']
}

function analyzeIntent(userInput) {
  const lower = userInput.toLowerCase()
  for (const [intentType, config] of Object.entries(INTENT_CAPABILITY_MAP)) {
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return { type: intentType, requirements: config.capabilities }
    }
  }
  return { type: 'other', requirements: [] }
}

async function searchPlugins(query, limit = 10) {
  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${PLUGIN_MARKET_KEY}` } })
    if (!response.ok) throw new Error(`API 失败: ${response.status}`)
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error(`搜索失败: ${query}`, error.message)
    return []
  }
}

function calculateScore(plugin) {
  let score = 0
  score += Math.log10(plugin.stars + 1) * 15
  score += Math.log10(plugin.installCount + 1) * 10
  if (plugin.pushedAt) {
    const daysSinceUpdate = (Date.now() - new Date(plugin.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 20 - daysSinceUpdate / 7)
  }
  return score
}

async function findPluginsForCapability(capability, topN = 3) {
  const keywords = CAPABILITY_SEARCH_KEYWORDS[capability] || [capability]
  const allPlugins = []
  for (const keyword of keywords) {
    const plugins = await searchPlugins(keyword)
    allPlugins.push(...plugins)
  }
  const uniquePlugins = new Map()
  for (const plugin of allPlugins) {
    if (!uniquePlugins.has(plugin.id)) uniquePlugins.set(plugin.id, plugin)
  }
  const scored = Array.from(uniquePlugins.values()).map(p => ({ ...p, score: calculateScore(p) }))
  scored.sort((a, b) => b.score - a.score)
  return { capability, plugins: scored.slice(0, topN) }
}

// 主测试
async function test() {
  console.log('=== 测试 Ming Capability Pack ===\n')

  console.log('🎯 测试 1: 意图分析')
  const intent = analyzeIntent('我想做一个摄影作品集网站')
  console.log(`意图类型: ${intent.type}`)
  console.log(`所需能力: ${intent.requirements.join(', ')}\n`)

  console.log('🔎 测试 2: 搜索网页生成插件')
  const htmlPlugins = await searchPlugins('html', 5)
  console.log(`找到 ${htmlPlugins.length} 个插件:`)
  htmlPlugins.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.stars} stars) - ${p.description?.zh || p.description?.en || 'N/A'}`)
  })

  console.log('\n📊 测试 3: 评分解析')
  if (htmlPlugins.length > 0) {
    const best = htmlPlugins.reduce((a, b) => calculateScore(a) > calculateScore(b) ? a : b)
    console.log(`最佳推荐: ${best.name}`)
    console.log(`评分: ${calculateScore(best).toFixed(1)}`)
    console.log(`安装命令: ${best.install}`)
  }

  console.log('\n🚀 测试 4: 完整分析流程')
  console.log('分析需求: "我想做一个摄影作品集网站"')
  for (const cap of intent.requirements) {
    const result = await findPluginsForCapability(cap)
    console.log(`\n能力: ${cap}`)
    if (result.plugins.length > 0) {
      console.log(`  最佳: ${result.plugins[0].name} (${result.plugins[0].stars} stars, 评分:${result.plugins[0].score.toFixed(1)})`)
    } else {
      console.log(`  未找到插件`)
    }
  }

  console.log('\n✅ 测试完成!')
}

test().catch(console.error)
