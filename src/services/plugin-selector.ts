/**
 * 插件选择器 - 核心算法
 *
 * 从 DeepSeek Harness 插件市场的 1594+ 插件中智能选择最佳组合
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { Plugin, PluginSearchResult, Requirement } from '../types.js'

const PLUGIN_MARKET_API = 'https://api.deepseek1024.com/v1/plugins'
const PLUGIN_MARKET_KEY = 'dsh_live_e2812e163bc996a2590c615dee03886832e2fa92'

export class PluginSelector extends Service {
  constructor(ctx: Context) {
    super(ctx, 'mingPluginSelector')
  }

  /**
   * 为能力需求列表查找最佳插件组合
   */
  async findBestPlugins(requirements: Requirement[]): Promise<Map<string, Plugin>> {
    this.ctx.logger.info(`🔎 开始搜索 ${requirements.length} 个能力的最佳插件...`)

    const selectedPlugins = new Map<string, Plugin>()

    for (const req of requirements) {
      try {
        this.ctx.logger.debug(`搜索能力: ${req.capability} (${req.priority})`)

        // 1. 搜索候选插件
        const candidates = await this.searchPluginsForCapability(req)

        if (candidates.length === 0) {
          this.ctx.logger.warn(`未找到能力的插件: ${req.capability}`)
          if (req.priority === 'critical') {
            throw new Error(`找不到关键能力：${req.capability}`)
          }
          continue
        }

        // 2. 评分和排序
        const scored = this.scoreAndRank(candidates, req, selectedPlugins)

        // 3. 选择最高分
        const best = scored[0]
        selectedPlugins.set(req.capability, best.plugin)

        this.ctx.logger.info(
          `✓ ${req.capability} → ${best.plugin.name} (⭐${best.plugin.stars}, 评分:${best.score.toFixed(1)})`
        )

      } catch (error) {
        this.ctx.logger.error(`搜索能力失败: ${req.capability}`, error)
        if (req.priority === 'critical') {
          throw error
        }
      }
    }

    // 4. 验证兼容性
    this.validateCompatibility(selectedPlugins)

    this.ctx.logger.info(`✅ 已选择 ${selectedPlugins.size} 个插件`)

    return selectedPlugins
  }

  /**
   * 搜索能力对应的插件
   */
  private async searchPluginsForCapability(req: Requirement): Promise<Plugin[]> {
    const allCandidates: Plugin[] = []

    // 对每个关键词搜索
    for (const keyword of req.keywords) {
      try {
        const results = await this.searchPluginMarket(keyword)
        allCandidates.push(...results.results)
      } catch (error) {
        this.ctx.logger.warn(`搜索关键词失败: ${keyword}`, error)
      }
    }

    // 去重（根据 id）
    const uniquePlugins = new Map<string, Plugin>()
    for (const plugin of allCandidates) {
      if (!uniquePlugins.has(plugin.id)) {
        uniquePlugins.set(plugin.id, plugin)
      }
    }

    // 过滤掉包含反向模式的插件
    const filtered = Array.from(uniquePlugins.values()).filter(plugin => {
      if (!req.antiPatterns || req.antiPatterns.length === 0) {
        return true
      }

      const description = (plugin.description.zh + ' ' + plugin.description.en).toLowerCase()
      return !req.antiPatterns.some(pattern =>
        description.includes(pattern.toLowerCase())
      )
    })

    return filtered
  }

  /**
   * 调用插件市场 API
   */
  private async searchPluginMarket(query: string, limit = 20): Promise<PluginSearchResult> {
    const url = `${PLUGIN_MARKET_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${PLUGIN_MARKET_KEY}`
        }
      })

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data as PluginSearchResult

    } catch (error) {
      this.ctx.logger.error(`插件市场 API 调用失败: ${query}`, error)
      throw error
    }
  }

  /**
   * 评分和排序 - 核心算法
   */
  private scoreAndRank(
    candidates: Plugin[],
    requirement: Requirement,
    alreadySelected: Map<string, Plugin>
  ): Array<{ plugin: Plugin; score: number }> {
    const scored = candidates.map(plugin => ({
      plugin,
      score: this.calculateScore(plugin, requirement, alreadySelected)
    }))

    // 按评分降序排序
    scored.sort((a, b) => b.score - a.score)

    return scored
  }

  /**
   * 计算插件评分（多维度）
   */
  private calculateScore(
    plugin: Plugin,
    requirement: Requirement,
    alreadySelected: Map<string, Plugin>
  ): number {
    let score = 0

    // 维度1: 受欢迎程度 (40%)
    const popularityScore =
      Math.log10(plugin.stars + 1) * 10 +        // 星标数
      Math.log10(plugin.installCount + 1) * 5 +  // 安装次数
      Math.log10(plugin.growth24h + 1) * 2       // 24h增长

    score += popularityScore * 0.4

    // 维度2: 活跃度 (20%)
    const daysSinceUpdate = this.getDaysSince(plugin.pushedAt)
    const freshnessScore = Math.max(0, 20 - daysSinceUpdate / 7)
    score += freshnessScore * 0.2

    // 维度3: 相关性 (25%)
    const relevanceScore = this.calculateRelevance(
      plugin,
      requirement.keywords,
      requirement.antiPatterns
    )
    score += relevanceScore * 0.25

    // 维度4: 兼容性 (15%)
    const compatibilityScore = this.calculateCompatibility(plugin, alreadySelected)
    score += compatibilityScore * 0.15

    return score
  }

  /**
   * 计算天数差
   */
  private getDaysSince(dateStr: string): number {
    const date = new Date(dateStr)
    const now = new Date()
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevance(
    plugin: Plugin,
    keywords: string[],
    antiPatterns?: string[]
  ): number {
    const text = (plugin.description.zh + ' ' + plugin.description.en + ' ' + plugin.name).toLowerCase()
    let score = 0

    // 正向关键词匹配
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 10
      }
    }

    // 反向模式惩罚
    if (antiPatterns) {
      for (const pattern of antiPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          score -= 20  // 严重惩罚
        }
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 计算兼容性评分
   */
  private calculateCompatibility(
    plugin: Plugin,
    alreadySelected: Map<string, Plugin>
  ): number {
    let score = 100

    for (const selected of alreadySelected.values()) {
      // 同一个作者的插件通常兼容
      if (plugin.owner === selected.owner) {
        score += 20
      }

      // 检查类别冲突
      if (this.hasCategoryConflict(plugin.category, selected.category)) {
        score -= 30
      }
    }

    return Math.max(0, score)
  }

  /**
   * 检查类别冲突
   */
  private hasCategoryConflict(cat1: string, cat2: string): boolean {
    // 某些类别可能冲突（例如：两个不同的模板引擎）
    const conflictPairs = [
      ['theme', 'theme'],  // 两个主题可能冲突
    ]

    return conflictPairs.some(([a, b]) =>
      (cat1 === a && cat2 === b) || (cat1 === b && cat2 === a)
    )
  }

  /**
   * 验证插件组合的兼容性
   */
  private validateCompatibility(plugins: Map<string, Plugin>): void {
    const pluginArray = Array.from(plugins.values())

    // 检查是否有明显的冲突
    for (let i = 0; i < pluginArray.length; i++) {
      for (let j = i + 1; j < pluginArray.length; j++) {
        const p1 = pluginArray[i]
        const p2 = pluginArray[j]

        if (this.hasCategoryConflict(p1.category, p2.category)) {
          this.ctx.logger.warn(
            `⚠️ 检测到可能的插件冲突: ${p1.name} vs ${p2.name}`
          )
        }
      }
    }
  }
}

// 声明类型扩展
declare module '@deepseek-ai/cordis' {
  interface Context {
    mingPluginSelector: PluginSelector
  }
}
