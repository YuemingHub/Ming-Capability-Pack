/**
 * `ming_store_search` 工具：搜索 DSH 1024Store 社区插件市场
 *
 * 只读工具：当 Recipe 声明的社区能力（skill / 插件）在本机不可用时，
 * 用它到 1024Store 找「市场上真实存在、可安装」的替代插件，
 * 返回官方 `dsh plugin add` 安装命令，交用户确认后装配。
 * 本工具只搜索与呈现，不执行安装、不下载任何代码。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { formatStoreResult, searchStorePlugins } from '../capabilities/store.js'

export function registerMingStoreTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ming_store_search',
    description: '搜索 DSH 1024Store 社区插件市场，查找某个能力对应的可安装插件。' +
      '当用户要求的能力本机尚未装配（如缺少某个文档解析、Office 处理、数据抓取插件）时，' +
      '先用本工具搜索替代插件，把返回的安装命令交给用户确认后再装配。',

    parameters: {
      query: {
        type: 'string',
        required: true,
        description: '要搜索的能力关键词，如「excel 分析」「pdf 转 markdown」「发票 下载」',
      },
      limit: {
        type: 'number',
        description: '返回数量，默认 5，最大 10',
      },
      sortBy: {
        type: 'string',
        enum: ['stars', 'growth24h', 'added'] as const,
        description: '排序：stars（星标，默认）/ growth24h（近 24h 热度）/ added（新近加入）',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text as string }],
    },

    async execute(args: { query: string; limit?: number; sortBy?: 'stars' | 'growth24h' | 'added' }) {
      const result = await searchStorePlugins(args.query, {
        limit: args.limit,
        sortBy: args.sortBy,
        key: process.env.MING_STORE_KEY,
      })
      return { text: formatStoreResult(result, args.limit ?? 5) }
    },
  }))
}
