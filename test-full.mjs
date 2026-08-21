// Ming Capability Pack - 完整测试套件

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

// ==================== 完整知识图谱 ====================

const INTENT_CAPABILITY_MAP = {
  // 网站相关
  'website-generation': {
    capabilities: ['html-generation', 'css-styling', 'responsive-layout'],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static', '网站', '网页', '建站'],
    priority: 1
  },
  'blog-generation': {
    capabilities: ['markdown-parsing', 'html-generation', 'theme-engine'],
    keywords: ['blog', '博客', 'post', '文章'],
    priority: 1
  },
  'portfolio': {
    capabilities: ['html-generation', 'image-gallery', 'responsive-layout'],
    keywords: ['portfolio', '作品集', 'gallery', '作品展示'],
    priority: 1
  },
  'landing-page': {
    capabilities: ['html-generation', 'css-styling', 'animation'],
    keywords: ['landing', 'page', '落地页', '营销页'],
    priority: 1
  },

  // 图片相关
  'image-processing': {
    capabilities: ['image-compression', 'format-conversion', 'thumbnail-generation'],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', '图片', '照片', '压缩'],
    priority: 2
  },
  'image-gallery': {
    capabilities: ['image-optimization', 'responsive-images'],
    keywords: ['gallery', 'album', '相册', '图集'],
    priority: 2
  },

  // 数据相关
  'data-processing': {
    capabilities: ['data-parsing', 'data-transformation', 'data-visualization'],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph', '数据', '图表', '可视化'],
    priority: 2
  },
  'data-dashboard': {
    capabilities: ['data-parsing', 'data-visualization', 'ui-components'],
    keywords: ['dashboard', '仪表盘', '监控', '统计'],
    priority: 2
  },

  // 视频相关
  'video-processing': {
    capabilities: ['video-editing', 'subtitle-generation', 'video-compression'],
    keywords: ['video', 'clip', 'edit', 'subtitle', '视频', '剪辑', '字幕'],
    priority: 3
  },

  // 文档相关
  'document-generation': {
    capabilities: ['text-generation', 'formatting', 'export'],
    keywords: ['document', 'doc', '文档', '报告'],
    priority: 3
  },
  'markdown-to-pdf': {
    capabilities: ['markdown-parsing', 'pdf-generation'],
    keywords: ['markdown', 'pdf', '转换'],
    priority: 3
  },

  // 代码相关
  'code-generation': {
    capabilities: ['code-generation', 'template-engine'],
    keywords: ['code', 'programming', 'function', 'api', '代码', '编程', '函数'],
    priority: 3
  },
  'code-review': {
    capabilities: ['code-analysis', 'best-practices'],
    keywords: ['review', 'code review', 'review code', '审查', '检查'],
    priority: 3
  },

  // 自动化相关
  'automation': {
    capabilities: ['workflow-automation', 'scheduling', 'notification'],
    keywords: ['automation', 'workflow', 'schedule', 'trigger', '自动', '定时', '自动化'],
    priority: 4
  },
  'email-automation': {
    capabilities: ['email-sending', 'template-engine'],
    keywords: ['email', 'mail', '邮件', '发送'],
    priority: 4
  },

  // 文件操作
  'file-batch-operation': {
    capabilities: ['file-search', 'file-manipulation', 'batch-processing'],
    keywords: ['batch', 'file', 'rename', '批量', '文件', '重命名'],
    priority: 4
  },

  // 设计相关
  'ui-design': {
    capabilities: ['ui-components', 'design-system', 'responsive-layout'],
    keywords: ['ui', 'design', 'interface', '界面', '设计'],
    priority: 3
  },
  'logo-design': {
    capabilities: ['svg-generation', 'image-generation'],
    keywords: ['logo', 'brand', '标识', '标志'],
    priority: 4
  },

  // 其他
  'other': {
    capabilities: [],
    keywords: [],
    priority: 99
  }
}

// 能力 → 搜索关键词映射（扩展版）
const CAPABILITY_SEARCH_KEYWORDS = {
  // 网站相关
  'html-generation': ['html', 'static site', 'website generator', 'web builder', 'page builder'],
  'css-styling': ['css', 'style', 'theme', 'design', 'ui'],
  'responsive-layout': ['responsive', 'mobile', 'adaptive', 'layout'],
  'theme-engine': ['theme', 'template', 'layout', 'skin'],
  'animation': ['animation', 'animation', 'effect', 'transition'],
  'markdown-parsing': ['markdown', 'md', 'mdx'],
  'image-gallery': ['gallery', 'image viewer', 'lightbox'],
  'responsive-images': ['responsive images', 'image optimization', 'lazy loading'],

  // 图片相关
  'image-compression': ['image', 'compress', 'optimize', 'resize', 'thumbnail'],
  'format-conversion': ['convert', 'format', 'transform', 'image format'],
  'thumbnail-generation': ['thumbnail', 'preview', 'resize'],
  'image-optimization': ['image optimization', 'compress', 'webp'],

  // 数据相关
  'data-parsing': ['parse', 'csv', 'excel', 'json', 'data'],
  'data-transformation': ['transform', 'convert', 'process', 'data'],
  'data-visualization': ['chart', 'graph', 'visualization', 'plot', 'diagram'],
  'ui-components': ['ui components', 'widgets', 'dashboard'],

  // 视频相关
  'video-editing': ['video', 'edit', 'clip', 'trim'],
  'subtitle-generation': ['subtitle', 'caption', 'transcript', 'srt'],
  'video-compression': ['video compress', 'video optimize', 'video resize'],

  // 文档相关
  'text-generation': ['text', 'content', 'article', 'write', 'ai'],
  'formatting': ['format', 'markdown', 'pdf', 'document'],
  'export': ['export', 'convert', 'download'],

  // 代码相关
  'code-generation': ['code', 'programming', 'scaffold', 'generator', 'template'],
  'code-analysis': ['analysis', 'lint', 'code review', 'quality'],
  'template-engine': ['template', 'scaffold', 'boilerplate', 'starter'],

  // 自动化相关
  'workflow-automation': ['workflow', 'automation', 'zap', 'trigger', 'pipeline'],
  'scheduling': ['schedule', 'cron', 'timer', 'calendar'],
  'notification': ['notification', 'alert', 'webhook'],
  'email-sending': ['email', 'send', 'smtp', 'mail'],

  // 文件操作
  'file-search': ['search', 'find', 'grep', 'filter'],
  'file-manipulation': ['file', 'rename', 'move', 'organize'],
  'batch-processing': ['batch', 'bulk', 'multiple', 'mass'],

  // 设计相关
  'ui-components': ['ui', 'component', 'widget', 'element'],
  'design-system': ['design system', 'ui kit', 'component library'],
  'svg-generation': ['svg', 'vector', 'icon'],
  'image-generation': ['image generation', 'ai image', 'stable diffusion'],

  // 其他
  'other': ['tool', 'utility', 'helper']
}

// ==================== 核心函数 ====================

function analyzeIntent(userInput) {
  const lower = userInput.toLowerCase()

  // 按优先级排序
  const sortedIntents = Object.entries(INTENT_CAPABILITY_MAP)
    .sort((a, b) => (a[1].priority || 99) - (b[1].priority || 99))

  for (const [intentType, config] of sortedIntents) {
    if (intentType === 'other') continue
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return { type: intentType, requirements: config.capabilities, priority: config.priority }
    }
  }

  return { type: 'other', requirements: [], priority: 99 }
}

async function searchPlugins(query, limit = 5) {
  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${PLUGIN_MARKET_KEY}` } })
    if (!response.ok) return []
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
  const intent = analyzeIntent(input)
  const recommendations = []

  for (const cap of intent.requirements) {
    const plugins = await findPluginsForCapability(cap)
    recommendations.push({ capability: cap, plugins })
  }

  return { input, intent, recommendations }
}

// ==================== 主测试 ====================

async function runAllTests() {
  console.log('🚀 Ming Capability Pack - 完整测试套件')
  console.log('━'.repeat(60))

  const scenarios = [
    // 网站类
    '我想做一个摄影作品集网站',
    '帮我创建一个博客',
    '制作一个营销落地页',

    // 图片类
    '帮我压缩这些图片',
    '把图片转换成 WebP 格式',
    '创建一个图片画廊',

    // 数据类
    '把我的 CSV 数据可视化',
    '创建一个数据仪表盘',
    '生成一个 Excel 图表',

    // 视频类
    '帮我生成视频字幕',
    '剪辑视频片段',

    // 文档类
    '写一篇文章',
    '把 Markdown 转成 PDF',
    '生成一份报告',

    // 代码类
    '帮我写一个函数',
    '创建一个 React 组件',
    '审查这段代码',

    // 自动化类
    '自动发送邮件',
    '设置定时任务',
    '创建工作流',

    // 文件操作类
    '批量重命名文件',
    '搜索所有图片文件',

    // 设计类
    '设计一个登录页面',
    '创建一个 Logo'
  ]

  const results = []

  for (const scenario of scenarios) {
    const result = await testScenario(scenario)
    results.push(result)
    await new Promise(r => setTimeout(r, 100))  // 避免限流
  }

  // 统计
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 测试结果统计')
  console.log('='.repeat(60))

  const successCount = results.filter(r => r.recommendations.some(rec => rec.plugins.length > 0)).length
  const failCount = results.length - successCount

  console.log(`✅ 成功: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(0)}%)`)
  console.log(`❌ 失败: ${failCount}/${results.length}`)

  console.log('\n按类型统计:')
  const byType = {}
  for (const r of results) {
    const type = r.intent.type
    if (!byType[type]) byType[type] = { success: 0, fail: 0 }
    if (r.recommendations.some(rec => rec.plugins.length > 0)) {
      byType[type].success++
    } else {
      byType[type].fail++
    }
  }

  for (const [type, stats] of Object.entries(byType)) {
    const total = stats.success + stats.fail
    const rate = (stats.success / total * 100).toFixed(0)
    console.log(`  - ${type}: ${stats.success}/${total} (${rate}%)`)
  }

  console.log('\n🎯 详细结果:')
  for (const r of results) {
    const status = r.recommendations.some(rec => rec.plugins.length > 0) ? '✅' : '❌'
    const topPlugin = r.recommendations[0]?.plugins[0]?.name || '无'
    console.log(`${status} ${r.input.substring(0, 20)}... → ${r.intent.type} → ${topPlugin}`)
  }
}

runAllTests().catch(console.error)
