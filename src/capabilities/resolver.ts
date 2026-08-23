/**
 * Capability Resolver：目标 → 装配计划
 *
 * 决策分两层（规则过滤 + 模型决策）：
 *   1. 规则过滤：目标文本命中内置 Recipe 触发词 → 候选方案（确定性、零成本）；
 *   2. 模型决策：主模型通过 ming_catalog 查看方案目录，可显式指定 recipeId；
 *      规则与显式都未命中 → 退回通用委派（与旧版 ming_auto 行为一致）。
 *
 * 能力可用性探测只读官方 catalog（ctx.skills / ctx.tools），不安装任何东西——
 * 探测是「知道有什么」，装配/安装是另一回事（见 assembler）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { findRecipesByGoal, getRecipe } from './recipes.js'
import { DEFAULT_DELEGATE, type CapabilityAvailability, type CapabilityPlan, type CapabilityRef, type Recipe } from './types.js'

/** ctx.skills 的松散类型（避免强耦合 dsh-skill 的具体类型名） */
interface SkillsRegistry {
  list(opts?: { cwd?: string; signal?: AbortSignal }): Promise<Array<{ name: string; description?: string }>>
}

export interface ResolveInput {
  goal: string
  /** 模型显式指定的方案 id（通过 ming_catalog 得知） */
  recipeId?: string
}

/** 通配能力 id（如 fs_*）视为基础能力必有，不探测 */
const WILDCARD_TOOL = /^\w+\*$/

/**
 * 触发词加权：暗示「复杂/多模块/带逻辑」的词权重更高。
 * 作用：同样的命中数下，复杂项目语义（后台/系统/应用）不被「做网站/建站」这类通用词淹掉。
 */
const TRIGGER_WEIGHT: Record<string, number> = {
  // 从 0 开发的复杂信号
  大型项目: 3, 复杂项目: 3, 开发项目: 3, 做项目: 3, 开发一个: 3,
  做一个应用: 3, 做个应用: 3, 做一个系统: 3, 做个系统: 3, 做一个工具: 3, 做个工具: 3, 写一个程序: 3,
  全栈: 3, 后台: 3, 管理系统: 3, web应用: 3, 小程序: 3, 爬虫: 3, 自动化: 3, 机器人: 3,
  系统: 3, 应用: 3, 工具: 3, 数据库: 3, 注册: 3, 登录: 3, 账号: 3, api: 3, 接口: 3, 服务端: 3,
  // 存量项目的强信号（修 bug / 加功能 / 迷茫 / 已有代码）
  '修 bug': 3, '修个 bug': 3, '改 bug': 3, '有 bug': 3, '出 bug': 3, '报错': 3, '崩溃': 3, '坏了': 3, '不工作': 3, '没反应': 3,
  '加个功能': 3, '加功能': 3, '实现功能': 3, '实现一个功能': 3, '加一个功能': 3, '新功能': 3, '做个功能': 3, '优化一下': 3, '重构': 3,
  '我的项目': 3, '这个项目': 3, '那个项目': 3, '已有项目': 3, '现有项目': 3, '接手': 3, '别人写的': 3, '克隆': 3, '代码库': 3, '源码': 3,
  '看不懂': 3, '不知道下一步': 3, '接下来做什么': 3, '不知道做什么': 3, '迷茫': 3, '看看这个项目': 3, '分析一下这个项目': 3, '项目是干嘛的': 3, '怎么运行的': 3,
}

/** 加权分相同时的特化兜底（数值越大越优先）：如纯「做网站」仍归 personal-site */
const RECIPE_SPECIFICITY: Record<string, number> = {
  'personal-site': 2,
  'big-project': 1,
}

function weightOfHits(hits: string[]): number {
  return hits.reduce((score, h) => score + (TRIGGER_WEIGHT[h] ?? 1), 0)
}

async function probeCapability(ctx: Context, ref: CapabilityRef): Promise<CapabilityAvailability> {
  // 通配符基础能力：视为可用
  if (ref.kind === 'tool' && WILDCARD_TOOL.test(ref.id)) {
    return { ref, available: true }
  }

  if (ref.kind === 'skill') {
    const skills = ctx.get('skills') as SkillsRegistry | undefined
    if (skills) {
      try {
        const list = await skills.list()
        if (list.some(s => s.name === ref.id)) return { ref, available: true }
      } catch {
        /* 目录不可读视为不可用 */
      }
    }
    return {
      ref,
      available: false,
      installHint: `缺少 skill「${ref.id}」；若为社区插件提供，可尝试 dsh plugin add ${ref.source ?? ref.id}`,
    }
  }

  if (ref.kind === 'tool') {
    try {
      const schemas = ctx.tools.schemas()
      if (schemas.some(s => s.name === ref.id)) return { ref, available: true }
    } catch {
      /* 忽略 */
    }
    return {
      ref,
      available: false,
      installHint: `缺少工具「${ref.id}」${ref.source ? `；可尝试 dsh plugin add ${ref.source}` : ''}`,
    }
  }

  // mcp / plugin / preset：第一刀只探测，不自动安装
  return {
    ref,
    available: false,
    installHint: `能力 ${ref.kind}:${ref.id} 未装配${ref.source ? `；可尝试 dsh plugin add ${ref.source}` : ''}`,
  }
}

/** 批量探测一组能力（工作流步骤级复用） */
export async function probeCapabilities(ctx: Context, refs: CapabilityRef[]): Promise<CapabilityAvailability[]> {
  const out: CapabilityAvailability[] = []
  for (const ref of refs) {
    out.push(await probeCapability(ctx, ref))
  }
  return out
}

function planFromRecipe(goal: string, recipe: Recipe, matchedBy: string, capabilities: CapabilityAvailability[]): CapabilityPlan {
  const missingRequired = capabilities
    .filter(c => !c.available && !c.ref.optional)
    .map(c => `${c.ref.kind}:${c.ref.id}`)

  return {
    goal,
    recipeId: recipe.id,
    recipeName: recipe.name,
    matchedBy,
    capabilities,
    guidance: recipe.guidance,
    delegate: recipe.delegate ?? DEFAULT_DELEGATE,
    verification: recipe.verification,
    questions: recipe.questions,
    workflow: recipe.workflow,
    qualityBar: recipe.qualityBar,
    executable: missingRequired.length === 0,
    missingRequired,
  }
}

/** 无方案命中时的通用委派计划（与旧版 ming_auto 行为一致） */
function genericPlan(goal: string, matchedBy: string): CapabilityPlan {
  return {
    goal,
    recipeId: null,
    recipeName: null,
    matchedBy,
    capabilities: [],
    guidance: [],
    delegate: DEFAULT_DELEGATE,
    verification: [],
    executable: true,
    missingRequired: [],
  }
}

export async function resolveCapabilities(ctx: Context, input: ResolveInput): Promise<CapabilityPlan> {
  if (input.recipeId) {
    const recipe = getRecipe(input.recipeId)
    if (recipe) {
      const capabilities: CapabilityAvailability[] = []
      for (const ref of recipe.capabilities) {
        capabilities.push(await probeCapability(ctx, ref))
      }
      return planFromRecipe(input.goal, recipe, `explicit:${input.recipeId}`, capabilities)
    }
    return genericPlan(input.goal, `explicit-unknown:${input.recipeId}`)
  }

  const candidates = findRecipesByGoal(input.goal)
  if (candidates.length === 0) return genericPlan(input.goal, 'no-recipe')

  // 规则命中：按「加权命中分」排序（确定性优先）。
  // 加权原因：像「做一个带后台的网站」会同时命中 personal-site（做网站）与 big-project（后台），
  // 权重让「后台/系统/应用」这类暗示复杂多模块的词压过「做网站」这类通用词，big-project 才接得住复杂请求；
  // 加权分相同时按特化度兜底（如纯「做网站」仍归 personal-site，它为此打磨过手艺标准）。
  candidates.sort((a, b) =>
    (weightOfHits(b.hits) - weightOfHits(a.hits)) ||
    ((RECIPE_SPECIFICITY[b.recipe.id] ?? 1) - (RECIPE_SPECIFICITY[a.recipe.id] ?? 1)),
  )
  const { recipe, hits } = candidates[0]

  const capabilities: CapabilityAvailability[] = []
  for (const ref of recipe.capabilities) {
    capabilities.push(await probeCapability(ctx, ref))
  }
  return planFromRecipe(input.goal, recipe, `rules:${hits.join('、')}`, capabilities)
}
