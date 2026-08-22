#!/usr/bin/env node
/**
 * ming — Ming Capability Pack 的 CLI 包装器
 *
 * 把自然语言任务描述转发给 DeepSeek Harness 的指定 profile，
 * 由 profile 内的 ming_auto 工具真正执行。
 *
 * 用法：
 *   ming <自然语言任务>
 *   DSH_PROFILE=web ming "帮我整理桌面文件"
 *
 * 环境变量：
 *   DSH_BIN    — dsh bin.js 的绝对路径（可选，默认自动查找）
 *   DSH_PROFILE— 要使用的 profile 名（默认 ming）
 *   DSH_HOME   — Harness 数据目录（默认 ~/.dsh）
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function fatal(msg) {
  console.error(`[ming] ${msg}`)
  process.exit(1)
}

function resolveDshBin() {
  const envBin = process.env.DSH_BIN
  if (envBin && envBin.endsWith('bin.js')) return envBin

  // 开发/本地安装：尝试 package 内的 node_modules
  const local = join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  return local
}

function resolveProfile() {
  return process.env.DSH_PROFILE || 'ming'
}

function resolveNode() {
  return process.env.DSH_NODE || process.execPath
}

function main() {
  const dshBin = resolveDshBin()
  const profile = resolveProfile()
  const node = resolveNode()
  const userPrompt = process.argv.slice(2).join(' ')

  if (!userPrompt) {
    console.log(`[ming] Ming Capability Pack CLI
用法：
  ming <自然语言任务描述>
  DSH_PROFILE=web ming "帮我整理当前目录文件"

环境变量：
  DSH_BIN     dsh bin.js 路径（默认自动查找）
  DSH_PROFILE 使用的 profile（默认 ming）
  DSH_HOME    Harness 数据目录（默认 ~/.dsh）

示例：
  ming 创建一个 hello.html，内容为 <h1>Hello Ming</h1>
  ming 把当前目录的 .txt 文件按修改时间排序并输出到 list.txt
`)
    process.exit(0)
  }

  const prompt = `请调用 ming_auto 工具完成下面的任务：${userPrompt}`
  const args = [dshBin, '--profile', profile, prompt]

  // 把 DSH_HOME 透传给子进程；未设置时让 Harness 用默认值
  const env = { ...process.env }
  if (!env.DSH_HOME) {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    if (home) env.DSH_HOME = join(home, '.dsh')
  }

  console.log(`[ming] profile=${profile}`)
  console.log(`[ming] prompt=${userPrompt}`)

  const child = spawn(node, args, {
    stdio: 'inherit',
    env,
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main()
