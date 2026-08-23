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

  // 规则命中：选命中触发词最多的方案（确定性优先）
  candidates.sort((a, b) => b.hits.length - a.hits.length)
  const { recipe, hits } = candidates[0]

  const capabilities: CapabilityAvailability[] = []
  for (const ref of recipe.capabilities) {
    capabilities.push(await probeCapability(ctx, ref))
  }
  return planFromRecipe(input.goal, recipe, `rules:${hits.join('、')}`, capabilities)
}
