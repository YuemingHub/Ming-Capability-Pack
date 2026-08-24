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
    /** 验收健康度（该方案累计通过率，让用户看到信任层的累积数据） */
    acceptanceHealth: string;
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
    kind: 'content_absent';
    pattern: string;
    mustNotContain: string;
    note?: string;
} | {
    kind: 'dir_nonempty';
    pattern: string;
    note?: string;
} | {
    /** 真实浏览器验收（对接 dsh-verify：JSON spec → 真实 Chromium → PASS/FAIL）。
     *  spec 为 dsh-verify 规格 JSON 的文件路径（相对工作区）或 URL。
     *  可选增强：本机未装配 dsh-verify 时该断言如实标记 skipped（不谎报通过、也不阻塞交付）。 */
    kind: 'browser_acceptance';
    spec: string;
    note?: string;
};
/**
 * 质量门槛：Ming 替用户定义「什么算好」。
 *
 * 模型变强后「怎么做到」越来越便宜，产品的价值上移到「做到什么、什么算好」。
 * qualityBar 就是每个领域的「好」：第一轮交付就要达到，不是「先出个简单的再迭代」。
 * 与 verification（硬验收：文件存在/内容匹配）不同，qualityBar 是主观质量标准，
 * 靠子代理执行时对照自查，产出「拿得出手」而非「能跑就行」。
 */
interface QualityBar {
    /** 一句话定位：第一轮交付是什么水平（注入子代理 prompt，直接决定产出预期） */
    bar: string;
    /** 具体可检查的质量要求（视觉/内容/交互/适配等，逐条注入） */
    checks: string[];
    /** 交付前必须自查的清单（子代理执行完逐条自查，全过再汇报完成） */
    selfCheck: string[];
}
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
    /**
     * 本步验收通过后暂停工作流，等待用户确认/选择后再继续。
     * 用于「动用户代码前先交底」「迷茫时给出建议清单等用户选」这类产品决策确认点；
     * 用户对 Ming 说「继续」后，以 workflowFrom=本步 id 从下一步接着做。
     */
    stopAfter?: boolean;
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
    /** 第一轮交付的质量门槛（Ming 替用户定义「什么算好」，注入子代理 prompt） */
    qualityBar?: QualityBar;
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
    /** 方案声明的第一轮交付质量门槛（未命中方案为 undefined） */
    qualityBar?: QualityBar;
}
/** 单个断言结果 */
interface VerificationResult {
    check: VerificationCheck;
    passed: boolean;
    /** 人类可读的证据细节（匹配到哪些文件 / 为什么失败） */
    detail: string;
    /** 是否跳过（如实标记：断言所依赖的外部能力未装配，如 dsh-verify；跳过不算失败，也不谎报通过） */
    skipped?: boolean;
}
interface VerificationSummary {
    passed: number;
    failed: number;
    /** 跳过的断言数（未执行的外部依赖验收，如浏览器验收缺 dsh-verify；不计入 pass/fail） */
    skipped: number;
    results: VerificationResult[];
}

/**
 * DSH 插件市场客户端 —— 能力目录的外部事实源
 *
 * 两个真实市场：
 *   1. DSH Marketplace（https://dshmarketplace.dev）——4,907+ 插件的公开 JSON API，
 *      无 key、无限流、CORS 全开，每条带中英文摘要与解析好的安装命令。
 *      默认市场（兜底搜索用）。
 *   2. 1024Store（https://api.deepseek1024.com）——DeepSeek Harness 社区插件的
 *      公开目录，匿名可用但有限流；保留为 fallback。
 *
 * 本模块负责把「Recipe 声明的能力缺口」翻译成「市场上真实存在、可安装的插件」，
 * 返回官方的 `dsh plugin add` 安装命令，交给用户/主模型决策。
 *
 * Marketplace 的 install 字段约定（重要）：
 *   - install 可为 null（monorepo 子目录 / 未发包的插件装不上），绝不用占位串；
 *     installable 布尔值说的是同一件事。本层只保留「installable && install」的候选，
 *     绝不给调用方一条跑不通的命令。
 *   - install 形如 github:owner/repo#packages/x 时也是装不上的（pnpm 把 # 当 git ref），
 *     由 dispatch 层的 isRunnableInstall 兜底过滤。
 *   - 返回的命令都带 --profile web；本层在 buildInstallCommand 里按当前 profile 重写。
 *
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
/** Marketplace /api/v1/plugins 的原始条目 */
interface MarketplacePlugin {
    fullName: string;
    name: string;
    owner: string;
    repo: string;
    subpath?: string;
    summary?: string;
    summaryZh?: string;
    category?: string;
    language?: string;
    license?: string;
    stars: number;
    pushedAt?: string;
    repoUrl?: string;
    npmPackage?: string | null;
    installKind?: string;
    /** 唯一可信的安装命令；monorepo 子目录 / 未发包时为 null（不是占位串） */
    install?: string | null;
    installable: boolean;
    installOptions?: Array<{
        label?: string;
        cmd?: string;
        note?: string;
    }>;
    riskFlags?: string[];
    url?: string;
}
interface MarketplaceSearchOptions {
    /** 返回数量，默认 8，最大 100 */
    limit?: number;
    /** 请求超时毫秒，默认 8000 */
    timeoutMs?: number;
}
/**
 * 搜索 DSH Marketplace（无 key、无限流、带中英文摘要）。
 * 只保留 installable 且有 install 命令的候选——绝不把跑不通的命令交给调用方。
 */
declare function searchMarketplacePlugins(query: string, opts?: MarketplaceSearchOptions): Promise<StoreSearchResult>;
declare function searchStorePlugins(query: string, opts?: StoreSearchOptions): Promise<StoreSearchResult>;
/** 把搜索结果格式化成给主模型的紧凑文本（含安装命令） */
declare function formatStoreResult(result: StoreSearchResult, max?: number): string;

/**
 * 工具调度层（中间件第三职责：根据需求找最好的工具，再动手）
 *
 * 用户只说要什么，技术类的事不让他操心。方案需要的能力缺了时，中间件自己完成
 * 「找 → 选 → 装配」：
 *   1. 内置 curated 库优先——已知的好工具（官方优先），不用每次搜市场；
 *   2. 否则去 DSH Marketplace 搜（无 key 无限流、带中英文摘要）→ 按相关度排序 → 选最好的；
 *      仅保留「一条命令真能装上的」（monorepo 子目录 #path 装不上，绝不给出跑不通的命令）；
 *      Marketplace 无结果时回退 1024Store；
 *   3. 可信源（bundled/official）自动安装；社区源（store/github）给一句确认；
 *   4. 不阻断第一版交付：装好的工具重启 DSH 后对后续迭代生效，本次先用现有工具。
 *
 * 安全边界：自动安装只对内置的官方/bundled 来源开放；市场与 github 社区插件
 * 一律走到「一句确认」，绝不在未经确认时安装第三方代码。
 *
 * 与生态的分工（避免重复造轮子）：本插件只做「轻装配」入口——curated 快查 +
 * 一条命令真能装上的市场候选，面向小白用户保持轻量。重型能力装配（先查本地 →
 * 多候选审查 → 隔离试用 → 独立语义验证 → 升级回填）由社区插件 dsh-plugin-autoevo
 * 承担；本模块只对齐其核心诚信原则（未经验证不报已装），不重复实现重型流程。
 */

interface CuratedCapability {
    /** 能力 id（与 Recipe.capabilities[].id 对应） */
    id: string;
    /** 内置已知的最佳来源（如 dsh-office-tools / @liustack/modlens） */
    source: string;
    trust: 'bundled' | 'official' | 'community';
    /** 为什么内置推荐它（人话） */
    why: string;
}
/**
 * 内置 curated 工具库：常见能力缺口直接命中，中间件不用每次搜市场。
 * 只放「真实市场验证过、来源可信」的工具——source 来自 1024Store 实际检索结果
 * （大厂背书 / 官方 / 高安装量），install 命令可直接 `dsh plugin add`。
 * 安全边界：bundled/official 自动装；community（含大厂社区包）一律「一句确认」。
 */
declare const CURATED_CAPABILITIES: CuratedCapability[];
type DispatchAction = 'installed' | 'proposed' | 'not-found';
/**
 * 装配状态（机器可读，对齐 autoevo 的安装状态机语义，供下游精确判断）：
 * - verified：已安装且已在 profile 层面确认写入（对应 autoevo 的 verified）
 * - pending：尚未验证通过——社区源等用户一句确认 / 官方源装完但未能确认写入（对应 autoevo 的 pending）
 * - absent：市场也没有替代（对应 autoevo 的 failed_absent）
 * 绝不在 verified 之外报「已装好」（诚信红线：只有确认写入才敢说 installed）。
 */
type DispatchState = 'verified' | 'pending' | 'absent';
interface DispatchEntry {
    ref: CapabilityRef;
    /** 选定的最佳来源（如 dsh-office-tools / github:owner/repo / 市场插件名） */
    source: string;
    trust: 'bundled' | 'official' | 'community';
    /** installed=已自动安装；proposed=社区源待一句确认；not-found=市场也没有 */
    action: DispatchAction;
    /** 精确装配状态（与 action 对应：installed→verified；proposed→pending；not-found→absent） */
    state: DispatchState;
    /** 安装命令（installed/proposed 时有） */
    command?: string;
    /** 为什么选它（人话） */
    reason: string;
}
interface DispatchResult {
    entries: DispatchEntry[];
    installedCount: number;
    proposedCount: number;
    notFoundCount: number;
    /** 人类可读总结（给用户/主模型看） */
    summary: string;
}
interface DispatchOptions {
    /** 覆盖市场搜索（测试/网络隔离）；缺省走 Marketplace → 1024Store 兜底 */
    search?: (query: string) => Promise<StoreSearchResult>;
    /** 覆盖安装执行（测试隔离；默认走 dsh plugin add） */
    install?: (source: string) => Promise<{
        ok: boolean;
        confirmed?: boolean;
        detail?: string;
    }>;
}
/**
 * 调度缺失能力：curated 优先 → 市场兜底 → 可信源自动装 / 社区源提议。
 * 纯逻辑可单测：search / install 均可注入。
 */
declare function dispatchMissingCapabilities(missingRefs: CapabilityRef[], options?: DispatchOptions): Promise<DispatchResult>;

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
type WorkflowFailureKind = 'step-failed' | 'verification-failed' | 'capability-missing' | 'invalid-workflow-from';
interface WorkflowResult {
    success: boolean;
    stepResults: WorkflowStepResult[];
    /** 失败步 id（成功时为空） */
    failedStepId?: string;
    failureKind?: WorkflowFailureKind;
    /** 暂停步 id（stopAfter 步骤验收通过后暂停，等待用户确认/选择；成功且未暂停时为空） */
    stoppedAt?: string;
    /** 暂停后应从哪一步继续（stopAfter 的下一步；由 runWorkflow 算出，供「继续」指引直接使用） */
    resumeFrom?: string;
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
    /** 覆盖工具调度（测试/网络隔离） */
    dispatch?: DispatchOptions;
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
declare function workflowNextSteps(result: WorkflowResult): string[];
/** 把校验发现的「声称产出但本地不存在」如实附在摘要末尾 */
declare function appendMissingNotice(outcome: ExecutionOutcome): string;

/**
 * 验收历史回填（标准飞轮第二块基石）
 *
 * 把每次独立验收的结果结构化追加到工作区，积累成「每个方案历次验收通过率」
 * 的原始数据。第一版只做：追加 JSONL 原始记录 + 读回 + 纯函数聚合。
 * 不做分析 / 报表 / 趋势（YAGNI）——那些等数据真的攒起来再做。
 *
 * 落盘位置：<workdir>/ming-evidence/acceptance-history.jsonl
 * （ming-evidence/ 已被 .gitignore 忽略，不污染仓库）。
 */

/** 一条验收记录（一次任务的独立验证结果） */
interface AcceptanceRecord {
    /** ISO 时间戳 */
    timestamp: string;
    recipeId: string | null;
    recipeName: string | null;
    passed: number;
    failed: number;
    /** 失败断言的 kind 列表（只记 kind，不记整个断言对象，避免膨胀） */
    failedKinds: string[];
}
/** 从验证结果里提取失败断言的 kind（供回填时精简记录） */
declare function failedKindsOf(results: VerificationResult[]): string[];
/** 追加一条验收记录到历史（JSONL，每行一条）。返回历史文件路径。 */
declare function appendAcceptanceRecord(workdir: string, record: AcceptanceRecord): Promise<string>;
/** 读回全部验收记录（文件不存在时返回空数组；坏行跳过，不因单条损坏丢弃整个历史） */
declare function readAcceptanceHistory(workdir: string): Promise<AcceptanceRecord[]>;
/** 单个方案的验收聚合 */
interface AcceptanceSummary {
    recipeId: string | null;
    recipeName: string | null;
    totalRuns: number;
    totalPassed: number;
    totalFailed: number;
    /** 通过率 0~1；无任何断言记录时为 null */
    passRate: number | null;
    lastRunAt: string | null;
}
/** 纯函数：把原始记录聚合成「每个方案历次验收通过率」 */
declare function summarizeAcceptance(records: AcceptanceRecord[]): AcceptanceSummary[];
/** 把验收聚合格式化成给人/模型看的文本（纯函数，供查询工具与测试复用） */
declare function formatAcceptance(summaries: AcceptanceSummary[]): string;
/** 从 ISO 时间戳取月份键 YYYY-MM（本地时区） */
declare function monthKeyOf(iso: string): string;
/**
 * 计算某月的 VTE：该月内整次任务验收通过（failed === 0）的记录条数。
 * month 缺省为当前月（YYYY-MM）。
 */
declare function computeVte(records: AcceptanceRecord[], month?: string): number;
/** 近 N 个月的 VTE 趋势（含当前月，从旧到新） */
declare function computeVteTrend(records: AcceptanceRecord[], months?: number): Array<{
    month: string;
    vte: number;
}>;
/** 把 VTE 与趋势格式化成人话（纯函数，供查询工具与测试复用） */
declare function formatVte(currentVte: number, trend: Array<{
    month: string;
    vte: number;
}>): string;

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
 *   - mvp-first（推荐）：用高标准的默认值直接做出一版「完整可展示」的成果，看完再打磨细节（快链）；
 *   - clarify-first：先问方案声明的关键问题（只问必要的），按用户答案精确装配再跑（核对链）。
 * 两条链都汇入 ming_auto 执行，区别只在「装配上下文是否注入用户答案」；
 * 第一轮交付标准由方案声明的 qualityBar 保证，两条链都生效。
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
 * 方案包 → Agent Skills（SKILL.md）出口
 *
 * 把 Ming 的内置方案包（Recipe）导出为跨宿主标准的 Agent Skill（SKILL.md）：
 * 一个文件夹 + SKILL.md（frontmatter name/description + 指令 + 资源），
 * Claude Code / Codex / Gemini CLI 等都能直接加载。
 *
 * 为什么做（不重复造轮子）：技能包载体生态已有事实标准（agentskills.io），
 * 方案包不该锁死在私有格式里；对齐标准后，Ming 策展的方案可以一键导出、
 * 在任何支持 Agent Skills 的宿主里复用。内部匹配规则（triggers）、验收断言
 * （verification）、质量门槛（qualityBar）是 Ming 的独有资产，保留在 Recipe 内部；
 * 本模块只负责把它们表达成标准 SKILL.md 的「指令 + 自查」形态。
 */

/**
 * 把方案包导出为标准 SKILL.md 文本。
 * 纯函数、零副作用；不修改 Recipe。frontmatter 只含规范最小必填
 * （name + description），正文按「何时使用 / 执行指引 / 能力要求 /
 * 质量门槛 / 交付前自查 / 验收断言」组织，便于任意 agent 直接消费。
 */
declare function exportRecipeToSkillMd(recipe: Recipe): string;

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
 * 验收协议（Acceptance Protocol）
 *
 * 把「什么算好 + 怎么验证」从 Recipe 里抽成一个可独立校验、可版本化的概念。
 *
 * 为什么需要它：
 *   - verification 与 qualityBar 现在是散落在 Recipe 里的普通字段，
 *     写错断言（拼错 kind、漏 pattern、漏 contains）要拖到执行阶段 verifier 跑
 *     到 default 分支才崩；本模块让协议在进入执行前就能被静态校验。
 *   - schemaVersion 让协议未来演进（新增断言 kind、新增质量维度、字段改名）
 *     时可迁移、可追溯：历史证据卡记录自己由哪个版本的协议产出。
 *
 * 第一版只做地基：版本号 + 纯函数校验器。运行时 fail-fast 与协议演进迁移
 * 留到协议真正开始变化时再上（YAGNI）。
 */

/** 验收协议 schema 版本。协议结构变更时 +1；证据卡记录本值用于历史迁移。 */
declare const ACCEPTANCE_PROTOCOL_VERSION = 1;
/** 协议校验失败的一处问题：定位 + 人话原因 */
interface ProtocolValidationError {
    /** 出错位置，如 verification[2] 或 qualityBar.checks */
    path: string;
    /** 人话原因（可读给开发者/用户看） */
    message: string;
}
/**
 * 校验一组验收断言是否合法。
 * 纯函数，零副作用；返回空数组表示全部合法。
 */
declare function validateVerificationChecks(checks: VerificationCheck[]): ProtocolValidationError[];
/**
 * 校验质量门槛是否合法。undefined 视为合法（方案可不声明质量门槛）。
 * 纯函数，零副作用。
 */
declare function validateQualityBar(bar: QualityBar | undefined): ProtocolValidationError[];
/** 把校验错误格式化成人话（供 fail-fast 报错或测试诊断） */
declare function formatProtocolErrors(errors: ProtocolValidationError[]): string;
/**
 * 校验一个完整方案的验收协议（recipe 级断言 + 质量门槛 + 工作流每步断言）。
 * 返回空数组表示协议合法。resolver 在装配阶段调用本函数 fail-fast。
 */
declare function validateRecipeProtocol(recipe: Recipe): ProtocolValidationError[];

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

/**
 * Ming 工具注册（能力织机版）
 *
 * `ming_auto` 内部链路：目标 → Capability Resolver（规则/显式命中方案包）
 * → Assembler（装配上下文）→ 官方子代理执行 → Verifier（独立验证）→ 证据卡。
 *
 * 未命中任何方案时退回通用委派（与旧版行为一致）；命中了方案但必选能力缺失时
 * 诚实失败并给出安装指引，绝不假装已装配。
 */

/**
 * 交付展示（交付体验层第 4 次对话）。
 *
 * 完成不是一句「搞定了」，而是「给你看」：产出数 + 独立检查 + 证据可回查 +
 * 把验收的判断权交还用户（请你过目）。参与感落在「我看懂了才说好」。
 * 纯函数；仅成功交付时展示（失败时用户需要的是坑位指引，不是复盘邀请）。
 */
declare function formatDeliveryReview(value: MingResult): string;
/** 把规范结果渲染成给用户/模型看的中文文本 */
declare function formatMingResult(value: MingResult): string;

/**
 * 证据收集器
 *
 * 把一次任务的完整过程写成可追溯的证据卡（JSON），落盘到工作区的 ming-evidence/。
 */

/** 计算目标内容的 SHA-256 指纹（溯源用：检测目标被外部注入篡改） */
declare function hashGoal(goal: string): string;
interface EvidencePayload {
    goal: string;
    resources: string[];
    outcome: ExecutionOutcome;
    /** 证据卡落盘目录（会话工作区，而非进程 cwd） */
    workdir: string;
    /** 命中的方案信息（能力织机） */
    recipe?: {
        id: string | null;
        name: string | null;
        matchedBy: string;
        capabilities: unknown[];
    };
    /** 独立验证结果（能力织机） */
    verification?: {
        passed: number;
        failed: number;
        results: unknown[];
    };
    /** 溯源（provenance）：谁发起、目标指纹，供审计注入来源与追溯（OWASP 2026 方向） */
    provenance?: {
        /** 发起方：user 直接发起 / auto 自动触发 / plan 规划后执行 */
        source: 'user' | 'auto' | 'plan';
        /** 用户目标内容的 SHA-256 指纹（检测目标被外部注入篡改） */
        goalHash: string;
        /** 命中的方案 id（若有） */
        recipeId?: string | null;
    };
}
interface EvidenceFile {
    path: string;
    id: string;
}
declare function writeEvidence(payload: EvidencePayload): Promise<EvidenceFile>;

/**
 * 真实浏览器验收（browser_acceptance 断言执行器）
 *
 * 对接社区工具 dsh-verify（Witness）：JSON spec → 真实 Chromium → PASS/FAIL 与
 * 截图 receipts——「The browser is the judge」，不靠 agent 自我宣称，也不靠 LLM 判分。
 *
 * 为什么对接而不是自研（不重复造轮子）：生态已有成熟实现（CLI + MCP + GitHub Action），
 * 本模块只做三件薄事：
 *   1. 探测本机是否可用（dsh-verify 或 npx 可拉取）；
 *   2. 可用 → 执行 spec 并解析 PASS/FAIL；
 *   3. 不可用 → 如实返回 skipped（不谎报通过，也不阻塞第一版交付）。
 * 诚实红线：未执行就是未执行，绝不把「跳过」当「通过」。
 */
interface BrowserVerifyResult {
    passed: boolean;
    /** 未执行（dsh-verify 不可用）时为 true；此时 passed 恒为 false */
    skipped?: boolean;
    detail: string;
}
interface BrowserVerifyDeps {
    /** 探测 dsh-verify 是否可用（测试可注入；缺省走真实探测） */
    probe?: () => Promise<boolean>;
    /** 执行 dsh-verify 并返回标准输出（测试可注入；缺省 spawn 真实 CLI） */
    run?: (specPath: string) => Promise<{
        code: number | null;
        output: string;
    }>;
}
/** 探测 dsh-verify 可用性：PATH 里的 dsh-verify 优先，其次 npx 全局缓存 */
declare function probeDshVerify(): Promise<boolean>;
/** 执行一次浏览器验收：spec 相对路径基于 workdir 解析；输出按「PASS/FAIL 关键字 + 退出码」判定 */
declare function runBrowserAcceptance(spec: string, workdir: string, deps?: BrowserVerifyDeps): Promise<BrowserVerifyResult>;

export { ACCEPTANCE_PROTOCOL_VERSION, type AcceptanceRecord, type AcceptanceSummary, type ArtifactCheck, type BrowserVerifyDeps, type BrowserVerifyResult, CURATED_CAPABILITIES, type CapabilityAvailability, type CapabilityKind, type CapabilityPlan, type CapabilityRef, type ClarifyQuestion, type CuratedCapability, type DispatchAction, type DispatchEntry, type DispatchOptions, type DispatchResult, type DispatchState, type ErrorKind, type ExecutionOutcome, type HistoryEntry, type HistoryResult, type InstallCheckResult, type InstallExecution, type InstallOutcome, type MarketplacePlugin, type MingResult, type ParsedInstallCommand, type Pitfall, type ProtocolValidationError, RECIPES, type Recipe, type RecommendContext, STRATEGY_OPTIONS, type ScoredCandidate, type StorePlugin, type StoreSearchOptions, type StoreSearchResult, type StrategyKind, type StrategyOption, type VerificationCheck, type VerificationResult, type VerificationSummary, type WorkflowFailureKind, type WorkflowResult, type WorkflowStep, type WorkflowStepResult, appendAcceptanceRecord, appendMissingNotice, assembleContext, buildInstallArgs, buildInstallCommand, buildRecommendationReason, checkInstalled, clarifyStatus, collectWorkflowArtifacts, computeVte, computeVteTrend, dispatchMissingCapabilities, dshBinCandidates, exportRecipeToSkillMd, extractArtifacts, failedKindsOf, findRecipesByGoal, formatAcceptance, formatClarify, formatDeliveryReview, formatMingResult, formatProtocolErrors, formatStoreResult, formatStrategyOptions, formatVerification, formatVte, getRecipe, hashGoal, installCapability, kindFromStopReason, looksLikeLocalPath, matchReason, matchesSimplePatternForTest, monthKeyOf, nextStepsFor, parseInstallCommand, planExecution, probeDshVerify, profileDirsOf, rankCandidates, readAcceptanceHistory, recipeCatalog, resolveAnswers, resolveCapabilities, resolveDshHome, resolveProfileName, resolveTimeoutMs, resolveWorkdir, runBrowserAcceptance, runDshInstall, runWorkflow, searchMarketplacePlugins, searchStorePlugins, stopReasonText, suggestQueryFor, summarizeAcceptance, tokensOf, validateQualityBar, validateRecipeProtocol, validateVerificationChecks, verifyChecks, workflowNextSteps, writeEvidence };
