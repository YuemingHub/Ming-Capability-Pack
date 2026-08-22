/**
 * DSH 1024Store 客户端 —— 能力目录的外部事实源
 *
 * 1024Store（https://api.deepseek1024.com）是 DeepSeek Harness 社区插件的公开目录：
 * 匿名即可搜索，GitHub 登录后创建 API Key 可获得更高配额。
 * 本模块负责把「Recipe 声明的能力缺口」翻译成「市场上真实存在、可安装的插件」，
 * 返回官方的 `dsh plugin add` 安装命令，交给用户/主模型决策。
 *
 * 约定：key 绝不硬编码，从环境变量 MING_STORE_KEY 读取（可选，匿名可用）。
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
  if (!result.ok) return `1024Store 查询失败：${result.error ?? '未知错误'}`
  if (result.plugins.length === 0) {
    return `1024Store 没有找到与「${result.query}」相关的插件（共 ${result.total ?? 0} 条匹配但均被过滤）。`
  }

  const lines = [`1024Store 搜「${result.query}」命中 ${result.total ?? result.plugins.length} 个插件（展示前 ${Math.min(max, result.plugins.length)}）：`, '']
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
