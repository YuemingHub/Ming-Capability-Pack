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
export { appendMissingNotice, nextStepsFor, workflowNextSteps } from './services/next-steps.js'
export {
  appendAcceptanceRecord,
  computeVte,
  computeVteTrend,
  failedKindsOf,
  formatAcceptance,
  formatVte,
  monthKeyOf,
  readAcceptanceHistory,
  summarizeAcceptance,
  type AcceptanceRecord,
  type AcceptanceSummary,
} from './services/acceptance-log.js'
export { collectWorkflowArtifacts, runWorkflow, type WorkflowFailureKind, type WorkflowResult, type WorkflowStepResult } from './services/workflow.js'
export { assembleContext } from './capabilities/assembler.js'
export { resolveCapabilities } from './capabilities/resolver.js'
export { planExecution, formatStrategyOptions, clarifyStatus, formatClarify, resolveAnswers, STRATEGY_OPTIONS } from './capabilities/planner.js'
export { findRecipesByGoal, getRecipe, recipeCatalog, RECIPES } from './capabilities/recipes.js'
export {
  CURATED_CAPABILITIES,
  dispatchMissingCapabilities,
  type CuratedCapability,
  type DispatchAction,
  type DispatchEntry,
  type DispatchOptions,
  type DispatchResult,
} from './capabilities/dispatch.js'
export { buildRecommendationReason, rankCandidates, suggestQueryFor, tokensOf, type RecommendContext, type ScoredCandidate } from './capabilities/recommend.js'
export { matchesSimplePatternForTest, verifyChecks, formatVerification } from './capabilities/verifier.js'
export {
  ACCEPTANCE_PROTOCOL_VERSION,
  formatProtocolErrors,
  validateQualityBar,
  validateRecipeProtocol,
  validateVerificationChecks,
  type ProtocolValidationError,
} from './capabilities/protocol.js'
export { formatStoreResult, searchMarketplacePlugins, searchStorePlugins, type MarketplacePlugin, type StorePlugin, type StoreSearchOptions, type StoreSearchResult } from './capabilities/store.js'
export {
  buildInstallArgs,
  buildInstallCommand,
  checkInstalled,
  dshBinCandidates,
  installCapability,
  matchReason,
  parseInstallCommand,
  profileDirsOf,
  resolveDshHome,
  resolveProfileName,
  runDshInstall,
  type InstallCheckResult,
  type InstallExecution,
  type InstallOutcome,
  type ParsedInstallCommand,
} from './services/installer.js'
export { formatMingResult } from './tools/ming-auto.js'
export { hashGoal, writeEvidence } from './services/evidence-collector.js'
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
  ClarifyQuestion,
  Pitfall,
  Recipe,
  StrategyKind,
  StrategyOption,
  VerificationCheck,
  VerificationResult,
  VerificationSummary,
  WorkflowStep,
} from './capabilities/types.js'
