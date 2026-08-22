import {
  appendMissingNotice,
  execute,
  nextStepsFor,
  resolveWorkdir
} from "./chunk-XHW6I3NC.js";

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
  if (value.artifacts.length > 0) {
    lines.push("", "\u4EA7\u51FA\uFF1A");
    value.artifacts.forEach((a) => lines.push(`  - ${a}`));
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
    description: `Ming \u667A\u80FD\u52A9\u624B\uFF1A\u7528\u6237\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u60F3\u505A\u7684\u4E8B\uFF0CMing \u4E00\u952E\u4EA4\u7ED9 Harness \u539F\u751F Agent \u771F\u6B63\u5B8C\u6210\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\u3002

\u9002\u5408\uFF1A\u751F\u6210\u7F51\u7AD9\u3001\u5904\u7406\u56FE\u7247/\u6570\u636E\u3001\u6574\u7406\u6587\u4EF6\u3001\u5199\u6587\u6863\u3001\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41\u7B49\u4EFB\u4F55\u53EF\u63CF\u8FF0\u7684\u4EFB\u52A1\u3002
\u63D0\u793A\uFF1A\u5C3D\u91CF\u8BF4\u6E05\u300C\u60F3\u8981\u4EC0\u4E48\u7ED3\u679C\u300D\uFF0C\u53EF\u9644\u5E26\u6587\u4EF6\u8DEF\u5F84\u6216 URL\u3002`,
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
          nextSteps: { type: "array", required: true, items: { type: "string" } }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatResult(value) }]
    },
    async execute(args, exec) {
      const goal = args.goal;
      const resources = args.resources ?? [];
      const outcome = await execute(ctx, goal, resources, exec);
      let evidencePath = "";
      try {
        const evidence = await writeEvidence({ goal, resources, outcome, workdir: resolveWorkdir(exec) });
        evidencePath = evidence.path;
      } catch {
      }
      const result = {
        success: outcome.success,
        mode: outcome.mode,
        summary: appendMissingNotice(outcome),
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: nextStepsFor(outcome)
      };
      return result;
    }
  }));
}

// src/tools/ming-history.ts
import { readFile, readdir } from "fs/promises";
import { join as join2 } from "path";
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";
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
  ctx.tools.register(defineTool2({
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

// src/index.ts
var name = "@mingworkbench/capability-pack";
var version = "0.6.0";
var inject = ["tools", "systemPrompt"];
async function apply(ctx) {
  ctx.logger.info("\u{1F680} Ming Capability Pack \u6B63\u5728\u52A0\u8F7D...");
  try {
    registerMingAutoTool(ctx);
    registerMingHistoryTool(ctx);
    ctx.systemPrompt.section({
      name: "tool:ming_auto",
      order: 110,
      text: [
        "\u5F53\u7528\u6237\u7528\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0\u300C\u60F3\u5B8C\u6210\u7684\u4E8B\u60C5\u300D\u65F6\uFF0C\u8C03\u7528 ming_auto \u5DE5\u5177\u6765\u771F\u6B63\u5B8C\u6210\u5B83\u3002",
        "\u4F8B\u5982\uFF1A\u505A\u4E00\u4E2A\u7F51\u7AD9\u3001\u5904\u7406\u4E00\u6279\u6570\u636E\u3001\u6574\u7406\u6587\u4EF6\u3001\u5199\u6587\u6863\u3001\u8DD1\u81EA\u52A8\u5316\u6D41\u7A0B\u3001\u751F\u6210\u62A5\u8868\u7B49\u3002",
        "\u628A\u7528\u6237\u7684\u76EE\u6807\u539F\u6837\u5199\u8FDB goal \u53C2\u6570\uFF08\u4E00\u53E5\u8BDD\u6216\u4E00\u6BB5\u8BDD\uFF09\uFF1B\u5982\u6709\u76F8\u5173\u7684\u6587\u4EF6\u8DEF\u5F84\u6216 URL\uFF0C\u586B\u8FDB resources\u3002",
        "ming_auto \u4F1A\u628A\u76EE\u6807\u8F6C\u4EA4\u7ED9\u4E00\u4E2A\u5168\u65B0\u7684\u6267\u884C\u5B50\u4EE3\u7406\uFF0C\u7531\u5B83\u771F\u6B63\u6267\u884C\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\uFF1B\u5B8C\u6210\u540E\u6309\u5DE5\u5177\u8FD4\u56DE\u7684\u4EA7\u51FA\u6587\u4EF6\u8DEF\u5F84\u5411\u7528\u6237\u6C47\u62A5\u3002",
        "\u5F53\u7528\u6237\u60F3\u56DE\u987E\u4E4B\u524D\u505A\u8FC7\u4EC0\u4E48\u3001\u6216\u8981\u627E\u56DE\u4E4B\u524D\u4EFB\u52A1\u7684\u4EA7\u51FA\u65F6\uFF0C\u8C03\u7528 ming_history \u5DE5\u5177\u67E5\u8BE2\u5386\u53F2\u8BB0\u5F55\u3002",
        "\u6CE8\u610F\uFF1A\u5982\u679C\u4F60\u81EA\u8EAB\u5C31\u662F\u88AB ming_auto \u59D4\u6D3E\u53BB\u6267\u884C\u5177\u4F53\u5B50\u4EFB\u52A1\u7684\u5B50\u4EE3\u7406\uFF0C\u4E0D\u8981\u518D\u6B21\u8C03\u7528\u672C\u5DE5\u5177\uFF08\u4F60\u7684\u5DE5\u5177\u5217\u8868\u91CC\u4E5F\u4E0D\u4F1A\u51FA\u73B0\u5B83\uFF09\u3002"
      ].join("\n")
    });
    ctx.logger.info("\u2705 ming_auto / ming_history \u5DE5\u5177\u5DF2\u6CE8\u518C");
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
