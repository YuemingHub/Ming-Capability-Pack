// Ming Capability Pack - 增加缓存和限流保护

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

// 缓存
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5分钟

// 限流
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 500  // 最小请求间隔 500ms

// 知识图谱
const INTENT_CAPABILITY_MAP = {
  'website-generation': {
    capabilities: ['html-generation'],
    keywords: ['website', 'html', 'web', 'site', 'page', '网站', '网页'],
    searchTerms: ['html', 'static site', 'website']
  },
  'image-processing': {
    capabilities: ['image-compression'],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', '图片', '照片'],
    searchTerms: ['image', 'compress', 'optimize']
  },
  'data-processing': {
    capabilities: ['data-parsing'],
    keywords: ['data', 'csv', 'excel', 'chart', 'graph', '数据', '图表'],
    searchTerms: ['chart', 'data', 'visualization']
  },
  'video-processing': {
    capabilities: ['video-editing'],
    keywords: ['video', 'clip', 'edit', 'subtitle', '视频', '剪辑'],
    searchTerms: ['video', 'subtitle']
  },
  'content-creation': {
    capabilities: ['text-generation'],
    keywords: ['content', 'text', 'document', 'article', 'write', '文档', '文章'],
    searchTerms: ['text', 'content', 'article']
  },
  'automation': {
    capabilities: ['workflow-automation'],
    keywords: ['automation', 'workflow', 'schedule', 'trigger', '自动', '定时'],
    searchTerms: ['workflow', 'automation']
  },
  'code-generation': {
    capabilities: ['code-generation'],
    keywords: ['code', 'programming', 'function', 'api', '代码', '编程'],
    searchTerms: ['code', 'programming']
  },
  'file-operations': {
    capabilities: ['batch-processing'],
    keywords: ['batch', 'file', 'rename', '批量', '文件', '重命名'],
    searchTerms: ['file', 'batch']
  }
}

function analyzeIntent(userInput) {
  const lower = userInput.toLowerCase()
  for (const [intentType, config] of Object.entries(INTENT_CAPABILITY_MAP)) {
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return { type: intentType, requirements: config.capabilities, searchTerms: config.searchTerms }
    }
  }
  return { type: 'other', requirements: [], searchTerms: [] }
}

async function searchPlugins(query, limit = 5) {
  const cacheKey = `${query}:${limit}`

  // 检查缓存
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)
    if (Date.now() - cached.time < CACHE_TTL) {
      return cached.data
    }
    cache.delete(cacheKey)
  }

  // 限流等待
  const now = Date.now()
  const waitTime = MIN_REQUEST_INTERVAL - (now - lastRequestTime)
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime))
  }

  lastRequestTime = Date.now()

  const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${PLUGIN_MARKET_KEY}` } })
    if (!response.ok) {
      if (response.status === 429) {
        console.error(`⚠️ 限流: ${query}`)
        return []
      }
      return []
    }
    const data = await response.json()
    const results = data.results || []

    // 存入缓存
    cache.set(cacheKey, { data: results, time: Date.now() })

    return results
  } catch (error) {
    return []
  }
}

function calculateScore(plugin) {
  return Math.log10(plugin.stars + 1) * 15 + Math.log10(plugin.installCount + 1) * 10
}

async function findPluginsForCapability(capability, searchTerms) {
  const allPlugins = []
  const keywords = searchTerms || [capability]

  for (const keyword of keywords) {
    const plugins = await searchPlugins(keyword, 5)
    allPlugins.push(...plugins)
  }

  const uniquePlugins = new Map()
  for (const plugin of allPlugins) {
    if (!uniquePlugins.has(plugin.id)) {
      uniquePlugins.set(plugin.id, plugin)
    }
  }

  const scored = Array.from(uniquePlugins.values()).map(p => ({ ...p, score: calculateScore(p) }))
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 3)
}

export { analyzeIntent, findPluginsForCapability, calculateScore, searchPlugins }
