import {
  appendMissingNotice,
  assembleContext,
  execute,
  formatStoreResult,
  formatStrategyOptions,
  formatVerification,
  nextStepsFor,
  planExecution,
  recipeCatalog,
  resolveAnswers,
  resolveCapabilities,
  resolveWorkdir,
  searchStorePlugins,
  verifyChecks
} from "./chunk-4VF5VF3S.js";

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
\u63D0\u793A\uFF1A\u5148\u8C03\u7528 ming_plan \u67E5\u770B\u7B56\u7565\u9009\u62E9\uFF08\u5148\u8DD1 MVP / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\uFF0C\u518D\u6309\u7528\u6237\u9009\u62E9\u628A strategy \u4F20\u8FDB\u6765\uFF1B
\u4E5F\u53EF\u76F4\u63A5\u6307\u5B9A recipe \u65B9\u6848 id\u3002\u5C3D\u91CF\u8BF4\u6E05\u300C\u60F3\u8981\u4EC0\u4E48\u7ED3\u679C\u300D\uFF0C\u53EF\u9644\u5E26\u6587\u4EF6\u8DEF\u5F84\u6216 URL\u3002`,
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
        description: "\u53EF\u9009\uFF1A\u6267\u884C\u7B56\u7565\u3002mvp-first \u7528\u9ED8\u8BA4\u503C\u76F4\u63A5\u505A\uFF08\u9ED8\u8BA4\uFF09\uFF1Bclarify-first \u7528\u7528\u6237\u5DF2\u786E\u8BA4\u7684\u7B54\u6848\u88C5\u914D\u540E\u518D\u505A"
      },
      answers: {
        type: "object",
        additionalProperties: true,
        description: "\u53EF\u9009\uFF1Aclarify-first \u65F6\u7528\u6237\u786E\u8BA4\u7684\u7B54\u6848\uFF08\u952E\u503C\u5BF9\uFF0C\u952E\u5BF9\u5E94 ming_plan \u8FD4\u56DE\u7684\u6F84\u6E05\u95EE\u9898 key\uFF09\uFF1B\u7F3A\u5931\u9879\u7528\u9ED8\u8BA4\u503C"
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
      if (plan.recipeId && !plan.executable) {
        const missing = plan.missingRequired.join("\u3001");
        const result2 = {
          success: false,
          mode: "planned",
          summary: `\u5DF2\u5339\u914D\u65B9\u6848\u300C${plan.recipeName}\u300D\uFF0C\u4F46\u7F3A\u5C11\u5FC5\u9009\u80FD\u529B\uFF08${missing}\uFF09\uFF0C\u672A\u6267\u884C\u3002\u8BF7\u5148\u6309\u6307\u5F15\u88C5\u914D\u80FD\u529B\u540E\u91CD\u8BD5\uFF0C\u6216\u76F4\u63A5\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u76EE\u6807\u8BA9\u6211\u7528\u73B0\u6709\u5DE5\u5177\u5B8C\u6210\u3002`,
          artifacts: [],
          evidence: "",
          nextSteps: plan.capabilities.filter((c) => !c.available).map((c) => c.installHint ?? `\u88C5\u914D ${c.ref.kind}:${c.ref.id}`),
          recipe: plan.recipeName ?? "",
          planSummary: buildPlanSummary(plan),
          verificationSummary: ""
        };
        return result2;
      }
      const answers = resolveAnswers(plan, args.strategy, args.answers);
      const contextual = assembleContext(plan, answers);
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
        summary: appendMissingNotice(outcome),
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: nextStepsFor(outcome),
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
  return parts.join("\uFF1B");
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

// src/tools/ming-history.ts
import { readFile, readdir } from "fs/promises";
import { join as join2 } from "path";
import { defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";
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
  ctx.tools.register(defineTool3({
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

// src/tools/ming-plan.ts
import { defineTool as defineTool4 } from "@deepseek-ai/dsh-tools";
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
  return lines.join("\n");
}
function registerMingPlanTool(ctx) {
  ctx.tools.register(defineTool4({
    name: "ming_plan",
    description: "Ming \u89C4\u5212\uFF1A\u7528\u6237\u521A\u63D0\u51FA\u4E00\u4E2A\u76EE\u6807\u65F6\uFF0C\u5148\u8C03\u7528\u672C\u5DE5\u5177\u89C4\u5212\u6267\u884C\u65B9\u5F0F\u2014\u2014\u8FD4\u56DE\u5339\u914D\u7684\u65B9\u6848\u3001\u4E24\u4E2A\u7B56\u7565\u9009\u9879\uFF08\u5148\u8DD1 MVP / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\u4E0E\u9700\u8981\u786E\u8BA4\u7684\u5173\u952E\u95EE\u9898\u3002\u628A\u9009\u9879\u5448\u73B0\u7ED9\u7528\u6237\u9009\u5B9A\u540E\uFF0C\u518D\u8C03\u7528 ming_auto\uFF08\u5E26\u4E0A strategy\uFF0C\u5FC5\u8981\u65F6\u5E26 answers\uFF09\u771F\u6B63\u6267\u884C\u3002\u672C\u5DE5\u5177\u53EA\u89C4\u5212\u4E0D\u6267\u884C\u3002",
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
import { defineTool as defineTool5 } from "@deepseek-ai/dsh-tools";
function registerMingStoreTool(ctx) {
  ctx.tools.register(defineTool5({
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
var version = "0.6.0";
var inject = ["tools", "systemPrompt"];
async function apply(ctx) {
  ctx.logger.info("\u{1F680} Ming Capability Pack \u6B63\u5728\u52A0\u8F7D...");
  try {
    registerMingAutoTool(ctx);
    registerMingCatalogTool(ctx);
    registerMingHistoryTool(ctx);
    registerMingPlanTool(ctx);
    registerMingStoreTool(ctx);
    ctx.systemPrompt.section({
      name: "tool:ming_auto",
      order: 110,
      text: [
        "\u5F53\u7528\u6237\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u300C\u60F3\u5B8C\u6210\u7684\u4E8B\u60C5\u300D\u65F6\uFF0C\u5148\u8C03\u7528 ming_plan \u89C4\u5212\u6267\u884C\u65B9\u5F0F\uFF08\u5339\u914D\u65B9\u6848 + \u7B56\u7565\u9009\u62E9\uFF1A\u5148\u8DD1 MVP / \u5148\u5BF9\u9F50\u9700\u6C42\uFF09\uFF0C",
        "\u628A\u9009\u9879\u5448\u73B0\u7ED9\u7528\u6237\u9009\u5B9A\u540E\uFF0C\u518D\u8C03\u7528 ming_auto \u771F\u6B63\u5B8C\u6210\u5B83\uFF08\u5E26\u4E0A\u7528\u6237\u9009\u62E9\u7684 strategy\uFF0C\u5FC5\u8981\u65F6\u5E26\u4E0A\u786E\u8BA4\u7684 answers\uFF09\u3002",
        "\u4F8B\u5982\uFF1A\u505A\u4E00\u4E2A\u7F51\u7AD9\u3001\u5904\u7406\u4E00\u6279\u6570\u636E\u3001\u6574\u7406\u6587\u4EF6\u3001\u5199\u6587\u6863\u3001\u8DD1\u81EA\u52A8\u5316\u6D41\u7A0B\u3001\u751F\u6210\u62A5\u8868\u7B49\u3002",
        "\u628A\u7528\u6237\u7684\u76EE\u6807\u539F\u6837\u5199\u8FDB goal \u53C2\u6570\uFF08\u4E00\u53E5\u8BDD\u6216\u4E00\u6BB5\u8BDD\uFF09\uFF1B\u5982\u6709\u76F8\u5173\u7684\u6587\u4EF6\u8DEF\u5F84\u6216 URL\uFF0C\u586B\u8FDB resources\u3002",
        "ming_auto \u4F1A\u628A\u76EE\u6807\u8F6C\u4EA4\u7ED9\u4E00\u4E2A\u5168\u65B0\u7684\u6267\u884C\u5B50\u4EE3\u7406\uFF0C\u7531\u5B83\u771F\u6B63\u6267\u884C\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\uFF1B\u5B8C\u6210\u540E\u6309\u5DE5\u5177\u8FD4\u56DE\u7684\u4EA7\u51FA\u6587\u4EF6\u8DEF\u5F84\u5411\u7528\u6237\u6C47\u62A5\u3002",
        "\u5F53\u7528\u6237\u60F3\u56DE\u987E\u4E4B\u524D\u505A\u8FC7\u4EC0\u4E48\u3001\u6216\u8981\u627E\u56DE\u4E4B\u524D\u4EFB\u52A1\u7684\u4EA7\u51FA\u65F6\uFF0C\u8C03\u7528 ming_history \u5DE5\u5177\u67E5\u8BE2\u5386\u53F2\u8BB0\u5F55\u3002",
        "Ming \u5185\u7F6E\u82E5\u5E72\u300C\u65B9\u6848\u5305\u300D\uFF08\u5982\u6574\u7406\u6587\u4EF6\u5939\u3001\u751F\u6210 HTML \u62A5\u8868\u3001\u642D\u5EFA\u4E2A\u4EBA\u7F51\u7AD9\uFF09\uFF0C\u4F1A\u81EA\u52A8\u5339\u914D\u5E76\u88C5\u914D\u80FD\u529B\uFF1B\u60F3\u67E5\u770B\u5168\u90E8\u53EF\u7528\u65B9\u6848\u65F6\u53EF\u8C03\u7528 ming_catalog\u3002",
        "\u5F53\u7528\u6237\u8981\u6C42\u7684\u80FD\u529B\u672C\u673A\u672A\u88C5\u914D\uFF08\u5982\u7F3A\u5C11\u6587\u6863\u89E3\u6790\u3001Office \u5904\u7406\u63D2\u4EF6\uFF09\u65F6\uFF0C\u8C03\u7528 ming_store_search \u5230 1024Store \u793E\u533A\u63D2\u4EF6\u5E02\u573A\u641C\u7D22\u66FF\u4EE3\u63D2\u4EF6\uFF0C\u628A\u8FD4\u56DE\u7684\u5B89\u88C5\u547D\u4EE4\u4EA4\u7ED9\u7528\u6237\u786E\u8BA4\u3002",
        "\u6CE8\u610F\uFF1A\u5982\u679C\u4F60\u81EA\u8EAB\u5C31\u662F\u88AB ming_auto \u59D4\u6D3E\u53BB\u6267\u884C\u5177\u4F53\u5B50\u4EFB\u52A1\u7684\u5B50\u4EE3\u7406\uFF0C\u4E0D\u8981\u518D\u6B21\u8C03\u7528\u672C\u5DE5\u5177\uFF08\u4F60\u7684\u5DE5\u5177\u5217\u8868\u91CC\u4E5F\u4E0D\u4F1A\u51FA\u73B0\u5B83\uFF09\u3002"
      ].join("\n")
    });
    ctx.logger.info("\u2705 ming_plan / ming_auto / ming_catalog / ming_history / ming_store_search \u5DE5\u5177\u5DF2\u6CE8\u518C");
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
