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
/** 工作流某一步常见的坑：用户「搞半天搞不定」的那些原因 + 修法 */
interface Pitfall {
    /** 失败时的常见现象（人话） */
    symptom: string;
    /** 对应的解决办法（人话） */
    fix: string;
}
/** 工作流里的一个步骤：独立委派一次子代理执行，做完独立验收 */
interface WorkflowStep {
    id: string;
    name: string;
    /** 本步要完成的事（给子代理的目标描述，会与用户原始目标合并） */
    goal: string;
    /** 本步的执行要求（人话，注入子代理 prompt） */
    guidance?: string[];
    /** 本步需要但可能未装配的能力（如发布步需要 publish_deploy） */
    capabilities?: CapabilityRef[];
    /** 本步完成后的验收断言（不过则停在本步） */
    verification?: VerificationCheck[];
    /** 本步常见坑与修法（失败时给用户的具体提示） */
    pitfalls?: Pitfall[];
}
/** 执行前需要向用户澄清的关键问题（只问必要的，其余用默认值） */
interface ClarifyQuestion {
    /** 答案在装配上下文里的键名（系统逻辑维度的标识） */
    key: string;
    /** 用大白话问用户（用户不懂技术，不要用术语） */
    question: string;
    /** 用户不回答时使用的默认值（保证 clarify-first 也能跑） */
    default: string;
    /** 给用户的可选答案（供快速选择，用户也可自由输入） */
    options?: string[];
    /** 翻译提示：用户类似的大白话回答应翻译成什么系统逻辑，帮主模型把「人话」变成执行要求 */
    translate?: string;
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
    /** 多步工作流（逐步执行、逐步验收；缺省为单步直接委派） */
    workflow?: WorkflowStep[];
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
    /** 多步工作流（方案声明时存在；单步方案为 undefined） */
    workflow?: WorkflowStep[];
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
 * 工作流执行器（痛点 1：复杂工作流容易掉坑，「搞半天搞不定」）
 *
 * 方案声明多步工作流时，Ming 逐步执行、逐步独立验收：
 *   1. 每步先探测本步所需能力（缺了就不白跑，直接引导装配）；
 *   2. 委派一次子代理完成本步（复用薄转发器的预检/超时/产物校验）；
 *   3. 本步验收断言不过就停在本步，失败原因附上方案预写的「坑位与修法」——
 *      用户不需要自己排查「为什么搞不定」，Ming 直接告诉他哪一步、常见原因、怎么办；
 *   4. 支持 workflowFrom：装完能力重启后从失败步继续，不重做前面已完成步骤。
 */

interface WorkflowStepResult {
    step: WorkflowStep;
    /** 本步执行产出；skipped 或 blockedBy 时为 undefined */
    outcome?: ExecutionOutcome;
    /** 本步验收结果（本步声明了验收断言时存在） */
    verification?: VerificationSummary;
    /** 因 workflowFrom 跳过（前面已完成，不重做） */
    skipped: boolean;
    /** 本步因缺能力未执行 */
    blockedBy?: CapabilityAvailability;
}
type WorkflowFailureKind = 'step-failed' | 'verification-failed' | 'capability-missing';
interface WorkflowResult {
    success: boolean;
    stepResults: WorkflowStepResult[];
    /** 失败步 id（成功时为空） */
    failedStepId?: string;
    failureKind?: WorkflowFailureKind;
    /** 失败步的坑位（用户「搞半天搞不定」的那些原因的修法） */
    pitfalls?: Pitfall[];
    summary: string;
    durationMs: number;
}
interface RunWorkflowOptions {
    /** 从某一步继续（跳过之前的步骤；用于装配能力重启后恢复） */
    workflowFrom?: string;
    /** 装配上下文（方案要求 + 用户确认的方向），注入每个步骤的子代理 prompt */
    baseContext?: string[];
}
declare function runWorkflow(ctx: Context, exec: any, goal: string, resources: string[], steps: WorkflowStep[], workdir: string, options?: RunWorkflowOptions): Promise<WorkflowResult>;
/** 汇总所有执行步的产出路径（供证据卡与汇报） */
declare function collectWorkflowArtifacts(result: WorkflowResult): string[];

/**
 * 结果收尾：针对性下一步建议 + 校验提醒拼接。
 *
 * 从 ming-auto 抽出的纯函数，便于单元测试与内部导出。
 */

/** 按失败原因给出可操作的下一步，而非千篇一律的套话 */
declare function nextStepsFor(outcome: ExecutionOutcome): string[];
/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
declare function workflowNextSteps(result: WorkflowResult, answers?: Record<string, string>): string[];
/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
declare function appendMissingNotice(outcome: ExecutionOutcome): string;

/**
 * Capability Assembler：把装配计划转成「可注入执行子代理的上下文」
 *
 * 第一刀只做两件事：
 *   1. 把命中方案的方法论（guidance）翻译成给执行子代理的人话要求；
 *   2. 诚实标注能力缺口——未装配的能力绝不假装已装配。
 * 真正「加载 skill / 激活 MCP / 安装插件」的动作留第二刀（走官方 API + dsh plugin 机制）。
 */

/** 装配计划转成追加到子代理 prompt 的上下文行；answers 为 clarify-first 收集的用户答案 */
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
/** 还没确认的决策点（主模型据此继续问用户） */
interface ClarifyMissing {
    key: string;
    question: string;
    default: string;
    options?: string[];
    translate?: string;
}
interface ClarifyStatus {
    /** 信息是否已够（所有决策点都有答案） */
    done: boolean;
    /** 已确认的答案（用户大白话 → 系统逻辑的翻译结果） */
    confirmed: Record<string, string>;
    /** 还没确认的决策点 */
    missing: ClarifyMissing[];
}
/**
 * 纯规则澄清引擎：缺什么就报告什么，信息够就 done。
 * 翻译（把用户的话变成系统逻辑）由主模型完成——它既看得见用户原话，也看得见翻译提示。
 * 主模型循环：问 missing 里的问题 → 翻译用户回答 → 再调用，直到 done → ming_auto 执行。
 */
declare function clarifyStatus(plan: Pick<CapabilityPlan, 'questions'>, answers: Record<string, string> | undefined): ClarifyStatus;
/** 把澄清状态格式化成给主模型/用户看的文本 */
declare function formatClarify(status: ClarifyStatus): string;

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
 * 能力推荐引擎（痛点 2：用户不知道需要什么，「眼花缭乱」）
 *
 * 不做「把一堆插件甩给用户」，而是按「用户的目标 + 已确认的方向」把候选排序，
 * 只推最相关的前几个，并给出「为什么配你」的人话理由。
 *
 * 排序信号（纯规则，零 LLM 消耗）：
 *   1. 需求关键词命中（query 分词，权重 2）——用户/主模型提炼的搜索词；
 *   2. 用户已确认方向命中（scenario 短语子串，权重 3）——clarify 收集的答案，
 *      如「作品集结构」「GitHub Pages」是最个性化的信号；
 *   3. 社区热度（stars / installCount 的对数信号，0.5/0.25）——只做弱加成，
 *      避免高星垃圾插件压过「真正配你」的。
 */
interface RecommendContext {
    /** 搜索关键词（主模型/用户提炼，如「网站 部署」「excel 报表」） */
    query: string;
    /** 缺口能力承担的角色（人话），如「把静态网站发布到公开地址」 */
    purpose?: string;
    /** 用户已确认的方向短语，如 ['作品集结构', 'GitHub Pages 免费静态托管'] */
    scenario?: string[];
}
interface ScoredCandidate<T> {
    candidate: T;
    score: number;
    /** 命中的查询词（用于理由） */
    queryHits: string[];
    /** 命中的场景短语（用于理由） */
    scenarioHits: string[];
}
/** 取文本里值得匹配的短词：按非字母数字切分，滤掉过短/纯数字 */
declare function tokensOf(text: string): string[];
/**
 * 给候选打分排序。textOf 返回候选的「可匹配文本」（如 name + 描述 + 分类）。
 */
declare function rankCandidates<T>(candidates: T[], ctx: RecommendContext, textOf: (c: T) => string, signalOf: (c: T) => {
    stars?: number;
    installCount?: number;
}): Array<ScoredCandidate<T>>;
/**
 * 生成「为什么配你」的人话理由：先讲与用户需求/方向的匹配，再补热度信号。
 */
declare function buildRecommendationReason(candidateText: string, ctx: RecommendContext, signals: {
    stars?: number;
    installCount?: number;
}, hits?: {
    queryHits?: string[];
    scenarioHits?: string[];
}): string;
/**
 * 从缺失能力推导市场搜索词（实测校准：1024Store 对「单个英文单词 / 单个中文词」
 * 命中率高，对长句子与多词短语基本返回 0）：
 *   1. 优先 purpose 里的英文关键词（excel / pdf / markdown / github 这类最易命中）；
 *   2. 其次能力 id 的下划线 token 里最具体的一个（publish_deploy → publish）；
 *   3. 再退到中文：剥句首虚词后取前 2~4 字；
 *   4. 兜底能力 id。
 */
declare function suggestQueryFor(purpose: string | undefined, id: string): string;

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

/**
 * 能力安装服务（闭环装配的「装 + 验」）
 *
 * 负责把用户在 1024Store 选中的插件真正装进 DSH profile，并核对安装结果。
 * 定位 dsh 命令时优先复用宿主进程自身安装位置（profiles/node_modules），
 * 找不到时回退 PATH 里的 `dsh`；再不行就如实报「请手动执行」，绝不假装装上了。
 *
 * 安全红线：
 *   - 只执行「dsh plugin ... add <source>」形态的命令（parseInstallCommand 校验）；
 *   - 绝不把 1024Store 返回的原始命令字符串直接交给 shell——解析后用自己的参数重建；
 *   - 安装永远由用户选定后才触发（ming_install 的 install 模式）。
 */

/** 解析后的安装命令：源 + 可选 profile */
interface ParsedInstallCommand {
    /** 要安装的插件源（如 dsh-excel-tools / github:owner/repo） */
    source: string;
    /** 命令里声明的 profile（我们安装时以当前 profile 为准，此处仅记录） */
    profile?: string;
}
/**
 * 解析 1024Store 返回的安装命令（形如 `dsh plugin --profile web add dsh-excel-tools`）。
 * 只接受「dsh 开头 + plugin 子命令 + add」的形态，其余一律拒绝，避免把任意文本变成命令。
 */
declare function parseInstallCommand(install: string): ParsedInstallCommand;
/**
 * 构建安装子进程参数。
 * dshBin 为 null 表示直接用 PATH 里的 `dsh` 可执行文件。
 */
declare function buildInstallArgs(source: string, profile: string, dshBin: string | null): string[];
/**
 * 组装可 spawn 的参数与展示命令。
 * dshBin 是 bin.js 脚本时，Windows 上必须用 `node <bin.js>` 启动（直接 spawn 脚本会 EFTYPE），
 * 所以返回的 args 不含 bin.js，由调用方用 node 作为解释器执行。
 */
declare function buildInstallCommand(source: string, profile: string, dshBin: string | null): {
    args: string[];
    command: string;
};
/** 候选 dsh bin.js 路径（fromDir = 本模块所在目录，构建后为 dist/services） */
declare function dshBinCandidates(fromDir: string): string[];
/** DSH 数据目录：DSH_HOME 环境变量优先，默认 ~/.dsh */
declare function resolveDshHome(): string;
/** 候选 profile 目录名（第一刀只扫官方布局 profiles/） */
declare function profileDirsOf(home: string): string[];
/**
 * 推荐理由（纯规则）：候选与搜索词的相关性说明 + 星标，供主模型转述给用户。
 * 让用户看到的不是「有一堆插件」，而是「为什么这个配我」。
 */
declare function matchReason(plugin: Pick<StorePlugin, 'name' | 'description' | 'category'> & {
    stars?: number;
}, query: string): string;
/** 解析当前 profile 名：DSH_PROFILE → 扫 profiles 找含本插件的 profile → 默认 ming */
declare function resolveProfileName(): Promise<string>;
/** 安装结果核对：profile package.json 或 profiles/node_modules 里是否已有该插件 */
interface InstallCheckResult {
    confirmed: boolean;
    detail: string;
}
declare function checkInstalled(source: string): Promise<InstallCheckResult>;
/** 一次安装子进程的执行记录 */
interface InstallExecution {
    ok: boolean;
    exitCode: number | null;
    output: string;
    /** 实际使用的 dsh（null = PATH 里的 dsh） */
    bin: string | null;
    profile: string;
    /** 展示给用户的完整命令 */
    command: string;
}
/** 执行 `dsh plugin add <source>`（带超时，捕获输出，不抛异常） */
declare function runDshInstall(source: string, opts?: {
    timeoutMs?: number;
}): Promise<InstallExecution>;
/** 装配编排：安装 → 核对 → 下一步建议 */
interface InstallOutcome {
    ok: boolean;
    installed: boolean;
    /** 是否在 profile 层面确认写入（重启前可验证的事实） */
    confirmed: boolean;
    detail: string;
    output: string;
    command: string;
    profile: string;
    nextSteps: string[];
}
declare function installCapability(source: string): Promise<InstallOutcome>;

export { type ArtifactCheck, type CapabilityAvailability, type CapabilityKind, type CapabilityPlan, type CapabilityRef, type ClarifyQuestion, type ErrorKind, type ExecutionOutcome, type HistoryEntry, type HistoryResult, type InstallCheckResult, type InstallExecution, type InstallOutcome, type MingResult, type ParsedInstallCommand, type Pitfall, RECIPES, type Recipe, type RecommendContext, STRATEGY_OPTIONS, type ScoredCandidate, type StorePlugin, type StoreSearchOptions, type StoreSearchResult, type StrategyKind, type StrategyOption, type VerificationCheck, type VerificationResult, type VerificationSummary, type WorkflowFailureKind, type WorkflowResult, type WorkflowStep, type WorkflowStepResult, appendMissingNotice, assembleContext, buildInstallArgs, buildInstallCommand, buildRecommendationReason, checkInstalled, clarifyStatus, collectWorkflowArtifacts, dshBinCandidates, extractArtifacts, findRecipesByGoal, formatClarify, formatStoreResult, formatStrategyOptions, formatVerification, getRecipe, installCapability, kindFromStopReason, looksLikeLocalPath, matchReason, matchesSimplePatternForTest, nextStepsFor, parseInstallCommand, planExecution, profileDirsOf, rankCandidates, recipeCatalog, resolveAnswers, resolveCapabilities, resolveDshHome, resolveProfileName, resolveTimeoutMs, resolveWorkdir, runDshInstall, runWorkflow, searchStorePlugins, stopReasonText, suggestQueryFor, tokensOf, verifyChecks, workflowNextSteps };
