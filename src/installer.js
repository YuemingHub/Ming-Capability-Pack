// Ming Capability Pack - 自动安装模块

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * 安装插件
 */
export async function installPlugin(plugin) {
  console.log(`📦 正在安装: ${plugin.name}...`)

  try {
    // 1. 执行安装命令
    const installCommand = plugin.install || `dsh plugin add ${plugin.id}`
    const { stdout, stderr } = await execAsync(installCommand, { timeout: 60000 })

    // 2. 验证安装成功
    const isInstalled = await verifyInstallation(plugin.name)

    if (isInstalled) {
      console.log(`✅ ${plugin.name} 安装成功`)
      return { success: true, plugin, message: stdout }
    } else {
      console.log(`⚠️ ${plugin.name} 安装完成但验证失败`)
      return { success: false, plugin, error: '安装验证失败' }
    }

  } catch (error) {
    console.error(`❌ ${plugin.name} 安装失败`, error.message)
    return { success: false, plugin, error: error.message }
  }
}

/**
 * 批量安装插件
 */
export async function installPluginsBatch(plugins) {
  const results = []

  for (const plugin of plugins) {
    const result = await installPlugin(plugin)
    results.push(result)

    // 间隔 1 秒，避免过快
    await new Promise(r => setTimeout(r, 1000))
  }

  return results
}

/**
 * 验证插件是否已安装
 */
export async function verifyInstallation(pluginName) {
  try {
    // 尝试列出已安装的插件
    const { stdout } = await execAsync('dsh plugin list', { timeout: 5000 })
    return stdout.includes(pluginName)
  } catch (error) {
    // 如果命令失败，假定未安装
    return false
  }
}

/**
 * 卸载插件
 */
export async function uninstallPlugin(plugin) {
  console.log(`🗑️ 正在卸载: ${plugin.name}...`)

  try {
    const uninstallCommand = `dsh plugin remove ${plugin.id}`
    await execAsync(uninstallCommand, { timeout: 30000 })

    console.log(`✅ ${plugin.name} 已卸载`)
    return { success: true, plugin }

  } catch (error) {
    console.error(`❌ ${plugin.name} 卸载失败`, error.message)
    return { success: false, plugin, error: error.message }
  }
}

/**
 * 获取已安装的插件列表
 */
export async function getInstalledPlugins() {
  try {
    const { stdout } = await execAsync('dsh plugin list', { timeout: 5000 })
    const lines = stdout.split('\n').filter(line => line.trim())

    return lines.map(line => {
      const [name, version] = line.split('@')
      return { name, version }
    })
  } catch (error) {
    return []
  }
}

/**
 * 检查插件是否满足依赖
 */
export function checkDependencies(plugin, installedPlugins) {
  // 简化版：检查是否有明显的冲突
  const conflicts = []

  for (const installed of installedPlugins) {
    if (installed.name === plugin.name) {
      conflicts.push(`插件 ${plugin.name} 已安装`)
    }
  }

  return {
    satisfied: conflicts.length === 0,
    conflicts
  }
}
