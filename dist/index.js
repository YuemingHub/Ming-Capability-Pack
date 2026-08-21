// src/tools/ming-auto.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/services/executor.ts
async function execute(ctx, goal, resources, exec) {
  const subagents = ctx.get("subagents");
  const provider = pickProvider(subagents);
  if (subagents && provider && exec?.agent) {
    return executeViaSubagent(subagents, provider, goal, resources, exec);
  }
  return {
    mode: "planned",
    success: true,
    summary: "\u5DF2\u63A5\u6536\u4EFB\u52A1\u3002\u5F53\u524D\u73AF\u5883\u672A\u542F\u7528\u5B50\u4EE3\u7406\u6267\u884C\u5F15\u64CE\uFF0C\u8BF7\u76F4\u63A5\u5B8C\u6210\u8BE5\u76EE\u6807\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\u3002",
    artifacts: []
  };
}
async function executeViaSubagent(subagents, provider, goal, resources, exec) {
  const prompt = buildPrompt(goal, resources, resolveWorkdir(exec));
  try {
    const run = await subagents.start(provider, {
      label: `ming: ${truncate(goal, 40)}`,
      prompt: [{ type: "text", text: prompt }],
      parent: exec.agent,
      signal: exec.signal
    });
    let result;
    try {
      result = await run.result;
    } finally {
      try {
        await run.dispose();
      } catch {
      }
    }
    if (result.stopReason !== "completed") {
      const reason = stopReasonText(result.stopReason);
      return {
        mode: "executed",
        success: false,
        summary: `\u6267\u884C\u672A\u5B8C\u6210\uFF1A${reason}`,
        artifacts: [],
        error: reason
      };
    }
    const text = result.output.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
    return {
      mode: "executed",
      success: true,
      summary: text.trim() || "\u4EFB\u52A1\u5DF2\u6267\u884C\u5B8C\u6210",
      artifacts: extractArtifacts(text)
    };
  } catch (error) {
    return {
      mode: "executed",
      success: false,
      summary: "\u6267\u884C\u5F15\u64CE\u8C03\u7528\u5931\u8D25",
      artifacts: [],
      error: String(error)
    };
  }
}
function buildPrompt(goal, resources, workdir) {
  const lines = [
    "\u4F60\u662F Ming \u7684\u6267\u884C\u52A9\u624B\u3002\u8BF7\u5B8C\u6574\u5730\u5B8C\u6210\u4E0B\u9762\u7684\u4EFB\u52A1\uFF0C\u5E76\u4EA7\u51FA\u771F\u5B9E\u7ED3\u679C\uFF08\u6587\u4EF6\u3001\u811A\u672C\u3001\u7F51\u9875\u7B49\uFF09\uFF0C\u4E0D\u8981\u53EA\u7ED9\u5EFA\u8BAE\u3002",
    "\u4F60\u53EF\u4EE5\u4F7F\u7528\u53EF\u7528\u7684\u5DE5\u5177\uFF08\u8BFB\u5199\u6587\u4EF6\u3001\u6267\u884C\u547D\u4EE4\u3001\u5B50\u4EE3\u7406\u7B49\uFF09\u6765\u5B8C\u6210\u5B83\u3002",
    "",
    `\u3010\u7528\u6237\u76EE\u6807\u3011
${goal}`
  ];
  if (resources.length > 0) {
    lines.push("", "\u3010\u7528\u6237\u63D0\u4F9B\u7684\u8D44\u6E90\u3011", ...resources.map((r) => `- ${r}`));
  }
  lines.push("", `\u3010\u5DE5\u4F5C\u76EE\u5F55\u3011
${workdir}`);
  lines.push("", "\u5B8C\u6210\u540E\uFF0C\u7528\u7B80\u6D01\u7684\u4E2D\u6587\u6C47\u62A5\uFF1A\u505A\u4E86\u4EC0\u4E48\u3001\u4EA7\u51FA\u4E86\u54EA\u4E9B\u6587\u4EF6\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\u3001\u5982\u4F55\u67E5\u770B\u3002");
  return lines.join("\n");
}
function extractArtifacts(text) {
  const found = /* @__PURE__ */ new Set();
  const patterns = [
    /[A-Za-z]:\\[^\s，。；、]+/g,
    /(?:\/|\.\/)[^\s，。；、]+\.[A-Za-z0-9]{1,5}/g,
    /https?:\/\/[^\s，。；、]+/gi
  ];
  for (const re of patterns) {
    for (const m of text.match(re) ?? []) {
      found.add(m);
    }
  }
  return [...found];
}
function pickProvider(subagents) {
  if (!subagents) return void 0;
  const available = subagents.list();
  for (const preferred of ["spawn", "fork"]) {
    if (available.includes(preferred)) return preferred;
  }
  return available[0];
}
function resolveWorkdir(exec) {
  return exec.agent?.session?.header?.cwd ?? process.cwd();
}
function stopReasonText(stopReason) {
  switch (stopReason) {
    case "aborted":
      return "\u4EFB\u52A1\u88AB\u53D6\u6D88";
    case "error":
      return "\u6267\u884C\u51FA\u9519";
    case "max-tokens":
      return "\u6267\u884C\u8FBE\u5230 token \u4E0A\u9650\uFF0C\u672A\u80FD\u5B8C\u6210";
    case "refusal":
      return "\u6267\u884C\u5F15\u64CE\u62D2\u7EDD\u4E86\u8BE5\u4EFB\u52A1";
    default:
      return `\u5F02\u5E38\u7ED3\u675F\uFF08${String(stopReason)}\uFF09`;
  }
}
function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}\u2026`;
}

// src/services/evidence-collector.ts
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
async function writeEvidence(payload) {
  const dir = join(process.cwd(), "ming-evidence");
  await mkdir(dir, { recursive: true });
  const id = `evidence-${Date.now()}`;
  const card = {
    id,
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
        const evidence = await writeEvidence({ goal, resources, outcome });
        evidencePath = evidence.path;
      } catch {
      }
      const result = {
        success: outcome.success,
        mode: outcome.mode,
        summary: outcome.summary,
        artifacts: outcome.artifacts,
        evidence: evidencePath,
        nextSteps: outcome.success ? ["\u67E5\u770B\u4E0A\u9762\u5217\u51FA\u7684\u4EA7\u51FA\u6587\u4EF6", "\u5982\u9700\u4FEE\u6539\uFF0C\u76F4\u63A5\u544A\u8BC9\u6211\u6539\u54EA\u91CC", "\u6EE1\u610F\u540E\u53EF\u7EE7\u7EED\u4E0B\u4E00\u4E2A\u4EFB\u52A1"] : ["\u53EF\u4EE5\u8865\u5145\u66F4\u5177\u4F53\u7684\u9700\u6C42\u540E\u91CD\u8BD5", "\u6216\u6362\u4E00\u79CD\u8BF4\u6CD5\u63CF\u8FF0\u76EE\u6807"]
      };
      return result;
    }
  }));
}

// src/index.ts
var name = "@mingworkbench/capability-pack";
var version = "0.3.0";
var inject = ["tools"];
async function apply(ctx) {
  ctx.logger.info("\u{1F680} Ming Capability Pack \u6B63\u5728\u52A0\u8F7D...");
  try {
    registerMingAutoTool(ctx);
    ctx.logger.info("\u2705 ming_auto \u5DE5\u5177\u5DF2\u6CE8\u518C");
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
