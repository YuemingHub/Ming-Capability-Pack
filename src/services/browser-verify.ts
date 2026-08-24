/**
 * 真实浏览器验收（browser_acceptance 断言执行器）
 *
 * 对接社区工具 dsh-verify（Witness）：JSON spec → 真实 Chromium → PASS/FAIL 与
 * 截图 receipts——「The browser is the judge」，不靠 agent 自我宣称，也不靠 LLM 判分。
 *
 * 为什么对接而不是自研（不重复造轮子）：生态已有成熟实现（CLI + MCP + GitHub Action），
 * 本模块只做三件薄事：
 *   1. 探测本机是否可用（dsh-verify 或 npx 可拉取）；
 *   2. 可用 → 执行 spec 并解析 PASS/FAIL；
 *   3. 不可用 → 如实返回 skipped（不谎报通过，也不阻塞第一版交付）。
 * 诚实红线：未执行就是未执行，绝不把「跳过」当「通过」。
 */

import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

export interface BrowserVerifyResult {
  passed: boolean
  /** 未执行（dsh-verify 不可用）时为 true；此时 passed 恒为 false */
  skipped?: boolean
  detail: string
}

export interface BrowserVerifyDeps {
  /** 探测 dsh-verify 是否可用（测试可注入；缺省走真实探测） */
  probe?: () => Promise<boolean>
  /** 执行 dsh-verify 并返回标准输出（测试可注入；缺省 spawn 真实 CLI） */
  run?: (specPath: string) => Promise<{ code: number | null; output: string }>
}

/** 探测 dsh-verify 可用性：PATH 里的 dsh-verify 优先，其次 npx 全局缓存 */
export async function probeDshVerify(): Promise<boolean> {
  // 方式一：PATH 里直接有 dsh-verify
  try {
    await access('dsh-verify')
    return true
  } catch {
    /* 继续 npx 探测 */
  }
  // 方式二：npx --no-install（只用已缓存的包，不主动联网下载安装）
  const code = await new Promise<number | null>((resolve) => {
    const child = spawn('npx', ['--no-install', 'dsh-verify', '--help'], { stdio: 'ignore' })
    const timer = setTimeout(() => { try { child.kill() } catch { /* 已退出 */ } }, 10_000)
    child.on('error', () => { clearTimeout(timer); resolve(null) })
    child.on('close', (c) => { clearTimeout(timer); resolve(c) })
  })
  return code === 0
}

/** 执行一次浏览器验收：spec 相对路径基于 workdir 解析；输出按「PASS/FAIL 关键字 + 退出码」判定 */
export async function runBrowserAcceptance(
  spec: string,
  workdir: string,
  deps: BrowserVerifyDeps = {},
): Promise<BrowserVerifyResult> {
  const probe = deps.probe ?? probeDshVerify
  const run = deps.run ?? (async (specPath: string) => {
    const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
      const child = spawn('npx', ['--yes', 'dsh-verify', '--spec', specPath], { cwd: workdir, stdio: ['ignore', 'pipe', 'pipe'] })
      const timer = setTimeout(() => { try { child.kill() } catch { /* 已退出 */ } }, 120_000)
      let output = ''
      child.stdout?.on('data', (c: Buffer) => { output += String(c) })
      child.stderr?.on('data', (c: Buffer) => { output += String(c) })
      child.on('error', (err) => { clearTimeout(timer); resolve({ code: null, output: `${output}\n启动 dsh-verify 失败：${err.message}` }) })
      child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }) })
    })
    return result
  })

  if (!(await probe())) {
    return {
      passed: false,
      skipped: true,
      detail: '浏览器验收未执行：本机未装配 dsh-verify（Witness）。需要时用 `dsh plugin add dsh-verify` 装配后再验收。',
    }
  }

  const specPath = join(workdir, spec)
  const { code, output } = await run(specPath)
  const verdict = /FAIL/iu.test(output) ? 'FAIL' : /PASS/iu.test(output) ? 'PASS' : null
  const ok = code === 0 && verdict === 'PASS'

  if (ok) {
    return { passed: true, detail: `真实浏览器验收通过（PASS）——${output.trim().split('\n')[0] || 'spec 全部通过'}` }
  }
  return {
    passed: false,
    detail: `真实浏览器验收未通过（${verdict ?? `退出码 ${code ?? '未知'}`}）。回执见输出前几行：${output.trim().split('\n').slice(0, 3).join(' | ') || '（无输出）'}`,
  }
}
