// 快速测试 - 减少搜索次数

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

const INTENT_CAPABILITY_MAP = {
  'website-generation': {
    capabilities: ['html-generation'],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static', '网站', '网页', '建站']
  },
  'image-processing': {
    capabilities: ['image-compression'],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', '图片', '照片', '压缩']
  },
  'data-processing': {
    capabilities: ['data-parsing'],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph', '数据', '图表', '可视化']
  },
  'video-processing': {
    capabilities: ['video-editing'],
    keywords: ['video', 'clip', 'edit', 'subtitle', '视频', '剪辑', '字幕']
  },
  'content-creation': {
    capabilities: ['text-generation'],
    keywords: ['content', 'text', 'document', 'article', 'write', '文档', '文章']
  },
  'automation': {
    capabilities: ['workflow-automation'],
    keywords: ['automation', 'workflow', 'schedule', 'trigger', '自动', '定时']
  },
  'code-generation': {
    capabilities: ['code-generation'],
    keywords: ['code', 'programming', 'function', 'api', '代码', '编程', '函数']
  },
  'file-batch-operation': {
    capabilities: ['batch-processing'],
    keywords: ['batch', 'file', 'rename', '批量', '文件', '重命名']
  }
}

const CAPABILITY_SEARCH_KEYWORDS = {
  'html-generation': ['html', 'website', 'web page'],
  'image-compression': ['image', 'compress', 'optimize'],
  'data-parsing': ['data', 'csv', 'excel', 'chart'],
  'video-editing': ['video', 'edit'],
  'text-generation': ['text', 'content', 'ai'],
  'workflow-automation': ['workflow', 'automation'],
  'code-generation': ['code', 'programming'],
  'batch-processing': ['batch', 'file']
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

async function searchPlugins(query, limit = 3) {
  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${PLUGIN_MARKET_KEY}` } })
    if (!response.ok) return []
    const data = await response.json()
    return (data.results || []).slice(0, 2)  // 只取前2个
  } catch (error) {
    return []
  }
}

function calculateScore(plugin) {
  return Math.log10(plugin.stars + 1) * 15 + Math.log10(plugin.installCount + 1) * 10
}

async function findPluginsForCapability(capability) {
  const keywords = CAPABILITY_SEARCH_KEYWORDS[capability] || [capability]
  const allPlugins = []
  for (const keyword of keywords.slice(0, 2)) {  // 只用前2个关键词
    const plugins = await searchPlugins(keyword)
    allPlugins.push(...plugins)
  }
  const uniquePlugins = new Map()
  for (const plugin of allPlugins) {
    if (!uniquePlugins.has(plugin.id)) uniquePlugins.set(plugin.id, plugin)
  }
  const scored = Array.from(uniquePlugins.values()).map(p => ({ ...p, score: calculateScore(p) }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 2)
}

async function testScenario(input) {
  const intent = analyzeIntent(input)
  const recommendations = []
  for (const cap of intent.requirements) {
    const plugins = await findPluginsForCapability(cap)
    recommendations.push({ capability: cap, plugins })
  }
  return { input, intent, recommendations }
}

async function runAllTests() {
  console.log('🚀 Ming Capability Pack - 快速测试\n')

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

  const results = []

  for (const scenario of scenarios) {
    const result = await testScenario(scenario)
    results.push(result)
    await new Promise(r => setTimeout(r, 50))
  }

  console.log('📊 测试结果:\n')
  const successCount = results.filter(r => r.recommendations.some(rec => rec.plugins.length > 0)).length
  console.log(`✅ 成功: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(0)}%)\n`)

  for (const r of results) {
    const status = r.recommendations.some(rec => rec.plugins.length > 0) ? '✅' : '❌'
    const topPlugin = r.recommendations[0]?.plugins[0]?.name || '无'
    console.log(`${status} ${r.input.substring(0, 25)}... → ${r.intent.type} → ${topPlugin}`)
  }
}

runAllTests().catch(console.error)
