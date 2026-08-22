import { Context } from '@deepseek-ai/cordis';

/**
 * 类型定义
 *
 * Ming Capability Pack v0.5：薄适配层。
 * 意图理解、步骤规划、任务执行全部交给 Harness 原生 Agent（子代理 + LLM），
 * Ming 只负责「一键把自然语言转交给原生能力」并收集结果与证据。
 */
/** 单个产物的本地校验结果 */
interface ArtifactCheck {
    /** 从汇报文本中提取的原始字符串 */
    raw: string;
    /**
     * file = 本地路径确认存在；
     * url  = 链接，不做本地校验；
     * missing = 声称产出但本地未找到（需警惕）
     */
    kind: 'file' | 'url' | 'missing';
    /** 文件大小（字节），仅 file 时存在 */
    bytes?: number;
    /** 最后修改时间（ISO 8601），仅 file 时存在 */
    modifiedAt?: string;
}
/** 失败原因分类（驱动针对性 nextSteps 与证据卡归因） */
type ErrorKind = 'engine-unavailable' | 'resource-missing' | 'timeout' | 'aborted' | 'max-tokens' | 'refusal' | 'error';
/** 一次执行的产出 */
interface ExecutionOutcome {
    /** executed = 原生 Agent 已真正执行；planned = 引擎不可用时的降级 */
    mode: 'executed' | 'planned';
    success: boolean;
    /** 给用户看的结果摘要 */
    summary: string;
    /** 产出的文件/链接（绝对路径或 URL，来自子代理汇报） */
    artifacts: string[];
    /** 对 artifacts 的逐项本地校验（尽力而为） */
    artifactChecks?: ArtifactCheck[];
    error?: string;
    errorKind?: ErrorKind;
    /** 执行元信息（随证据卡落盘） */
    durationMs?: number;
    provider?: string;
    stopReason?: string;
}
/** ming_auto 工具返回给模型的规范值 */
interface MingResult {
    success: boolean;
    mode: 'executed' | 'planned';
    summary: string;
    artifacts: string[];
    /** 证据卡文件路径 */
    evidence: string;
    nextSteps: string[];
    /** 命中的方案名（未命中任何方案时为空字符串） */
    recipe: string;
    /** 装配计划摘要（命中了什么能力、有无缺口） */
    planSummary: string;
    /** 独立验证摘要（文件存在/内容匹配等断言结果） */
    verificationSummary: string;
}
/** ming_history 单条历史记录 */
interface HistoryEntry {
    id: string;
    timestamp: string;
    goal: string;
    success: boolean;
    mode: string;
    /** 声称的产物数 */
    artifactsCount: number;
    /** 校验未通过（本地不存在）的产物数 */
    missingCount: number;
    /** 失败原因分类；成功时为空字符串；durationMs < 0 表示未知 */
    errorKind: string;
    durationMs: number;
    evidencePath: string;
}
/** ming_history 工具返回给模型的规范值 */
interface HistoryResult {
    success: boolean;
    total: number;
    returned: number;
    entries: HistoryEntry[];
}

/**
 * 执行引擎（薄转发器）
 *
 * 不重复造轮子：不自己写「意图分析 / 步骤规划 / 能力匹配」。
 * 用户用自然语言描述目标后，直接交给 Harness 原生的子代理 seam
 * （ctx.subagents）去完成——子代理自带 LLM 与工具，能自己理解、规划、执行。
 *
 * 在「转交」之外补三件可靠性小事：
 *   1. 资源预检：resources 里的本地路径先验证存在性，避免浪费一整轮执行；
 *   2. 执行超时：默认 15 分钟（MING_TIMEOUT_MS 可调），超时中止并如实上报；
 *   3. 产物校验：对汇报中的本地路径逐一 stat，把「声称产出」变成「确认存在」。
 *
 * 子代理不可用时，降级为「计划模式」：把目标原样交回当前助手完成。
 */

declare function resolveTimeoutMs(): number;
/** 只有「长得像路径」的资源才做存在性检查；普通描述性文字跳过 */
declare function looksLikeLocalPath(text: string): boolean;
declare function resolveWorkdir(exec: any): string;
/** 从汇报文本里提取产物路径/URL（尽力而为） */
declare function extractArtifacts(text: string): string[];
declare function kindFromStopReason(stopReason: string): ErrorKind;
declare function stopReasonText(stopReason: string): string;

/**
 * 结果收尾：针对性下一步建议 + 校验提醒拼接。
 *
 * 从 ming-auto 抽出的纯函数，便于单元测试与内部导出。
 */

/** 按失败原因给出可操作的下一步，而非千篇一律的套话 */
declare function nextStepsFor(outcome: ExecutionOutcome): string[];
/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
declare function appendMissingNotice(outcome: ExecutionOutcome): string;

/**
 * 能力织机（Ming Fabric）核心类型
 *
 * 用户目标 → Recipe（方案包）→ CapabilityPlan（装配计划）→ 装配 → 执行 → 验证 → 证据。
 *
 * Recipe 是「Ming 提前策展的能力组合」（含社区插件 / skill / MCP / 官方工具），
 * CapabilityPlan 是 Resolver 针对当前目标输出的可执行计划。
 * 实现形态（skill / MCP / plugin / tool）不是用户概念，用户只描述「想让什么变成真的」。
 */
/** 单个能力的实现形态 */
type CapabilityKind = 'skill' | 'mcp' | 'tool' | 'plugin' | 'preset';
interface CapabilityRef {
    kind: CapabilityKind;
    /** 能力标识：skill / mcp / tool / plugin 的名字；preset 为预设名 */
    id: string;
    /** 来源（社区插件时给出 npm 包名或 GitHub 仓库，用于安装指引） */
    source?: string;
    /** 在方案中承担的角色（人话） */
    purpose: string;
    /** 信任等级：bundled=本包自带；official=DeepSeek 官方；community=社区维护 */
    trust: 'bundled' | 'official' | 'community';
    /** 可选能力缺失不阻断闭环 */
    optional?: boolean;
}
/** 验收断言：把「人想要的」转成可独立检查的事实 */
type VerificationCheck = {
    kind: 'file_exists';
    pattern: string;
    note?: string;
} | {
    kind: 'content_match';
    pattern: string;
    contains: string;
    note?: string;
} | {
    kind: 'dir_nonempty';
    pattern: string;
    note?: string;
};
/** 执行前需要向用户澄清的关键问题（只问必要的，其余用默认值） */
interface ClarifyQuestion {
    /** 答案在装配上下文里的键名 */
    key: string;
    question: string;
    /** 用户不回答时使用的默认值（保证 clarify-first 也能跑） */
    default: string;
    /** 给用户的可选答案（供快速选择，用户也可自由输入） */
    options?: string[];
}
/** 执行策略：不同策略走不同的中间件调用链 */
type StrategyKind = 'mvp-first' | 'clarify-first';
interface StrategyOption {
    id: StrategyKind;
    label: string;
    description: string;
    recommended?: boolean;
}
/** 方案包（Recipe）：Ming 提前策展的能力组合 */
interface Recipe {
    id: string;
    name: string;
    description: string;
    /** 规则过滤触发词：目标里命中任一即进入候选 */
    triggers: string[];
    /** 命中后给执行子代理的额外上下文（人话，说明怎么做 / 用什么） */
    guidance: string[];
    capabilities: CapabilityRef[];
    /** 委派偏好 */
    delegate?: {
        provider: 'spawn' | 'fork';
    };
    /** 验收断言：执行结束后独立检查 */
    verification: VerificationCheck[];
    /** 执行前可能需要澄清的关键问题（默认值兜底；策略 mvp-first 时跳过） */
    questions?: ClarifyQuestion[];
}
/** 能力可用性探测结果 */
interface CapabilityAvailability {
    ref: CapabilityRef;
    available: boolean;
    /** 不可用时的安装指引 */
    installHint?: string;
}
/** Resolver 输出：装配计划 */
interface CapabilityPlan {
    goal: string;
    /** 命中的方案 id；未命中为 null（退回通用委派） */
    recipeId: string | null;
    recipeName: string | null;
    /** 命中原因：显式指定 / 规则触发词 / 未命中 */
    matchedBy: string;
    capabilities: CapabilityAvailability[];
    /** 给执行子代理的额外上下文 */
    guidance: string[];
    delegate?: {
        provider: 'spawn' | 'fork';
    };
    verification: VerificationCheck[];
    /** 是否可执行：false 时至少一个必选能力缺失 */
    executable: boolean;
    /** 缺失的必选能力（可执行时为 []） */
    missingRequired: string[];
    /** 方案声明的澄清问题（供 clarify-first 策略用；未命中方案为空） */
    questions?: ClarifyQuestion[];
}
/** 单个断言结果 */
interface VerificationResult {
    check: VerificationCheck;
    passed: boolean;
    /** 人类可读的证据细节（匹配到哪些文件 / 为什么失败） */
    detail: string;
}
interface VerificationSummary {
    passed: number;
    failed: number;
    results: VerificationResult[];
}

/**
 * Capability Assembler：把装配计划转成「可注入执行子代理的上下文」
 *
 * 第一刀只做两件事：
 *   1. 把命中方案的方法论（guidance）翻译成给执行子代理的人话要求；
 *   2. 诚实标注能力缺口——未装配的能力绝不假装已装配。
 * 真正「加载 skill / 激活 MCP / 安装插件」的动作留第二刀（走官方 API + dsh plugin 机制）。
 */

/** 把装配计划转成追加到子代理 prompt 的上下文行；answers 为 clarify-first 收集的用户答案 */
declare function assembleContext(plan: CapabilityPlan, answers?: Record<string, string>): string[];

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

interface ResolveInput {
    goal: string;
    /** 模型显式指定的方案 id（通过 ming_catalog 得知） */
    recipeId?: string;
}
declare function resolveCapabilities(ctx: Context, input: ResolveInput): Promise<CapabilityPlan>;

/**
 * Execution Planner：目标 → 策略选项 + 澄清问题
 *
 * 产品交互：用户只说「想让什么变成真的」，Ming 不连环追问，
 * 而是先给「怎么做的选择」，让用户挑一个方向再往下走。
 * 不同策略对应不同的中间件调用链：
 *   - mvp-first（推荐）：用默认值直接跑出能看的 MVP，看完再迭代（快链）；
 *   - clarify-first：先问方案声明的关键问题（只问必要的），按用户答案精确装配再跑（核对链）。
 * 两条链都汇入 ming_auto 执行，区别只在「装配上下文是否注入用户答案」。
 */

/**
 * 把方案声明的澄清问题解析成「注入执行子代理的方向」：
 * mvp-first 直接用默认值；clarify-first 优先用户答案、缺省回落到默认值。
 * 保证两条链都能跑，且「不问也能做、问了更贴合」。
 */
declare function resolveAnswers(plan: Pick<CapabilityPlan, 'questions'>, strategy: string | undefined, answers: Record<string, string> | undefined): Record<string, string> | undefined;
/** 恒有两个策略：先给选择，不做自由发挥 */
declare const STRATEGY_OPTIONS: StrategyOption[];
interface ExecutionPlan {
    plan: CapabilityPlan;
    strategyOptions: StrategyOption[];
    /** 方案声明的澄清问题（clarify-first 时用；未命中方案时为空数组） */
    questions: ClarifyQuestion[];
}
interface PlanInput {
    goal: string;
    recipeId?: string;
}
declare function planExecution(ctx: Context, input: PlanInput): Promise<ExecutionPlan>;
/** 把策略选项格式化成给主模型/用户看的文本 */
declare function formatStrategyOptions(options: StrategyOption[]): string;

/**
 * 内置方案包（Recipe）目录
 *
 * Ming 提前策展的能力组合：用户目标命中触发词后，由 Resolver 选出一套方案，
 * 装配其声明的能力并委派执行。方案里的能力可以是官方工具、官方 skill，
 * 也可以是社区插件（source 给出安装来源）。第一刀以官方基础能力为主，
 * 社区插件装配作为第二刀（探测 + 安装指引已就位）。
 */

declare const RECIPES: Recipe[];
/** 按目标文本做规则过滤：返回命中的方案与命中触发词 */
declare function findRecipesByGoal(goal: string): Array<{
    recipe: Recipe;
    hits: string[];
}>;
declare function getRecipe(id: string): Recipe | undefined;
/** 目录清单（供 ming_catalog 只读工具展示） */
declare function recipeCatalog(): Array<Pick<Recipe, 'id' | 'name' | 'description' | 'triggers'>>;

/**
 * Capability Verifier：验收断言 → 独立回读现实
 *
 * 把方案声明的验收断言（文件存在 / 内容匹配 / 目录非空）转成可独立检查的事实，
 * 不依赖「子代理说自己完成了」——完成与否由磁盘事实决定。
 */

declare function verifyChecks(checks: VerificationCheck[], workdir: string, signal?: AbortSignal): Promise<VerificationSummary>;
/** 人类可读的验证摘要（追加到结果里给人/模型看） */
declare function formatVerification(summary: VerificationSummary): string;
/** 供测试：判断单文件是否匹配简单 glob */
declare function matchesSimplePatternForTest(relPath: string, base: string): boolean;

/**
 * DSH 1024Store 客户端 —— 能力目录的外部事实源
 *
 * 1024Store（https://api.deepseek1024.com）是 DeepSeek Harness 社区插件的公开目录：
 * 匿名即可搜索，GitHub 登录后创建 API Key 可获得更高配额。
 * 本模块负责把「Recipe 声明的能力缺口」翻译成「市场上真实存在、可安装的插件」，
 * 返回官方的 `dsh plugin add` 安装命令，交给用户/主模型决策。
 *
 * 约定：key 绝不硬编码，从环境变量 MING_STORE_KEY 读取（可选，匿名可用）。
 * 网络失败时优雅降级（ok:false + 人类可读原因），不影响主流程。
 */
interface StorePlugin {
    id: string;
    name: string;
    owner: string;
    url: string;
    category: string;
    description: {
        en?: string;
        zh?: string;
    };
    stars: number;
    installCount: number;
    growth24h: number;
    added: string;
    pushedAt: string;
    install: string;
}
interface StoreSearchOptions {
    /** 返回数量，默认 5，最大 10 */
    limit?: number;
    /** 排序：stars（默认）/ growth24h（近 24h 热度）/ added（新近加入） */
    sortBy?: 'stars' | 'growth24h' | 'added';
    /** 显式 key；缺省读环境变量 MING_STORE_KEY */
    key?: string;
    /** 请求超时毫秒，默认 8000 */
    timeoutMs?: number;
}
interface StoreSearchResult {
    ok: boolean;
    query: string;
    total?: number;
    plugins: StorePlugin[];
    /** 失败时的人类可读原因（如网络不可达、限流） */
    error?: string;
}
declare function searchStorePlugins(query: string, opts?: StoreSearchOptions): Promise<StoreSearchResult>;
/** 把搜索结果格式化成给主模型的紧凑文本（含安装命令） */
declare function formatStoreResult(result: StoreSearchResult, max?: number): string;

export { type ArtifactCheck, type CapabilityAvailability, type CapabilityKind, type CapabilityPlan, type CapabilityRef, type ClarifyQuestion, type ErrorKind, type ExecutionOutcome, type HistoryEntry, type HistoryResult, type MingResult, RECIPES, type Recipe, STRATEGY_OPTIONS, type StorePlugin, type StoreSearchOptions, type StoreSearchResult, type StrategyKind, type StrategyOption, type VerificationCheck, type VerificationResult, type VerificationSummary, appendMissingNotice, assembleContext, extractArtifacts, findRecipesByGoal, formatStoreResult, formatStrategyOptions, formatVerification, getRecipe, kindFromStopReason, looksLikeLocalPath, matchesSimplePatternForTest, nextStepsFor, planExecution, recipeCatalog, resolveAnswers, resolveCapabilities, resolveTimeoutMs, resolveWorkdir, searchStorePlugins, stopReasonText, verifyChecks };
