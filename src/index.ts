/**
 * Ming Capability Pack - 插件入口
 *
 * DeepSeek Harness 插件（薄适配层）：把自然语言目标一键转交给
 * Harness 原生能力（子代理 / 工具 / LLM）真正完成任务并产出文件。
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerMingAcceptanceTool } from './tools/ming-acceptance.js'
import { registerMingAutoTool } from './tools/ming-auto.js'
import { registerMingCatalogTool } from './tools/ming-catalog.js'
import { registerMingClarifyTool } from './tools/ming-clarify.js'
import { registerMingHistoryTool } from './tools/ming-history.js'
import { registerMingInstallTool } from './tools/ming-install.js'
import { registerMingPlanTool } from './tools/ming-plan.js'
import { registerMingStoreTool } from './tools/ming-store.js'

export const name = '@mingworkbench/capability-pack'
export const version = '0.9.0'

/**
 * 硬依赖：tools（注册工具）+ systemPrompt（注入「何时用 ming_auto」提示）。
 * subagents 作为软依赖在运行期按需取用（见 executor）。
 */
export const inject = ['tools', 'systemPrompt']

export async function apply(ctx: Context): Promise<void> {
  ctx.logger.info('🚀 Ming Capability Pack 正在加载...')

  try {
    registerMingAcceptanceTool(ctx)
    registerMingAutoTool(ctx)
    registerMingCatalogTool(ctx)
    registerMingClarifyTool(ctx)
    registerMingHistoryTool(ctx)
    registerMingInstallTool(ctx)
    registerMingPlanTool(ctx)
    registerMingStoreTool(ctx)
    ctx.systemPrompt.section({
      name: 'tool:ming_auto',
      order: 110,
      text: [
        '当用户用自然语言描述「想完成的事情」时，先调用 ming_plan 规划执行方式（匹配方案 + 策略选择：直接做一版完整的 / 先对齐需求），',
        '把选项呈现给用户选定后，再调用 ming_auto 真正完成它（带上用户选择的 strategy，必要时带上确认的 answers）。',
        '如果用户选「先对齐需求再做」（clarify-first）：用 ming_clarify 做对话式核对——',
        '一次只问一个最关键的问题、给选项让用户挑，把用户的大白话翻译成系统逻辑答案（如「文艺点」→ 浅色背景+衬线字体+大图留白），',
        '每确认一点调用一次 ming_clarify 传入新答案；信息够了（用户说「你看着办」或关键点已齐）就立刻用默认值补全并调 ming_auto 开始做，不要反复追问。',
        '用户不懂技术：永远用大白话问，给默认值兜底，不要用任何术语（HTML、部署、后端等）。',
        '例如：做一个网站、处理一批数据、整理文件、写文档、跑自动化流程、生成报表等。',
        '把用户的目标原样写进 goal 参数（一句话或一段话）；如有相关的文件路径或 URL，填进 resources。',
        'ming_auto 会把目标转交给一个全新的执行子代理，由它真正执行并产出真实文件；完成后按工具返回的产出文件路径向用户汇报。',
        '当用户想回顾之前做过什么、或要找回之前任务的产出时，调用 ming_history 工具查询历史记录。',
        '当用户想了解「各方案验收通过率如何、质量稳不稳、月度真执行且验证通过的任务数（VTE）」时，调用 ming_acceptance 只读查询。',
        'Ming 内置若干「方案包」（如整理文件夹、生成 HTML 报表、搭建个人网站），会自动匹配并装配能力；想查看全部可用方案时可调用 ming_catalog。',
        '当方案或用户要求的能力本机未装配（如缺少文档解析、Office 处理、网站部署插件）时，先调用 ming_install（mode=search）到 1024Store 搜索替代插件，' +
          '把候选展示给用户选择（说明每个为什么与目标相关，不要替用户决定），用户选定后调用 ming_install（mode=install，plugin=选中的候选 name）执行安装；' +
          '装完按返回的指引提示重启 DSH，重启后用户再说一遍目标，Ming 会自动复用新能力。' +
          '搜索免费只读，安装必须等用户明确选定后才执行；也可以先用 ming_store_search 做只读浏览。',
        '部分方案是多步工作流（如「发布网站」= 建站 → 校验 → 发布）。Ming 会逐步执行、逐步独立验收：' +
          '某一步失败会明确告诉用户是哪一步、常见原因和修法（坑位），不需要用户自己排查；' +
          '某一步缺能力会停下引导走 ming_install 装配，装完重启后用户说「继续」，就把 workflowFrom=<失败步 id> 传给 ming_auto，从失败步接着做，不重做前面已完成的部分。',
        '注意：如果你自身就是被 ming_auto 委派去执行具体子任务的子代理，不要再次调用本工具（你的工具列表里也不会出现它）。',
      ].join('\n'),
    })
    ctx.logger.info('✅ ming_plan / ming_clarify / ming_auto / ming_catalog / ming_install / ming_store_search / ming_history / ming_acceptance 工具已注册')
    ctx.logger.info('💡 直接描述你想做的事，Ming 会帮你真正完成')
  } catch (error) {
    ctx.logger.error('❌ Ming Capability Pack 加载失败', error)
    throw error
  }
}
