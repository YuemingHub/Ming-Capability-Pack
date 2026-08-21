/**
 * 类型定义
 */

// ==================== 意图分析 ====================

export enum IntentType {
  WEBSITE_GENERATION = 'website-generation',
  DATA_PROCESSING = 'data-processing',
  IMAGE_PROCESSING = 'image-processing',
  FILE_AUTOMATION = 'file-automation',
  CONTENT_CREATION = 'content-creation',
  WORKFLOW_AUTOMATION = 'workflow-automation',
  OTHER = 'other'
}

export type Priority = 'critical' | 'important' | 'optional'

export interface Requirement {
  capability: string              // 能力名称，如 "html-generation"
  priority: Priority
  keywords: string[]              // 搜索关键词
  antiPatterns?: string[]         // 排除模式
}

export interface Intent {
  goal: string                    // 目标描述
  type: IntentType                // 意图类型
  requirements: Requirement[]     // 能力需求列表
  context: {
    resources?: string[]          // 用户提供的资源
    constraints?: Constraint[]    // 约束条件
  }
  confidence: number              // 置信度 (0-1)
}

export interface Constraint {
  type: 'speed' | 'quality' | 'privacy' | 'cost'
  value: string
}

// ==================== 插件选择 ====================

export interface Plugin {
  id: string                      // "owner/repo" 或 "owner/repo/path"
  name: string
  owner: string
  url: string
  category: string
  description: {
    en: string
    zh: string
  }
  stars: number
  installCount: number
  growth24h: number
  added: string
  pushedAt: string
  install: string                 // 安装命令
  score?: number                  // 计算的评分
}

export interface PluginSearchResult {
  query: string
  page: number
  limit: number
  sortBy: string
  total: number
  totalPages: number
  results: Plugin[]
}

// ==================== 执行编排 ====================

export interface ExecutionContext {
  goal: string
  resources: string[]
  workDir: string
}

export interface StepResult {
  capability: string
  plugin: string
  success: boolean
  output?: any
  error?: string
  timestamp: string
}

export interface ExecutionResult {
  success: boolean
  steps: StepResult[]
  evidencePath?: string
}

// ==================== 证据收集 ====================

export interface EvidenceCard {
  id: string
  timestamp: string
  intent: {
    raw: string
    analyzed: Intent
  }
  execution: {
    plugins: Array<{
      name: string
      stars: number
      url: string
    }>
    steps: StepResult[]
  }
  outcome: {
    artifacts: Array<{
      type: 'file' | 'url' | 'data'
      path: string
      description: string
    }>
    verification: {
      method: string
      result: 'verified' | 'failed'
      evidence: string[]
    }
  }
}

// ==================== 知识图谱 ====================

export interface CapabilityDefinition {
  capabilities: Array<{
    name: string
    priority: Priority
  }>
  keywords: string[]
  antiPatterns: string[]
}

export const INTENT_CAPABILITY_MAP: Record<IntentType, CapabilityDefinition> = {
  [IntentType.WEBSITE_GENERATION]: {
    capabilities: [
      { name: 'html-generation', priority: 'critical' },
      { name: 'css-styling', priority: 'critical' },
      { name: 'responsive-layout', priority: 'important' },
      { name: 'template-engine', priority: 'important' },
      { name: 'image-optimization', priority: 'optional' },
      { name: 'deployment', priority: 'optional' }
    ],
    keywords: ['website', 'html', 'web', 'site', 'page', 'static'],
    antiPatterns: ['backend', 'database', 'api', 'server']
  },

  [IntentType.IMAGE_PROCESSING]: {
    capabilities: [
      { name: 'image-compression', priority: 'critical' },
      { name: 'format-conversion', priority: 'important' },
      { name: 'thumbnail-generation', priority: 'optional' },
      { name: 'watermark', priority: 'optional' }
    ],
    keywords: ['image', 'photo', 'picture', 'compress', 'optimize', 'resize'],
    antiPatterns: ['video', 'audio']
  },

  [IntentType.DATA_PROCESSING]: {
    capabilities: [
      { name: 'data-parsing', priority: 'critical' },
      { name: 'data-transformation', priority: 'critical' },
      { name: 'data-visualization', priority: 'important' },
      { name: 'data-export', priority: 'optional' }
    ],
    keywords: ['data', 'csv', 'excel', 'json', 'chart', 'graph'],
    antiPatterns: ['image', 'video']
  },

  [IntentType.FILE_AUTOMATION]: {
    capabilities: [
      { name: 'file-search', priority: 'critical' },
      { name: 'file-manipulation', priority: 'critical' },
      { name: 'batch-processing', priority: 'important' }
    ],
    keywords: ['file', 'folder', 'batch', 'rename', 'organize'],
    antiPatterns: []
  },

  [IntentType.CONTENT_CREATION]: {
    capabilities: [
      { name: 'text-generation', priority: 'critical' },
      { name: 'formatting', priority: 'important' },
      { name: 'export', priority: 'optional' }
    ],
    keywords: ['content', 'text', 'document', 'article', 'write'],
    antiPatterns: []
  },

  [IntentType.WORKFLOW_AUTOMATION]: {
    capabilities: [
      { name: 'trigger', priority: 'critical' },
      { name: 'action', priority: 'critical' },
      { name: 'notification', priority: 'optional' }
    ],
    keywords: ['automation', 'workflow', 'schedule', 'trigger'],
    antiPatterns: []
  },

  [IntentType.OTHER]: {
    capabilities: [],
    keywords: [],
    antiPatterns: []
  }
}

// 能力 → 搜索关键词映射
export const CAPABILITY_SEARCH_KEYWORDS: Record<string, string[]> = {
  'html-generation': ['html', 'static site', 'website generator', 'web builder'],
  'css-styling': ['css', 'style', 'theme', 'design'],
  'responsive-layout': ['responsive', 'mobile', 'adaptive'],
  'template-engine': ['template', 'theme', 'layout'],
  'image-optimization': ['image', 'compress', 'optimize', 'resize'],
  'image-compression': ['image', 'compress', 'optimize'],
  'format-conversion': ['convert', 'format', 'transform'],
  'thumbnail-generation': ['thumbnail', 'preview'],
  'data-parsing': ['parse', 'csv', 'excel', 'json'],
  'data-transformation': ['transform', 'convert', 'process'],
  'data-visualization': ['chart', 'graph', 'visualization', 'plot'],
  'file-search': ['search', 'find', 'grep'],
  'file-manipulation': ['file', 'rename', 'organize'],
  'batch-processing': ['batch', 'bulk', 'multiple']
}
