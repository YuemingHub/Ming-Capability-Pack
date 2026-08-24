/**
 * Capability Verifier：验收断言 → 独立回读现实
 *
 * 把方案声明的验收断言（文件存在 / 内容匹配 / 目录非空）转成可独立检查的事实，
 * 不依赖「子代理说自己完成了」——完成与否由磁盘事实决定。
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { runBrowserAcceptance } from '../services/browser-verify.js'
import type { VerificationCheck, VerificationResult, VerificationSummary } from './types.js'

/** 简单 glob 展开：支持星号、双星、后缀通配（例如 *.ext、双星递归），第一刀不覆盖复杂通配 */
async function expandPattern(workdir: string, pattern: string, signal?: AbortSignal): Promise<string[]> {
  const trimmed = pattern.trim()
  const recursive = trimmed.startsWith('**/')
  const base = trimmed.replace(/^\*?\*\//, '')

  const results: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    signal?.throwIfAborted()
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = full.slice(workdir.length + 1).replaceAll('\\', '/')
      if (entry.isDirectory()) {
        if (recursive) await walk(full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (matchesSimplePattern(rel, base)) results.push(full)
    }
  }

  await walk(workdir, 0)
  return results
}

function matchesSimplePattern(relPath: string, base: string): boolean {
  if (base === '*' || base === '**/*') return true
  if (!base.includes('*')) return relPath === base
  // 仅支持尾缀通配：*.ext
  const suffix = base.slice(1)
  return relPath.endsWith(suffix)
}

async function verifyOne(check: VerificationCheck, workdir: string, signal?: AbortSignal): Promise<VerificationResult> {
  // browser_acceptance 不依赖本地文件 glob，直接走真实浏览器验收（dsh-verify）
  if (check.kind === 'browser_acceptance') {
    const outcome = await runBrowserAcceptance(check.spec, workdir)
    return {
      check,
      passed: outcome.passed,
      skipped: outcome.skipped,
      detail: outcome.detail,
    }
  }

  const files = await expandPattern(workdir, check.pattern, signal)

  switch (check.kind) {
    case 'file_exists': {
      if (files.length === 0) {
        return { check, passed: false, detail: `未找到匹配「${check.pattern}」的文件` }
      }
      return {
        check,
        passed: true,
        detail: `匹配 ${files.length} 个文件：${files.slice(0, 5).join('、')}${files.length > 5 ? ' …' : ''}`,
      }
    }
    case 'content_match': {
      if (files.length === 0) {
        return { check, passed: false, detail: `未找到匹配「${check.pattern}」的文件，无法检查内容` }
      }
      const hits: string[] = []
      for (const file of files) {
        signal?.throwIfAborted()
        try {
          const content = await readFile(file, 'utf-8')
          if (content.includes(check.contains)) hits.push(file)
        } catch {
          /* 二进制/不可读文件跳过 */
        }
      }
      if (hits.length === 0) {
        return { check, passed: false, detail: `匹配的文件中均未包含「${check.contains}」` }
      }
      return { check, passed: true, detail: `${hits.length} 个文件包含「${check.contains}」：${hits.join('、')}` }
    }
    case 'content_absent': {
      if (files.length === 0) {
        return { check, passed: false, detail: `未找到匹配「${check.pattern}」的文件，无法检查内容` }
      }
      const violations: string[] = []
      for (const file of files) {
        signal?.throwIfAborted()
        try {
          const content = await readFile(file, 'utf-8')
          if (content.includes(check.mustNotContain)) violations.push(file)
        } catch {
          /* 二进制/不可读文件跳过 */
        }
      }
      if (violations.length > 0) {
        return { check, passed: false, detail: `${violations.length} 个文件包含禁止内容「${check.mustNotContain}」：${violations.join('、')}` }
      }
      return { check, passed: true, detail: `${files.length} 个文件均未包含「${check.mustNotContain}」` }
    }
    case 'dir_nonempty': {
      if (files.length === 0) {
        return { check, passed: false, detail: '目录中未发现任何文件' }
      }
      return { check, passed: true, detail: `目录含 ${files.length} 个文件` }
    }
    default:
      return { check, passed: false, detail: `不支持的断言类型：${(check as { kind: string }).kind}` }
  }
}

export async function verifyChecks(
  checks: VerificationCheck[],
  workdir: string,
  signal?: AbortSignal,
): Promise<VerificationSummary> {
  const results: VerificationResult[] = []
  for (const check of checks) {
    results.push(await verifyOne(check, workdir, signal))
  }
  const skipped = results.filter(r => r.skipped).length
  const passed = results.filter(r => r.passed).length
  // 跳过的断言不计入失败（否则会误阻断交付）；但也不会计为通过（不谎报）
  const failed = results.length - passed - skipped
  return { passed, failed, skipped, results }
}

/** 人类可读的验证摘要（追加到结果里给人/模型看） */
export function formatVerification(summary: VerificationSummary): string {
  if (summary.results.length === 0) return ''
  const lines = summary.results.map(r =>
    r.skipped
      ? `⏭️ ${describeCheck(r.check)}：${r.detail}`
      : `${r.passed ? '✅' : '❌'} ${describeCheck(r.check)}：${r.detail}`,
  )
  const skipNote = summary.skipped > 0 ? `（跳过 ${summary.skipped} 项——外部验收能力未装配，未执行）` : ''
  return `【独立验证】通过 ${summary.passed} / ${summary.failed + summary.passed}${skipNote}\n${lines.join('\n')}`
}

function describeCheck(check: VerificationCheck): string {
  switch (check.kind) {
    case 'file_exists':
      return `检查文件「${check.pattern}」存在`
    case 'content_match':
      return `检查「${check.pattern}」包含「${check.contains}」`
    case 'content_absent':
      return `检查「${check.pattern}」不含「${check.mustNotContain}」`
    case 'dir_nonempty':
      return `检查目录「${check.pattern}」非空`
    case 'browser_acceptance':
      return `真实浏览器验收「${check.spec}」`
  }
}

/** 供测试：判断单文件是否匹配简单 glob */
export function matchesSimplePatternForTest(relPath: string, base: string): boolean {
  return matchesSimplePattern(relPath, base)
}

export async function fileStatOrNull(path: string): Promise<{ bytes: number; modifiedAt: string } | null> {
  try {
    const info = await stat(path)
    return { bytes: info.size, modifiedAt: info.mtime.toISOString() }
  } catch {
    return null
  }
}
