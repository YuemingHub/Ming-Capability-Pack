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
      '素材获取：用户提到「文档/数据/文件/上传」时，先用文件工具自己定位并读取数据文件（.xlsx/.csv/.md/.txt 等），' +
        '不要教用户找路径或复制粘贴；读不了就如实说明缺什么解析能力，确实找不到时最多问一次用户大概位置',
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
        translate: '用户说「展示作品/摄影/设计/画画」→ 作品集结构（首页 + 分类 + 作品详情）；' +
          '「写文章/日记/分享」→ 博客结构（文章列表 + 详情页）；「介绍自己」→ 个人介绍（头像/经历/联系方式）；' +
          '「卖东西/推广产品」→ 落地页（产品卖点 + 行动按钮）。',
      },
      {
        key: 'style',
        question: '视觉风格偏好？',
        default: '简洁现代',
        options: ['简洁现代', '深色科技', '清新简约', '杂志风'],
        translate: '用户说「文艺/清新/温柔」→ 浅色背景 + 衬线/手写字体 + 大图留白；' +
          '「科技/极客/炫酷」→ 深色背景 + 等宽字体 + 霓虹强调色；「简约/高级」→ 大量留白 + 无衬线 + 克制配色；' +
          '「杂志/时尚」→ 大标题 + 分栏网格 + 图片为主。',
      },
      {
        key: 'scope',
        question: '这次做到什么程度？',
        default: '先出可看的首页 + 2~3 个内页',
        options: ['先出可看的首页 + 2~3 个内页', '完整多页面站点', '只要一个落地页'],
        translate: '用户说「先看看/先做个能看的/随便先弄」→ 用默认（首页 + 2~3 个内页），内容占位后迭代；' +
          '「全部/完整/正式」→ 完整站点结构；「只要一页/单页」→ 单页落地。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: 'index.html', note: '应有首页 index.html' },
      { kind: 'content_match', pattern: 'index.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
  },
  {
    id: 'infographic',
    name: '文字变信息图/视觉表达',
    description: '把一段文字或数据变成一张能看懂的信息图（流程图/时间线/对比图/图标化），纯 SVG/HTML 产出',
    triggers: ['信息图', '一张图看懂', '视觉表达', '做成图', 'infographic', '流程图', '时间线', '示意图', '海报', 'diagram', 'poster', '关系图', '图标'],
    guidance: [
      '用 SVG/HTML/CSS 纯文本产出视觉表达（矢量、浏览器可看可缩放），不要依赖外部生成 API 或图片素材库',
      '内容要提炼：标题、关键要点、数字一目了然，避免大段文字堆砌',
      '配色克制（1 个主色 + 1~2 个辅色），字号层级清晰，移动端也要能看',
      '产出 .svg + 预览 .html；完成后给出文件绝对路径与打开方式',
      '素材获取：用户提到「文档/文件/上传」或目标里有具体文字内容来源时，先用文件工具自己定位并读取（.md/.txt/.docx/.pdf 等常见格式，在用户工作区/常见文档位置找）；' +
        '读不了（如缺格式解析能力）就如实说明缺什么，并用 ming_store_search 找文档解析类插件；' +
        '确实找不到素材时最多问用户一次，要一句「大概在哪个文件夹」即可，绝不让用户复制粘贴全文或自己找路径',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '产出 SVG/HTML 文件', trust: 'official' },
      {
        kind: 'skill',
        id: 'modlens',
        source: '@liustack/modlens',
        purpose: '视觉自检（可选，已装社区插件提供）',
        trust: 'community',
        optional: true,
      },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'form',
        question: '想做成哪种视觉表达？',
        default: '信息图',
        options: ['信息图', '流程图', '时间线', '对比图', '图标化'],
        translate: '用户说「整理成一张图/一张图看懂/总结成图」→ 信息图（标题+要点+数字分区）；' +
          '「流程/步骤/怎么做」→ 流程图（步骤节点+箭头）；「先后顺序/时间发展」→ 时间线；' +
          '「比谁强/对比一下」→ 对比图（并排差异）；「做个 logo/标志/小图标」→ 图标化（简洁符号）。',
      },
      {
        key: 'style',
        question: '视觉风格偏好？',
        default: '简洁现代',
        options: ['简洁现代', '商务正式', '活泼卡通', '科技感'],
        translate: '用户说「好看/可爱/生动/有趣」→ 活泼卡通（明亮色块+圆角）；「正式/开会/汇报用」→ 商务正式（白底+深色标题+品牌色）；' +
          '「酷/未来/科技」→ 科技感（深色底+霓虹强调）；默认 → 简洁现代（留白+无衬线+克制配色）。',
      },
      {
        key: 'output',
        question: '做完主要用在哪？',
        default: '网页上展示 + 可下载的 SVG',
        options: ['网页上展示 + 可下载的 SVG', '要放进 PPT/文档/邮件', '打印海报'],
        translate: '用户说「放 PPT/文档/邮件里」→ 矢量 SVG（放大不失真）；「打印/贴出来」→ 竖版海报尺寸（大标题+大字）；' +
          '「网页/发朋友圈」→ 横版网页尺寸；默认 → 网页展示尺寸。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: '*.svg', note: '应产出 SVG 文件' },
      { kind: 'content_match', pattern: '*.svg', contains: '<svg', note: '应为有效 SVG' },
      { kind: 'content_match', pattern: '*.svg', contains: 'viewBox', note: 'SVG 应有画布尺寸' },
    ],
  },
  {
    id: 'presentation',
    name: '生成演示文稿（PPT/幻灯片）',
    description: '把要点整理成一套能翻页演示的幻灯片，打开就能讲',
    triggers: ['ppt', '幻灯片', '演示文稿', 'slides', 'presentation', '宣讲', 'deck', '做一套讲解'],
    guidance: [
      '先提炼要点（结论先行、一页一个主题），再产出幻灯片',
      '优先产出 HTML 幻灯片（每页一个 section，内联 CSS，浏览器可翻页演示）；若环境有 ppt_create 能力则同时产出 .pptx',
      '配图用纯 CSS/形状即可，不依赖外部图片；完成后给出文件路径与打开方式',
      '素材获取：用户提到「文档/资料/上传」时，先用文件工具自己定位并读取素材（.md/.docx/.txt 等），' +
        '不要教用户找路径或复制粘贴；读不了就如实说明缺什么，确实找不到时最多问一次用户大概位置',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '产出幻灯片文件', trust: 'official' },
      {
        kind: 'tool',
        id: 'ppt_create',
        source: 'dsh-office-tools',
        purpose: '生成 .pptx（已装社区插件提供）',
        trust: 'community',
        optional: true,
      },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'audience',
        question: '这套幻灯片主要给谁讲？',
        default: '通用/内部汇报',
        options: ['给上级/老板汇报', '给客户/对外', '给同事/内部培训', '通用'],
        translate: '用户说「给老板/上级/领导」→ 结论先行 + 数据支撑 + 一页一要点；「给客户/对外」→ 价值卖点 + 案例 + 行动呼吁；' +
          '「培训/教同事」→ 步骤讲解 + 图示 + 留互动；默认 → 通用结构。',
      },
      {
        key: 'style',
        question: '视觉风格偏好？',
        default: '商务简洁',
        options: ['商务简洁', '科技感', '活泼明亮'],
        translate: '用户说「正式/专业」→ 商务简洁（白底+深色标题+品牌色）；「产品发布/酷」→ 深色渐变+霓虹强调；' +
          '「轻松/培训/年轻」→ 明亮色块+大图标。',
      },
      {
        key: 'depth',
        question: '内容量做多少？',
        default: '10 页左右核心要点',
        options: ['精炼 5~8 页', '10 页左右', '详尽 15 页以上'],
        translate: '用户说「简单/快速/先弄一版」→ 精炼 5~8 页；「详细/完整/要讲很久」→ 详尽 15 页以上（含目录+附录）；' +
          '默认 → 10 页左右核心要点。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: '*.html', note: '应产出 HTML 幻灯片' },
      { kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
  },
  {
    id: 'publish-site',
    name: '发布网站/上线（一条龙：建站 → 校验 → 发布）',
    description: '从零到公开访问一条龙：没有站点先建一个，校验可打开，再发布上线，生成可公开访问的地址',
    triggers: ['发布', '上线', '部署', 'deploy', '托管', 'github pages', 'vercel', 'netlify', '让别人能看', '公开访问', '一条龙'],
    guidance: [
      '这是一条多步工作流：先确保有站点（没有就建）→ 校验可打开 → 发布上线',
      '用户提到「先本地看看」时，发布步可以只做本地预览并说明如何本地打开',
      '发布能力未装配时，停在本步并引导装配，不假装已发布',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '准备与检查发布内容', trust: 'official' },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'target',
        question: '发布到哪里让别人看？',
        default: '先本地预览，确认没问题再发布',
        options: ['先本地预览，确认没问题再发布', 'GitHub Pages（免费静态托管）', 'Vercel（免费静态托管）', '生成可发给别人的打包文件'],
        translate: '用户说「免费/不要钱/白嫖」→ 免费静态托管（GitHub Pages 或 Vercel）；' +
          '「自己看看/先看效果」→ 本地预览即可，不急着公开；「发给别人/别人能打开」→ 需要公开托管地址。',
      },
      {
        key: 'content',
        question: '要发布的是哪个文件夹/文件？',
        default: '当前工作区里刚做好的网站',
        options: ['当前工作区里刚做好的网站', '我指定一个文件夹'],
        translate: '用户说「刚做的/刚才那个/这个」→ 当前工作区最近生成的站点；「XX 文件夹」→ 用户指定的路径（自己定位，不要让对方复制粘贴路径）。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: '*.html', note: '发布内容应包含 HTML 页面' },
      { kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
    workflow: [
      {
        id: 'prepare-site',
        name: '准备站点内容',
        goal: '确保工作区里有一份可发布的静态网站：若没有，就基于用户目标现做一版（个人网站/落地页/作品集）；若有，确认 index.html 等关键文件齐全。',
        guidance: [
          '先检查工作区是否已有网站文件（index.html 等）；有就用现有的，没有就基于用户目标做一版',
          '用户提到的主题/风格/内容方向（如「作品集」「深色科技风」）按确认的方向做',
          '必须产出真实 .html 文件并报告绝对路径，不许只给建议',
        ],
        verification: [
          { kind: 'file_exists', pattern: '*.html', note: '应有 HTML 页面' },
        ],
        pitfalls: [
          { symptom: '子代理只给了建议没产出文件', fix: '重试时明确要求：必须产出真实 .html 文件并报告绝对路径' },
        ],
      },
      {
        id: 'check-site',
        name: '校验站点可打开',
        goal: '检查站点：首页存在、是有效 HTML、引用的资源（css/js/图片）路径正确，浏览器能直接打开。',
        guidance: [
          '用文件工具检查 index.html 是否存在且内容有效（含 <html> 标签）',
          '检查引用的相对资源路径都存在；发现坏链就修复',
        ],
        verification: [
          { kind: 'content_match', pattern: '*.html', contains: '<html', note: '首页应为有效 HTML' },
        ],
        pitfalls: [
          { symptom: '首页是空文件或纯模板占位', fix: '确认首页有真实内容（标题/段落/导航），不是空壳模板' },
        ],
      },
      {
        id: 'publish',
        name: '发布上线',
        goal: '把站点发布到公开地址，让别人能通过链接打开；或按用户要求只做本地预览。',
        guidance: [
          '优先静态托管（GitHub Pages / Vercel / 本地静态服务），先说明发布后的访问方式再动手',
          '发布完成后给出可访问的地址（URL 或本地地址）和验证方式',
        ],
        capabilities: [
          {
            kind: 'tool',
            id: 'publish_deploy',
            source: 'dsh-deploy-tools',
            purpose: '把静态网站发布到公开地址',
            trust: 'community',
          },
        ],
        verification: [
          { kind: 'file_exists', pattern: '*.html', note: '发布内容应包含 HTML 页面' },
        ],
        pitfalls: [
          { symptom: '没有发布/部署能力（未装配 publish_deploy）', fix: '按指引走 ming_install 装配闭环：搜索候选给用户选→安装→重启→从发布步继续' },
          { symptom: '发布后链接打不开', fix: '检查是否真的上传了 index.html；免费托管首次生效可能需等 1~2 分钟' },
        ],
      },
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
