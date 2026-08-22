/**
 * 内置方案包（Recipe）目录
 *
 * Ming 提前策展的能力组合：用户目标命中触发词后，由 Resolver 选出一套方案，
 * 装配其声明的能力并委派执行。方案里的能力可以是官方工具、官方 skill，
 * 也可以是社区插件（source 给出安装来源）。第一刀以官方基础能力为主，
 * 社区插件装配作为第二刀（探测 + 安装指引已就位）。
 */

import type { Recipe } from './types.js'

export const RECIPES: Recipe[] = [
  {
    id: 'tidy-downloads',
    name: '整理下载/工作文件夹',
    description: '把散乱的文件按类型/时间归档到子目录，清出空间并给出汇总',
    triggers: ['整理', '归档', '分类', '下载', 'downloads', '清理', '文件太多', '文件夹'],
    guidance: [
      '先扫描目标目录，按文件类型（图片/文档/压缩包/安装包/视频等）归类，列出计划',
      '先预览计划、确认无误再执行移动，绝不先删后问',
      '完成后汇报：统计了哪些类型、移动了多少文件、归档到了哪里',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '扫描与移动文件', trust: 'official' },
    ],
    delegate: { provider: 'spawn' },
    verification: [
      { kind: 'dir_nonempty', pattern: '**/*', note: '目录结构应发生变化' },
    ],
  },
  {
    id: 'html-report',
    name: '生成图文 HTML 报表',
    description: '把数据整理成一份可打开查看的 HTML 报表（含表格/样式，双击即用）',
    triggers: ['报表', '周报', '月报', '报告', '汇报', 'html', '网页', '图表', '可视化', 'dashboard'],
    guidance: [
      '产出单文件 HTML（内联 CSS，避免外部依赖），双击即可在浏览器打开',
      '数据在本地文件里就先读取再整理成表格；图表用纯 HTML/CSS 或轻量内联方式实现',
      '完成后给出文件的绝对路径和打开方式',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '读写数据与产出文件', trust: 'official' },
      {
        kind: 'tool',
        id: 'excel_read',
        source: 'dsh-office-tools',
        purpose: '读取 Excel 数据（已装社区插件提供）',
        trust: 'community',
        optional: true,
      },
    ],
    delegate: { provider: 'spawn' },
    verification: [
      { kind: 'file_exists', pattern: '*.html', note: '应产出 HTML 文件' },
      { kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
  },
  {
    id: 'personal-site',
    name: '搭建个人网站/主页',
    description: '从零做一个能打开浏览的个人网站（个人介绍、作品集、博客等），静态优先，打开即用',
    triggers: ['个人网站', '个人主页', '个人博客', '个人站点', '作品集', 'portfolio', '主页', '落地页', '做网站', '建站'],
    guidance: [
      '先按用户确认的主题与视觉风格搭建站点骨架，产出可直接在浏览器打开的文件',
      '纯静态优先（HTML/CSS/JS），不要引入需要构建或部署才能看的效果；移动端也要能看',
      '内容先用占位/示例，结构完整、可点击导航；完成后给出首页绝对路径与打开方式',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '创建站点文件与目录', trust: 'official' },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'theme',
        question: '这个网站主要用来做什么？',
        default: '个人介绍 + 作品展示',
        options: ['个人介绍 + 作品展示', '个人博客', '作品集 / portfolio', '产品落地页'],
      },
      {
        key: 'style',
        question: '视觉风格偏好？',
        default: '简洁现代',
        options: ['简洁现代', '深色科技', '清新简约', '杂志风'],
      },
      {
        key: 'scope',
        question: '这次做到什么程度？',
        default: '先出可看的首页 + 2~3 个内页',
        options: ['先出可看的首页 + 2~3 个内页', '完整多页面站点', '只要一个落地页'],
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: 'index.html', note: '应有首页 index.html' },
      { kind: 'content_match', pattern: 'index.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
  },
]

/** 按目标文本做规则过滤：返回命中的方案与命中触发词 */
export function findRecipesByGoal(goal: string): Array<{ recipe: Recipe; hits: string[] }> {
  const lower = goal.toLowerCase()
  const found: Array<{ recipe: Recipe; hits: string[] }> = []
  for (const recipe of RECIPES) {
    const hits = recipe.triggers.filter(t => lower.includes(t.toLowerCase()))
    if (hits.length > 0) found.push({ recipe, hits })
  }
  return found
}

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id)
}

/** 目录清单（供 ming_catalog 只读工具展示） */
export function recipeCatalog(): Array<Pick<Recipe, 'id' | 'name' | 'description' | 'triggers'>> {
  return RECIPES.map(({ id, name, description, triggers }) => ({ id, name, description, triggers }))
}
