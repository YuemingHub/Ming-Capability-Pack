/**
 * 插件安装器
 *
 * 负责检查、下载和安装插件
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { Plugin } from '../types.js'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class PluginInstaller extends Service {
  constructor(ctx: Context) {
    super(ctx, 'mingPluginInstaller')
  }

  /**
   * 确保插件已安装
   */
  async ensureInstalled(plugin: Plugin): Promise<boolean> {
    try {
      // 1. 检查是否已安装
      const isInstalled = await this.isInstalled(plugin)

      if (isInstalled) {
        this.ctx.logger.debug(`✅ ${plugin.name} 已安装`)
        return true
      }

      // 2. 安装插件
      this.ctx.logger.info(`📦 正在安装 ${plugin.name}...`)

      await this.installPlugin(plugin)

      this.ctx.logger.info(`✅ ${plugin.name} 安装成功`)
      return true

    } catch (error) {
      this.ctx.logger.error(`❌ ${plugin.name} 安装失败`, error)
      return false
    }
  }

  /**
   * 批量确保插件已安装
   */
  async ensureAllInstalled(plugins: Map<string, Plugin>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    for (const [capability, plugin] of plugins) {
      const success = await this.ensureInstalled(plugin)
      results.set(capability, success)
    }

    return results
  }

  /**
   * 检查插件是否已安装
   */
  private async isInstalled(plugin: Plugin): Promise<boolean> {
    try {
      // 方法1: 尝试列出已安装的插件
      const { stdout } = await execAsync('dsh plugin list', { timeout: 5000 })

      // 检查插件名称或 ID 是否在列表中
      return stdout.includes(plugin.name) || stdout.includes(plugin.id)

    } catch (error) {
      // 如果命令失败，假定未安装
      this.ctx.logger.debug(`检查安装状态失败，假定未安装: ${plugin.name}`)
      return false
    }
  }

  /**
   * 安装插件
   */
  private async installPlugin(plugin: Plugin): Promise<void> {
    try {
      // 执行安装命令
      const { stdout, stderr } = await execAsync(plugin.install, {
        timeout: 60000  // 60秒超时
      })

      if (stderr && !stderr.includes('warning')) {
        this.ctx.logger.warn(`安装警告: ${stderr}`)
      }

      this.ctx.logger.debug(`安装输出: ${stdout}`)

    } catch (error: any) {
      this.ctx.logger.error(`安装失败: ${error.message}`)
      throw new Error(`插件安装失败: ${plugin.name}`)
    }
  }
}

// 声明类型扩展
declare module '@deepseek-ai/cordis' {
  interface Context {
    mingPluginInstaller: PluginInstaller
  }
}
