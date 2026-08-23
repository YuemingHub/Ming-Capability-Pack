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
    qualityBar: {
      bar: '这一轮就交付「整理完能立刻找到东西」，不是把文件挪个地方',
      checks: [
        '分类规则合理：按「类型」而非大小/日期分，类别 5~8 个为宜，不碎片化',
        '保留可追溯性：文件名不被改写，移动后有汇总清单（类型→数量→新位置）',
        '边界情况处理妥当：隐藏文件、重名文件、正在使用的文件都不丢不覆盖',
      ],
      selfCheck: [
        '随机抽 3 个文件，能否按分类逻辑立刻找到',
        '是否有一份「整理了什么、移到哪里」的汇总',
        '有没有文件被误删或覆盖（绝不允许）',
      ],
    },
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
        source: 'dsh-univer-office',
        purpose: '读取 Excel/表格数据（dsh-univer-office：表格/文档/演示/数据库，支持实时预览）',
        trust: 'community',
        optional: true,
      },
    ],
    delegate: { provider: 'spawn' },
    verification: [
      { kind: 'file_exists', pattern: '*.html', note: '应产出 HTML 文件' },
      { kind: 'content_match', pattern: '*.html', contains: '<html', note: '应为有效 HTML 文档' },
    ],
    qualityBar: {
      bar: '这一轮就交付「能直接拿去用、拿得出手」的报表，不是数据陈列',
      checks: [
        '数据完整：源数据里的关键数字全部进入报表，不丢行不丢列',
        '有分析视角：不止罗列，要有汇总（合计/平均/趋势）或对比，让看的人一眼知道「数据在说什么」',
        '排版专业：数字对齐、表头清晰、重点高亮；配色克制（1 个主色），打印/分享也不乱',
        '零依赖：单文件内联 CSS，双击直接打开',
      ],
      selfCheck: [
        '数字是否都来自源数据、没有手编',
        '一个不懂背景的人打开能否在 10 秒内看懂重点',
        '是否可以直接发给别人看而不用先解释',
      ],
    },
  },
  {
    id: 'personal-site',
    name: '搭建个人网站/主页',
    description: '从零做一个能打开浏览的个人网站（个人介绍、作品集、博客等），静态优先，打开即用',
    triggers: ['个人网站', '个人主页', '个人博客', '个人站点', '作品集', 'portfolio', '主页', '落地页', '做网站', '做个网站', '做一个网站', '建站'],
    guidance: [
      '先按用户确认的主题与视觉风格搭建站点骨架，产出可直接在浏览器打开的文件',
      '目的先行：首页首屏（hero）要在 3 秒内说清「这是谁/做什么/下一步行动」，一句话 + 一个主行动按钮（如「联系我」「查看作品」）',
      '结构节奏：hero → 2~4 个内容区块（作品/经历/文章等，每块有清晰小标题）→ 关于/联系；不堆区块，宁少勿多',
      '排版系统：字号阶梯清晰（如 64/32/20/16 四级）；正文行高 1.5~1.7；每行正文 45~75 字符；标题是结论不是描述',
      '色彩系统：1 个主色 + 1 个强调色 + 中性色（灰白黑）；明/暗主题二选一做主视觉；禁用浏览器默认样式（默认蓝链接、Times 字体、默认边框）',
      '留白与网格：区块间距成体系（64/96px 梯队）；卡片、按钮、内边距统一；移动端优先（390px 先好，桌面端自然好）',
      '交互细节：按钮/卡片有 hover 态；导航在当前页高亮；至少一处滚动渐显/悬停动效；滚动平滑',
      '内容真实：全部中文真实文案，绝不用 Lorem 占位；用户没有的素材用合理示例内容补齐；不放假头像/假个人信息',
      '技术：纯静态可打开（HTML/CSS/JS 单文件或静态多文件），无构建/部署依赖，浏览器控制台无报错；图片有 alt、无破图无死链',
    ],
    qualityBar: {
      bar: '这一轮就交付「打开能直接展示的高质感网站」，不是朴素占位版；后续迭代只做细节打磨',
      checks: [
        '有明确的视觉主题：统一的配色体系（1 主色 + 1 强调色 + 中性色）、清晰的字号阶梯（标题/正文/辅助）、卡片与按钮样式——第一眼有设计感，不是默认白底黑字',
        '首屏即亮点：hero 一句话说清「这是谁/做什么」+ 一个行动按钮，3 秒抓住注意力',
        '内容有真实质感：标题、个人介绍、作品条目、联系方式都是通顺真实的中文文案，不用 Lorem 占位；没有的素材用合理的示例内容补齐',
        '有存在感的交互：至少一处滚动/悬停/入场动效（滚动渐显、卡片 hover 抬升、导航高亮等），让页面「活」起来而不是死板',
        '适配完整：移动端单列可读、桌面端多列布局，导航在所有页面可点击跳转，无死链无破图，控制台无报错',
      ],
      selfCheck: [
        '第一眼是否「有设计感」而不是「像没做过样式」',
        '首屏 3 秒内能否说清「这是谁的网站、做什么的」',
        '有没有默认蓝链接、Times 字体、浏览器默认样式残留',
        '所有导航链接是否都能点击跳转、没有死链',
        '文案是否真实通顺，有无错别字、占位残留或假信息',
        '手机宽度（约 390px）下是否还能正常阅读',
      ],
    },
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
        translate: '用户说「先看看/先做个能看的/随便先弄」→ 用默认（首页 + 2~3 个内页），内容先行补足后按反馈迭代；' +
          '「全部/完整/正式」→ 完整站点结构；「只要一页/单页」→ 单页落地。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: 'index.html', note: '应有首页 index.html' },
      { kind: 'content_match', pattern: 'index.html', contains: '<html', note: '应为有效 HTML 文档' },
      { kind: 'content_absent', pattern: 'index.html', mustNotContain: 'Lorem', note: '绝无占位文字' },
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
        purpose: '视觉自检（可选，modlens：截图/版面/OCR 转结构化证据，装后升级视觉检查）',
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
    qualityBar: {
      bar: '这一轮就交付「能直接发出去的信息图」——站在一米外也能看懂核心信息',
      checks: [
        '信息层次清晰：标题→要点→数字三层，大段文字先提炼成短句/关键词，不堆砌',
        '构图有呼吸感：留白充足，区块之间有视觉分隔，不挤成一团',
        '配色克制：1 个主色 + 1~2 个辅色，字号层级 3 级以内，移动端可读',
        '矢量输出：SVG 不失真，配 .html 预览页，双击可看',
      ],
      selfCheck: [
        '一米外能否一眼看懂「这张图在讲什么」',
        '有没有大段文字堆砌（有就该提炼）',
        '颜色是否超过 3 个主色（超了就是花）',
      ],
    },
  },
  {
    id: 'content-cards',
    name: '文章转多平台信息图（公众号封面 / 小红书 / 抖音）',
    description: '把一篇公众号文章或内容主题，提炼成一组低密度信息图卡片：公众号封面 + 小红书竖卡 + 抖音竖卡，品牌化、可直接发布',
    triggers: ['信息图', '做成图', '封面', '配图', '卡片', '图文', '自媒体', '公众号', '小红书', '抖音', '内容图', '发布图', 'social media'],
    guidance: [
      '素材获取：用户提到「文章/文档/我的内容」时，先用文件工具自己定位并读取素材（.md/.txt/.docx 等），不要教用户找路径或复制粘贴',
      '先提炼内容骨架：标题（≤12 字）、3~5 个核心要点、1 句金句、1 个行动引导；信息图只呈现骨架，不堆正文',
      '内容密度规则（最重要）：一卡一点——大标题（≤12 字）+ 一句副标（≤20 字）+ 至多 3 个关键词标签；任何一张卡都不放段落文字，一卡讲不清就拆成多卡',
      '平台尺寸：公众号封面 900×383（2.35:1，标题 ≤10 字，一句话 + 主视觉）；小红书 1080×1440（3:4，标题 + 标签组）；' +
        '抖音 1080×1920（9:16，金句单点，中下部留空避开底部 UI）。用户未指定时三种都做',
      '版式系统：四周边距 ≥ 画布宽 8%（1080 宽 → 边距 ≥ 86px）；层级从上到下固定为「品牌小字 → 大标题 → 一句副标 → 标签/底部品牌」；' +
        '整卡对齐统一（要么全左对齐要么全居中，绝不混用）；元素间距用 8/16/24/32/48 梯队，不随手摆',
      '色彩系统：1 个主色（占画面 70% 以上）+ 1 个强调色（只用于标题/金句/标签）+ 中性色；渐变只从主色衍生；' +
        '深底浅字或浅底深字二选一，文字与背景对比 ≥ 4.5:1；不要霓虹堆叠、不要多重阴影、不要五颜六色',
      '字体系统：中文标题用系统黑体（PingFang SC / Microsoft YaHei / 思源黑体），1080 宽下标题 ≥ 72px、副标 ≥ 32px、标签 ≥ 28px；' +
        '标题不换行超过 2 行；不用衬线体做标题；不用 emoji',
      '专业细节：同组元素圆角半径统一；标签用浅色底 + 强调色字（或强调色底 + 白字）；金句可用强调色；底部品牌小字（≤ 26px）；留白充足不挤',
      '品牌化：图上只出现用户品牌名（如 FamilySpace）与产品角色名（如家明），绝不出现 Ming、插件名、模型名、dsh 等工具痕迹，也不出现「由XX生成」水印',
      '每个 SVG 配一个 .html 预览页（内联引入，透明底居中），双击即可看整组效果',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '定位读取素材、产出 SVG/HTML', trust: 'official' },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'brand',
        question: '图上放什么品牌名？',
        default: 'FamilySpace',
        options: ['FamilySpace', '不加署名'],
        translate: '用户给了品牌名（如 FamilySpace、产品名）→ 使用该品牌；「不署名/干净」→ 图上不出现品牌字样；' +
          '「用户品牌是什么」→ 用 FamilySpace（里面对话的叫家明）。',
      },
      {
        key: 'platform',
        question: '这些信息图发到哪里？',
        default: '公众号封面 + 小红书 + 抖音',
        options: ['公众号封面 + 小红书 + 抖音', '只要公众号封面', '只要小红书竖卡', '只要抖音竖卡'],
        translate: '用户说「公众号」→ 900×383 封面；「小红书」→ 1080×1440 竖卡；「抖音」→ 1080×1920 竖卡；' +
          '「都要/全平台/自媒体」→ 三种尺寸都产出，内容要点按平台拆分复用。',
      },
      {
        key: 'source',
        question: '内容从哪里来？',
        default: '先用文件工具读工作区里的文章/文档',
        options: ['先用文件工具读工作区里的文章/文档', '直接按下面的主题做'],
        translate: '用户给了文章/文档 → 定位读取后提炼；只给主题没给文章 → 按主题 + 产品背景直接提炼要点做。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: '*.svg', note: '应产出 SVG 信息图卡片' },
      { kind: 'content_match', pattern: '*.svg', contains: '<svg', note: '应为有效 SVG' },
      { kind: 'content_match', pattern: '*.svg', contains: 'viewBox', note: 'SVG 应有画布尺寸' },
      { kind: 'content_absent', pattern: '*.svg', mustNotContain: 'Ming', note: '绝无工具痕迹/水印' },
    ],
    qualityBar: {
      bar: '这一轮就交付「能直接发布的低密度信息图组」：公众号封面 + 小红书/抖音竖卡，品牌化、零工具痕迹',
      checks: [
        '低密度：每张图一个信息点（大标题 ≤12 字 + 一句副标 + 至多 3 个标签），绝无段落文字',
        '多平台尺寸：公众号封面 900×383（2.35:1）；小红书 1080×1440（3:4）；抖音 1080×1920（9:16）',
        '版式有设计感：边距 ≥ 8% 画布宽、层级「品牌→标题→副标→标签」清晰、对齐全卡统一、间距成梯队',
        '色彩克制：1 主色 + 1 强调色 + 中性色，渐变只从主色衍生，文字对比 ≥ 4.5:1',
        '品牌化：出现用户品牌（如 FamilySpace / 家明），绝无 Ming/插件/模型水印或「由XX生成」字样',
        '移动端可读：标题 ≥ 72px（1080 宽）、手机竖屏一眼看懂',
      ],
      selfCheck: [
        '缩成手机屏幕大小，标题一眼能看清、没有小字堆叠吗',
        '有没有「由XX生成」这类工具水印或任何工具痕迹（绝不能有）',
        '每张图是不是只讲一个要点、内容密度会不会太高',
        '有没有 emoji、花哨渐变、多重阴影、五颜六色（有就删）',
      ],
    },
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
        source: 'dsh-univer-office',
        purpose: '生成 .pptx（dsh-univer-office：表格/文档/演示/数据库，装后可产出 .pptx）',
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
    qualityBar: {
      bar: '这一轮就交付「打开就能讲的幻灯片」，不是要点清单',
      checks: [
        '一页一主题：每页只讲一件事，标题即结论，正文是支撑不是重复',
        '结论先行：开场页直接给「这次讲什么、结论是什么」，不从背景铺垫',
        '排版有层次：标题/要点/图示三级清晰，留白充足，动画克制但存在（翻页过渡/要点渐显）',
        '不依赖外部图片；投影与手机都能看清',
      ],
      selfCheck: [
        '每页能否不看稿讲满 30 秒',
        '连起来翻一遍是否通顺、有没有跳步',
        '站在会议室后排能否看清字',
      ],
    },
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
    qualityBar: {
      bar: '发布出去的站点第一眼就要「拿得出手」，不是半成品',
      checks: [
        '站点内容完整：首页 + 必要内页齐全，文案真实通顺，没有占位残留',
        '页面有设计感：统一的配色与排版，不是默认样式',
        '资源路径正确：css/js/图片用相对路径引用，打开无破图无死链',
      ],
      selfCheck: [
        '用浏览器打开首页，第一眼是否有设计感',
        '所有链接/资源是否都能加载',
        '是否可以直接发给别人看',
      ],
    },
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
            source: 'sealos-skills',
            purpose: '把静态网站发布到公开地址（sealos-skills：一条命令部署+数据库+对象存储）',
            trust: 'community',
          },
        ],
        verification: [
          { kind: 'file_exists', pattern: '*.html', note: '发布内容应包含 HTML 页面' },
        ],
        pitfalls: [
          { symptom: '没有发布/部署能力（未装配 publish_deploy）', fix: '中间件已自动去市场找最好的（sealos-skills：部署+数据库+存储）并建议装配；装好重启后从发布步继续' },
          { symptom: '发布后链接打不开', fix: '检查是否真的上传了 index.html；免费托管首次生效可能需等 1~2 分钟' },
        ],
      },
    ],
  },
  {
    id: 'big-project',
    name: '开发/维护项目（从 0 或已有代码）',
    description: '大型/复杂项目的全流程助手：从 0 开发（骨架先行、分模块交付）或已有项目（修 bug / 加功能 / 迷茫给建议），先看懂现状再动手，交付可运行、验证过的结果',
    triggers: [
      // 从 0 开发
      '大型项目', '复杂项目', '开发项目', '做项目', '开发一个',
      '做一个应用', '做个应用', '做一个系统', '做个系统', '做一个工具', '做个工具', '写一个程序',
      '全栈', '后台', '管理系统', 'web应用', '小程序', '爬虫', '自动化', '机器人',
      '系统', '应用', '工具', '数据库', '注册', '登录', '账号', 'api', '接口', '服务端',
      // 存量项目：修 bug / 加功能 / 迷茫
      '修 bug', '修个 bug', '改 bug', '有 bug', '出 bug', '报错', '崩溃', '坏了', '不工作', '没反应',
      '加个功能', '加功能', '实现功能', '实现一个功能', '加一个功能', '新功能', '做个功能', '优化一下', '重构',
      '我的项目', '这个项目', '那个项目', '已有项目', '现有项目', '接手', '别人写的', '克隆', 'clone', '代码库', '源码',
      '看不懂', '不知道下一步', '接下来做什么', '不知道做什么', '迷茫', '看看这个项目', '分析一下这个项目', '项目是干嘛的', '怎么运行的',
    ],
    guidance: [
      '现状自适应：先探测目标是「空目录/新项目」还是「已有代码」。从 0 → 骨架先行分模块；已有 → 先看懂再最小改动，不瞎改',
      '技术栈自选成熟默认：纯展示 → 静态 HTML/CSS/JS；带数据/登录/后台 → 轻量后端（Node/Express 或 Python）+ SQLite 本地库；工具/自动化 → 对应语言命令行脚本。能用标准库就不引依赖，不追重型框架',
      '存量项目：改前先看相关代码，说清「问题在哪/要改哪、怎么改」；最小改动，不顺手重构无关代码；真实代码不占位，没做的如实标注',
      '用户迷茫/看不懂/不知道下一步：产出「项目地图 + 下一步建议清单」（3~5 条按价值/风险排序），等用户选一个再动手，不要自作主张大改',
      '素材获取：用户提到「我的项目/那个文件/文档」时，先用文件工具自己定位并读取（工作区、常见目录、给定路径），不要教用户找路径或复制粘贴；找不到时最多问一次大概位置',
      '能力动态补：探索时识别项目技术栈与用到的格式（Excel/图片/数据库/特定运行时）；环境缺而项目需要的能力，先用现有工具；明确做不了时用 ming_store_search 找最好的插件，确认后安装再继续，不跳过',
      '本地可运行优先：第一版保证能启动/打开且不报错；发布尽力而为，缺发布能力时如实说明上线路径，不阻塞交付',
    ],
    capabilities: [
      { kind: 'tool', id: 'fs_*', purpose: '读写项目文件与文档', trust: 'official' },
      {
        kind: 'tool',
        id: 'infra_ops',
        source: '@deepseek-ai/dsh-base',
        purpose: '数据库/SSH/SFTP/Docker 基础运维（DeepSeek 官方基础包，装后自动增强）',
        trust: 'official',
        optional: true,
      },
      {
        kind: 'tool',
        id: 'db_ops',
        source: 'dsh-data-agent',
        purpose: '连数据库写 SQL（dsh-data-agent，让 AI 连库写 SQL）',
        trust: 'community',
        optional: true,
      },
      {
        kind: 'tool',
        id: 'knowledge_rag',
        source: 'dsh-weknora',
        purpose: '知识库/RAG（腾讯 dsh-weknora：原始文档→可查询 RAG + 自维护 Wiki）',
        trust: 'community',
        optional: true,
      },
      {
        kind: 'skill',
        id: 'frontend_design',
        source: 'superdesign-skill',
        purpose: '前端设计质量（superdesign-skill：把 AI 生成的界面变成精致、可发布的前端）',
        trust: 'community',
        optional: true,
      },
    ],
    delegate: { provider: 'spawn' },
    questions: [
      {
        key: 'task',
        question: '这个项目是已经有的，还是要从 0 开始做？',
        default: '不确定，你看下现状定',
        options: ['从 0 开始做新的', '已经有一个项目（修 bug / 加功能）', '说不清，你看看我的项目'],
        translate: '用户说「已有的/别人写的/克隆的/下载的」→ 存量模式（先探索再改）；' +
          '「新的/从零/还没有」→ 从 0 模式（先设计再搭骨架）；「说不清/你看着办」→ 先探测现状，按探测结果分流。',
      },
      {
        key: 'purpose',
        question: '这个项目主要给谁用、是干什么的？',
        default: '个人用的工具/应用',
        options: ['个人用的工具/脚本', '带数据的应用（记账/管理后台）', '给别人用的网站/应用', '自动化/爬虫类'],
        translate: '用户说「记账/管理/后台/存数据」→ 轻量后端 + SQLite，能增删改查；' +
          '「工具/脚本/帮我干活的」→ 命令行工具（输入→处理→输出）；「给别人用/产品」→ 完整可运行 + 使用说明；' +
          '「自动抓/爬/批量」→ 自动化脚本（可配置输入输出）。',
      },
      {
        key: 'scope',
        question: '这次做到什么程度？',
        default: '可运行的核心版本（骨架 + 核心功能走通）',
        options: ['核心版本先跑通', '完整功能全部实现', '先只搭骨架看结构'],
        translate: '用户说「先看看/先弄一版/先跑通」→ 核心版本（骨架 + 最关键的一条功能路径走通）；' +
          '「全部/完整/正式」→ 完整功能；「结构/框架/先规划」→ 只搭骨架 + 模块清单，不实现细节。',
      },
      {
        key: 'publish',
        question: '要不要发布上线让别人访问？',
        default: '先本地可运行，上线以后再说',
        options: ['先本地可运行', '要发布到公开地址'],
        translate: '用户说「上线/发布/给别人用」→ 走发布步（需发布能力，缺失时如实说明并引导）；' +
          '默认 → 本地可运行，README 写清本地打开方式。',
      },
    ],
    verification: [
      { kind: 'file_exists', pattern: 'PROJECT.md', note: '项目应有项目地图文档' },
      { kind: 'content_match', pattern: 'PROJECT.md', contains: '运行', note: '项目地图应写清怎么运行' },
      { kind: 'content_absent', pattern: '*.md', mustNotContain: 'Lorem', note: '文档绝无占位文字' },
    ],
    qualityBar: {
      bar: '这一轮交付「能跑起来、改得对、验证过、说清改了什么」的项目结果：从 0 是可用骨架，存量是修好/加好且没弄坏',
      checks: [
        '从 0：可运行（按 README/PROJECT.md 能启动不报错）+ 结构清晰（入口/核心/数据/文档分层）+ 核心路径走通',
        '存量：先看懂再改——改前说清「问题在哪/要改哪」，最小改动，不顺手重构无关代码',
        '真实验证：按项目真实运行/测试方式验证过，确认没弄坏别处（回归）',
        '真实不占位：关键文件全是真代码真文案，没有 TODO/Lorem 冒充；没做的模块如实标注',
        '文档合格：PROJECT.md/README 写清「是什么、怎么跑、改了什么、怎么用、目录结构、下一步」',
        '发布尽力而为：能发布就给了公开地址；不能就如实说明上线路径',
      ],
      selfCheck: [
        '我按文档能复现启动/验证吗（命令是否写全）',
        '改前真的看懂那段代码了吗（不是盲改）',
        '有没有改坏别的地方（回归验证过了吗）',
        '有没有 TODO/Lorem 占位冒充已完成',
        '迷茫时有没有给用户可选清单，而不是自作主张大改',
      ],
    },
    workflow: [
      {
        id: 'orient',
        name: '现状探测与项目理解',
        goal: '先探测目标相关目录是「空目录/新项目」还是「已有代码」，然后产出一份《项目地图》文档 PROJECT.md：项目是什么、技术栈、目录结构、入口、怎么运行、当前状态、本次要做什么。',
        guidance: [
          '项目定位：先看工作区与常见目录（桌面/文档/下载）；用户给了路径或说了「我的项目」就自己去定位，找不到最多问一次大概位置',
          '技术栈识别：看 package.json / requirements.txt / *.py / *.js / tsconfig.json / pom.xml 等；列出本项目需要的运行时与格式（Excel/图片/数据库/特定语言）',
          '从 0 开发：PROJECT.md 写清技术选型、目录规划、模块清单（标核心模块），本次从搭骨架开始',
          '存量项目（修 bug/加功能）：PROJECT.md 写清任务定位——相关文件、根因分析、改动计划（最小改动）',
          '用户迷茫/看不懂/不知道下一步：PROJECT.md 加「下一步做什么」章节，给 3~5 条按价值排序的建议，等用户选择；不要改动任何代码',
          '能力清单（curated 已配好的增强工具）：数据库→dsh-data-agent；知识库/RAG→dsh-weknora（腾讯）；' +
            '基础运维→@deepseek-ai/dsh-base（官方，自动装）；前端设计→superdesign-skill。' +
            '第一版用 Harness 原生能力即可交付，这些工具是「装好重启后第二版升级」用的增强，不阻塞第一版；' +
            'curated 没有的缺口再去 ming_store_search 找最好的，确认后安装',
          '必须产出真实 PROJECT.md 文件并报告绝对路径，不许只给建议',
        ],
        verification: [
          { kind: 'file_exists', pattern: 'PROJECT.md', note: '应有项目地图 PROJECT.md' },
          { kind: 'content_match', pattern: 'PROJECT.md', contains: '运行', note: '项目地图应写清怎么运行' },
        ],
        pitfalls: [
          { symptom: '子代理只聊方案没产出文件', fix: '重试时明确要求：必须产出真实 PROJECT.md 文件并报告绝对路径' },
          { symptom: '找不到项目位置', fix: '先在工作区与常见目录（桌面/文档/下载）扫描，找不到最多问一次大概位置' },
        ],
        stopAfter: true,
      },
      {
        id: 'build',
        name: '动手实现',
        goal: '按 PROJECT.md 动手：从 0 开发 → 搭骨架（目录/入口/配置）并实现核心模块让核心路径走通；已有项目 → 修 bug / 实现功能，最小改动，不碰无关代码。',
        guidance: [
          '从 0：先骨架（入口/核心/数据/文档分层，每层至少一个真实文件）再核心模块，每实现一块就验证一次，不攒到最后',
          '存量：先看懂相关代码再改，改前说清「改哪里、怎么改」；最小改动，不顺手重构无关代码',
          '用户迷茫待选：若上一步产出的是「下一步建议清单」（用户还在选择中），本步不修改代码，把清单作为交付等用户选',
          '技术栈按项目类型自选成熟默认（纯展示→静态；带数据/登录→轻量后端+SQLite；工具/自动化→命令行）；第一版用原生能力交付，不必等插件',
          '真实代码不占位：关键文件都是能跑的真代码真文案，没有 TODO/Lorem 冒充；没做的模块如实标注',
          '装好的增强工具（数据库/知识库/前端设计）重启 DSH 后对第二版生效，在交付说明里预告升级点',
        ],
        verification: [
          { kind: 'dir_nonempty', pattern: '**/*', note: '实现应有真实文件' },
          // 方案级验收在工作流路径不执行，占位检查必须落在步骤级，否则文档占位会被放行
          { kind: 'content_absent', pattern: '*.md', mustNotContain: 'Lorem', note: '文档无占位文字' },
        ],
        pitfalls: [
          { symptom: '只写了函数没调用/没走通', fix: '重试时明确要求：核心路径必须演示走通（数据进→出/页面可交互）' },
          { symptom: '盲改存量代码', fix: '改前必须说清根因与落点，最小改动，改完验证不弄坏别处' },
          { symptom: '产出大量 TODO 占位', fix: '关键文件不能留 TODO 冒充完成，没做的如实说明' },
        ],
      },
      {
        id: 'verify',
        name: '运行验证',
        goal: '按项目运行方式真实跑一遍（启动/打开/测试），确认改好且没弄坏别处；把运行结果与复现步骤写进 PROJECT.md。',
        guidance: [
          '真实执行启动命令/测试或打开入口文件，把结果（成功/报错）写进 PROJECT.md 与交付说明',
          '运行不了的如实说明缺什么（缺运行时/缺依赖/缺数据），不假装能跑',
        ],
        verification: [
          { kind: 'file_exists', pattern: 'PROJECT.md', note: 'PROJECT.md 应记录验证结果' },
        ],
        pitfalls: [
          { symptom: '声称能跑但没验证', fix: '必须真实执行启动命令/测试，把输出写进交付说明' },
        ],
      },
      {
        id: 'deliver',
        name: '交付说明（尽量发布）',
        goal: '完善 PROJECT.md/README（是什么/怎么跑/改了什么/怎么用/下一步），产出交付总结；若用户要发布且环境有发布能力则发布并给出公开地址。',
        guidance: [
          '存量：写清「改了什么、为什么、怎么验证」；从 0：写清「怎么跑、怎么用、目录结构」',
          '发布能力缺失时不阻塞：本地已可运行即可交付，如实说明上线路径',
        ],
        capabilities: [
          {
            kind: 'tool',
            id: 'publish_deploy',
            source: 'sealos-skills',
            purpose: '把项目发布到公开地址（sealos-skills：一条命令部署+数据库+对象存储）',
            trust: 'community',
            // 可选：发布是「尽量」，缺了不阻塞交付——本地可运行即视为第一版交付。
            // 必选发布只在 publish-site（发布即目标）里声明，这里刻意给 optional。
            optional: true,
          },
        ],
        verification: [
          { kind: 'file_exists', pattern: 'PROJECT.md', note: '交付时应有一份完整项目文档' },
        ],
        pitfalls: [
          { symptom: '发布能力缺失（未装配 publish_deploy）', fix: '中间件已自动去市场找最好的（sealos-skills）并建议装配；装好重启后从交付步继续，本地已可运行不阻塞' },
          { symptom: '文档没写怎么跑', fix: '必须写清安装依赖与启动命令，别人照着能复现' },
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
