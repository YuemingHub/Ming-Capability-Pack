/**
 * 能力安装服务（闭环装配的「装 + 验」）
 *
 * 负责把用户在 1024Store 选中的插件真正装进 DSH profile，并核对安装结果。
 * 定位 dsh 命令时优先复用宿主进程自身安装位置（profiles/node_modules），
 * 找不到时回退 PATH 里的 `dsh`；再不行就如实报「请手动执行」，绝不假装装上了。
 *
 * 安全红线：
 *   - 只执行「dsh plugin ... add <source>」形态的命令（parseInstallCommand 校验）；
 *   - 绝不把 1024Store 返回的原始命令字符串直接交给 shell——解析后用自己的参数重建；
 *   - 安装永远由用户选定后才触发（ming_install 的 install 模式）。
 */

import { spawn } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorePlugin } from '../capabilities/store.js'

// ---------- 纯函数（可单测）----------

/** 解析后的安装命令：源 + 可选 profile */
export interface ParsedInstallCommand {
  /** 要安装的插件源（如 dsh-excel-tools / github:owner/repo） */
  source: string
  /** 命令里声明的 profile（我们安装时以当前 profile 为准，此处仅记录） */
  profile?: string
}

/**
 * 解析 1024Store 返回的安装命令（形如 `dsh plugin --profile web add dsh-excel-tools`）。
 * 只接受「dsh 开头 + plugin 子命令 + add」的形态，其余一律拒绝，避免把任意文本变成命令。
 */
export function parseInstallCommand(install: string): ParsedInstallCommand {
  const tokens = (install ?? '').trim().split(/\s+/)
  if (tokens.length === 0 || !tokens[0]) {
    throw new Error('安装命令为空')
  }
  const first = tokens[0].toLowerCase().replace(/\.(cmd|exe|bat)$/u, '')
  if (first !== 'dsh') {
    throw new Error(`非法安装命令（必须以 dsh 开头）：${install}`)
  }
  if (tokens[1] !== 'plugin') {
    throw new Error(`非法安装命令（缺少 plugin 子命令）：${install}`)
  }

  let profile: string | undefined
  let source: string | undefined
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '--profile' || t === '-p') {
      profile = tokens[i + 1]
      i++
      continue
    }
    if (t === 'add') continue
    if (t.startsWith('-')) continue
    source = t // 最后一个非 flag 令牌视为插件源
  }
  if (!source) {
    throw new Error(`安装命令缺少插件源：${install}`)
  }
  return { source, profile }
}

/**
 * 构建安装子进程参数。
 * dshBin 为 null 表示直接用 PATH 里的 `dsh` 可执行文件。
 */
export function buildInstallArgs(source: string, profile: string, dshBin: string | null): string[] {
  const common = ['plugin', '--profile', profile, 'add', source]
  return dshBin ? [dshBin, ...common] : common
}

/**
 * 组装可 spawn 的参数与展示命令。
 * dshBin 是 bin.js 脚本时，Windows 上必须用 `node <bin.js>` 启动（直接 spawn 脚本会 EFTYPE），
 * 所以返回的 args 不含 bin.js，由调用方用 node 作为解释器执行。
 */
export function buildInstallCommand(source: string, profile: string, dshBin: string | null): { args: string[]; command: string } {
  const common = ['plugin', '--profile', profile, 'add', source]
  if (dshBin) {
    return { args: [dshBin, ...common], command: `node ${dshBin} ${common.join(' ')}` }
  }
  return { args: common, command: `dsh ${common.join(' ')}` }
}

/** 候选 dsh bin.js 路径（fromDir = 本模块所在目录，构建后为 dist/services） */
export function dshBinCandidates(fromDir: string): string[] {
  const candidates: string[] = []
  const envBin = process.env.DSH_BIN
  if (envBin) candidates.push(envBin)
  // 方式一：随 profile 安装（<DSH_HOME>/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js）
  candidates.push(join(fromDir, '..', '..', '..', '..', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  // 方式二：开发环境包内 node_modules
  candidates.push(join(fromDir, '..', '..', '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  return candidates
}

/** DSH 数据目录：DSH_HOME 环境变量优先，默认 ~/.dsh */
export function resolveDshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

/** 候选 profile 目录名（第一刀只扫官方布局 profiles/） */
export function profileDirsOf(home: string): string[] {
  return [join(home, 'profiles')]
}

/**
 * 推荐理由（纯规则）：候选与搜索词的相关性说明 + 星标，供主模型转述给用户。
 * 让用户看到的不是「有一堆插件」，而是「为什么这个配我」。
 */
export function matchReason(plugin: Pick<StorePlugin, 'name' | 'description' | 'category'> & { stars?: number }, query: string): string {
  const haystack = `${plugin.name} ${plugin.description?.en ?? ''} ${plugin.description?.zh ?? ''} ${plugin.category ?? ''}`.toLowerCase()
  const q = (query ?? '').trim().toLowerCase()
  const hit = q.split(/\s+/).find(kw => kw.length >= 2 && haystack.includes(kw))
  const stars = plugin.stars ? `（⭐${plugin.stars}）` : ''
  if (hit) return `名称/描述命中「${hit}」${stars}`
  return `候选之一${stars}，描述未直接命中搜索词，供对比`
}

// ---------- 非纯函数（执行 / 核对）----------

/** 在 PATH 或宿主安装位置里定位 dsh bin.js；找不到返回 null（表示可用 PATH 里的 dsh） */
export async function resolveDshBin(): Promise<string | null> {
  const moduleDir = fileURLToPath(new URL('.', import.meta.url))
  for (const candidate of dshBinCandidates(moduleDir)) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* 继续找下一个 */
    }
  }
  return null
}

/** 解析当前 profile 名：DSH_PROFILE → 扫 profiles 找含本插件的 profile → 默认 ming */
export async function resolveProfileName(): Promise<string> {
  const envProfile = process.env.DSH_PROFILE
  if (envProfile) return envProfile

  const home = resolveDshHome()
  for (const profilesDir of profileDirsOf(home)) {
    try {
      const entries = await readdir(profilesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const pkgPath = join(profilesDir, entry.name, 'package.json')
        try {
          const text = await readFile(pkgPath, 'utf-8')
          if (text.includes('@mingworkbench/capability-pack')) return entry.name
        } catch {
          /* 不是 profile，跳过 */
        }
      }
    } catch {
      /* profiles 目录不存在 */
    }
  }
  return 'ming'
}

/** 安装结果核对：profile package.json 或 profiles/node_modules 里是否已有该插件 */
export interface InstallCheckResult {
  confirmed: boolean
  detail: string
}

export async function checkInstalled(source: string): Promise<InstallCheckResult> {
  const home = resolveDshHome()
  const profile = await resolveProfileName()
  const profilesDir = join(home, 'profiles')
  // 去掉 github: 前缀；scoped 包（@scope/pkg）保留完整形态用于目录核对
  const withoutGitHub = source.replace(/^github:/u, '')
  const sourceName = basename(withoutGitHub)

  const pkgPath = join(profilesDir, profile, 'package.json')
  try {
    const text = await readFile(pkgPath, 'utf-8')
    if (text.includes(source) || text.includes(sourceName)) {
      return { confirmed: true, detail: `profile「${profile}」的 package.json 已包含 ${source}` }
    }
  } catch {
    /* profile package.json 不存在，走 node_modules 兜底 */
  }

  const scopeMatch = withoutGitHub.match(/^(@[^/]+)\//u)
  const dirs = scopeMatch
    ? [join(profilesDir, 'node_modules', withoutGitHub), join(profilesDir, 'node_modules', scopeMatch[1])]
    : [join(profilesDir, 'node_modules', sourceName)]
  for (const dir of dirs) {
    try {
      await access(dir)
      return { confirmed: true, detail: `已在 ${profilesDir} 下找到包目录 ${dir}` }
    } catch {
      /* 继续 */
    }
  }

  return {
    confirmed: false,
    detail: `未在 profile「${profile}」中确认 ${source}（可能写入其他 profile，或安装尚未完成）`,
  }
}

/** 一次安装子进程的执行记录 */
export interface InstallExecution {
  ok: boolean
  exitCode: number | null
  output: string
  /** 实际使用的 dsh（null = PATH 里的 dsh） */
  bin: string | null
  profile: string
  /** 展示给用户的完整命令 */
  command: string
}

/** 执行 `dsh plugin add <source>`（带超时，捕获输出，不抛异常） */
export async function runDshInstall(source: string, opts: { timeoutMs?: number } = {}): Promise<InstallExecution> {
  const profile = await resolveProfileName()
  const dshBin = await resolveDshBin()
  const { args, command } = buildInstallCommand(source, profile, dshBin)
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000

  return new Promise((resolve) => {
    let child
    try {
      if (dshBin) {
        child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      } else {
        // Windows 上 .cmd/.bat 不能直接 spawn，交给 cmd.exe 解析；其余平台直接执行
        child = process.platform === 'win32'
          ? spawn('cmd.exe', ['/d', '/s', '/c', command], { stdio: ['ignore', 'pipe', 'pipe'] })
          : spawn(args[0], args, { stdio: ['ignore', 'pipe', 'pipe'] })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      resolve({ ok: false, exitCode: null, output: `启动 dsh 失败：${message}`, bin: dshBin, profile, command })
      return
    }

    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += String(chunk) })
    child.stderr?.on('data', (chunk: Buffer) => { output += String(chunk) })

    const timer = setTimeout(() => {
      try { child.kill() } catch { /* 已退出 */ }
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, exitCode: null, output: `${output}\n[ming] dsh 启动失败：${err.message}`, bin: dshBin, profile, command })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, exitCode: code, output, bin: dshBin, profile, command })
    })
  })
}

/** 装配编排：安装 → 核对 → 下一步建议 */
export interface InstallOutcome {
  ok: boolean
  installed: boolean
  /** 是否在 profile 层面确认写入（重启前可验证的事实） */
  confirmed: boolean
  detail: string
  output: string
  command: string
  profile: string
  nextSteps: string[]
}

export async function installCapability(source: string): Promise<InstallOutcome> {
  const exec = await runDshInstall(source)

  if (!exec.ok) {
    return {
      ok: false,
      installed: false,
      confirmed: false,
      detail: `安装命令执行失败（退出码 ${exec.exitCode ?? '未知'}）。可手动执行：${exec.command}`,
      output: exec.output.trim(),
      command: exec.command,
      profile: exec.profile,
      nextSteps: [
        `手动执行安装命令：${exec.command}`,
        '装好后完全重启 DSH，再说一遍目标让 Ming 复用新能力',
      ],
    }
  }

  const check = await checkInstalled(source)
  if (check.confirmed) {
    return {
      ok: true,
      installed: true,
      confirmed: true,
      detail: `安装成功，已确认写入：${check.detail}。重启 DSH 后新能力生效。`,
      output: exec.output.trim(),
      command: exec.command,
      profile: exec.profile,
      nextSteps: [
        '完全重启 DSH（关闭窗口 + 退出托盘图标）',
        '重启后再说一遍目标，Ming 会自动复用刚装配的能力',
      ],
    }
  }

  return {
    ok: true,
    installed: true,
    confirmed: false,
    detail: `安装命令已成功执行，但未能确认写入 profile「${exec.profile}」（${check.detail}）。`,
    output: exec.output.trim(),
    command: exec.command,
    profile: exec.profile,
    nextSteps: [
      '重启 DSH 后验证新能力是否生效',
      `若未生效，手动执行安装命令：${exec.command}`,
    ],
  }
}
