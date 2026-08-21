// 测试更多场景

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

const INTENT_CAPABILITY_MAP = {
  'website-generation': {
    capabilities: ['html-generation', 'css-styling', 'responsive-layout'],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static', '网站'],
    description: '静态网站生成'
  },
  'image-processing': {
    capabilities: ['image-compression', 'format-conversion'],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', '图片', '照片'],
    description: '图片处理'
  },
  'data-processing': {
    capabilities: ['data-parsing', 'data-visualization'],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph', '数据', '图表'],
    description: '数据处理与可视化'
  },
  'video-processing': {
    capabilities: ['video-editing', 'subtitle-generation'],
    keywords: ['video', 'clip', 'edit', 'subtitle', '视频', '剪辑'],
    description: '视频处理'
  },
  'content-creation': {
    capabilities: ['text-generation', 'formatting'],
    keywords: ['content', 'text', 'document', 'article', 'write', '文档', '文章'],
    description: '内容创作'
  },
  'automation': {
    capabilities: ['workflow-automation', 'scheduling'],
    keywords: ['automation', 'workflow', 'schedule', 'trigger', '自动', '定时'],
    description: '自动化工作流'
  },
  'coding': {
    capabilities: ['code-generation', 'testing'],
    keywords: ['code', 'programming', 'function', 'api', '代码', '编程'],
    description: '代码生成'
  }
}

const CAPABILITY_SEARCH_KEYWORDS = {
  'html-generation': ['html', 'static site', 'website generator', 'web builder'],
  'css-styling': ['css', 'style', 'theme', 'design'],
  'responsive-layout': ['responsive', 'mobile', 'adaptive'],
  'image-compression': ['image', 'compress', 'optimize', 'resize'],
  'format-conversion': ['convert', 'format', 'transform'],
  'data-parsing': ['parse', 'csv', 'excel', 'json'],
  'data-visualization': ['chart', 'graph', 'visualization', 'plot'],
  'video-editing': ['video', 'edit', 'clip'],
  'subtitle-generation': ['subtitle', 'caption', 'transcript'],
  'text-generation': ['text', 'content', 'article', 'write'],
  'formatting': ['format', 'markdown', 'pdf'],
  'workflow-automation': ['workflow', 'automation', 'zap', 'trigger'],
  'scheduling': ['schedule', 'cron', 'timer'],
  'code-generation': ['code', 'programming', 'scaffold'],
  'testing': ['test', 'testing', 'unit-test']
}

function analyzeIntent(userInput) {
  const lower = userInput.toLowerCase()
  for (const [intentType, config] of Object.entries(INTENT_CAPABILITY_MAP)) {
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return { type: intentType, requirements: config.capabilities, description: config.description }
    }
  }
  return { type: 'other', requirements: [], description: '未识别' }
}

async function searchPlugins(query, limit = 5) {
  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${PLUGIN_MARKET_KEY}` } })
    if (!response.ok) throw new Error(`API 失败: ${response.status}`)
    const data = await response.json()
    return data.results || []
  } catch (error) {
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
  return scored.slice(0, topN)
}

async function testScenario(input) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📝 用户需求: "${input}"`)
  console.log('='.repeat(60))
  
  const intent = analyzeIntent(input)
  console.log(`\n🎯 识别意图: ${intent.description} (${intent.type})`)
  console.log(`🔧 所需能力: ${intent.requirements.join(', ')}`)
  
  const recommendations = []
  
  for (const cap of intent.requirements) {
    const plugins = await findPluginsForCapability(cap)
    recommendations.push({ capability: cap, plugins })
    
    if (plugins.length > 0) {
      console.log(`\n📦 ${cap}:`)
      console.log(`   ⭐ ${plugins[0].name} (${plugins[0].stars} stars)`)
      console.log(`   📥 ${plugins[0].install}`)
    }
  }
  
  return { intent, recommendations }
}

async function runAllTests() {
  console.log('🚀 Ming Capability Pack - 多场景测试')
  console.log('━'.repeat(60))
  
  const scenarios = [
    '我想做一个摄影作品集网站',
    '帮我压缩这些图片',
    '把我的 CSV 数据可视化成图表',
    '帮我生成视频字幕',
    '写一篇文章',
    '自动发送邮件',
    '帮我写一个函数',
    '创建一个简单的登录页面',
    '批量重命名文件',
    '把 Markdown 转成 PDF'
  ]
  
  const results = []
  
  for (const scenario of scenarios) {
    const result = await testScenario(scenario)
    results.push({ input: scenario, ...result })
    
    // 避免 API 限流
    await new Promise(r => setTimeout(r, 200))
  }
  
  // 统计
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 测试统计')
  console.log('='.repeat(60))
  
  const successCount = results.filter(r => r.recommendations.some(rec => rec.plugins.length > 0)).length
  console.log(`✅ 成功推荐: ${successCount}/${scenarios.length} (${(successCount/scenarios.length*100).toFixed(0)}%)`)
  
  console.log('\n分类统计:')
  const byType = {}
  for (const r of results) {
    byType[r.intent.type] = (byType[r.intent.type] || 0) + 1
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  - ${type}: ${count}`)
  }
}

runAllTests().catch(console.error)
