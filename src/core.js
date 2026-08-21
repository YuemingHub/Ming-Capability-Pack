// Ming Capability Pack - 增强版核心模块（场景适配优化）

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

// 缓存
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5分钟

// 限流
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 500  // 最小请求间隔 500ms

// ==================== 增强知识图谱 ====================

const INTENT_CAPABILITY_MAP = {
  // 代码相关
  'code-development': {
    capabilities: ['code-generation', 'code-review', 'testing'],
    keywords: [
      'code', 'programming', 'function', 'api', 'test', 'debug',
      'review', 'lint', 'format', 'refactor', 'fix', 'error',
      '代码', '编程', '函数', '测试', '调试', '审查', '格式化', '重构', '修复', '错误',
      'typescript', 'javascript', 'python', 'react', 'vue', 'bug'
    ],
    searchTerms: ['code', 'programming', 'test', 'lint', 'review', 'debug'],
    scene: 'development',
    priority: 3
  },

  // 部署运维
  'deployment': {
    capabilities: ['ci-cd', 'containerization', 'monitoring'],
    keywords: [
      'deploy', 'production', 'docker', 'kubernetes', 'ci/cd', 'pipeline',
      'aws', 'azure', 'vercel', 'netlify', 'server', 'hosting',
      '部署', '生产', '容器', '编排', '持续集成', '服务器',
      '上线', '发布', '运维', 'ci', 'cd'
    ],
    searchTerms: ['deploy', 'docker', 'ci/cd', 'production', 'monitoring'],
    scene: 'deployment',
    priority: 3
  },

  // 文档管理
  'documentation': {
    capabilities: ['docs-generation', 'readme', 'api-docs'],
    keywords: [
      'docs', 'documentation', 'readme', 'api docs', 'wiki', 'guide',
      'tutorial', 'manual', 'changelog', 'contributing',
      '文档', '说明', '手册', '指南', '教程', '更新日志',
      '注释', '注解', '说明文档', '生成文档', '更新文档'
    ],
    searchTerms: ['docs', 'documentation', 'readme', 'api'],
    scene: 'documentation',
    priority: 4
  },

  // 安全审查
  'security-review': {
    capabilities: ['security-scan', 'vulnerability-check', 'auth-testing'],
    keywords: [
      'security', 'vulnerability', 'auth', 'permission', 'audit', 'scan',
      'encryption', 'token', 'oauth', 'jwt', 'check',
      '安全', '漏洞', '权限', '扫描', '审计', '加密', '认证',
      '检查权限', '安全检查', '安全审计'
    ],
    searchTerms: ['security', 'auth', 'permission', 'vulnerability', 'audit'],
    scene: 'security',
    priority: 4
  },

  // 性能优化
  'performance-optimization': {
    capabilities: ['profiling', 'caching', 'optimization'],
    keywords: [
      'performance', 'optimize', 'cache', 'speed', 'benchmark', 'profile',
      'memory', 'cpu', 'latency', 'throughput',
      '性能', '优化', '缓存', '加速', '基准', '内存', '延迟',
      '提高性能', '优化性能', '优化速度'
    ],
    searchTerms: ['performance', 'optimize', 'cache', 'speed'],
    scene: 'performance',
    priority: 4
  },

  // 数据库操作
  'database-operations': {
    capabilities: ['sql-optimization', 'migration', 'backup'],
    keywords: [
      'database', 'sql', 'query', 'migration', 'backup', 'restore',
      'mysql', 'postgresql', 'sqlite', 'mongodb',
      '数据库', '查询', '迁移', '备份', '恢复', 'SQL',
      '优化查询', '数据库性能', '分析数据库'
    ],
    searchTerms: ['database', 'sql', 'query', 'migration'],
    scene: 'database',
    priority: 4
  },

  // 监控告警
  'monitoring-alerting': {
    capabilities: ['monitoring', 'alerting', 'logging'],
    keywords: [
      'monitor', 'monitoring', 'alert', 'alerting', 'logging', 'log',
      'metrics', 'dashboard', 'notification',
      '监控', '告警', '日志', '指标', '仪表盘', '通知',
      '设置监控', '监控告警', '日志分析'
    ],
    searchTerms: ['monitor', 'alert', 'logging', 'metrics'],
    scene: 'monitoring',
    priority: 4
  },

  // 自动化工作流
  'automation': {
    capabilities: ['workflow-automation', 'scheduling', 'notification'],
    keywords: [
      'automation', 'workflow', 'schedule', 'trigger', 'cron',
      'script', 'batch', 'automatic',
      '工作流', '自动化', '定时', '触发', '脚本', '批量'
    ],
    searchTerms: ['workflow', 'automation', 'schedule'],
    scene: 'automation',
    priority: 5
  }
}

// ==================== 场景关键词映射 ====================

const SCENE_KEYWORDS = {
  'website': [
    'html', 'css', 'javascript', 'responsive', 'template', 'theme',
    'layout', 'ui', 'design', 'frontend', 'static site', 'web page',
    '网页', '网站', '前端', '模板', '响应式', '布局', '界面'
  ],
  'data': [
    'chart', 'graph', 'visualization', 'data', 'csv', 'excel', 'json',
    'database', 'sql', 'analytics', 'statistics', 'dashboard',
    '数据', '图表', '可视化', '数据库', '分析', '统计', '仪表盘'
  ],
  'development': [
    'code', 'programming', 'debug', 'test', 'lint', 'format', 'refactor',
    'typescript', 'javascript', 'python', 'react', 'vue', 'node',
    '代码', '编程', '调试', '测试', '格式化', '重构', '开发'
  ],
  'deployment': [
    'deploy', 'production', 'docker', 'kubernetes', 'ci/cd', 'pipeline',
    'aws', 'azure', 'vercel', 'netlify', 'server', 'hosting',
    '部署', '生产', '容器', '编排', '持续集成', '服务器'
  ],
  'documentation': [
    'docs', 'documentation', 'readme', 'api docs', 'wiki', 'guide',
    'tutorial', 'manual', 'changelog', 'contributing',
    '文档', '说明', '手册', '指南', '教程', '更新日志'
  ],
  'security': [
    'security', 'auth', 'permission', 'vulnerability', 'scan', 'audit',
    'encryption', 'token', 'oauth', 'jwt',
    '安全', '权限', '漏洞', '扫描', '审计', '加密', '认证'
  ],
  'performance': [
    'performance', 'optimize', 'cache', 'speed', 'benchmark', 'profile',
    'memory', 'cpu', 'latency', 'throughput',
    '性能', '优化', '缓存', '加速', '基准', '内存', '延迟'
  ],
  'automation': [
    'workflow', 'automation', 'schedule', 'trigger', 'pipeline', 'cron',
    'script', 'batch', 'batch', 'automatic',
    '工作流', '自动化', '定时', '触发', '脚本', '批量'
  ]
}

// ==================== 增强评分算法 ====================

/**
 * 计算插件的基础评分
 */
function calculateBaseScore(plugin) {
  let score = 0

  // 受欢迎程度 (60%)
  score += Math.log10(plugin.stars + 1) * 15
  score += Math.log10(plugin.installCount + 1) * 10

  // 活跃度 (40%)
  if (plugin.pushedAt) {
    const daysSinceUpdate = (Date.now() - new Date(plugin.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 25 - daysSinceUpdate / 7)
  }

  return score
}

/**
 * 计算场景适配度评分
 */
function calculateSceneFitness(plugin, scene) {
  const sceneKeywords = SCENE_KEYWORDS[scene] || []
  if (sceneKeywords.length === 0) return 0

  const pluginText = (plugin.description?.zh + ' ' + plugin.description?.en + ' ' + plugin.name).toLowerCase()

  let matchCount = 0
  for (const keyword of sceneKeywords) {
    if (pluginText.includes(keyword.toLowerCase())) {
      matchCount++
    }
  }

  // 匹配度得分（0-30分）
  return (matchCount / sceneKeywords.length) * 30
}

/**
 * 计算依赖复杂度评分（越简单越好）
 */
function calculateDependencyScore(plugin) {
  // 简化：根据类别判断复杂度
  const complexCategories = ['framework', 'platform', 'runtime']
  const simpleCategories = ['tool', 'utility', 'helper', 'plugin']

  if (complexCategories.includes(plugin.category)) {
    return -10  // 复杂插件扣分
  } else if (simpleCategories.includes(plugin.category)) {
    return 5    // 简单插件加分
  }

  return 0
}

/**
 * 计算综合评分
 */
function calculateEnhancedScore(plugin, scene) {
  let score = 0

  // 1. 基础评分（50%权重）
  const baseScore = calculateBaseScore(plugin)
  score += baseScore * 0.5

  // 2. 场景适配度（30%权重）⭐核心新增
  const sceneFitness = calculateSceneFitness(plugin, scene)
  score += sceneFitness * 1.0  // 已经是0-30分，直接加

  // 3. 依赖复杂度（10%权重）
  const dependencyScore = calculateDependencyScore(plugin)
  score += dependencyScore

  // 4. 综合调整
  score = Math.max(0, score)  // 确保非负

  return score
}

// ==================== 核心函数 ====================

/**
 * 分析用户意图
 */
function analyzeIntent(userInput) {
  const lower = userInput.toLowerCase()

  // 按优先级排序
  const sortedIntents = Object.entries(INTENT_CAPABILITY_MAP)
    .sort((a, b) => (a[1].priority || 99) - (b[1].priority || 99))

  for (const [intentType, config] of sortedIntents) {
    const match = config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (match) {
      return {
        type: intentType,
        requirements: config.capabilities,
        searchTerms: config.searchTerms,
        scene: config.scene,
        priority: config.priority,
        description: intentType.replace(/-/g, ' ')
      }
    }
  }

  return { type: 'other', requirements: [], searchTerms: [], scene: 'other', priority: 99 }
}

/**
 * 搜索插件市场
 */
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

/**
 * 为能力搜索并评分插件（增强版）
 */
async function findPluginsForCapability(capability, searchTerms, scene) {
  const allPlugins = []
  const keywords = searchTerms || [capability]

  for (const keyword of keywords) {
    const plugins = await searchPlugins(keyword, 5)
    allPlugins.push(...plugins)
  }

  // 去重
  const uniquePlugins = new Map()
  for (const plugin of allPlugins) {
    if (!uniquePlugins.has(plugin.id)) {
      uniquePlugins.set(plugin.id, plugin)
    }
  }

  // 使用增强评分算法
  const scored = Array.from(uniquePlugins.values()).map(p => ({
    ...p,
    score: calculateEnhancedScore(p, scene),
    scoreBreakdown: {
      base: calculateBaseScore(p),
      sceneFitness: calculateSceneFitness(p, scene),
      dependency: calculateDependencyScore(p)
    }
  }))

  // 排序
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 5)
}

// ==================== 导出 ====================

export {
  analyzeIntent,
  searchPlugins,
  calculateBaseScore,
  calculateSceneFitness,
  calculateDependencyScore,
  calculateEnhancedScore,
  findPluginsForCapability,
  INTENT_CAPABILITY_MAP,
  SCENE_KEYWORDS
}
