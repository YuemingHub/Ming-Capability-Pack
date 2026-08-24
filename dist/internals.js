import {
  ACCEPTANCE_PROTOCOL_VERSION,
  CURATED_CAPABILITIES,
  RECIPES,
  STRATEGY_OPTIONS,
  appendAcceptanceRecord,
  appendMissingNotice,
  assembleContext,
  buildInstallArgs,
  buildInstallCommand,
  buildRecommendationReason,
  checkInstalled,
  clarifyStatus,
  collectWorkflowArtifacts,
  computeVte,
  computeVteTrend,
  dispatchMissingCapabilities,
  dshBinCandidates,
  extractArtifacts,
  failedKindsOf,
  findRecipesByGoal,
  formatAcceptance,
  formatClarify,
  formatDeliveryReview,
  formatMingResult,
  formatProtocolErrors,
  formatStoreResult,
  formatStrategyOptions,
  formatVerification,
  formatVte,
  getRecipe,
  hashGoal,
  installCapability,
  kindFromStopReason,
  looksLikeLocalPath,
  matchReason,
  matchesSimplePatternForTest,
  monthKeyOf,
  nextStepsFor,
  parseInstallCommand,
  planExecution,
  probeDshVerify,
  profileDirsOf,
  rankCandidates,
  readAcceptanceHistory,
  recipeCatalog,
  resolveAnswers,
  resolveCapabilities,
  resolveDshHome,
  resolveProfileName,
  resolveTimeoutMs,
  resolveWorkdir,
  runBrowserAcceptance,
  runDshInstall,
  runWorkflow,
  searchMarketplacePlugins,
  searchStorePlugins,
  stopReasonText,
  suggestQueryFor,
  summarizeAcceptance,
  tokensOf,
  validateQualityBar,
  validateRecipeProtocol,
  validateVerificationChecks,
  verifyChecks,
  workflowNextSteps,
  writeEvidence
} from "./chunk-MB7D7SYT.js";

// src/capabilities/skill-md.ts
function toListItems(lines) {
  if (!lines || lines.length === 0) return "";
  return lines.map((l) => {
    const trimmed = l.trim();
    return trimmed.startsWith("-") || trimmed.startsWith("*") ? trimmed : `- ${trimmed}`;
  }).join("\n");
}
function describeVerification(check) {
  switch (check.kind) {
    case "file_exists":
      return `\u68C0\u67E5\u6587\u4EF6\u300C${check.pattern}\u300D\u5B58\u5728`;
    case "content_match":
      return `\u68C0\u67E5\u300C${check.pattern}\u300D\u5305\u542B\u300C${check.contains}\u300D`;
    case "content_absent":
      return `\u68C0\u67E5\u300C${check.pattern}\u300D\u4E0D\u542B\u300C${check.mustNotContain}\u300D`;
    case "dir_nonempty":
      return `\u68C0\u67E5\u76EE\u5F55\u300C${check.pattern}\u300D\u975E\u7A7A`;
    case "browser_acceptance":
      return `\u7528\u771F\u5B9E\u6D4F\u89C8\u5668\u9A8C\u6536\u300C${check.spec}\u300D\uFF08dsh-verify\uFF0CPASS/FAIL\uFF09`;
    default:
      return `\u65AD\u8A00\u300C${check.kind}\u300D`;
  }
}
function exportRecipeToSkillMd(recipe) {
  const name = recipe.id;
  const description = `${recipe.description}\uFF08\u9002\u7528\uFF1A${recipe.triggers.slice(0, 8).join("\u3001")}\uFF09`;
  const sections = [
    `# ${recipe.name}`,
    "",
    "## \u4F55\u65F6\u4F7F\u7528",
    `\u5F53\u7528\u6237\u63D0\u51FA\u4EE5\u4E0B\u65B9\u5411\u7684\u9700\u6C42\u65F6\u4F7F\u7528\u672C\u65B9\u6848\uFF1A${recipe.triggers.join("\u3001")}\u3002`,
    ""
  ];
  if (recipe.guidance && recipe.guidance.length > 0) {
    sections.push("## \u6267\u884C\u6307\u5F15", toListItems(recipe.guidance), "");
  }
  if (recipe.capabilities && recipe.capabilities.length > 0) {
    sections.push(
      "## \u80FD\u529B\u8981\u6C42",
      toListItems(recipe.capabilities.map(
        (c) => c.source ? `\uFF08${c.kind}\uFF09${c.id}\uFF1A${c.purpose}\uFF08\u6765\u6E90 ${c.source}${c.optional ? "\uFF0C\u53EF\u9009" : ""}\uFF09` : `\uFF08${c.kind}\uFF09${c.id}\uFF1A${c.purpose}${c.optional ? "\uFF08\u53EF\u9009\uFF09" : ""}`
      )),
      ""
    );
  }
  if (recipe.qualityBar) {
    sections.push("## \u8D28\u91CF\u95E8\u69DB\uFF08\u7B2C\u4E00\u8F6E\u4EA4\u4ED8\u5C31\u8FBE\u5230\uFF09", recipe.qualityBar.bar, "");
    sections.push(toListItems(recipe.qualityBar.checks), "");
    if (recipe.qualityBar.selfCheck && recipe.qualityBar.selfCheck.length > 0) {
      sections.push("## \u4EA4\u4ED8\u524D\u81EA\u67E5\uFF08\u5168\u8FC7\u518D\u6C47\u62A5\u5B8C\u6210\uFF09", toListItems(recipe.qualityBar.selfCheck), "");
    }
  }
  if (recipe.verification && recipe.verification.length > 0) {
    sections.push("## \u9A8C\u6536\u65AD\u8A00\uFF08\u5B8C\u6210\u540E\u72EC\u7ACB\u68C0\u67E5\uFF09", toListItems(recipe.verification.map(describeVerification)), "");
  }
  const body = sections.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  return `---
name: ${name}
description: ${description}
---

${body}
`;
}
export {
  ACCEPTANCE_PROTOCOL_VERSION,
  CURATED_CAPABILITIES,
  RECIPES,
  STRATEGY_OPTIONS,
  appendAcceptanceRecord,
  appendMissingNotice,
  assembleContext,
  buildInstallArgs,
  buildInstallCommand,
  buildRecommendationReason,
  checkInstalled,
  clarifyStatus,
  collectWorkflowArtifacts,
  computeVte,
  computeVteTrend,
  dispatchMissingCapabilities,
  dshBinCandidates,
  exportRecipeToSkillMd,
  extractArtifacts,
  failedKindsOf,
  findRecipesByGoal,
  formatAcceptance,
  formatClarify,
  formatDeliveryReview,
  formatMingResult,
  formatProtocolErrors,
  formatStoreResult,
  formatStrategyOptions,
  formatVerification,
  formatVte,
  getRecipe,
  hashGoal,
  installCapability,
  kindFromStopReason,
  looksLikeLocalPath,
  matchReason,
  matchesSimplePatternForTest,
  monthKeyOf,
  nextStepsFor,
  parseInstallCommand,
  planExecution,
  probeDshVerify,
  profileDirsOf,
  rankCandidates,
  readAcceptanceHistory,
  recipeCatalog,
  resolveAnswers,
  resolveCapabilities,
  resolveDshHome,
  resolveProfileName,
  resolveTimeoutMs,
  resolveWorkdir,
  runBrowserAcceptance,
  runDshInstall,
  runWorkflow,
  searchMarketplacePlugins,
  searchStorePlugins,
  stopReasonText,
  suggestQueryFor,
  summarizeAcceptance,
  tokensOf,
  validateQualityBar,
  validateRecipeProtocol,
  validateVerificationChecks,
  verifyChecks,
  workflowNextSteps,
  writeEvidence
};
