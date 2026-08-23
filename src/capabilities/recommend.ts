/**
 * 能力推荐引擎（痛点 2：用户不知道需要什么，「眼花缭乱」）
 *
 * 不做「把一堆插件甩给用户」，而是按「用户的目标 + 已确认的方向」把候选排序，
 * 只推最相关的前几个，并给出「为什么配你」的人话理由。
 *
 * 排序信号（纯规则，零 LLM 消耗）：
 *   1. 需求关键词命中（query 分词，权重 2）——用户/主模型提炼的搜索词；
 *   2. 用户已确认方向命中（scenario 短语子串，权重 3）——clarify 收集的答案，
 *      如「作品集结构」「GitHub Pages」是最个性化的信号；
 *   3. 社区热度（stars / installCount 的对数信号，0.5/0.25）——只做弱加成，
 *      避免高星垃圾插件压过「真正配你」的。
 */

export interface RecommendContext {
  /** 搜索关键词（主模型/用户提炼，如「网站 部署」「excel 报表」） */
  query: string
  /** 缺口能力承担的角色（人话），如「把静态网站发布到公开地址」 */
  purpose?: string
  /** 用户已确认的方向短语，如 ['作品集结构', 'GitHub Pages 免费静态托管'] */
  scenario?: string[]
}

export interface ScoredCandidate<T> {
  candidate: T
  score: number
  /** 命中的查询词（用于理由） */
  queryHits: string[]
  /** 命中的场景短语（用于理由） */
  scenarioHits: string[]
}

/** 取文本里值得匹配的短词：按非字母数字切分，滤掉过短/纯数字 */
export function tokensOf(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !/^\d+$/u.test(t))
}

/**
 * 给候选打分排序。textOf 返回候选的「可匹配文本」（如 name + 描述 + 分类）。
 */
export function rankCandidates<T>(
  candidates: T[],
  ctx: RecommendContext,
  textOf: (c: T) => string,
  signalOf: (c: T) => { stars?: number; installCount?: number },
): Array<ScoredCandidate<T>> {
  const queryTokens = [...new Set(tokensOf(ctx.query ?? ''))]
  const scenarioTerms = (ctx.scenario ?? [])
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 2)

  const scored: Array<ScoredCandidate<T>> = candidates.map((candidate) => {
    const text = (textOf(candidate) ?? '').toLowerCase()
    const queryHits = queryTokens.filter(t => text.includes(t))
    const scenarioHits = scenarioTerms.filter(s => text.includes(s))
    const { stars = 0, installCount = 0 } = signalOf(candidate) ?? {}
    const score =
      queryHits.length * 2 +
      scenarioHits.length * 3 +
      Math.log10(1 + Math.max(0, stars)) * 0.5 +
      Math.log10(1 + Math.max(0, installCount)) * 0.25
    return { candidate, score, queryHits, scenarioHits }
  })

  return scored.sort((a, b) => b.score - a.score)
}

/**
 * 生成「为什么配你」的人话理由：先讲与用户需求/方向的匹配，再补热度信号。
 */
export function buildRecommendationReason(
  candidateText: string,
  ctx: RecommendContext,
  signals: { stars?: number; installCount?: number },
  hits?: { queryHits?: string[]; scenarioHits?: string[] },
): string {
  const parts: string[] = []
  const scenarioHits = hits?.scenarioHits ?? []
  const queryHits = hits?.queryHits ?? []
  if (scenarioHits.length > 0) {
    parts.push(`命中你确认的方向「${scenarioHits.slice(0, 2).join('、')}」`)
  } else if (queryHits.length > 0) {
    parts.push(`对应你的需求「${queryHits.slice(0, 2).join('、')}」`)
  }
  if (ctx.purpose) {
    parts.push(`补上缺口能力：${ctx.purpose}`)
  }
  const stars = signals.stars ?? 0
  const installCount = signals.installCount ?? 0
  if (stars > 0) {
    parts.push(stars >= 1000 ? `社区热选（⭐${Math.round(stars / 1000)}k）` : `⭐${stars}`)
  }
  if (installCount > 0) {
    parts.push(`已有 ${installCount} 次安装`)
  }
  if (parts.length === 0) {
    parts.push('候选之一，供对比')
  }
  return parts.join('；')
}

/** 泛化动词/虚词：不适合当市场搜索关键词（实测 read/convert/get 这类命中率极低） */
const VAGUE_TOKENS = new Set([
  'read', 'get', 'gen', 'run', 'make', 'list', 'show', 'view', 'parse', 'convert',
  'create', 'build', 'set', 'add', 'do', 'to', 'for', 'of', 'the', 'a', 'an', 'and',
  'with', 'from', 'use', 'using', 'tool', 'plugin', 'skill', 'auto', 'gen',
])

/** 中文句首的虚词/使动词：剥掉后剩下的才是关键词 */
const CJK_LEAD = /^[把将让用从在到给为和与是做了请帮我它这那要可以能出后及以及或其之]/u

/**
 * 从缺失能力推导市场搜索词（实测校准：1024Store 对「单个英文单词 / 单个中文词」
 * 命中率高，对长句子与多词短语基本返回 0）：
 *   1. 优先 purpose 里的英文关键词（excel / pdf / markdown / github 这类最易命中）；
 *   2. 其次能力 id 的下划线 token 里最具体的一个（publish_deploy → publish）；
 *   3. 再退到中文：剥句首虚词后取前 2~4 字；
 *   4. 兜底能力 id。
 */
export function suggestQueryFor(purpose: string | undefined, id: string): string {
  const p = (purpose ?? '').trim()

  // 1) purpose 里的英文关键词
  const en = p.toLowerCase().match(/[a-z]{3,}/g)
  if (en) {
    const concrete = en.find(t => !VAGUE_TOKENS.has(t))
    if (concrete) return concrete
  }

  // 2) 能力 id 的 token
  const idTokens = id.split(/[_-]/).filter(t => /^[a-z]{3,}$/u.test(t))
  if (idTokens.length >= 2) {
    const concrete = idTokens.find(t => !VAGUE_TOKENS.has(t))
    if (concrete) return concrete
    return idTokens[idTokens.length - 1]
  }

  // 3) 中文：剥句首虚词，取前 2 字（商店对单个中文词命中率高，长复合词常返回 0）
  const cjkRuns = p.match(/[\u4e00-\u9fff]{2,}/g)
  if (cjkRuns) {
    for (const run of cjkRuns) {
      const stripped = run.replace(CJK_LEAD, '') || run
      if (stripped.length >= 2) return stripped.slice(0, 2)
    }
  }

  // 4) 兜底
  return id
}
