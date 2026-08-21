/**
 * 证据收集器
 *
 * 负责记录执行过程，生成可追溯的证据链
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { Intent, Plugin, StepResult, EvidenceCard } from '../types.js'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export class EvidenceCollector extends Service {
  private evidenceDir: string

  constructor(ctx: Context) {
    super(ctx, 'mingEvidenceCollector')
    this.evidenceDir = join(process.cwd(), 'ming-evidence')
  }

  /**
   * 收集并保存证据
   */
  async collect(data: {
    goal: string
    intent: Intent
    plugins: Plugin[]
    steps: StepResult[]
  }): Promise<{ path: string; card: EvidenceCard }> {
    this.ctx.logger.info('📋 开始收集证据...')

    try {
      // 确保证据目录存在
      await mkdir(this.evidenceDir, { recursive: true })

      // 生成证据卡
      const card: EvidenceCard = {
        id: `evidence-${Date.now()}`,
        timestamp: new Date().toISOString(),
        intent: {
          raw: data.goal,
          analyzed: data.intent
        },
        execution: {
          plugins: data.plugins.map(p => ({
            name: p.name,
            stars: p.stars,
            url: p.url
          })),
          steps: data.steps
        },
        outcome: {
          artifacts: this.extractArtifacts(data.steps),
          verification: {
            method: 'execution-log',
            result: data.steps.every(s => s.success) ? 'verified' : 'failed',
            evidence: data.steps.map(s => s.timestamp)
          }
        }
      }

      // 保存到文件
      const filename = `${card.id}.json`
      const filepath = join(this.evidenceDir, filename)

      await writeFile(filepath, JSON.stringify(card, null, 2), 'utf-8')

      this.ctx.logger.info(`✅ 证据已保存: ${filepath}`)

      return { path: filepath, card }

    } catch (error) {
      this.ctx.logger.error('❌ 证据收集失败', error)
      throw error
    }
  }

  /**
   * 从执行步骤中提取产物
   */
  private extractArtifacts(steps: StepResult[]): EvidenceCard['outcome']['artifacts'] {
    const artifacts: EvidenceCard['outcome']['artifacts'] = []

    for (const step of steps) {
      if (step.success && step.output) {
        // 尝试从输出中提取文件路径或 URL
        if (typeof step.output === 'object') {
          if (step.output.filePath) {
            artifacts.push({
              type: 'file',
              path: step.output.filePath,
              description: `${step.capability} 生成的文件`
            })
          }
          if (step.output.url) {
            artifacts.push({
              type: 'url',
              path: step.output.url,
              description: `${step.capability} 生成的链接`
            })
          }
        }
      }
    }

    return artifacts
  }
}

// 声明类型扩展
declare module '@deepseek-ai/cordis' {
  interface Context {
    mingEvidenceCollector: EvidenceCollector
  }
}
