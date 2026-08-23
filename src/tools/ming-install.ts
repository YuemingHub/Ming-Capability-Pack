/**
 * `ming_install` 工具：能力装配闭环（缺 → 搜 → 选 → 装 → 验 → 重跑）
 *
 * 当方案声明的能力（skill / MCP / 工具 / 插件）本机未装配时，用它完成闭环：
 *   - mode=search：按关键词搜 1024Store，返回结构化候选（含每个的「匹配理由」），
 *     由主模型把候选展示给用户选择——用户说「装哪个」，不是替用户决定；
 *   - mode=install：执行用户选定插件的安装（自动定位 dsh、解析安装命令、spawn 执行、
 *     核对 profile 写入），返回「已确认 / 需手动」与「重启后重跑」指引。
 *
 * 安全：搜索免费只读；安装永远等用户明确选定后才执行，且只跑「dsh plugin add」形态。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { searchStorePlugins, type StorePlugin } from '../capabilities/store.js'
import { buildRecommendationReason, rankCandidates } from '../capabilities/recommend.js'
import { installCapability, matchReason, parseInstallCommand } from '../services/installer.js'
import { writeEvidence } from '../services/evidence-collector.js'
import { resolveWorkdir } from '../services/executor.js'
import type { ExecutionOutcome } from '../types.js'

interface Candidate {
  id: string
  name: string
  owner: string
  stars: number
  installCount: number
  category: string
  description: string
  install: string
  /** 为什么配当前需求（纯规则：命中关键词 + 星标） */
  matchReason: string
}

function toCandidate(p: StorePlugin, query: string): Candidate {
  return {
    id: p.id ?? p.name,
    name: p.name,
    owner: p.owner,
    stars: p.stars ?? 0,
    installCount: p.installCount ?? 0,
    category: p.category,
    description: [p.description?.zh, p.description?.en].filter(Boolean).join('｜').slice(0, 200),
    install: p.install,
    matchReason: matchReason(p, query),
  }
}

function candidateText(c: Candidate): string {
  return `${c.name} ${c.description} ${c.category}`
}

/** 按用户场景排序 + 生成「为什么配你」理由（推荐展示用） */
function recommendCandidates(
  candidates: Candidate[],
  ctx: { query: string; purpose?: string; scenario?: string[] },
  top: number,
): Array<Candidate & { matchReason: string; score: number }> {
  const scored = rankCandidates(candidates, ctx, candidateText, c => ({
    stars: c.stars,
    installCount: c.installCount,
  }))
  return scored.slice(0, top).map(({ candidate, score, queryHits, scenarioHits }) => ({
    ...candidate,
    score,
    matchReason: buildRecommendationReason(candidateText(candidate), ctx, { stars: candidate.stars, installCount: candidate.installCount }, { queryHits, scenarioHits }),
  }))
}

function formatCandidates(candidates: Candidate[], query: string, goal?: string): string {
  const lines = [
    `按你的目标排序后，推荐以下 ${candidates.length} 个候选${goal ? `（目标：${goal.slice(0, 60)}）` : ''}`,
    '',
  ]
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    lines.push(`${i + 1}. ${c.name}（⭐${c.stars}，${c.owner}）— ${c.matchReason}`)
    if (c.description) lines.push(`   ${c.description}`)
    lines.push(`   安装：${c.install ?? '—'}`)
  }
  lines.push('', '把候选展示给用户，让用户选（用户可以说「装第几个」或「装 XXX」）。')
  lines.push('用户选定后，调用 ming_install（mode=install，plugin=选中的 name）执行安装。')
  return lines.join('\n')
}

/** 用插件名/源重新搜索，拿到精确匹配的安装命令；拿不到时把名字当源直接装 */
async function resolveSource(plugin: string): Promise<{ source: string; matched?: StorePlugin }> {
  const search = await searchStorePlugins(plugin, { limit: 5, key: process.env.MING_STORE_KEY })
  const exact = search.plugins.find(p => p.name === plugin)
  if (exact) {
    return { source: parseInstallCommand(exact.install).source, matched: exact }
  }
  // 名字没精确命中：若是安全的插件源形态（无空格 / 无 shell 元字符），直接按源处理
  if (/^[\w.\-/:@]+$/u.test(plugin)) {
    return { source: plugin }
  }
  throw new Error(`未在 1024Store 找到「${plugin}」的精确匹配，请先调用 ming_install（mode=search）拿到候选再让用户选`)
}

export function registerMingInstallTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_install',
    description: `Ming 能力装配：当方案声明的能力（skill/MCP/工具/插件）本机未装配时，用它完成「搜索→选项→安装→核对→重跑指引」闭环。

mode=search：按关键词搜索 1024Store 社区插件市场，返回结构化候选（每个含匹配理由），
  把候选展示给用户选择（说清每个为什么与目标相关），不要替用户决定；
mode=install：执行用户选定插件的安装（plugin 传用户选中的候选 name），自动定位 dsh、解析并执行安装命令，
  核对 profile 写入结果，返回「已确认 / 需手动」和「重启后重跑」指引。

安全提示：搜索免费只读；安装第三方插件有风险，必须等用户明确选定后才调用 install 模式。`,
    parameters: {
      mode: {
        type: 'string',
        required: true,
        enum: ['search', 'install'] as const,
        description: 'search=搜索候选给用户选；install=安装用户选定的插件',
      },
      query: {
        type: 'string',
        description: 'mode=search 必填：搜索关键词，如「excel 报表」「pdf 转 markdown」「网站部署」；通常用缺失能力名或用户意图提炼',
      },
      goal: {
        type: 'string',
        description: 'mode=search 可选：用户目标，用于生成候选与目标的相关性说明',
      },
      purpose: {
        type: 'string',
        description: 'mode=search 可选：缺失能力承担的角色（人话），如「把静态网站发布到公开地址」，用于候选推荐理由',
      },
      answers: {
        type: 'object',
        additionalProperties: true,
        description: 'mode=search 可选：用户已确认的方向（clarify 收集的答案键值对），用于按用户场景排序候选',
      },
      top: {
        type: 'number',
        description: 'mode=search 可选：推荐展示数量，默认 3（只推最相关的，避免眼花缭乱）；看全部可调大',
      },
      plugin: {
        type: 'string',
        description: 'mode=install 必填：用户选中的候选 name（来自 search 返回的候选列表）',
      },
      limit: {
        type: 'number',
        description: 'mode=search 可选：返回候选数，默认 5，最大 10',
      },
      sortBy: {
        type: 'string',
        enum: ['stars', 'growth24h', 'added'] as const,
        description: 'mode=search 可选：排序 stars（默认）/ growth24h / added',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          mode: { type: 'string', required: true },
          text: { type: 'string', required: true },
          candidates: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
                owner: { type: 'string', required: true },
                stars: { type: 'number', required: true },
                installCount: { type: 'number', required: true },
                category: { type: 'string', required: true },
                description: { type: 'string', required: true },
                install: { type: 'string', required: true },
                matchReason: { type: 'string', required: true },
              },
            },
          },
          installed: { type: 'boolean', required: true },
          confirmed: { type: 'boolean', required: true },
          detail: { type: 'string', required: true },
          command: { type: 'string', required: true },
          profile: { type: 'string', required: true },
          nextSteps: { type: 'array', required: true, items: { type: 'string' } },
          evidence: { type: 'string', required: true },
          error: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text as string }],
    },

    async execute(
      args: {
        mode: 'search' | 'install'
        query?: string
        goal?: string
        purpose?: string
        answers?: Record<string, string>
        top?: number
        plugin?: string
        limit?: number
        sortBy?: 'stars' | 'growth24h' | 'added'
      },
      exec,
    ) {
      // ---------- search 模式：按用户场景推荐候选，交用户选 ----------
      if (args.mode === 'search') {
        const query = (args.query ?? '').trim()
        if (!query) {
          return {
            ok: false,
            mode: 'search',
            text: '缺少搜索关键词（query）。请用缺失能力名或用户意图提炼一个关键词再试。',
            candidates: [],
            installed: false,
            confirmed: false,
            detail: '',
            command: '',
            profile: '',
            nextSteps: [],
            evidence: '',
            error: '缺少搜索关键词',
          }
        }
        const result = await searchStorePlugins(query, {
          limit: Math.min(Math.max(args.limit ?? 10, 1), 10),
          sortBy: args.sortBy,
          key: process.env.MING_STORE_KEY,
        })
        if (!result.ok) {
          return {
            ok: false,
            mode: 'search',
            text: `1024Store 查询失败：${result.error ?? '未知错误'}。可以先不装，用现有能力尽力完成。`,
            candidates: [],
            installed: false,
            confirmed: false,
            detail: '',
            command: '',
            profile: '',
            nextSteps: [],
            evidence: '',
            error: result.error ?? '1024Store 查询失败',
          }
        }
        const allCandidates = result.plugins.map(p => toCandidate(p, query))
        if (allCandidates.length === 0) {
          return {
            ok: false,
            mode: 'search',
            text: `1024Store 没有找到与「${query}」相关的插件（${result.total ?? 0} 条匹配但均被过滤）。可以先不装，用现有能力尽力完成。`,
            candidates: [],
            installed: false,
            confirmed: false,
            detail: '',
            command: '',
            profile: '',
            nextSteps: [],
            evidence: '',
            error: '无匹配候选',
          }
        }
        // 按用户场景排序，只推最相关的 top 个（默认 3，避免眼花缭乱）
        const scenario = Object.values(args.answers ?? {}).map(v => String(v))
        const top = Math.min(Math.max(args.top ?? 3, 1), allCandidates.length)
        const candidates = recommendCandidates(allCandidates, { query, purpose: args.purpose, scenario }, top)
        return {
          ok: true,
          mode: 'search',
          candidates,
          text: formatCandidates(candidates, query, args.goal),
          installed: false,
          confirmed: false,
          detail: '',
          command: '',
          profile: '',
          nextSteps: [],
          evidence: '',
          error: '',
        }
      }

      // ---------- install 模式：装用户选定的插件 ----------
      const plugin = (args.plugin ?? '').trim()
      if (!plugin) {
        return {
          ok: false,
          mode: 'install',
          text: '缺少 plugin 参数。用户选定候选后，把选中的候选 name 传进来。',
          candidates: [],
          installed: false,
          confirmed: false,
          detail: '',
          command: '',
          profile: '',
          nextSteps: [],
          evidence: '',
          error: '缺少 plugin 参数',
        }
      }

      const workdir = resolveWorkdir(exec)
      try {
        const { source, matched } = await resolveSource(plugin)
        const outcome = await installCapability(source)

        // 装配动作留证据卡（谁选了、装了什么、结果如何）
        let evidencePath = ''
        try {
          const outcomeForEvidence: ExecutionOutcome = {
            mode: 'executed',
            success: outcome.installed,
            summary: `装配插件 ${source}（用户选定：${plugin}${matched ? `，${matched.owner}` : ''}）`,
            artifacts: [],
            error: outcome.installed ? undefined : outcome.detail,
          }
          const evidence = await writeEvidence({
            goal: `装配能力：${source}`,
            resources: [],
            outcome: outcomeForEvidence,
            workdir,
          })
          evidencePath = evidence.path
        } catch {
          /* 证据尽力而为 */
        }

        const text = [
          outcome.ok ? '✅' : '❌',
          ` 插件「${source}」：${outcome.detail}`,
          outcome.output ? `\n安装输出：\n${outcome.output.slice(0, 600)}` : '',
          '',
          '接下来：',
          ...outcome.nextSteps.map(s => `  - ${s}`),
        ].join('\n')

        return {
          ok: outcome.ok,
          mode: 'install',
          candidates: [],
          installed: outcome.installed,
          confirmed: outcome.confirmed,
          detail: outcome.detail,
          command: outcome.command,
          profile: outcome.profile,
          nextSteps: outcome.nextSteps,
          evidence: evidencePath,
          error: '',
          text,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          ok: false,
          mode: 'install',
          text: `安装失败：${message}`,
          candidates: [],
          installed: false,
          confirmed: false,
          detail: '',
          command: '',
          profile: '',
          nextSteps: [],
          evidence: '',
          error: message,
        }
      }
    },
  }))
}
