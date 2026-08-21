/**
 * 智能编排器
 *
 * 负责按正确的顺序执行插件，处理依赖关系和数据传递
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { Plugin, ExecutionContext, ExecutionResult, StepResult } from '../types.js'

export class Orchestrator extends Service {
  constructor(ctx: Context) {
    super(ctx, 'mingOrchestrator')
  }

  /**
   * 执行插件组合
   */
  async execute(
    plugins: Map<string, Plugin>,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    this.ctx.logger.info('⚙️ 开始执行插件编排...')

    const steps: StepResult[] = []

    try {
      // 简化版：按顺序执行（未来可以添加依赖分析和拓扑排序）
      for (const [capability, plugin] of plugins) {
        try {
          this.ctx.logger.info(`执行: ${plugin.name} (${capability})`)

          const result = await this.executePlugin(plugin, capability, context, steps)

          steps.push({
            capability,
            plugin: plugin.name,
            success: true,
            output: result,
            timestamp: new Date().toISOString()
          })

          this.ctx.logger.info(`✓ ${plugin.name} 执行成功`)

        } catch (error: any) {
          this.ctx.logger.error(`✗ ${plugin.name} 执行失败`, error)

          steps.push({
            capability,
            plugin: plugin.name,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          })

          // 如果是关键步骤失败，停止执行
          // 简化版：所有步骤都视为关键
          throw error
        }
      }

      this.ctx.logger.info(`✅ 编排执行完成，共 ${steps.length} 个步骤`)

      return {
        success: true,
        steps
      }

    } catch (error) {
      this.ctx.logger.error('❌ 编排执行失败', error)

      return {
        success: false,
        steps
      }
    }
  }

  /**
   * 执行单个插件
   */
  private async executePlugin(
    plugin: Plugin,
    capability: string,
    context: ExecutionContext,
    previousSteps: StepResult[]
  ): Promise<any> {
    // 简化版：尝试调用插件提供的工具
    // 在实际实现中，需要根据插件类型和能力来决定如何调用

    // 目前返回模拟结果
    this.ctx.logger.debug(`执行插件 ${plugin.name} 的能力 ${capability}`)

    return {
      message: `插件 ${plugin.name} 执行完成`,
      capability,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 准备输入数据
   */
  private prepareInput(
    plugin: Plugin,
    previousSteps: StepResult[],
    context: ExecutionContext
  ): any {
    // 从前序步骤的输出和上下文准备输入
    return {
      goal: context.goal,
      resources: context.resources,
      previousOutputs: previousSteps.map(s => s.output)
    }
  }
}

// 声明类型扩展
declare module '@deepseek-ai/cordis' {
  interface Context {
    mingOrchestrator: Orchestrator
  }
}
