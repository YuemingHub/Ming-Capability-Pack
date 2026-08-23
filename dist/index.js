import {
  appendMissingNotice,
  assembleContext,
  buildRecommendationReason,
  clarifyStatus,
  collectWorkflowArtifacts,
  dispatchMissingCapabilities,
  execute,
  formatClarify,
  formatStoreResult,
  formatStrategyOptions,
  formatVerification,
  installCapability,
  matchReason,
  nextStepsFor,
  parseInstallCommand,
  planExecution,
  rankCandidates,
  recipeCatalog,
  resolveAnswers,
  resolveCapabilities,
  resolveWorkdir,
  runWorkflow,
  searchStorePlugins,
  verifyChecks,
  workflowNextSteps
} from "./chunk-FE73CM7S.js";

// src/tools/ming-auto.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/services/evidence-collector.ts
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
async function writeEvidence(payload) {
  const dir = join(payload.workdir, "ming-evidence");
  await mkdir(dir, { recursive: true });
  const id = `evidence-${Date.now()}`;
  const card = {
    id,
    schemaVersion: 1,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...payload
  };
  const filepath = join(dir, `${id}.json`);
  await writeFile(filepath, JSON.stringify(card, null, 2), "utf-8");
  return { path: filepath, id };
}

// src/tools/ming-auto.ts
function formatResult(value) {
  const lines = [value.summary];
  if (value.recipe) {
    lines.push("", `\u65B9\u6848\uFF1A${value.recipe}`);
  }
  if (value.artifacts.length > 0) {
    lines.push("", "\u4EA7\u51FA\uFF1A");
    value.artifacts.forEach((a) => lines.push(`  - ${a}`));
  }
  if (value.verificationSummary) {
    lines.push("", value.verificationSummary);
  }
  if (value.evidence) {
    lines.push("", `\u8BC1\u636E\u5361\uFF1A${value.evidence}`);
  }
  if (value.nextSteps.length > 0) {
    lines.push("", "\u63A5\u4E0B\u6765\uFF1A");
    value.nextSteps.forEach((n) => lines.push(`  - ${n}`));
  }
  return lines.join("\n");
}
function registerMingAutoTool(ctx) {
  ctx.tools.register(defineTool({
    name: "ming_auto",
    description: `Ming \u667A\u80FD\u52A9\u624B\uFF1A\u7528\u6237\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u60F3\u505A\u7684\u4E8B\uFF0CMing \u81EA\u52A8\u5339\u914D\u5185\u7F6E\u65B9\u6848\u5305\u5E76\u88C5\u914D\u80FD\u529B\uFF0C
\u4EA4\u7ED9 Harness \u539F\u751F Agent \u771F\u6B63\u5B8C\u6210\uFF0C\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\u5E76\u72EC\u7ACB\u9A8C\u8BC1\u3002

\u9002\u5408\uFF1A\u751F\u6210\u7F51\u7AD9\u3001\u5904\u7406\u56FE\u7247/\u6570\u636E\u3001\u6574\u7406\u6587\u4EF6\u3001\u5199\u6587\u6863\u3001\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41\u7B49\u4EFB\u4F55\u53EF\u63CF\u8FF0\u7684\u4EFB\u52A1\u3002
\u63D0\u793A\uFF1A\u5148\u8C03\u7528 ming_plan \u67E5\u770B\u7B56\u7565\u9009\u62E9\uFF08\u76F4\u63A5\u505A\u4E00\u7248\u5B8C\u6574\u7684 / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\uFF0C\u518D\u6309\u7528\u6237\u9009\u62E9\u628A strategy \u4F20\u8FDB\u6765\uFF1B
\u9009 clarify-first \u65F6\u5148\u7528 ming_clarify \u5BF9\u8BDD\u5F0F\u6838\u5BF9\uFF0C\u628A\u7FFB\u8BD1\u6210\u7CFB\u7EDF\u903B\u8F91\u7684\u7B54\u6848\u653E\u8FDB answers \u518D\u6267\u884C\u3002
\u4E5F\u53EF\u76F4\u63A5\u6307\u5B9A recipe \u65B9\u6848 id\u3002`,
    parameters: {
      goal: {
        type: "string",
        required: true,
        description: "\u7528\u6237\u60F3\u5B8C\u6210\u7684\u76EE\u6807\uFF08\u81EA\u7136\u8BED\u8A00\uFF0C\u4E00\u53E5\u8BDD\u6216\u4E00\u6BB5\u8BDD\uFF09"
      },
      resources: {
        type: "array",
        items: { type: "string" },
        description: "\u53EF\u9009\uFF1A\u76F8\u5173\u7684\u6587\u4EF6\u8DEF\u5F84\u6216 URL"
      },
      recipe: {
        type: "string",
        description: "\u53EF\u9009\uFF1A\u901A\u8FC7 ming_catalog \u786E\u8BA4\u7684\u65B9\u6848 id\uFF1B\u4E0D\u4F20\u5219\u81EA\u52A8\u5339\u914D"
      },
      strategy: {
        type: "string",
        enum: ["mvp-first", "clarify-first"],
        description: "\u53EF\u9009\uFF1A\u6267\u884C\u7B56\u7565\u3002mvp-first \u7528\u9ED8\u8BA4\u503C\u76F4\u63A5\u505A\uFF08\u9ED8\u8BA4\uFF09\uFF1Bclarify-first \u7528 ming_clarify \u6838\u5BF9\u540E\u7FFB\u8BD1\u6210\u7684\u7CFB\u7EDF\u903B\u8F91\u7B54\u6848\u88C5\u914D\u518D\u505A"
      },
      answers: {
        type: "object",
        additionalProperties: true,
        description: "\u53EF\u9009\uFF1Aclarify-first \u65F6\u7ECF ming_clarify \u6838\u5BF9\u5E76\u7FFB\u8BD1\u6210\u7CFB\u7EDF\u903B\u8F91\u7684\u7B54\u6848\uFF08\u952E\u503C\u5BF9\uFF09\uFF1B\u7F3A\u5931\u9879\u7528\u9ED8\u8BA4\u503C"
      },
      workflowFrom: {
        type: "string",
        description: "\u53EF\u9009\uFF1A\u591A\u6B65\u5DE5\u4F5C\u6D41\u4ECE\u67D0\u4E00\u6B65\u7EE7\u7EED\uFF08\u8DF3\u8FC7\u4E4B\u524D\u7684\u6B65\u9AA4\uFF09\u3002\u5DE5\u4F5C\u6D41\u67D0\u6B65\u7F3A\u80FD\u529B\u88C5\u597D\u540E\uFF0C\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u300D\u65F6\u4F20\u5165\u5931\u8D25\u6B65\u7684 step id"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          success: { type: "boolean", required: true },
          mode: { type: "string", required: true },
          summary: { type: "string", required: true },
          artifacts: { type: "array", required: true, items: { type: "string" } },
          evidence: { type: "string", required: true },
          nextSteps: { type: "array", required: true, items: { type: "string" } },
          recipe: { type: "string", required: true },
          planSummary: { type: "string", required: true },
          verificationSummary: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatResult(value) }]
    },
    async execute(args, exec) {
      const goal = args.goal;
      const resources = args.resources ?? [];
      const workdir = resolveWorkdir(exec);
      const plan = await resolveCapabilities(ctx, { goal, recipeId: args.recipe });
      let dispatchNotice = "";
      let dispatchNextSteps = [];
      if (plan.recipeId && !plan.executable) {
        const missingRefs = plan.capabilities.filter((c) => !c.available && !c.ref.optional).map((c) => c.ref);
        const dispatch = await dispatchMissingCapabilities(missingRefs);
        if (dispatch.entries.length > 0) {
          dispatchNotice = `\u65B9\u6848\u300C${plan.recipeName}\u300D\u7F3A ${missingRefs.length} \u4E2A\u80FD\u529B\uFF0C\u4E2D\u95F4\u4EF6\u5DF2\u81EA\u52A8\u88C5\u914D\uFF1A
${dispatch.summary}

\u672C\u6B21\u5148\u7528\u73B0\u6709\u5DE5\u5177\u4EA4\u4ED8\u7B2C\u4E00\u7248\uFF0C\u88C5\u597D\u7684\u5DE5\u5177\u91CD\u542F DSH \u540E\u5BF9\u540E\u7EED\u8FED\u4EE3\u751F\u6548\u3002`;
          dispatchNextSteps = dispatch.entries.filter((e) => e.action === "proposed" && e.command).map((e) => `\u56DE\u300C\u786E\u8BA4\u300D\u5E2E\u4F60\u88C5 ${e.source}\uFF08${e.reason}\uFF09`);
        }
      }
      const answers = resolveAnswers(plan, args.strategy, args.answers);
      const contextual = assembleContext(plan, answers);
      if (plan.workflow && plan.workflow.length > 0) {
        const wfResult = await runWorkflow(ctx, exec, goal, resources, plan.workflow, workdir, {
          workflowFrom: args.workflowFrom,
          baseContext: contextual
        });
        return workflowToResult(wfResult, plan, goal, resources, workdir);
      }
      const outcome = await execute(ctx, goal, resources, exec, { contextual });
      let verificationSummary = "";
      let verification;
      if (outcome.success && plan.verification.length > 0) {
        const summary = await verifyChecks(plan.verification, workdir);
        verification = { passed: summary.passed, failed: summary.failed, results: summary.results };
        verificationSummary = formatVerification(summary);
      }
      let evidencePath = "";
      try {
        const evidence = await writeEvidence({
          goal,
          resources,
          outcome,
          workdir,
          recipe: plan.recipeId ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities } : void 0,
          verification
        });
        evidencePath = evidence.path;
      } catch {
      }
      const result = {
        success: outcome.success,
        mode: outcome.mode,
        summary: [dispatchNotice, appendMissingNotice(outcome)].filter(Boolean).join("\n\n"),
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: [...dispatchNextSteps, ...nextStepsFor(outcome)],
        recipe: plan.recipeName ?? "",
        planSummary: buildPlanSummary(plan),
        verificationSummary
      };
      return result;
    }
  }));
}
function buildPlanSummary(plan) {
  if (!plan.recipeId) return "\u672A\u5339\u914D\u5230\u5185\u7F6E\u65B9\u6848\uFF0C\u8D70\u901A\u7528\u59D4\u6D3E\u6267\u884C";
  const parts = [`\u65B9\u6848\u300C${plan.recipeName}\u300D\uFF08\u5339\u914D\uFF1A${plan.matchedBy}\uFF09`];
  if (plan.capabilities.length > 0) {
    const available = plan.capabilities.filter((c) => c.available).length;
    const missing = plan.capabilities.filter((c) => !c.available);
    parts.push(`\u80FD\u529B\u88C5\u914D\uFF1A${available}/${plan.capabilities.length} \u53EF\u7528`);
    if (missing.length > 0) {
      parts.push(`\u672A\u88C5\u914D\uFF1A${missing.map((m) => `${m.ref.kind}:${m.ref.id}`).join("\u3001")}`);
    }
  }
  if (plan.workflow && plan.workflow.length > 0) {
    parts.push(`\u591A\u6B65\u5DE5\u4F5C\u6D41\uFF1A${plan.workflow.map((s) => s.name).join(" \u2192 ")}`);
  }
  return parts.join("\uFF1B");
}
async function workflowToResult(wf, plan, goal, resources, workdir) {
  const failedOutcome = wf.stepResults.find((r) => r.step.id === wf.failedStepId)?.outcome;
  const outcome = {
    mode: "executed",
    success: wf.success,
    summary: wf.summary,
    artifacts: collectWorkflowArtifacts(wf),
    error: wf.success ? void 0 : wf.summary,
    errorKind: failedOutcome?.errorKind
  };
  let evidencePath = "";
  try {
    const evidence = await writeEvidence({
      goal,
      resources,
      outcome,
      workdir,
      recipe: plan.recipeId ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities } : void 0
    });
    evidencePath = evidence.path;
  } catch {
  }
  return {
    success: wf.success,
    mode: "executed",
    summary: wf.stoppedAt ? wf.summary : wf.success ? appendMissingNotice(outcome) : `\u5DE5\u4F5C\u6D41\u5728\u300C${wf.stepResults.find((r) => r.step.id === wf.failedStepId)?.step.name ?? "\u67D0\u4E00\u6B65"}\u300D\u505C\u4E0B\uFF1A${wf.summary}`,
    artifacts: outcome.artifacts,
    evidence: evidencePath,
    nextSteps: workflowNextSteps(wf),
    recipe: plan.recipeName ?? "",
    planSummary: buildPlanSummary(plan),
    verificationSummary: workflowVerificationSummary(wf)
  };
}
function workflowVerificationSummary(wf) {
  const lines = [];
  for (const r of wf.stepResults) {
    if (r.skipped) {
      lines.push(`- ${r.step.name}\uFF1A\u8DF3\u8FC7\uFF08\u6B64\u524D\u5DF2\u5B8C\u6210\uFF09`);
    } else if (r.blockedBy) {
      lines.push(`- ${r.step.name}\uFF1A\u672A\u6267\u884C\uFF08\u7F3A\u80FD\u529B ${r.blockedBy.ref.kind}:${r.blockedBy.ref.id}\uFF09`);
    } else if (r.verification) {
      lines.push(`- ${r.step.name}\uFF1A\u9A8C\u6536 ${r.verification.passed} \u8FC7 / ${r.verification.failed} \u672A\u8FC7`);
    } else {
      lines.push(`- ${r.step.name}\uFF1A\u5DF2\u6267\u884C${r.outcome?.success ? "" : "\uFF08\u5931\u8D25\uFF09"}`);
    }
  }
  return lines.join("\n");
}

// src/tools/ming-catalog.ts
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";
function formatCatalog(recipes) {
  if (recipes.length === 0) return "\u5F53\u524D\u6CA1\u6709\u4EFB\u4F55\u5185\u7F6E\u65B9\u6848\u5305\u3002";
  const lines = ["Ming \u5185\u7F6E\u65B9\u6848\u5305\uFF1A", ""];
  for (const r of recipes) {
    lines.push(`- [${r.id}] ${r.name}`);
    lines.push(`  \u63CF\u8FF0\uFF1A${r.description}`);
    lines.push(`  \u9002\u5408\u8BF4\uFF1A${r.triggers.join("\u3001")}`);
  }
  lines.push("", "\u5728 ming_auto \u7684 recipe \u53C2\u6570\u91CC\u586B\u65B9\u6848 id \u53EF\u663E\u5F0F\u6307\u5B9A\uFF1B\u4E0D\u6307\u5B9A\u5219\u81EA\u52A8\u5339\u914D\u3002");
  return lines.join("\n");
}
function registerMingCatalogTool(ctx) {
  ctx.tools.register(defineTool2({
    name: "ming_catalog",
    description: "\u67E5\u770B Ming \u5185\u7F6E\u65B9\u6848\u5305\u76EE\u5F55\uFF08\u6574\u7406\u6587\u4EF6\u3001\u751F\u6210\u62A5\u8868\u7B49\uFF09\u3002\u5F53\u7528\u6237\u7684\u76EE\u6807\u770B\u8D77\u6765\u53EF\u4EE5\u5957\u7528\u67D0\u4E2A\u73B0\u6210\u65B9\u6848\u65F6\uFF0C\u5148\u67E5\u672C\u76EE\u5F55\uFF0C\u518D\u628A\u65B9\u6848 id \u4F20\u7ED9 ming_auto\u3002",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          total: { type: "number", required: true },
          recipes: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", required: true },
                name: { type: "string", required: true },
                description: { type: "string", required: true },
                triggers: { type: "array", required: true, items: { type: "string" } }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatCatalog(value.recipes) }]
    },
    async execute() {
      const recipes = recipeCatalog();
      return { total: recipes.length, recipes };
    }
  }));
}

// src/tools/ming-clarify.ts
import { defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";
function registerMingClarifyTool(ctx) {
  ctx.tools.register(defineTool3({
    name: "ming_clarify",
    description: "Ming \u6F84\u6E05\uFF1A\u7528\u6237\u9009\u4E86\u300C\u5148\u5BF9\u9F50\u9700\u6C42\u518D\u505A\u300D\u540E\uFF0C\u7528\u5B83\u505A\u5BF9\u8BDD\u5F0F\u6838\u5BF9\u3002\u4F20\u5165\u7528\u6237\u6700\u65B0\u56DE\u7B54\u7FFB\u8BD1\u540E\u7684\u7B54\u6848\uFF08answers\uFF09\uFF0C\u8FD4\u56DE\u8FD8\u7F3A\u54EA\u4E9B\u5173\u952E\u70B9\uFF08\u542B\u95EE\u9898/\u9009\u9879/\u9ED8\u8BA4\u503C/\u7FFB\u8BD1\u63D0\u793A\uFF09\u3002\u628A\u7F3A\u7684\u95EE\u7528\u6237\uFF0C\u628A\u7528\u6237\u7684\u5927\u767D\u8BDD\u7FFB\u8BD1\u6210\u7CFB\u7EDF\u903B\u8F91\u518D\u4F20\u56DE\u6765\uFF1B\u8FD4\u56DE done=true \u65F6\u4FE1\u606F\u591F\u4E86\uFF0C\u628A\u8FD9\u4E9B answers \u4F20\u7ED9 ming_auto\uFF08strategy=clarify-first\uFF09\u5F00\u59CB\u505A\u3002\u53EA\u6838\u5BF9\uFF0C\u4E0D\u6267\u884C\u3002",
    parameters: {
      goal: {
        type: "string",
        required: true,
        description: "\u7528\u6237\u60F3\u5B8C\u6210\u7684\u76EE\u6807\uFF08\u81EA\u7136\u8BED\u8A00\uFF09"
      },
      recipe: {
        type: "string",
        description: "\u53EF\u9009\uFF1A\u5DF2\u901A\u8FC7 ming_catalog \u786E\u8BA4\u7684\u65B9\u6848 id"
      },
      answers: {
        type: "object",
        additionalProperties: true,
        description: "\u7528\u6237\u6700\u65B0\u56DE\u7B54\u7FFB\u8BD1\u540E\u7684\u7B54\u6848\uFF08\u952E\u503C\u5BF9\uFF0C\u952E\u5BF9\u5E94\u4E0A\u4E00\u8F6E\u8FD4\u56DE\u7684 missing.key\uFF09\uFF1B\u53EF\u53EA\u4F20\u65B0\u589E\u7684"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.text }]
    },
    async execute(args) {
      const plan = await resolveCapabilities(ctx, { goal: args.goal, recipeId: args.recipe });
      const status = clarifyStatus(plan, args.answers);
      return { text: formatClarify(status) };
    }
  }));
}

// src/tools/ming-history.ts
import { readFile, readdir } from "fs/promises";
import { join as join2 } from "path";
import { defineTool as defineTool4 } from "@deepseek-ai/dsh-tools";
var DEFAULT_LIMIT = 10;
var MAX_LIMIT = 50;
function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}\u2026`;
}
function formatResult2(value) {
  if (value.total === 0) {
    return "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709 Ming \u4EFB\u52A1\u8BB0\u5F55\uFF08\u672A\u627E\u5230 ming-evidence/ \u76EE\u5F55\u6216\u4E3A\u7A7A\uFF09\u3002";
  }
  const lines = [
    `\u5171 ${value.total} \u6761\u4EFB\u52A1\u8BB0\u5F55\uFF0C\u5C55\u793A\u6700\u8FD1 ${value.returned} \u6761\uFF1A`,
    ""
  ];
  value.entries.forEach((e, i) => {
    const flag = e.success ? "\u2705" : "\u274C";
    const time = e.timestamp ? e.timestamp.replace("T", " ").slice(0, 16) : "\u65F6\u95F4\u672A\u77E5";
    const goal = truncate(e.goal || "(\u65E0\u76EE\u6807\u8BB0\u5F55)", 60);
    const detail = e.success ? `${e.artifactsCount} \u4E2A\u4EA7\u7269${e.missingCount > 0 ? `\uFF08\u5176\u4E2D ${e.missingCount} \u4E2A\u672A\u901A\u8FC7\u6821\u9A8C\uFF09` : ""}` : `\u5931\u8D25\uFF08${e.errorKind || "\u539F\u56E0\u672A\u8BB0\u5F55"}\uFF09`;
    const duration = e.durationMs >= 0 ? ` \xB7 \u8017\u65F6 ${(e.durationMs / 1e3).toFixed(1)}s` : "";
    lines.push(`${i + 1}. ${flag} [${time}] ${goal}`);
    lines.push(`   ${detail}${duration}`);
  });
  lines.push("", "\u5982\u9700\u67E5\u770B\u67D0\u6761\u7684\u5B8C\u6574\u8BC1\u636E\u5361\uFF0C\u76F4\u63A5\u6253\u5F00\u5BF9\u5E94\u7684 evidencePath \u6587\u4EF6\u3002");
  return lines.join("\n");
}
function registerMingHistoryTool(ctx) {
  ctx.tools.register(defineTool4({
    name: "ming_history",
    description: `Ming \u5386\u53F2\u67E5\u8BE2\uFF1A\u67E5\u770B\u4E4B\u524D\u901A\u8FC7 ming_auto \u5B8C\u6210\u8FC7\u7684\u4EFB\u52A1\u8BB0\u5F55\uFF08\u65F6\u95F4\u3001\u76EE\u6807\u3001\u6210\u8D25\u3001\u4EA7\u7269\u6570\u91CF\u3001\u8017\u65F6\uFF09\u3002

\u9002\u5408\uFF1A\u7528\u6237\u60F3\u56DE\u987E\u300CMing \u6700\u8FD1\u505A\u8FC7\u4EC0\u4E48\u300D\u3001\u627E\u56DE\u4E4B\u524D\u4EFB\u52A1\u7684\u4EA7\u51FA\u6587\u4EF6\u3001\u6216\u7EDF\u8BA1\u4EFB\u52A1\u5B8C\u6210\u60C5\u51B5\u3002
\u53EA\u8BFB\u5DE5\u5177\uFF0C\u4E0D\u4F1A\u6267\u884C\u4EFB\u4F55\u65B0\u4EFB\u52A1\u3002`,
    parameters: {
      limit: {
        type: "number",
        description: `\u53EF\u9009\uFF1A\u8FD4\u56DE\u6700\u8FD1\u591A\u5C11\u6761\u8BB0\u5F55\uFF0C\u9ED8\u8BA4 ${DEFAULT_LIMIT}\uFF0C\u6700\u591A ${MAX_LIMIT}`
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          success: { type: "boolean", required: true },
          total: { type: "number", required: true },
          returned: { type: "number", required: true },
          entries: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", required: true },
                timestamp: { type: "string", required: true },
                goal: { type: "string", required: true },
                success: { type: "boolean", required: true },
                mode: { type: "string", required: true },
                artifactsCount: { type: "number", required: true },
                missingCount: { type: "number", required: true },
                errorKind: { type: "string", required: true },
                durationMs: { type: "number", required: true },
                evidencePath: { type: "string", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatResult2(value) }]
    },
    async execute(args, exec) {
      const workdir = resolveWorkdir(exec);
      const dir = join2(workdir, "ming-evidence");
      let rawLimit = Number(args.limit);
      if (!Number.isFinite(rawLimit)) rawLimit = DEFAULT_LIMIT;
      const limit = Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT);
      let files;
      try {
        files = await readdir(dir);
      } catch {
        return { success: true, total: 0, returned: 0, entries: [] };
      }
      const jsonFiles = files.filter((f) => f.endsWith(".json")).sort().reverse();
      const total = jsonFiles.length;
      const entries = [];
      for (const file of jsonFiles.slice(0, limit)) {
        try {
          const card = JSON.parse(await readFile(join2(dir, file), "utf-8"));
          const checks = card.outcome?.artifactChecks ?? [];
          entries.push({
            id: String(card.id ?? file.replace(/\.json$/u, "")),
            timestamp: String(card.timestamp ?? ""),
            goal: truncate(String(card.goal ?? ""), 120),
            success: Boolean(card.outcome?.success),
            mode: String(card.outcome?.mode ?? ""),
            artifactsCount: (card.outcome?.artifacts ?? []).length,
            missingCount: checks.filter((c) => c.kind === "missing").length,
            errorKind: String(card.outcome?.errorKind ?? ""),
            durationMs: typeof card.outcome?.durationMs === "number" ? card.outcome.durationMs : -1,
            evidencePath: join2(dir, file)
          });
        } catch {
        }
      }
      return { success: true, total, returned: entries.length, entries };
    }
  }));
}

// src/tools/ming-install.ts
import { defineTool as defineTool5 } from "@deepseek-ai/dsh-tools";
function toCandidate(p, query) {
  return {
    id: p.id ?? p.name,
    name: p.name,
    owner: p.owner,
    stars: p.stars ?? 0,
    installCount: p.installCount ?? 0,
    category: p.category,
    description: [p.description?.zh, p.description?.en].filter(Boolean).join("\uFF5C").slice(0, 200),
    install: p.install,
    matchReason: matchReason(p, query)
  };
}
function candidateText(c) {
  return `${c.name} ${c.description} ${c.category}`;
}
function recommendCandidates(candidates, ctx, top) {
  const scored = rankCandidates(candidates, ctx, candidateText, (c) => ({
    stars: c.stars,
    installCount: c.installCount
  }));
  return scored.slice(0, top).map(({ candidate, score, queryHits, scenarioHits }) => ({
    ...candidate,
    score,
    matchReason: buildRecommendationReason(candidateText(candidate), ctx, { stars: candidate.stars, installCount: candidate.installCount }, { queryHits, scenarioHits })
  }));
}
function formatCandidates(candidates, query, goal) {
  const lines = [
    `\u6309\u4F60\u7684\u76EE\u6807\u6392\u5E8F\u540E\uFF0C\u63A8\u8350\u4EE5\u4E0B ${candidates.length} \u4E2A\u5019\u9009${goal ? `\uFF08\u76EE\u6807\uFF1A${goal.slice(0, 60)}\uFF09` : ""}`,
    ""
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    lines.push(`${i + 1}. ${c.name}\uFF08\u2B50${c.stars}\uFF0C${c.owner}\uFF09\u2014 ${c.matchReason}`);
    if (c.description) lines.push(`   ${c.description}`);
    lines.push(`   \u5B89\u88C5\uFF1A${c.install ?? "\u2014"}`);
  }
  lines.push("", "\u628A\u5019\u9009\u5C55\u793A\u7ED9\u7528\u6237\uFF0C\u8BA9\u7528\u6237\u9009\uFF08\u7528\u6237\u53EF\u4EE5\u8BF4\u300C\u88C5\u7B2C\u51E0\u4E2A\u300D\u6216\u300C\u88C5 XXX\u300D\uFF09\u3002");
  lines.push("\u7528\u6237\u9009\u5B9A\u540E\uFF0C\u8C03\u7528 ming_install\uFF08mode=install\uFF0Cplugin=\u9009\u4E2D\u7684 name\uFF09\u6267\u884C\u5B89\u88C5\u3002");
  return lines.join("\n");
}
async function resolveSource(plugin) {
  const search = await searchStorePlugins(plugin, { limit: 5, key: process.env.MING_STORE_KEY });
  const exact = search.plugins.find((p) => p.name === plugin);
  if (exact) {
    return { source: parseInstallCommand(exact.install).source, matched: exact };
  }
  if (/^[\w.\-/:@]+$/u.test(plugin)) {
    return { source: plugin };
  }
  throw new Error(`\u672A\u5728 1024Store \u627E\u5230\u300C${plugin}\u300D\u7684\u7CBE\u786E\u5339\u914D\uFF0C\u8BF7\u5148\u8C03\u7528 ming_install\uFF08mode=search\uFF09\u62FF\u5230\u5019\u9009\u518D\u8BA9\u7528\u6237\u9009`);
}
function registerMingInstallTool(ctx) {
  ctx.tools.register(defineTool5({
    name: "ming_install",
    description: `Ming \u80FD\u529B\u88C5\u914D\uFF1A\u5F53\u65B9\u6848\u58F0\u660E\u7684\u80FD\u529B\uFF08skill/MCP/\u5DE5\u5177/\u63D2\u4EF6\uFF09\u672C\u673A\u672A\u88C5\u914D\u65F6\uFF0C\u7528\u5B83\u5B8C\u6210\u300C\u641C\u7D22\u2192\u9009\u9879\u2192\u5B89\u88C5\u2192\u6838\u5BF9\u2192\u91CD\u8DD1\u6307\u5F15\u300D\u95ED\u73AF\u3002

mode=search\uFF1A\u6309\u5173\u952E\u8BCD\u641C\u7D22 1024Store \u793E\u533A\u63D2\u4EF6\u5E02\u573A\uFF0C\u8FD4\u56DE\u7ED3\u6784\u5316\u5019\u9009\uFF08\u6BCF\u4E2A\u542B\u5339\u914D\u7406\u7531\uFF09\uFF0C
  \u628A\u5019\u9009\u5C55\u793A\u7ED9\u7528\u6237\u9009\u62E9\uFF08\u8BF4\u6E05\u6BCF\u4E2A\u4E3A\u4EC0\u4E48\u4E0E\u76EE\u6807\u76F8\u5173\uFF09\uFF0C\u4E0D\u8981\u66FF\u7528\u6237\u51B3\u5B9A\uFF1B
mode=install\uFF1A\u6267\u884C\u7528\u6237\u9009\u5B9A\u63D2\u4EF6\u7684\u5B89\u88C5\uFF08plugin \u4F20\u7528\u6237\u9009\u4E2D\u7684\u5019\u9009 name\uFF09\uFF0C\u81EA\u52A8\u5B9A\u4F4D dsh\u3001\u89E3\u6790\u5E76\u6267\u884C\u5B89\u88C5\u547D\u4EE4\uFF0C
  \u6838\u5BF9 profile \u5199\u5165\u7ED3\u679C\uFF0C\u8FD4\u56DE\u300C\u5DF2\u786E\u8BA4 / \u9700\u624B\u52A8\u300D\u548C\u300C\u91CD\u542F\u540E\u91CD\u8DD1\u300D\u6307\u5F15\u3002

\u5B89\u5168\u63D0\u793A\uFF1A\u641C\u7D22\u514D\u8D39\u53EA\u8BFB\uFF1B\u5B89\u88C5\u7B2C\u4E09\u65B9\u63D2\u4EF6\u6709\u98CE\u9669\uFF0C\u5FC5\u987B\u7B49\u7528\u6237\u660E\u786E\u9009\u5B9A\u540E\u624D\u8C03\u7528 install \u6A21\u5F0F\u3002`,
    parameters: {
      mode: {
        type: "string",
        required: true,
        enum: ["search", "install"],
        description: "search=\u641C\u7D22\u5019\u9009\u7ED9\u7528\u6237\u9009\uFF1Binstall=\u5B89\u88C5\u7528\u6237\u9009\u5B9A\u7684\u63D2\u4EF6"
      },
      query: {
        type: "string",
        description: "mode=search \u5FC5\u586B\uFF1A\u641C\u7D22\u5173\u952E\u8BCD\uFF0C\u5982\u300Cexcel \u62A5\u8868\u300D\u300Cpdf \u8F6C markdown\u300D\u300C\u7F51\u7AD9\u90E8\u7F72\u300D\uFF1B\u901A\u5E38\u7528\u7F3A\u5931\u80FD\u529B\u540D\u6216\u7528\u6237\u610F\u56FE\u63D0\u70BC"
      },
      goal: {
        type: "string",
        description: "mode=search \u53EF\u9009\uFF1A\u7528\u6237\u76EE\u6807\uFF0C\u7528\u4E8E\u751F\u6210\u5019\u9009\u4E0E\u76EE\u6807\u7684\u76F8\u5173\u6027\u8BF4\u660E"
      },
      purpose: {
        type: "string",
        description: "mode=search \u53EF\u9009\uFF1A\u7F3A\u5931\u80FD\u529B\u627F\u62C5\u7684\u89D2\u8272\uFF08\u4EBA\u8BDD\uFF09\uFF0C\u5982\u300C\u628A\u9759\u6001\u7F51\u7AD9\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740\u300D\uFF0C\u7528\u4E8E\u5019\u9009\u63A8\u8350\u7406\u7531"
      },
      answers: {
        type: "object",
        additionalProperties: true,
        description: "mode=search \u53EF\u9009\uFF1A\u7528\u6237\u5DF2\u786E\u8BA4\u7684\u65B9\u5411\uFF08clarify \u6536\u96C6\u7684\u7B54\u6848\u952E\u503C\u5BF9\uFF09\uFF0C\u7528\u4E8E\u6309\u7528\u6237\u573A\u666F\u6392\u5E8F\u5019\u9009"
      },
      top: {
        type: "number",
        description: "mode=search \u53EF\u9009\uFF1A\u63A8\u8350\u5C55\u793A\u6570\u91CF\uFF0C\u9ED8\u8BA4 3\uFF08\u53EA\u63A8\u6700\u76F8\u5173\u7684\uFF0C\u907F\u514D\u773C\u82B1\u7F2D\u4E71\uFF09\uFF1B\u770B\u5168\u90E8\u53EF\u8C03\u5927"
      },
      plugin: {
        type: "string",
        description: "mode=install \u5FC5\u586B\uFF1A\u7528\u6237\u9009\u4E2D\u7684\u5019\u9009 name\uFF08\u6765\u81EA search \u8FD4\u56DE\u7684\u5019\u9009\u5217\u8868\uFF09"
      },
      limit: {
        type: "number",
        description: "mode=search \u53EF\u9009\uFF1A\u8FD4\u56DE\u5019\u9009\u6570\uFF0C\u9ED8\u8BA4 5\uFF0C\u6700\u5927 10"
      },
      sortBy: {
        type: "string",
        enum: ["stars", "growth24h", "added"],
        description: "mode=search \u53EF\u9009\uFF1A\u6392\u5E8F stars\uFF08\u9ED8\u8BA4\uFF09/ growth24h / added"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          mode: { type: "string", required: true },
          text: { type: "string", required: true },
          candidates: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", required: true },
                name: { type: "string", required: true },
                owner: { type: "string", required: true },
                stars: { type: "number", required: true },
                installCount: { type: "number", required: true },
                category: { type: "string", required: true },
                description: { type: "string", required: true },
                install: { type: "string", required: true },
                matchReason: { type: "string", required: true }
              }
            }
          },
          installed: { type: "boolean", required: true },
          confirmed: { type: "boolean", required: true },
          detail: { type: "string", required: true },
          command: { type: "string", required: true },
          profile: { type: "string", required: true },
          nextSteps: { type: "array", required: true, items: { type: "string" } },
          evidence: { type: "string", required: true },
          error: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.text }]
    },
    async execute(args, exec) {
      if (args.mode === "search") {
        const query = (args.query ?? "").trim();
        if (!query) {
          return {
            ok: false,
            mode: "search",
            text: "\u7F3A\u5C11\u641C\u7D22\u5173\u952E\u8BCD\uFF08query\uFF09\u3002\u8BF7\u7528\u7F3A\u5931\u80FD\u529B\u540D\u6216\u7528\u6237\u610F\u56FE\u63D0\u70BC\u4E00\u4E2A\u5173\u952E\u8BCD\u518D\u8BD5\u3002",
            candidates: [],
            installed: false,
            confirmed: false,
            detail: "",
            command: "",
            profile: "",
            nextSteps: [],
            evidence: "",
            error: "\u7F3A\u5C11\u641C\u7D22\u5173\u952E\u8BCD"
          };
        }
        const result = await searchStorePlugins(query, {
          limit: Math.min(Math.max(args.limit ?? 10, 1), 10),
          sortBy: args.sortBy,
          key: process.env.MING_STORE_KEY
        });
        if (!result.ok) {
          return {
            ok: false,
            mode: "search",
            text: `1024Store \u67E5\u8BE2\u5931\u8D25\uFF1A${result.error ?? "\u672A\u77E5\u9519\u8BEF"}\u3002\u53EF\u4EE5\u5148\u4E0D\u88C5\uFF0C\u7528\u73B0\u6709\u80FD\u529B\u5C3D\u529B\u5B8C\u6210\u3002`,
            candidates: [],
            installed: false,
            confirmed: false,
            detail: "",
            command: "",
            profile: "",
            nextSteps: [],
            evidence: "",
            error: result.error ?? "1024Store \u67E5\u8BE2\u5931\u8D25"
          };
        }
        const allCandidates = result.plugins.map((p) => toCandidate(p, query));
        if (allCandidates.length === 0) {
          return {
            ok: false,
            mode: "search",
            text: `1024Store \u6CA1\u6709\u627E\u5230\u4E0E\u300C${query}\u300D\u76F8\u5173\u7684\u63D2\u4EF6\uFF08${result.total ?? 0} \u6761\u5339\u914D\u4F46\u5747\u88AB\u8FC7\u6EE4\uFF09\u3002\u53EF\u4EE5\u5148\u4E0D\u88C5\uFF0C\u7528\u73B0\u6709\u80FD\u529B\u5C3D\u529B\u5B8C\u6210\u3002`,
            candidates: [],
            installed: false,
            confirmed: false,
            detail: "",
            command: "",
            profile: "",
            nextSteps: [],
            evidence: "",
            error: "\u65E0\u5339\u914D\u5019\u9009"
          };
        }
        const scenario = Object.values(args.answers ?? {}).map((v) => String(v));
        const top = Math.min(Math.max(args.top ?? 3, 1), allCandidates.length);
        const candidates = recommendCandidates(allCandidates, { query, purpose: args.purpose, scenario }, top);
        return {
          ok: true,
          mode: "search",
          candidates,
          text: formatCandidates(candidates, query, args.goal),
          installed: false,
          confirmed: false,
          detail: "",
          command: "",
          profile: "",
          nextSteps: [],
          evidence: "",
          error: ""
        };
      }
      const plugin = (args.plugin ?? "").trim();
      if (!plugin) {
        return {
          ok: false,
          mode: "install",
          text: "\u7F3A\u5C11 plugin \u53C2\u6570\u3002\u7528\u6237\u9009\u5B9A\u5019\u9009\u540E\uFF0C\u628A\u9009\u4E2D\u7684\u5019\u9009 name \u4F20\u8FDB\u6765\u3002",
          candidates: [],
          installed: false,
          confirmed: false,
          detail: "",
          command: "",
          profile: "",
          nextSteps: [],
          evidence: "",
          error: "\u7F3A\u5C11 plugin \u53C2\u6570"
        };
      }
      const workdir = resolveWorkdir(exec);
      try {
        const { source, matched } = await resolveSource(plugin);
        const outcome = await installCapability(source);
        let evidencePath = "";
        try {
          const outcomeForEvidence = {
            mode: "executed",
            success: outcome.installed,
            summary: `\u88C5\u914D\u63D2\u4EF6 ${source}\uFF08\u7528\u6237\u9009\u5B9A\uFF1A${plugin}${matched ? `\uFF0C${matched.owner}` : ""}\uFF09`,
            artifacts: [],
            error: outcome.installed ? void 0 : outcome.detail
          };
          const evidence = await writeEvidence({
            goal: `\u88C5\u914D\u80FD\u529B\uFF1A${source}`,
            resources: [],
            outcome: outcomeForEvidence,
            workdir
          });
          evidencePath = evidence.path;
        } catch {
        }
        const text = [
          outcome.ok ? "\u2705" : "\u274C",
          ` \u63D2\u4EF6\u300C${source}\u300D\uFF1A${outcome.detail}`,
          outcome.output ? `
\u5B89\u88C5\u8F93\u51FA\uFF1A
${outcome.output.slice(0, 600)}` : "",
          "",
          "\u63A5\u4E0B\u6765\uFF1A",
          ...outcome.nextSteps.map((s) => `  - ${s}`)
        ].join("\n");
        return {
          ok: outcome.ok,
          mode: "install",
          candidates: [],
          installed: outcome.installed,
          confirmed: outcome.confirmed,
          detail: outcome.detail,
          command: outcome.command,
          profile: outcome.profile,
          nextSteps: outcome.nextSteps,
          evidence: evidencePath,
          error: "",
          text
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          mode: "install",
          text: `\u5B89\u88C5\u5931\u8D25\uFF1A${message}`,
          candidates: [],
          installed: false,
          confirmed: false,
          detail: "",
          command: "",
          profile: "",
          nextSteps: [],
          evidence: "",
          error: message
        };
      }
    }
  }));
}

// src/tools/ming-plan.ts
import { defineTool as defineTool6 } from "@deepseek-ai/dsh-tools";
function formatPlan(ep) {
  const lines = [];
  const p = ep.plan;
  if (p.recipeName) {
    lines.push(`\u76EE\u6807\u53EF\u5957\u7528\u65B9\u6848\u300C${p.recipeName}\u300D\uFF08\u5339\u914D\uFF1A${p.matchedBy}\uFF09\uFF0C\u80FD\u529B\u88C5\u914D ${p.capabilities.filter((c) => c.available).length}/${p.capabilities.length}\u3002`);
  } else {
    lines.push(`\u6CA1\u6709\u547D\u4E2D\u5185\u7F6E\u65B9\u6848\uFF0C\u5C06\u7528\u901A\u7528\u59D4\u6D3E\u5B8C\u6210\uFF08Ming \u73B0\u6709\u7684\u5168\u90E8\u5DE5\u5177\u90FD\u4F1A\u53EF\u7528\uFF09\u3002`);
  }
  if (ep.questions.length > 0) {
    lines.push("", "\u9009\u62E9\u300C\u5148\u5BF9\u9F50\u9700\u6C42\u518D\u505A\u300D\u65F6\uFF0C\u53EA\u9700\u786E\u8BA4\u4EE5\u4E0B\u95EE\u9898\uFF08\u4E0D\u7B54\u5219\u7528\u9ED8\u8BA4\u503C\uFF09\uFF1A");
    for (const q of ep.questions) {
      const opts = q.options?.length ? `\uFF08${q.options.join(" / ")}\uFF09` : "";
      lines.push(`- ${q.question}${opts}\uFF5C\u9ED8\u8BA4\uFF1A${q.default}`);
    }
  }
  lines.push("", formatStrategyOptions(ep.strategyOptions));
  lines.push("", "\u63D0\u9192\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u6863/\u6587\u4EF6/\u4E0A\u4F20/\u7D20\u6750\u300D\u65F6\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u4E0A\u4F20\u6216\u627E\u8DEF\u5F84\u2014\u2014\u7D20\u6750\u7684\u5B9A\u4F4D\u4E0E\u8BFB\u53D6\u7531\u6267\u884C\u73AF\u8282\u81EA\u5DF1\u5B8C\u6210\uFF1B\u6F84\u6E05\u9636\u6BB5\u6700\u591A\u95EE\u4E00\u6B21\u7528\u6237\u60F3\u8981\u7684\u5185\u5BB9\u65B9\u5411\u3002");
  return lines.join("\n");
}
function registerMingPlanTool(ctx) {
  ctx.tools.register(defineTool6({
    name: "ming_plan",
    description: "Ming \u89C4\u5212\uFF1A\u7528\u6237\u521A\u63D0\u51FA\u4E00\u4E2A\u76EE\u6807\u65F6\uFF0C\u5148\u8C03\u7528\u672C\u5DE5\u5177\u89C4\u5212\u6267\u884C\u65B9\u5F0F\u2014\u2014\u8FD4\u56DE\u5339\u914D\u7684\u65B9\u6848\u3001\u4E24\u4E2A\u7B56\u7565\u9009\u9879\uFF08\u76F4\u63A5\u505A\u4E00\u7248\u5B8C\u6574\u7684 / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\u4E0E\u9700\u8981\u786E\u8BA4\u7684\u5173\u952E\u95EE\u9898\u3002\u628A\u9009\u9879\u5448\u73B0\u7ED9\u7528\u6237\u9009\u5B9A\u540E\uFF0C\u518D\u8C03\u7528 ming_auto\uFF08\u5E26\u4E0A strategy\uFF0C\u5FC5\u8981\u65F6\u5E26 answers\uFF09\u771F\u6B63\u6267\u884C\u3002\u672C\u5DE5\u5177\u53EA\u89C4\u5212\u4E0D\u6267\u884C\u3002",
    parameters: {
      goal: {
        type: "string",
        required: true,
        description: "\u7528\u6237\u60F3\u5B8C\u6210\u7684\u76EE\u6807\uFF08\u81EA\u7136\u8BED\u8A00\uFF09"
      },
      recipe: {
        type: "string",
        description: "\u53EF\u9009\uFF1A\u5DF2\u901A\u8FC7 ming_catalog \u786E\u8BA4\u7684\u65B9\u6848 id"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.text }]
    },
    async execute(args) {
      const ep = await planExecution(ctx, { goal: args.goal, recipeId: args.recipe });
      return { text: formatPlan(ep) };
    }
  }));
}

// src/tools/ming-store.ts
import { defineTool as defineTool7 } from "@deepseek-ai/dsh-tools";
function registerMingStoreTool(ctx) {
  ctx.tools.register(defineTool7({
    name: "ming_store_search",
    description: "\u641C\u7D22 DSH 1024Store \u793E\u533A\u63D2\u4EF6\u5E02\u573A\uFF0C\u67E5\u627E\u67D0\u4E2A\u80FD\u529B\u5BF9\u5E94\u7684\u53EF\u5B89\u88C5\u63D2\u4EF6\u3002\u5F53\u7528\u6237\u8981\u6C42\u7684\u80FD\u529B\u672C\u673A\u5C1A\u672A\u88C5\u914D\uFF08\u5982\u7F3A\u5C11\u67D0\u4E2A\u6587\u6863\u89E3\u6790\u3001Office \u5904\u7406\u3001\u6570\u636E\u6293\u53D6\u63D2\u4EF6\uFF09\u65F6\uFF0C\u5148\u7528\u672C\u5DE5\u5177\u641C\u7D22\u66FF\u4EE3\u63D2\u4EF6\uFF0C\u628A\u8FD4\u56DE\u7684\u5B89\u88C5\u547D\u4EE4\u4EA4\u7ED9\u7528\u6237\u786E\u8BA4\u540E\u518D\u88C5\u914D\u3002",
    parameters: {
      query: {
        type: "string",
        required: true,
        description: "\u8981\u641C\u7D22\u7684\u80FD\u529B\u5173\u952E\u8BCD\uFF0C\u5982\u300Cexcel \u5206\u6790\u300D\u300Cpdf \u8F6C markdown\u300D\u300C\u53D1\u7968 \u4E0B\u8F7D\u300D"
      },
      limit: {
        type: "number",
        description: "\u8FD4\u56DE\u6570\u91CF\uFF0C\u9ED8\u8BA4 5\uFF0C\u6700\u5927 10"
      },
      sortBy: {
        type: "string",
        enum: ["stars", "growth24h", "added"],
        description: "\u6392\u5E8F\uFF1Astars\uFF08\u661F\u6807\uFF0C\u9ED8\u8BA4\uFF09/ growth24h\uFF08\u8FD1 24h \u70ED\u5EA6\uFF09/ added\uFF08\u65B0\u8FD1\u52A0\u5165\uFF09"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.text }]
    },
    async execute(args) {
      const result = await searchStorePlugins(args.query, {
        limit: args.limit,
        sortBy: args.sortBy,
        key: process.env.MING_STORE_KEY
      });
      return { text: formatStoreResult(result, args.limit ?? 5) };
    }
  }));
}

// src/index.ts
var name = "@mingworkbench/capability-pack";
var version = "0.9.0";
var inject = ["tools", "systemPrompt"];
async function apply(ctx) {
  ctx.logger.info("\u{1F680} Ming Capability Pack \u6B63\u5728\u52A0\u8F7D...");
  try {
    registerMingAutoTool(ctx);
    registerMingCatalogTool(ctx);
    registerMingClarifyTool(ctx);
    registerMingHistoryTool(ctx);
    registerMingInstallTool(ctx);
    registerMingPlanTool(ctx);
    registerMingStoreTool(ctx);
    ctx.systemPrompt.section({
      name: "tool:ming_auto",
      order: 110,
      text: [
        "\u5F53\u7528\u6237\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u300C\u60F3\u5B8C\u6210\u7684\u4E8B\u60C5\u300D\u65F6\uFF0C\u5148\u8C03\u7528 ming_plan \u89C4\u5212\u6267\u884C\u65B9\u5F0F\uFF08\u5339\u914D\u65B9\u6848 + \u7B56\u7565\u9009\u62E9\uFF1A\u76F4\u63A5\u505A\u4E00\u7248\u5B8C\u6574\u7684 / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\uFF0C",
        "\u628A\u9009\u9879\u5448\u73B0\u7ED9\u7528\u6237\u9009\u5B9A\u540E\uFF0C\u518D\u8C03\u7528 ming_auto \u771F\u6B63\u5B8C\u6210\u5B83\uFF08\u5E26\u4E0A\u7528\u6237\u9009\u62E9\u7684 strategy\uFF0C\u5FC5\u8981\u65F6\u5E26\u4E0A\u786E\u8BA4\u7684 answers\uFF09\u3002",
        "\u5982\u679C\u7528\u6237\u9009\u300C\u5148\u5BF9\u9F50\u9700\u6C42\u518D\u505A\u300D\uFF08clarify-first\uFF09\uFF1A\u7528 ming_clarify \u505A\u5BF9\u8BDD\u5F0F\u6838\u5BF9\u2014\u2014",
        "\u4E00\u6B21\u53EA\u95EE\u4E00\u4E2A\u6700\u5173\u952E\u7684\u95EE\u9898\u3001\u7ED9\u9009\u9879\u8BA9\u7528\u6237\u6311\uFF0C\u628A\u7528\u6237\u7684\u5927\u767D\u8BDD\u7FFB\u8BD1\u6210\u7CFB\u7EDF\u903B\u8F91\u7B54\u6848\uFF08\u5982\u300C\u6587\u827A\u70B9\u300D\u2192 \u6D45\u8272\u80CC\u666F+\u886C\u7EBF\u5B57\u4F53+\u5927\u56FE\u7559\u767D\uFF09\uFF0C",
        "\u6BCF\u786E\u8BA4\u4E00\u70B9\u8C03\u7528\u4E00\u6B21 ming_clarify \u4F20\u5165\u65B0\u7B54\u6848\uFF1B\u4FE1\u606F\u591F\u4E86\uFF08\u7528\u6237\u8BF4\u300C\u4F60\u770B\u7740\u529E\u300D\u6216\u5173\u952E\u70B9\u5DF2\u9F50\uFF09\u5C31\u7ACB\u523B\u7528\u9ED8\u8BA4\u503C\u8865\u5168\u5E76\u8C03 ming_auto \u5F00\u59CB\u505A\uFF0C\u4E0D\u8981\u53CD\u590D\u8FFD\u95EE\u3002",
        "\u7528\u6237\u4E0D\u61C2\u6280\u672F\uFF1A\u6C38\u8FDC\u7528\u5927\u767D\u8BDD\u95EE\uFF0C\u7ED9\u9ED8\u8BA4\u503C\u515C\u5E95\uFF0C\u4E0D\u8981\u7528\u4EFB\u4F55\u672F\u8BED\uFF08HTML\u3001\u90E8\u7F72\u3001\u540E\u7AEF\u7B49\uFF09\u3002",
        "\u4F8B\u5982\uFF1A\u505A\u4E00\u4E2A\u7F51\u7AD9\u3001\u5904\u7406\u4E00\u6279\u6570\u636E\u3001\u6574\u7406\u6587\u4EF6\u3001\u5199\u6587\u6863\u3001\u8DD1\u81EA\u52A8\u5316\u6D41\u7A0B\u3001\u751F\u6210\u62A5\u8868\u7B49\u3002",
        "\u628A\u7528\u6237\u7684\u76EE\u6807\u539F\u6837\u5199\u8FDB goal \u53C2\u6570\uFF08\u4E00\u53E5\u8BDD\u6216\u4E00\u6BB5\u8BDD\uFF09\uFF1B\u5982\u6709\u76F8\u5173\u7684\u6587\u4EF6\u8DEF\u5F84\u6216 URL\uFF0C\u586B\u8FDB resources\u3002",
        "ming_auto \u4F1A\u628A\u76EE\u6807\u8F6C\u4EA4\u7ED9\u4E00\u4E2A\u5168\u65B0\u7684\u6267\u884C\u5B50\u4EE3\u7406\uFF0C\u7531\u5B83\u771F\u6B63\u6267\u884C\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\uFF1B\u5B8C\u6210\u540E\u6309\u5DE5\u5177\u8FD4\u56DE\u7684\u4EA7\u51FA\u6587\u4EF6\u8DEF\u5F84\u5411\u7528\u6237\u6C47\u62A5\u3002",
        "\u5F53\u7528\u6237\u60F3\u56DE\u987E\u4E4B\u524D\u505A\u8FC7\u4EC0\u4E48\u3001\u6216\u8981\u627E\u56DE\u4E4B\u524D\u4EFB\u52A1\u7684\u4EA7\u51FA\u65F6\uFF0C\u8C03\u7528 ming_history \u5DE5\u5177\u67E5\u8BE2\u5386\u53F2\u8BB0\u5F55\u3002",
        "Ming \u5185\u7F6E\u82E5\u5E72\u300C\u65B9\u6848\u5305\u300D\uFF08\u5982\u6574\u7406\u6587\u4EF6\u5939\u3001\u751F\u6210 HTML \u62A5\u8868\u3001\u642D\u5EFA\u4E2A\u4EBA\u7F51\u7AD9\uFF09\uFF0C\u4F1A\u81EA\u52A8\u5339\u914D\u5E76\u88C5\u914D\u80FD\u529B\uFF1B\u60F3\u67E5\u770B\u5168\u90E8\u53EF\u7528\u65B9\u6848\u65F6\u53EF\u8C03\u7528 ming_catalog\u3002",
        "\u5F53\u65B9\u6848\u6216\u7528\u6237\u8981\u6C42\u7684\u80FD\u529B\u672C\u673A\u672A\u88C5\u914D\uFF08\u5982\u7F3A\u5C11\u6587\u6863\u89E3\u6790\u3001Office \u5904\u7406\u3001\u7F51\u7AD9\u90E8\u7F72\u63D2\u4EF6\uFF09\u65F6\uFF0C\u5148\u8C03\u7528 ming_install\uFF08mode=search\uFF09\u5230 1024Store \u641C\u7D22\u66FF\u4EE3\u63D2\u4EF6\uFF0C\u628A\u5019\u9009\u5C55\u793A\u7ED9\u7528\u6237\u9009\u62E9\uFF08\u8BF4\u660E\u6BCF\u4E2A\u4E3A\u4EC0\u4E48\u4E0E\u76EE\u6807\u76F8\u5173\uFF0C\u4E0D\u8981\u66FF\u7528\u6237\u51B3\u5B9A\uFF09\uFF0C\u7528\u6237\u9009\u5B9A\u540E\u8C03\u7528 ming_install\uFF08mode=install\uFF0Cplugin=\u9009\u4E2D\u7684\u5019\u9009 name\uFF09\u6267\u884C\u5B89\u88C5\uFF1B\u88C5\u5B8C\u6309\u8FD4\u56DE\u7684\u6307\u5F15\u63D0\u793A\u91CD\u542F DSH\uFF0C\u91CD\u542F\u540E\u7528\u6237\u518D\u8BF4\u4E00\u904D\u76EE\u6807\uFF0CMing \u4F1A\u81EA\u52A8\u590D\u7528\u65B0\u80FD\u529B\u3002\u641C\u7D22\u514D\u8D39\u53EA\u8BFB\uFF0C\u5B89\u88C5\u5FC5\u987B\u7B49\u7528\u6237\u660E\u786E\u9009\u5B9A\u540E\u624D\u6267\u884C\uFF1B\u4E5F\u53EF\u4EE5\u5148\u7528 ming_store_search \u505A\u53EA\u8BFB\u6D4F\u89C8\u3002",
        "\u90E8\u5206\u65B9\u6848\u662F\u591A\u6B65\u5DE5\u4F5C\u6D41\uFF08\u5982\u300C\u53D1\u5E03\u7F51\u7AD9\u300D= \u5EFA\u7AD9 \u2192 \u6821\u9A8C \u2192 \u53D1\u5E03\uFF09\u3002Ming \u4F1A\u9010\u6B65\u6267\u884C\u3001\u9010\u6B65\u72EC\u7ACB\u9A8C\u6536\uFF1A\u67D0\u4E00\u6B65\u5931\u8D25\u4F1A\u660E\u786E\u544A\u8BC9\u7528\u6237\u662F\u54EA\u4E00\u6B65\u3001\u5E38\u89C1\u539F\u56E0\u548C\u4FEE\u6CD5\uFF08\u5751\u4F4D\uFF09\uFF0C\u4E0D\u9700\u8981\u7528\u6237\u81EA\u5DF1\u6392\u67E5\uFF1B\u67D0\u4E00\u6B65\u7F3A\u80FD\u529B\u4F1A\u505C\u4E0B\u5F15\u5BFC\u8D70 ming_install \u88C5\u914D\uFF0C\u88C5\u5B8C\u91CD\u542F\u540E\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u300D\uFF0C\u5C31\u628A workflowFrom=<\u5931\u8D25\u6B65 id> \u4F20\u7ED9 ming_auto\uFF0C\u4ECE\u5931\u8D25\u6B65\u63A5\u7740\u505A\uFF0C\u4E0D\u91CD\u505A\u524D\u9762\u5DF2\u5B8C\u6210\u7684\u90E8\u5206\u3002",
        "\u6CE8\u610F\uFF1A\u5982\u679C\u4F60\u81EA\u8EAB\u5C31\u662F\u88AB ming_auto \u59D4\u6D3E\u53BB\u6267\u884C\u5177\u4F53\u5B50\u4EFB\u52A1\u7684\u5B50\u4EE3\u7406\uFF0C\u4E0D\u8981\u518D\u6B21\u8C03\u7528\u672C\u5DE5\u5177\uFF08\u4F60\u7684\u5DE5\u5177\u5217\u8868\u91CC\u4E5F\u4E0D\u4F1A\u51FA\u73B0\u5B83\uFF09\u3002"
      ].join("\n")
    });
    ctx.logger.info("\u2705 ming_plan / ming_clarify / ming_auto / ming_catalog / ming_install / ming_store_search / ming_history \u5DE5\u5177\u5DF2\u6CE8\u518C");
    ctx.logger.info("\u{1F4A1} \u76F4\u63A5\u63CF\u8FF0\u4F60\u60F3\u505A\u7684\u4E8B\uFF0CMing \u4F1A\u5E2E\u4F60\u771F\u6B63\u5B8C\u6210");
  } catch (error) {
    ctx.logger.error("\u274C Ming Capability Pack \u52A0\u8F7D\u5931\u8D25", error);
    throw error;
  }
}
export {
  apply,
  inject,
  name,
  version
};
