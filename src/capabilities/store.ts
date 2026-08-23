/**
 * DSH 插件市场客户端 —— 能力目录的外部事实源
 *
 * 两个真实市场：
 *   1. DSH Marketplace（https://dshmarketplace.dev）——4,907+ 插件的公开 JSON API，
 *      无 key、无限流、CORS 全开，每条带中英文摘要与解析好的安装命令。
 *      默认市场（兜底搜索用）。
 *   2. 1024Store（https://api.deepseek1024.com）——DeepSeek Harness 社区插件的
 *      公开目录，匿名可用但有限流；保留为 fallback。
 *
 * 本模块负责把「Recipe 声明的能力缺口」翻译成「市场上真实存在、可安装的插件」，
 * 返回官方的 `dsh plugin add` 安装命令，交给用户/主模型决策。
 *
 * Marketplace 的 install 字段约定（重要）：
 *   - install 可为 null（monorepo 子目录 / 未发包的插件装不上），绝不用占位串；
 *     installable 布尔值说的是同一件事。本层只保留「installable && install」的候选，
 *     绝不给调用方一条跑不通的命令。
 *   - install 形如 github:owner/repo#packages/x 时也是装不上的（pnpm 把 # 当 git ref），
 *     由 dispatch 层的 isRunnableInstall 兜底过滤。
 *   - 返回的命令都带 --profile web；本层在 buildInstallCommand 里按当前 profile 重写。
 *
 * 网络失败时优雅降级（ok:false + 人类可读原因），不影响主流程。
 */

export interface StorePlugin {
  id: string
  name: string
  owner: string
  url: string
  category: string
  description: { en?: string; zh?: string }
  stars: number
  installCount: number
  growth24h: number
  added: string
  pushedAt: string
  install: string
}

export interface StoreSearchOptions {
  /** 返回数量，默认 5，最大 10 */
  limit?: number
  /** 排序：stars（默认）/ growth24h（近 24h 热度）/ added（新近加入） */
  sortBy?: 'stars' | 'growth24h' | 'added'
  /** 显式 key；缺省读环境变量 MING_STORE_KEY */
  key?: string
  /** 请求超时毫秒，默认 8000 */
  timeoutMs?: number
}

export interface StoreSearchResult {
  ok: boolean
  query: string
  total?: number
  plugins: StorePlugin[]
  /** 失败时的人类可读原因（如网络不可达、限流） */
  error?: string
}

// ---------- DSH Marketplace（https://dshmarketplace.dev）----------

const MARKETPLACE_HOST = 'https://dshmarketplace.dev'

/** Marketplace /api/v1/plugins 的原始条目 */
export interface MarketplacePlugin {
  fullName: string
  name: string
  owner: string
  repo: string
  subpath?: string
  summary?: string
  summaryZh?: string
  category?: string
  language?: string
  license?: string
  stars: number
  pushedAt?: string
  repoUrl?: string
  npmPackage?: string | null
  installKind?: string
  /** 唯一可信的安装命令；monorepo 子目录 / 未发包时为 null（不是占位串） */
  install?: string | null
  installable: boolean
  installOptions?: Array<{ label?: string; cmd?: string; note?: string }>
  riskFlags?: string[]
  url?: string
}

export interface MarketplaceSearchOptions {
  /** 返回数量，默认 8，最大 100 */
  limit?: number
  /** 请求超时毫秒，默认 8000 */
  timeoutMs?: number
}

/**
 * 搜索 DSH Marketplace（无 key、无限流、带中英文摘要）。
 * 只保留 installable 且有 install 命令的候选——绝不把跑不通的命令交给调用方。
 */
export async function searchMarketplacePlugins(
  query: string,
  opts: MarketplaceSearchOptions = {},
): Promise<StoreSearchResult> {
  const q = (query ?? '').trim()
  if (!q) return { ok: false, query: '', plugins: [], error: '缺少搜索关键词' }

  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 8), 1), 100)
  // 注意：new URL('/plugins', host) 会把路径重置到根目录，必须用完整 API 路径拼接
  const url = new URL('/api/v1/plugins', MARKETPLACE_HOST)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ming-capability-pack' },
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, query: q, plugins: [], error: `DSH Marketplace 返回 ${res.status}` }
    }
    const data = (await res.json()) as { total?: number; results?: MarketplacePlugin[] }
    const plugins: StorePlugin[] = (data.results ?? [])
      .filter(p => p.installable && typeof p.install === 'string' && p.install.length > 0)
      .map(p => ({
        id: p.fullName,
        name: p.name || p.fullName,
        owner: p.owner || '',
        url: p.repoUrl ?? p.url ?? '',
        category: p.category ?? '',
        description: { en: p.summary ?? '', zh: p.summaryZh ?? '' },
        stars: p.stars ?? 0,
        installCount: 0,
        growth24h: 0,
        added: p.pushedAt ?? '',
        pushedAt: p.pushedAt ?? '',
        install: p.install as string,
      }))
    return { ok: true, query: q, total: data.total, plugins }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, query: q, plugins: [], error: `无法访问 DSH Marketplace（${reason}）` }
  } finally {
    clearTimeout(timer)
  }
}

// ---------- 1024Store（fallback）----------

const STORE_BASE = 'https://api.deepseek1024.com'

export async function searchStorePlugins(
  query: string,
  opts: StoreSearchOptions = {},
): Promise<StoreSearchResult> {
  const q = (query ?? '').trim()
  if (!q) return { ok: false, query: '', plugins: [], error: '缺少搜索关键词' }

  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 5), 1), 10)
  const sortBy = opts.sortBy ?? 'stars'
  const key = opts.key ?? process.env.MING_STORE_KEY

  const url = new URL('/v1/plugins/search', STORE_BASE)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('sortBy', sortBy)

  const headers: Record<string, string> = { 'User-Agent': 'ming-capability-pack' }
  if (key) headers['Authorization'] = `Bearer ${key}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) {
      return { ok: false, query: q, plugins: [], error: `1024Store 返回 ${res.status}` }
    }
    const data = (await res.json()) as { total?: number; results?: StorePlugin[] }
    return { ok: true, query: q, total: data.total, plugins: data.results ?? [] }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, query: q, plugins: [], error: `无法访问 1024Store（${reason}）` }
  } finally {
    clearTimeout(timer)
  }
}

/** 把搜索结果格式化成给主模型的紧凑文本（含安装命令） */
export function formatStoreResult(result: StoreSearchResult, max = 5): string {
  if (!result.ok) return `DSH 插件市场查询失败：${result.error ?? '未知错误'}`
  if (result.plugins.length === 0) {
    return `DSH 插件市场没有找到与「${result.query}」相关的可安装插件（共 ${result.total ?? 0} 条匹配，但均无可用安装命令）。`
  }

  const lines = [`DSH 插件市场搜「${result.query}」命中 ${result.total ?? result.plugins.length} 个插件（展示前 ${Math.min(max, result.plugins.length)}）：`, '']
  for (const p of result.plugins.slice(0, max)) {
    const zh = p.description?.zh ? `｜${p.description.zh}` : ''
    const desc = (p.description?.en ?? '').replaceAll('\n', ' ')
    lines.push(`- [${p.category}] ${p.name}（⭐${p.stars}，${p.owner}）`)
    lines.push(`  ${desc}${zh}`.slice(0, 180))
    lines.push(`  安装：\`${p.install}\``)
  }
  lines.push('', '装配能力需用户确认后执行安装命令；装好后再让 Ming 重跑目标即可复用。')
  return lines.join('\n')
}
