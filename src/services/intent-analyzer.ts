/**
 * 意图分析引擎
 *
 * 负责将用户的自然语言输入转换为结构化的意图和能力需求
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { Intent, IntentType, Requirement } from '../types.js'
import { INTENT_CAPABILITY_MAP } from '../types.js'

export class IntentAnalyzer extends Service {
  constructor(ctx: Context) {
    super(ctx, 'mingIntentAnalyzer')
  }

  /**
   * 分析用户意图
   */
  async analyze(userInput: string): Promise<Intent> {
    this.ctx.logger.info('🔍 开始分析意图...')

    try {
      // Step 1: 使用 LLM 分析意图
      const llmAnalysis = await this.callLLMForIntent(userInput)

      // Step 2: 解析 LLM 输出
      const parsed = this.parseIntentFromLLM(llmAnalysis)

      // Step 3: 使用知识图谱增强
      const enhanced = this.enhanceWithKnowledgeGraph(parsed)

      this.ctx.logger.info(`✅ 意图分析完成: ${enhanced.type}`)

      return enhanced

    } catch (error) {
      this.ctx.logger.error('❌ 意图分析失败', error)
      throw error
    }
  }

  /**
   * 调用 LLM 分析意图
   */
  private async callLLMForIntent(userInput: string): Promise<string> {
    const systemPrompt = `你是一个意图分析专家。分析用户输入，判断用户想要完成什么任务。

输出严格的 JSON 格式：
{
  "goal": "用一句话描述用户的目标",
  "type": "website-generation | data-processing | image-processing | file-automation | content-creation | workflow-automation | other",
  "confidence": 0.0-1.0,
  "resources": ["用户提到的文件、URL等资源"],
  "constraints": [{"type": "speed|quality|privacy|cost", "value": "描述"}]
}

类型说明：
- website-generation: 生成网站、网页、HTML
- data-processing: 处理数据、CSV、Excel、图表
- image-processing: 处理图片、照片、压缩、格式转换
- file-automation: 文件操作、批量处理、重命名
- content-creation: 文本生成、文档创建、写作
- workflow-automation: 自动化工作流、定时任务
- other: 其他类型

只输出 JSON，不要任何解释。`

    try {
      // 调用 Harness 的 LLM 服务
      const response = await this.ctx.llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        temperature: 0.1  // 低温度，确保输出稳定
      })

      return response.content

    } catch (error) {
      this.ctx.logger.warn('LLM 调用失败，使用简单规则分析', error)
      // 降级：使用简单规则
      return this.fallbackRuleBasedAnalysis(userInput)
    }
  }

  /**
   * 解析 LLM 输出
   */
  private parseIntentFromLLM(llmOutput: string): Intent {
    try {
      // 尝试提取 JSON
      const jsonMatch = llmOutput.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('无法从 LLM 输出中提取 JSON')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        goal: parsed.goal || '未知目标',
        type: parsed.type || 'other',
        requirements: [],  // 稍后填充
        context: {
          resources: parsed.resources || [],
          constraints: parsed.constraints || []
        },
        confidence: parsed.confidence || 0.5
      }

    } catch (error) {
      this.ctx.logger.warn('解析 LLM 输出失败，使用默认值', error)
      return {
        goal: '未知目标',
        type: 'other',
        requirements: [],
        context: { resources: [], constraints: [] },
        confidence: 0.3
      }
    }
  }

  /**
   * 使用知识图谱增强意图
   */
  private enhanceWithKnowledgeGraph(intent: Intent): Intent {
    // 从知识图谱获取能力需求
    const capabilityDef = INTENT_CAPABILITY_MAP[intent.type]

    if (!capabilityDef || capabilityDef.capabilities.length === 0) {
      this.ctx.logger.warn(`未找到意图类型的能力定义: ${intent.type}`)
      return intent
    }

    // 转换为 Requirement 格式
    const requirements: Requirement[] = capabilityDef.capabilities.map(cap => ({
      capability: cap.name,
      priority: cap.priority,
      keywords: this.getKeywordsForCapability(cap.name),
      antiPatterns: capabilityDef.antiPatterns
    }))

    return {
      ...intent,
      requirements
    }
  }

  /**
   * 获取能力的搜索关键词
   */
  private getKeywordsForCapability(capability: string): string[] {
    // 从 CAPABILITY_SEARCH_KEYWORDS 导入
    const { CAPABILITY_SEARCH_KEYWORDS } = require('../types.js')
    return CAPABILITY_SEARCH_KEYWORDS[capability] || [capability]
  }

  /**
   * 降级方案：基于规则的简单分析
   */
  private fallbackRuleBasedAnalysis(userInput: string): string {
    const lower = userInput.toLowerCase()

    let type: IntentType = 'other'
    let goal = userInput

    if (lower.includes('网站') || lower.includes('网页') || lower.includes('html')) {
      type = 'website-generation'
      goal = '生成网站'
    } else if (lower.includes('图片') || lower.includes('照片') || lower.includes('图像')) {
      type = 'image-processing'
      goal = '处理图片'
    } else if (lower.includes('数据') || lower.includes('excel') || lower.includes('csv')) {
      type = 'data-processing'
      goal = '处理数据'
    } else if (lower.includes('文件')) {
      type = 'file-automation'
      goal = '处理文件'
    }

    return JSON.stringify({
      goal,
      type,
      confidence: 0.6,
      resources: [],
      constraints: []
    })
  }
}

// 声明类型扩展（让 TypeScript 识别）
declare module '@deepseek-ai/cordis' {
  interface Context {
    mingIntentAnalyzer: IntentAnalyzer
  }
}
