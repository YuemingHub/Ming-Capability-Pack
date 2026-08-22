/**
 * 内部纯函数导出面（仅供单元测试与脚本复用，不属于公开插件 API）。
 *
 * 通过 dist/internals.js 暴露，避免测试直接依赖 src 布局。
 */

export {
  extractArtifacts,
  kindFromStopReason,
  looksLikeLocalPath,
  resolveTimeoutMs,
  resolveWorkdir,
  stopReasonText,
} from './services/executor.js'
export { appendMissingNotice, nextStepsFor } from './services/next-steps.js'
export { assembleContext } from './capabilities/assembler.js'
export { resolveCapabilities } from './capabilities/resolver.js'
export { findRecipesByGoal, getRecipe, recipeCatalog, RECIPES } from './capabilities/recipes.js'
export { matchesSimplePatternForTest, verifyChecks, formatVerification } from './capabilities/verifier.js'
export { formatStoreResult, searchStorePlugins, type StorePlugin, type StoreSearchOptions, type StoreSearchResult } from './capabilities/store.js'
export type {
  ArtifactCheck,
  ErrorKind,
  ExecutionOutcome,
  HistoryEntry,
  HistoryResult,
  MingResult,
} from './types.js'
export type {
  CapabilityAvailability,
  CapabilityKind,
  CapabilityPlan,
  CapabilityRef,
  Recipe,
  VerificationCheck,
  VerificationResult,
  VerificationSummary,
} from './capabilities/types.js'
