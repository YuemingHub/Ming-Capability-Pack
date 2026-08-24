/**
 * 工具调度层（中间件第三职责：根据需求找最好的工具，再动手）
 *
 * 用户只说要什么，技术类的事不让他操心。方案需要的能力缺了时，中间件自己完成
 * 「找 → 选 → 装配」：
 *   1. 内置 curated 库优先——已知的好工具（官方优先），不用每次搜市场；
 *   2. 否则去 DSH Marketplace 搜（无 key 无限流、带中英文摘要）→ 按相关度排序 → 选最好的；
 *      仅保留「一条命令真能装上的」（monorepo 子目录 #path 装不上，绝不给出跑不通的命令）；
 *      Marketplace 无结果时回退 1024Store；
 *   3. 可信源（bundled/official）自动安装；社区源（store/github）给一句确认；
 *   4. 不阻断第一版交付：装好的工具重启 DSH 后对后续迭代生效，本次先用现有工具。
 *
 * 安全边界：自动安装只对内置的官方/bundled 来源开放；市场与 github 社区插件
 * 一律走到「一句确认」，绝不在未经确认时安装第三方代码。
 *
 * 与生态的分工（避免重复造轮子）：本插件只做「轻装配」入口——curated 快查 +
 * 一条命令真能装上的市场候选，面向小白用户保持轻量。重型能力装配（先查本地 →
 * 多候选审查 → 隔离试用 → 独立语义验证 → 升级回填）由社区插件 dsh-plugin-autoevo
 * 承担；本模块只对齐其核心诚信原则（未经验证不报已装），不重复实现重型流程。
 */

import type { CapabilityRef } from './types.js'
import { buildRecommendationReason, rankCandidates, suggestQueryFor } from './recommend.js'
import { searchMarketplacePlugins, searchStorePlugins, type StorePlugin, type StoreSearchResult } from './store.js'
import { buildInstallCommand, installCapability, parseInstallCommand, resolveDshBin, resolveProfileName } from '../services/installer.js'

export interface CuratedCapability {
  /** 能力 id（与 Recipe.capabilities[].id 对应） */
  id: string
  /** 内置已知的最佳来源（如 dsh-office-tools / @liustack/modlens） */
  source: string
  trust: 'bundled' | 'official' | 'community'
  /** 为什么内置推荐它（人话） */
  why: string
}

/**
 * 内置 curated 工具库：常见能力缺口直接命中，中间件不用每次搜市场。
 * 只放「真实市场验证过、来源可信」的工具——source 来自 1024Store 实际检索结果
 * （大厂背书 / 官方 / 高安装量），install 命令可直接 `dsh plugin add`。
 * 安全边界：bundled/official 自动装；community（含大厂社区包）一律「一句确认」。
 */
export const CURATED_CAPABILITIES: CuratedCapability[] = [
  // 官方（自动装）：DeepSeek 官方基础能力
  { id: 'infra_ops', source: '@deepseek-ai/dsh-base', trust: 'official', why: '官方基础包：数据库/SSH/SFTP/Docker 自动化运维' },
  // 社区增强（一句确认）：office / 视觉 / 数据库 / 知识库 / 部署 / 前端设计
  { id: 'ppt_create', source: 'dsh-univer-office', trust: 'community', why: 'dsh-univer-office（dream-num）：表格/文档/演示/数据库，实时预览' },
  { id: 'excel_read', source: 'dsh-univer-office', trust: 'community', why: 'dsh-univer-office（dream-num）：读取/编辑表格数据' },
  { id: 'modlens', source: '@liustack/modlens', trust: 'community', why: 'modlens（liustack，⭐2800+）：给纯文本模型架视觉桥梁，截图/版面/OCR 转结构化证据' },
  { id: 'db_ops', source: 'dsh-data-agent', trust: 'community', why: 'dsh-data-agent（@yejiming）：让 AI 连数据库、写 SQL' },
  { id: 'knowledge_rag', source: 'dsh-weknora', trust: 'community', why: 'dsh-weknora（腾讯）：原始文档→可查询 RAG + 自维护 Wiki 知识库' },
  { id: 'publish_deploy', source: 'sealos-skills', trust: 'community', why: 'sealos-skills（labring）：一条命令部署项目 + 配置数据库与对象存储' },
  { id: 'frontend_design', source: 'superdesign-skill', trust: 'community', why: 'superdesign-skill（superdesigndev）：把 AI 生成的界面变成精致、可发布的前端' },
]

export type DispatchAction = 'installed' | 'proposed' | 'not-found'

/**
 * 装配状态（机器可读，对齐 autoevo 的安装状态机语义，供下游精确判断）：
 * - verified：已安装且已在 profile 层面确认写入（对应 autoevo 的 verified）
 * - pending：尚未验证通过——社区源等用户一句确认 / 官方源装完但未能确认写入（对应 autoevo 的 pending）
 * - absent：市场也没有替代（对应 autoevo 的 failed_absent）
 * 绝不在 verified 之外报「已装好」（诚信红线：只有确认写入才敢说 installed）。
 */
export type DispatchState = 'verified' | 'pending' | 'absent'

export interface DispatchEntry {
  ref: CapabilityRef
  /** 选定的最佳来源（如 dsh-office-tools / github:owner/repo / 市场插件名） */
  source: string
  trust: 'bundled' | 'official' | 'community'
  /** installed=已自动安装；proposed=社区源待一句确认；not-found=市场也没有 */
  action: DispatchAction
  /** 精确装配状态（与 action 对应：installed→verified；proposed→pending；not-found→absent） */
  state: DispatchState
  /** 安装命令（installed/proposed 时有） */
  command?: string
  /** 为什么选它（人话） */
  reason: string
}

export interface DispatchResult {
  entries: DispatchEntry[]
  installedCount: number
  proposedCount: number
  notFoundCount: number
  /** 人类可读总结（给用户/主模型看） */
  summary: string
}

export interface DispatchOptions {
  /** 覆盖市场搜索（测试/网络隔离）；缺省走 Marketplace → 1024Store 兜底 */
  search?: (query: string) => Promise<StoreSearchResult>
  /** 覆盖安装执行（测试隔离；默认走 dsh plugin add） */
  install?: (source: string) => Promise<{ ok: boolean; confirmed?: boolean; detail?: string }>
  /**
   * true = 所有候选都走「一句确认」，绝不自动装（含 curated 的官方/bundled 源）。
   * 供通用能力缺口探测（gap-probe）等低置信度场景使用——「可能需要」的能力不该静默安装。
   */
  forceConfirm?: boolean
}

/** 默认市场搜索：Marketplace 优先（无 key 无限流、带中文摘要），失败或空时回退 1024Store */
async function defaultSearch(query: string): Promise<StoreSearchResult> {
  const primary = await searchMarketplacePlugins(query)
  if (primary.ok && primary.plugins.length > 0) return primary
  return searchStorePlugins(query)
}

/** 从 1024Store 安装命令里安全提取插件源；非法命令（非 dsh）视为不可信，返回空 */
function sourceFromInstallCommand(command: string | undefined): string | undefined {
  if (!command) return undefined
  try {
    return parseInstallCommand(command).source
  } catch {
    return undefined
  }
}

/**
 * 这条安装命令真的能跑通吗？
 * dsh plugin add 是转发给 pnpm 的，而 pnpm 把 # 后面的东西当 git ref——
 * github:owner/repo#packages/thing（monorepo 子目录）根本解析不了。
 * 这类候选必须过滤，绝不能把跑不通的命令交给用户（Marketplace 约定：install 宁可为 null 也不给占位）。
 */
function isRunnableInstall(command: string | undefined): boolean {
  if (!command) return false
  try {
    const { source } = parseInstallCommand(command)
    if (source.startsWith('github:') && source.includes('#')) return false
    return true
  } catch {
    return false
  }
}

/** 市场的候选文本（供排序） */
function textOf(p: StorePlugin): string {
  return `${p.name} ${p.description?.en ?? ''} ${p.description?.zh ?? ''} ${p.category ?? ''}`
}

async function findCurated(ref: CapabilityRef): Promise<CuratedCapability | undefined> {
  return CURATED_CAPABILITIES.find(c => c.id === ref.id)
}

/** 去市场找最好的替代：搜 → 过滤装不上的 → 排序 → 取第一；score 为 0 视为无关 */
async function findInStore(
  ref: CapabilityRef,
  search: (query: string) => Promise<StoreSearchResult>,
): Promise<{ source: string; command?: string; reason: string } | undefined> {
  const query = suggestQueryFor(ref.purpose, ref.id)
  const result = await search(query)
  if (!result.ok || result.plugins.length === 0) return undefined

  // 只留真正能一条命令装上的（monorepo 子目录 / 非 dsh 命令一律剔除）
  const runnable = result.plugins.filter(p => isRunnableInstall(p.install))
  if (runnable.length === 0) return undefined

  const ranked = rankCandidates(
    runnable,
    { query, purpose: ref.purpose },
    textOf,
    p => ({ stars: p.stars, installCount: p.installCount }),
  )
  const best = ranked[0]
  if (!best || best.score <= 0) return undefined

  const source =
    sourceFromInstallCommand(best.candidate.install) ??
    (best.candidate.name || best.candidate.id)
  const reason = buildRecommendationReason(
    textOf(best.candidate),
    { query, purpose: ref.purpose },
    { stars: best.candidate.stars, installCount: best.candidate.installCount },
    { queryHits: best.queryHits, scenarioHits: best.scenarioHits },
  )
  return { source, command: best.candidate.install, reason }
}

async function buildCommand(source: string): Promise<string | undefined> {
  try {
    const profile = await resolveProfileName()
    const dshBin = await resolveDshBin()
    return buildInstallCommand(source, profile, dshBin).command
  } catch {
    return `dsh plugin --profile ming add ${source}`
  }
}

/** 默认安装执行：走 dsh plugin add（不抛异常，失败也返回 ok:false） */
async function defaultInstall(source: string): Promise<{ ok: boolean; confirmed?: boolean; detail?: string }> {
  const outcome = await installCapability(source)
  return { ok: outcome.ok, confirmed: outcome.confirmed, detail: outcome.detail }
}

/**
 * 调度缺失能力：curated 优先 → 市场兜底 → 可信源自动装 / 社区源提议。
 * 纯逻辑可单测：search / install 均可注入。
 */
export async function dispatchMissingCapabilities(
  missingRefs: CapabilityRef[],
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const search = options.search ?? defaultSearch
  const install = options.install ?? defaultInstall
  const entries: DispatchEntry[] = []

  for (const ref of missingRefs) {
    const curated = await findCurated(ref)

    if (curated) {
      const command = await buildCommand(curated.source)
      // forceConfirm：低置信度场景（通用缺口探测）不自动装，官方/bundled 也走「一句确认」
      const canAutoInstall = !options.forceConfirm && (curated.trust === 'bundled' || curated.trust === 'official')
      if (canAutoInstall) {
        const result = await install(curated.source)
        // 只有「命令成功且已确认写入 profile」才敢报 installed；装完但没确认生效 → 降级为待确认，
        // 绝不把「没装成/没确认」的能力当「已装好」交给用户（重启后能力不存在是给小白的技术债）。
        const confirmed = result.ok && result.confirmed !== false
        entries.push({
          ref,
          source: curated.source,
          trust: curated.trust,
          action: confirmed ? 'installed' : 'proposed',
          state: confirmed ? 'verified' : 'pending',
          command,
          reason: confirmed
            ? curated.why
            : `${curated.why}；但安装后未能确认写入（${result.detail ?? '未知原因'}）——需人工确认/重试`,
        })
      } else {
        entries.push({
          ref,
          source: curated.source,
          trust: curated.trust,
          action: 'proposed',
          state: 'pending',
          command,
          reason: curated.why,
        })
      }
      continue
    }

    const found = await findInStore(ref, search)
    if (found) {
      entries.push({
        ref,
        source: found.source,
        trust: 'community',
        action: 'proposed',
        state: 'pending',
        command: found.command ?? (await buildCommand(found.source)),
        reason: found.reason,
      })
      continue
    }

    entries.push({
      ref,
      source: '',
      trust: 'community',
      action: 'not-found',
      state: 'absent',
      reason: `市场未找到「${ref.id}」的替代工具`,
    })
  }

  const installedCount = entries.filter(e => e.action === 'installed').length
  const proposedCount = entries.filter(e => e.action === 'proposed').length
  const notFoundCount = entries.filter(e => e.action === 'not-found').length

  const lines: string[] = []
  for (const e of entries) {
    if (e.action === 'installed') {
      lines.push(`✅ 已自动安装 ${e.source}（${e.reason}）——重启 DSH 后即可用`)
    } else if (e.action === 'proposed') {
      lines.push(`🔧 建议装配 ${e.source}（${e.reason}）——回「确认」我就帮你装`)
    } else {
      lines.push(`❌ ${e.reason}——先用现有工具完成第一版`)
    }
  }

  return {
    entries,
    installedCount,
    proposedCount,
    notFoundCount,
    summary: lines.join('\n'),
  }
}
