/**
 * `ming_catalog` 工具：查看 Ming 内置方案包（Recipe）目录
 *
 * 只读工具：列出每个方案的 id / 名称 / 描述 / 触发场景，
 * 供主模型在调用 ming_auto 时显式指定 recipe 参数。
 * 不执行任何任务，不装配任何能力。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { recipeCatalog } from '../capabilities/recipes.js'

interface CatalogEntry {
  id: string
  name: string
  description: string
  triggers: string[]
}

function formatCatalog(recipes: CatalogEntry[]): string {
  if (recipes.length === 0) return '当前没有任何内置方案包。'
  const lines = ['Ming 内置方案包：', '']
  for (const r of recipes) {
    lines.push(`- [${r.id}] ${r.name}`)
    lines.push(`  描述：${r.description}`)
    lines.push(`  适合说：${r.triggers.join('、')}`)
  }
  lines.push('', '在 ming_auto 的 recipe 参数里填方案 id 可显式指定；不指定则自动匹配。')
  return lines.join('\n')
}

export function registerMingCatalogTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_catalog',
    description: '查看 Ming 内置方案包目录（整理文件、生成报表等）。' +
      '当用户的目标看起来可以套用某个现成方案时，先查本目录，再把方案 id 传给 ming_auto。',

    parameters: {},

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'number', required: true },
          recipes: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                triggers: { type: 'array', required: true, items: { type: 'string' } },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatCatalog(value.recipes as CatalogEntry[]) }],
    },

    async execute() {
      const recipes = recipeCatalog()
      return { total: recipes.length, recipes }
    },
  }))
}
