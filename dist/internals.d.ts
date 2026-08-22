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

export { type ArtifactCheck, type ErrorKind, type ExecutionOutcome, type HistoryEntry, type HistoryResult, type MingResult, appendMissingNotice, extractArtifacts, kindFromStopReason, looksLikeLocalPath, nextStepsFor, resolveTimeoutMs, resolveWorkdir, stopReasonText };
