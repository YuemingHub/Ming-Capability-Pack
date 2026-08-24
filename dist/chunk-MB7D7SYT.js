// src/services/acceptance-log.ts
import { appendFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
function failedKindsOf(results) {
  return results.filter((r) => !r.passed).map((r) => r.check.kind);
}
async function appendAcceptanceRecord(workdir, record) {
  const dir = join(workdir, "ming-evidence");
  await mkdir(dir, { recursive: true });
  const filepath = join(dir, "acceptance-history.jsonl");
  await appendFile(filepath, JSON.stringify(record) + "\n", "utf-8");
  return filepath;
}
async function readAcceptanceHistory(workdir) {
  const filepath = join(workdir, "ming-evidence", "acceptance-history.jsonl");
  let content;
  try {
    content = await readFile(filepath, "utf-8");
  } catch {
    return [];
  }
  const records = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
    }
  }
  return records;
}
function summarizeAcceptance(records) {
  const byRecipe = /* @__PURE__ */ new Map();
  for (const r of records) {
    const key = r.recipeId ?? "(generic)";
    const list = byRecipe.get(key) ?? [];
    list.push(r);
    byRecipe.set(key, list);
  }
  const out = [];
  for (const list of byRecipe.values()) {
    const totalPassed = list.reduce((s, r) => s + r.passed, 0);
    const totalFailed = list.reduce((s, r) => s + r.failed, 0);
    const totalChecks = totalPassed + totalFailed;
    const last = list[list.length - 1];
    out.push({
      recipeId: last.recipeId,
      recipeName: last.recipeName,
      totalRuns: list.length,
      totalPassed,
      totalFailed,
      passRate: totalChecks > 0 ? totalPassed / totalChecks : null,
      lastRunAt: last.timestamp
    });
  }
  return out;
}
function formatAcceptance(summaries) {
  if (summaries.length === 0) {
    return "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u9A8C\u6536\u8BB0\u5F55\uFF08\u5C1A\u672A\u6709\u4EFB\u4F55\u5E26\u9A8C\u6536\u7684\u65B9\u6848\u4EFB\u52A1\u5B8C\u6210\uFF09\u3002";
  }
  const lines = ["\u9A8C\u6536\u5065\u5EB7\u5EA6\uFF08\u6309\u65B9\u6848\u805A\u5408\uFF09\uFF1A", ""];
  for (const s of summaries) {
    const rate = s.passRate === null ? "\u2014" : `${(s.passRate * 100).toFixed(0)}%`;
    const name = s.recipeName ?? s.recipeId ?? "(\u901A\u7528\u59D4\u6D3E)";
    lines.push(`- ${name}\uFF1A${s.totalRuns} \u6B21\u8FD0\u884C\uFF0C\u901A\u8FC7\u7387 ${rate}\uFF08${s.totalPassed} \u8FC7 / ${s.totalFailed} \u8D25\uFF09\uFF0C\u6700\u8FD1 ${s.lastRunAt}`);
  }
  return lines.join("\n");
}
function monthKeyOf(iso) {
  return iso.slice(0, 7);
}
function computeVte(records, month) {
  const key = month ?? monthKeyOf((/* @__PURE__ */ new Date()).toISOString());
  return records.filter((r) => monthKeyOf(r.timestamp) === key && r.failed === 0).length;
}
function computeVteTrend(records, months = 3) {
  const now = /* @__PURE__ */ new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, vte: computeVte(records, key) });
  }
  return out;
}
function formatVte(currentVte, trend) {
  const line = `\u672C\u6708 VTE\uFF1A${currentVte}`;
  if (trend.length === 0) return line;
  const parts = trend.map((t) => `${t.month}\uFF1A${t.vte}`).join("\uFF0C");
  return `${line}
\u8FD1 ${trend.length} \u4E2A\u6708\u8D8B\u52BF\uFF1A${parts}`;
}

// src/services/executor.ts
import { stat } from "fs/promises";
import { isAbsolute, resolve } from "path";
var DEFAULT_TIMEOUT_MS = 15 * 60 * 1e3;
function resolveTimeoutMs() {
  const raw = Number(process.env.MING_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TIMEOUT_MS;
}
function isUrl(text) {
  return /^https?:\/\//i.test(text);
}
function looksLikeLocalPath(text) {
  if (isUrl(text)) return false;
  return /[\\/]/.test(text) || /^[A-Za-z]:/.test(text) || text.startsWith("./") || text.startsWith("../") || text.startsWith("~");
}
function resolveWorkdir(exec) {
  return exec.agent?.session?.header?.cwd ?? process.cwd();
}
async function execute(ctx, goal, resources, exec, options = {}) {
  const startedAt = Date.now();
  const workdir = resolveWorkdir(exec);
  const missingResources = await findMissingResources(resources, workdir);
  if (missingResources.length > 0) {
    return {
      mode: "planned",
      success: false,
      summary: `\u63D0\u4F9B\u7684\u8D44\u6E90\u4E2D\u6709 ${missingResources.length} \u4E2A\u672C\u5730\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF0C\u5DF2\u53D6\u6D88\u59D4\u6D3E\uFF1A${missingResources.join("\u3001")}`,
      artifacts: [],
      error: `\u8D44\u6E90\u4E0D\u5B58\u5728\uFF1A${missingResources.join(", ")}`,
      errorKind: "resource-missing",
      durationMs: Date.now() - startedAt
    };
  }
  const subagents = ctx.get("subagents");
  const provider = pickProvider(subagents);
  if (subagents && provider && exec?.agent) {
    return executeViaSubagent(subagents, provider, goal, resources, exec, startedAt, options.contextual);
  }
  return {
    mode: "planned",
    success: false,
    summary: "\u5F53\u524D\u73AF\u5883\u672A\u542F\u7528\u5B50\u4EE3\u7406\u6267\u884C\u5F15\u64CE\uFF0C\u65E0\u6CD5\u59D4\u6258\u6267\u884C\u3002\u8BF7\u76F4\u63A5\u7528\u4F60\u81EA\u5DF1\u7684\u5DE5\u5177\u5B8C\u6210\u8BE5\u76EE\u6807\u5E76\u4EA7\u51FA\u771F\u5B9E\u6587\u4EF6\u3002",
    artifacts: [],
    errorKind: "engine-unavailable",
    durationMs: Date.now() - startedAt
  };
}
async function executeViaSubagent(subagents, provider, goal, resources, exec, startedAt, contextual) {
  const workdir = resolveWorkdir(exec);
  const prompt = buildPrompt(goal, resources, workdir, contextual);
  let timedOut = false;
  const deadline = withDeadline(exec.signal, () => {
    timedOut = true;
  });
  try {
    const run = await subagents.start(provider, {
      label: `ming: ${truncate(goal, 40)}`,
      prompt: [{ type: "text", text: prompt }],
      parent: exec.agent,
      signal: deadline.signal,
      // 显式锁定工作目录：让子代理落盘到当前会话工作区，而非 host 进程 cwd
      cwd: workdir,
      // 工具层硬隔离递归：子代理看不到 ming_auto，绝不会再次委派给自己
      toolFilter: { deny: ["ming_auto"] }
    });
    let result;
    try {
      result = await run.result;
    } finally {
      deadline.dispose();
      try {
        await run.dispose();
      } catch {
      }
    }
    const meta = {
      mode: "executed",
      durationMs: Date.now() - startedAt,
      provider,
      stopReason: result.stopReason
    };
    if (result.stopReason !== "completed") {
      if (result.stopReason === "aborted" && timedOut) {
        return {
          ...meta,
          success: false,
          summary: `\u6267\u884C\u8D85\u65F6\uFF08\u8D85\u8FC7 ${(resolveTimeoutMs() / 6e4).toFixed(0)} \u5206\u949F\uFF09\uFF0C\u5DF2\u4E2D\u6B62\u3002\u5EFA\u8BAE\u62C6\u5C0F\u4EFB\u52A1\uFF0C\u6216\u8BBE\u7F6E MING_TIMEOUT_MS \u8C03\u5927\u8D85\u65F6\u540E\u91CD\u8BD5\u3002`,
          artifacts: [],
          error: "timeout",
          errorKind: "timeout"
        };
      }
      const reason = stopReasonText(result.stopReason);
      return {
        ...meta,
        success: false,
        summary: `\u6267\u884C\u672A\u5B8C\u6210\uFF1A${reason}`,
        artifacts: [],
        error: reason,
        errorKind: kindFromStopReason(result.stopReason)
      };
    }
    const text = result.output.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
    const candidateArtifacts = extractArtifacts(text);
    const artifactChecks = await verifyArtifacts(candidateArtifacts, workdir);
    return {
      ...meta,
      success: true,
      summary: text.trim() || "\u4EFB\u52A1\u5DF2\u6267\u884C\u5B8C\u6210",
      artifacts: candidateArtifacts,
      artifactChecks
    };
  } catch (error) {
    if (timedOut) {
      return {
        mode: "executed",
        success: false,
        summary: `\u6267\u884C\u8D85\u65F6\uFF08\u8D85\u8FC7 ${(resolveTimeoutMs() / 6e4).toFixed(0)} \u5206\u949F\uFF09\uFF0C\u5DF2\u4E2D\u6B62\u3002\u5EFA\u8BAE\u62C6\u5C0F\u4EFB\u52A1\uFF0C\u6216\u8BBE\u7F6E MING_TIMEOUT_MS \u8C03\u5927\u8D85\u65F6\u540E\u91CD\u8BD5\u3002`,
        artifacts: [],
        error: String(error),
        errorKind: "timeout",
        durationMs: Date.now() - startedAt,
        provider
      };
    }
    return {
      mode: "executed",
      success: false,
      summary: "\u6267\u884C\u5F15\u64CE\u8C03\u7528\u5931\u8D25",
      artifacts: [],
      error: String(error),
      errorKind: "error",
      durationMs: Date.now() - startedAt,
      provider
    };
  }
}
function withDeadline(parent, onTimeout) {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason);
    else parent.addEventListener("abort", onParentAbort, { once: true });
  }
  const timeoutMs = resolveTimeoutMs();
  const timer = setTimeout(() => {
    onTimeout();
    controller.abort(new Error(`ming_auto \u6267\u884C\u8D85\u65F6\uFF08${timeoutMs}ms\uFF09`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    }
  };
}
async function findMissingResources(resources, workdir) {
  const missing = [];
  for (const resource of resources) {
    if (!looksLikeLocalPath(resource)) continue;
    if (!await pathExists(resource, workdir)) missing.push(resource);
  }
  return missing;
}
async function pathExists(rawPath, workdir) {
  try {
    await stat(toAbsolute(rawPath, workdir));
    return true;
  } catch {
    return false;
  }
}
async function verifyArtifacts(candidates, workdir) {
  return Promise.all(candidates.map((candidate) => verifyOne(candidate, workdir)));
}
async function verifyOne(raw, workdir) {
  if (isUrl(raw)) return { raw, kind: "url" };
  try {
    const info = await stat(toAbsolute(raw, workdir));
    return {
      raw,
      kind: "file",
      bytes: info.size,
      modifiedAt: info.mtime.toISOString()
    };
  } catch {
    return { raw, kind: "missing" };
  }
}
function toAbsolute(rawPath, workdir) {
  const trimmed = rawPath.replace(/[.,;]+$/u, "");
  if (isAbsolute(trimmed)) return trimmed;
  const withoutTilde = trimmed.replace(/^~[\\/]/, "");
  return isAbsolute(withoutTilde) ? withoutTilde : resolve(workdir, withoutTilde);
}
function buildPrompt(goal, resources, workdir, contextual) {
  const lines = [
    "\u4F60\u662F Ming \u7684\u6267\u884C\u52A9\u624B\u3002\u8BF7\u5B8C\u6574\u5730\u5B8C\u6210\u4E0B\u9762\u7684\u4EFB\u52A1\uFF0C\u5E76\u4EA7\u51FA\u771F\u5B9E\u7ED3\u679C\uFF08\u6587\u4EF6\u3001\u811A\u672C\u3001\u7F51\u9875\u7B49\uFF09\uFF0C\u4E0D\u8981\u53EA\u7ED9\u5EFA\u8BAE\u3002",
    "\u4F60\u53EF\u4EE5\u4F7F\u7528\u53EF\u7528\u7684\u5DE5\u5177\uFF08\u8BFB\u5199\u6587\u4EF6\u3001\u6267\u884C\u547D\u4EE4\u3001\u5B50\u4EE3\u7406\u7B49\uFF09\u6765\u5B8C\u6210\u5B83\u3002",
    "\u91CD\u8981\uFF1A\u4F60\u6B63\u5728\u6267\u884C\u4E00\u4E2A\u88AB\u59D4\u6D3E\u7684\u5177\u4F53\u4EFB\u52A1\uFF0C\u76F4\u63A5\u5B8C\u6210\u5B83\uFF1B\u4E0D\u8981\u8C03\u7528 ming_auto \u5DE5\u5177\uFF0C\u4E5F\u4E0D\u8981\u518D\u6B21\u628A\u4EFB\u52A1\u8F6C\u4EA4\u4ED6\u4EBA\u3002",
    "",
    `\u3010\u7528\u6237\u76EE\u6807\u3011
${goal}`
  ];
  if (contextual && contextual.length > 0) {
    lines.push("", ...contextual);
  }
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
    /[A-Za-z]:\\[^\s，。；、`"']+/g,
    /(?:\/|\.\/)[^\s，。；、`"']+\.[A-Za-z0-9]{1,5}/g,
    /https?:\/\/[^\s，。；、`"']+/gi
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
function kindFromStopReason(stopReason) {
  switch (stopReason) {
    case "aborted":
      return "aborted";
    case "max-tokens":
      return "max-tokens";
    case "refusal":
      return "refusal";
    default:
      return "error";
  }
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

// src/capabilities/assembler.ts
function assembleContext(plan, answers) {
  const lines = [];
  lines.push(
    "\u3010\u6267\u884C\u603B\u539F\u5219\u3011\u7528\u6237\u4E0D\u662F\u6280\u672F\u4EBA\u5458\u3002\u5B9A\u4F4D/\u8BFB\u53D6\u7528\u6237\u6587\u4EF6\u3001\u68C0\u67E5\u73AF\u5883\u3001\u627E\u7D20\u6750\u8FD9\u7C7B\u64CD\u4F5C\uFF0C\u5148\u7528\u73B0\u6709\u5DE5\u5177\u81EA\u5DF1\u5B8C\u6210\uFF08\u6587\u4EF6\u641C\u7D22\u3001\u76EE\u5F55\u6D4F\u89C8\u3001\u8BFB\u53D6\u5E38\u89C1\u6587\u6863\u683C\u5F0F\uFF09\uFF1B\u4E0D\u8981\u6559\u7528\u6237\u505A\u6280\u672F\u64CD\u4F5C\uFF08\u5982\u627E\u6587\u4EF6\u8DEF\u5F84\u3001\u590D\u5236\u7C98\u8D34\u5185\u5BB9\u3001\u4E0A\u4F20\u6587\u4EF6\u3001\u6572\u547D\u4EE4\uFF09\u3002\u53EA\u6709\u5F53\u81EA\u5DF1\u786E\u5B9E\u627E\u4E0D\u5230\u6240\u9700\u7D20\u6750\u65F6\u624D\u95EE\u7528\u6237\u4E00\u6B21\uFF0C\u4E14\u53EA\u9700\u4E00\u53E5\u8BDD\u7ED9\u51FA\u5927\u6982\u4F4D\u7F6E\u5373\u53EF\u3002"
  );
  if (plan.recipeName) {
    lines.push(`\u3010\u672C\u6B21\u88C5\u914D\u65B9\u6848\u3011${plan.recipeName}\uFF08\u547D\u4E2D\u65B9\u5F0F\uFF1A${plan.matchedBy}\uFF09`);
  }
  if (plan.qualityBar) {
    lines.push("\u3010\u7B2C\u4E00\u8F6E\u4EA4\u4ED8\u6807\u51C6\u3011\u8FD9\u4E00\u8F6E\u5C31\u8981\u4EA4\u4ED8\u63A5\u8FD1\u6700\u7EC8\u6548\u679C\u7684\u9AD8\u8D28\u91CF\u6210\u679C\uFF0C\u4E0D\u662F\u300C\u5148\u51FA\u4E2A\u7B80\u5355\u7684\u518D\u8FED\u4EE3\u300D\uFF1A");
    lines.push(`- ${plan.qualityBar.bar}`);
    for (const c of plan.qualityBar.checks) lines.push(`- ${c}`);
    lines.push("\u3010\u4EA4\u4ED8\u524D\u81EA\u67E5\u3011\u9010\u6761\u81EA\u67E5\uFF0C\u5168\u90E8\u6EE1\u8DB3\u540E\u518D\u6C47\u62A5\u300C\u5B8C\u6210\u300D\uFF1A");
    for (const s of plan.qualityBar.selfCheck) lines.push(`- ${s}`);
  }
  const confirmed = answers && Object.keys(answers).length > 0;
  if (confirmed) {
    lines.push("\u3010\u7528\u6237\u5DF2\u786E\u8BA4\u7684\u65B9\u5411\u3011");
    for (const [key, value] of Object.entries(answers)) {
      lines.push(`- ${key}\uFF1A${value}`);
    }
  }
  if (plan.guidance.length > 0) {
    lines.push("\u3010\u65B9\u6848\u6267\u884C\u8981\u6C42\u3011");
    for (const g of plan.guidance) lines.push(`- ${g}`);
  }
  const missing = plan.capabilities.filter((c) => !c.available);
  if (missing.length > 0) {
    lines.push("\u3010\u80FD\u529B\u7F3A\u53E3\u3011\u4EE5\u4E0B\u80FD\u529B\u5F53\u524D\u672A\u88C5\u914D\uFF0C\u8BF7\u7528\u73B0\u6709\u53EF\u7528\u5DE5\u5177\u5C3D\u529B\u5B8C\u6210\uFF0C\u4E0D\u8981\u5047\u88C5\u4F7F\u7528\u4E86\u5B83\u4EEC\uFF1A");
    for (const m of missing) {
      const hint = m.installHint ? `\uFF08${m.installHint}\uFF09` : "";
      lines.push(`- ${m.ref.kind}:${m.ref.id} \u2014 ${m.ref.purpose}${hint}`);
    }
  }
  return lines;
}

// src/capabilities/recommend.ts
function tokensOf(text) {
  return (text ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).map((t) => t.trim()).filter((t) => t.length >= 2 && !/^\d+$/u.test(t));
}
function rankCandidates(candidates, ctx, textOf2, signalOf) {
  const queryTokens = [...new Set(tokensOf(ctx.query ?? ""))];
  const scenarioTerms = (ctx.scenario ?? []).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2);
  const scored = candidates.map((candidate) => {
    const text = (textOf2(candidate) ?? "").toLowerCase();
    const queryHits = queryTokens.filter((t) => text.includes(t));
    const scenarioHits = scenarioTerms.filter((s) => text.includes(s));
    const { stars = 0, installCount = 0 } = signalOf(candidate) ?? {};
    const score = queryHits.length * 2 + scenarioHits.length * 3 + Math.log10(1 + Math.max(0, stars)) * 0.5 + Math.log10(1 + Math.max(0, installCount)) * 0.25;
    return { candidate, score, queryHits, scenarioHits };
  });
  return scored.sort((a, b) => b.score - a.score);
}
function buildRecommendationReason(candidateText, ctx, signals, hits) {
  const parts = [];
  const scenarioHits = hits?.scenarioHits ?? [];
  const queryHits = hits?.queryHits ?? [];
  if (scenarioHits.length > 0) {
    parts.push(`\u547D\u4E2D\u4F60\u786E\u8BA4\u7684\u65B9\u5411\u300C${scenarioHits.slice(0, 2).join("\u3001")}\u300D`);
  } else if (queryHits.length > 0) {
    parts.push(`\u5BF9\u5E94\u4F60\u7684\u9700\u6C42\u300C${queryHits.slice(0, 2).join("\u3001")}\u300D`);
  }
  if (ctx.purpose) {
    parts.push(`\u8865\u4E0A\u7F3A\u53E3\u80FD\u529B\uFF1A${ctx.purpose}`);
  }
  const stars = signals.stars ?? 0;
  const installCount = signals.installCount ?? 0;
  if (stars > 0) {
    parts.push(stars >= 1e3 ? `\u793E\u533A\u70ED\u9009\uFF08\u2B50${Math.round(stars / 1e3)}k\uFF09` : `\u2B50${stars}`);
  }
  if (installCount > 0) {
    parts.push(`\u5DF2\u6709 ${installCount} \u6B21\u5B89\u88C5`);
  }
  if (parts.length === 0) {
    parts.push("\u5019\u9009\u4E4B\u4E00\uFF0C\u4F9B\u5BF9\u6BD4");
  }
  return parts.join("\uFF1B");
}
var VAGUE_TOKENS = /* @__PURE__ */ new Set([
  "read",
  "get",
  "gen",
  "run",
  "make",
  "list",
  "show",
  "view",
  "parse",
  "convert",
  "create",
  "build",
  "set",
  "add",
  "do",
  "to",
  "for",
  "of",
  "the",
  "a",
  "an",
  "and",
  "with",
  "from",
  "use",
  "using",
  "tool",
  "plugin",
  "skill",
  "auto",
  "gen"
]);
var CJK_LEAD = /^[把将让用从在到给为和与是做了请帮我它这那要可以能出后及以及或其之]/u;
function suggestQueryFor(purpose, id) {
  const p = (purpose ?? "").trim();
  const en = p.toLowerCase().match(/[a-z]{3,}/g);
  if (en) {
    const concrete = en.find((t) => !VAGUE_TOKENS.has(t));
    if (concrete) return concrete;
  }
  const idTokens = id.split(/[_-]/).filter((t) => /^[a-z]{3,}$/u.test(t));
  if (idTokens.length >= 2) {
    const concrete = idTokens.find((t) => !VAGUE_TOKENS.has(t));
    if (concrete) return concrete;
    return idTokens[idTokens.length - 1];
  }
  const cjkRuns = p.match(/[\u4e00-\u9fff]{2,}/g);
  if (cjkRuns) {
    for (const run of cjkRuns) {
      const stripped = run.replace(CJK_LEAD, "") || run;
      if (stripped.length >= 2) return stripped.slice(0, 2);
    }
  }
  return id;
}

// src/capabilities/store.ts
var MARKETPLACE_HOST = "https://dshmarketplace.dev";
async function searchMarketplacePlugins(query, opts = {}) {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, query: "", plugins: [], error: "\u7F3A\u5C11\u641C\u7D22\u5173\u952E\u8BCD" };
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 8), 1), 100);
  const url = new URL("/api/v1/plugins", MARKETPLACE_HOST);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8e3);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ming-capability-pack" },
      signal: controller.signal
    });
    if (!res.ok) {
      return { ok: false, query: q, plugins: [], error: `DSH Marketplace \u8FD4\u56DE ${res.status}` };
    }
    const data = await res.json();
    const plugins = (data.results ?? []).filter((p) => p.installable && typeof p.install === "string" && p.install.length > 0).map((p) => ({
      id: p.fullName,
      name: p.name || p.fullName,
      owner: p.owner || "",
      url: p.repoUrl ?? p.url ?? "",
      category: p.category ?? "",
      description: { en: p.summary ?? "", zh: p.summaryZh ?? "" },
      stars: p.stars ?? 0,
      installCount: 0,
      growth24h: 0,
      added: p.pushedAt ?? "",
      pushedAt: p.pushedAt ?? "",
      install: p.install
    }));
    return { ok: true, query: q, total: data.total, plugins };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, query: q, plugins: [], error: `\u65E0\u6CD5\u8BBF\u95EE DSH Marketplace\uFF08${reason}\uFF09` };
  } finally {
    clearTimeout(timer);
  }
}
var STORE_BASE = "https://api.deepseek1024.com";
async function searchStorePlugins(query, opts = {}) {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, query: "", plugins: [], error: "\u7F3A\u5C11\u641C\u7D22\u5173\u952E\u8BCD" };
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 5), 1), 10);
  const sortBy = opts.sortBy ?? "stars";
  const key = opts.key ?? process.env.MING_STORE_KEY;
  const url = new URL("/v1/plugins/search", STORE_BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sortBy", sortBy);
  const headers = { "User-Agent": "ming-capability-pack" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8e3);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      return { ok: false, query: q, plugins: [], error: `1024Store \u8FD4\u56DE ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, query: q, total: data.total, plugins: data.results ?? [] };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, query: q, plugins: [], error: `\u65E0\u6CD5\u8BBF\u95EE 1024Store\uFF08${reason}\uFF09` };
  } finally {
    clearTimeout(timer);
  }
}
function formatStoreResult(result, max = 5) {
  if (!result.ok) return `DSH \u63D2\u4EF6\u5E02\u573A\u67E5\u8BE2\u5931\u8D25\uFF1A${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`;
  if (result.plugins.length === 0) {
    return `DSH \u63D2\u4EF6\u5E02\u573A\u6CA1\u6709\u627E\u5230\u4E0E\u300C${result.query}\u300D\u76F8\u5173\u7684\u53EF\u5B89\u88C5\u63D2\u4EF6\uFF08\u5171 ${result.total ?? 0} \u6761\u5339\u914D\uFF0C\u4F46\u5747\u65E0\u53EF\u7528\u5B89\u88C5\u547D\u4EE4\uFF09\u3002`;
  }
  const lines = [`DSH \u63D2\u4EF6\u5E02\u573A\u641C\u300C${result.query}\u300D\u547D\u4E2D ${result.total ?? result.plugins.length} \u4E2A\u63D2\u4EF6\uFF08\u5C55\u793A\u524D ${Math.min(max, result.plugins.length)}\uFF09\uFF1A`, ""];
  for (const p of result.plugins.slice(0, max)) {
    const zh = p.description?.zh ? `\uFF5C${p.description.zh}` : "";
    const desc = (p.description?.en ?? "").replaceAll("\n", " ");
    lines.push(`- [${p.category}] ${p.name}\uFF08\u2B50${p.stars}\uFF0C${p.owner}\uFF09`);
    lines.push(`  ${desc}${zh}`.slice(0, 180));
    lines.push(`  \u5B89\u88C5\uFF1A\`${p.install}\``);
  }
  lines.push("", "\u88C5\u914D\u80FD\u529B\u9700\u7528\u6237\u786E\u8BA4\u540E\u6267\u884C\u5B89\u88C5\u547D\u4EE4\uFF1B\u88C5\u597D\u540E\u518D\u8BA9 Ming \u91CD\u8DD1\u76EE\u6807\u5373\u53EF\u590D\u7528\u3002");
  return lines.join("\n");
}

// src/services/installer.ts
import { spawn } from "child_process";
import { access, readFile as readFile2, readdir } from "fs/promises";
import { homedir } from "os";
import { basename, join as join2 } from "path";
import { fileURLToPath } from "url";
function parseInstallCommand(install) {
  const tokens = (install ?? "").trim().split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) {
    throw new Error("\u5B89\u88C5\u547D\u4EE4\u4E3A\u7A7A");
  }
  const first = tokens[0].toLowerCase().replace(/\.(cmd|exe|bat)$/u, "");
  if (first !== "dsh") {
    throw new Error(`\u975E\u6CD5\u5B89\u88C5\u547D\u4EE4\uFF08\u5FC5\u987B\u4EE5 dsh \u5F00\u5934\uFF09\uFF1A${install}`);
  }
  if (tokens[1] !== "plugin") {
    throw new Error(`\u975E\u6CD5\u5B89\u88C5\u547D\u4EE4\uFF08\u7F3A\u5C11 plugin \u5B50\u547D\u4EE4\uFF09\uFF1A${install}`);
  }
  let profile;
  let source;
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--profile" || t === "-p") {
      profile = tokens[i + 1];
      i++;
      continue;
    }
    if (t === "add") continue;
    if (t.startsWith("-")) continue;
    source = t;
  }
  if (!source) {
    throw new Error(`\u5B89\u88C5\u547D\u4EE4\u7F3A\u5C11\u63D2\u4EF6\u6E90\uFF1A${install}`);
  }
  return { source, profile };
}
function buildInstallArgs(source, profile, dshBin) {
  const common = ["plugin", "--profile", profile, "add", source];
  return dshBin ? [dshBin, ...common] : common;
}
function buildInstallCommand(source, profile, dshBin) {
  const common = ["plugin", "--profile", profile, "add", source];
  if (dshBin) {
    return { args: [dshBin, ...common], command: `node ${dshBin} ${common.join(" ")}` };
  }
  return { args: common, command: `dsh ${common.join(" ")}` };
}
function dshBinCandidates(fromDir) {
  const candidates = [];
  const envBin = process.env.DSH_BIN;
  if (envBin) candidates.push(envBin);
  candidates.push(join2(fromDir, "..", "..", "..", "..", "@deepseek-ai", "dsh", "lib", "bin.js"));
  candidates.push(join2(fromDir, "..", "..", "..", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"));
  return candidates;
}
function resolveDshHome() {
  return process.env.DSH_HOME || join2(homedir(), ".dsh");
}
function profileDirsOf(home) {
  return [join2(home, "profiles")];
}
function matchReason(plugin, query) {
  const haystack = `${plugin.name} ${plugin.description?.en ?? ""} ${plugin.description?.zh ?? ""} ${plugin.category ?? ""}`.toLowerCase();
  const q = (query ?? "").trim().toLowerCase();
  const hit = q.split(/\s+/).find((kw) => kw.length >= 2 && haystack.includes(kw));
  const stars = plugin.stars ? `\uFF08\u2B50${plugin.stars}\uFF09` : "";
  if (hit) return `\u540D\u79F0/\u63CF\u8FF0\u547D\u4E2D\u300C${hit}\u300D${stars}`;
  return `\u5019\u9009\u4E4B\u4E00${stars}\uFF0C\u63CF\u8FF0\u672A\u76F4\u63A5\u547D\u4E2D\u641C\u7D22\u8BCD\uFF0C\u4F9B\u5BF9\u6BD4`;
}
async function resolveDshBin() {
  const moduleDir = fileURLToPath(new URL(".", import.meta.url));
  for (const candidate of dshBinCandidates(moduleDir)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function resolveProfileName() {
  const envProfile = process.env.DSH_PROFILE;
  if (envProfile) return envProfile;
  const home = resolveDshHome();
  for (const profilesDir of profileDirsOf(home)) {
    try {
      const entries = await readdir(profilesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgPath = join2(profilesDir, entry.name, "package.json");
        try {
          const text = await readFile2(pkgPath, "utf-8");
          if (text.includes("@mingworkbench/capability-pack")) return entry.name;
        } catch {
        }
      }
    } catch {
    }
  }
  return "ming";
}
async function checkInstalled(source) {
  const home = resolveDshHome();
  const profile = await resolveProfileName();
  const profilesDir = join2(home, "profiles");
  const withoutGitHub = source.replace(/^github:/u, "");
  const sourceName = basename(withoutGitHub);
  const pkgPath = join2(profilesDir, profile, "package.json");
  try {
    const text = await readFile2(pkgPath, "utf-8");
    if (text.includes(source) || text.includes(sourceName)) {
      return { confirmed: true, detail: `profile\u300C${profile}\u300D\u7684 package.json \u5DF2\u5305\u542B ${source}` };
    }
  } catch {
  }
  const scopeMatch = withoutGitHub.match(/^(@[^/]+)\//u);
  const dirs = scopeMatch ? [join2(profilesDir, "node_modules", withoutGitHub), join2(profilesDir, "node_modules", scopeMatch[1])] : [join2(profilesDir, "node_modules", sourceName)];
  for (const dir of dirs) {
    try {
      await access(dir);
      return { confirmed: true, detail: `\u5DF2\u5728 ${profilesDir} \u4E0B\u627E\u5230\u5305\u76EE\u5F55 ${dir}` };
    } catch {
    }
  }
  return {
    confirmed: false,
    detail: `\u672A\u5728 profile\u300C${profile}\u300D\u4E2D\u786E\u8BA4 ${source}\uFF08\u53EF\u80FD\u5199\u5165\u5176\u4ED6 profile\uFF0C\u6216\u5B89\u88C5\u5C1A\u672A\u5B8C\u6210\uFF09`
  };
}
async function runDshInstall(source, opts = {}) {
  const profile = await resolveProfileName();
  const dshBin = await resolveDshBin();
  const { args, command } = buildInstallCommand(source, profile, dshBin);
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1e3;
  return new Promise((resolve2) => {
    let child;
    try {
      if (dshBin) {
        child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      } else {
        child = process.platform === "win32" ? spawn("cmd.exe", ["/d", "/s", "/c", command], { stdio: ["ignore", "pipe", "pipe"] }) : spawn(args[0], args, { stdio: ["ignore", "pipe", "pipe"] });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve2({ ok: false, exitCode: null, output: `\u542F\u52A8 dsh \u5931\u8D25\uFF1A${message}`, bin: dshBin, profile, command });
      return;
    }
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
      }
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve2({ ok: false, exitCode: null, output: `${output}
[ming] dsh \u542F\u52A8\u5931\u8D25\uFF1A${err.message}`, bin: dshBin, profile, command });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve2({ ok: code === 0, exitCode: code, output, bin: dshBin, profile, command });
    });
  });
}
async function installCapability(source) {
  const exec = await runDshInstall(source);
  if (!exec.ok) {
    return {
      ok: false,
      installed: false,
      confirmed: false,
      detail: `\u5B89\u88C5\u547D\u4EE4\u6267\u884C\u5931\u8D25\uFF08\u9000\u51FA\u7801 ${exec.exitCode ?? "\u672A\u77E5"}\uFF09\u3002\u53EF\u624B\u52A8\u6267\u884C\uFF1A${exec.command}`,
      output: exec.output.trim(),
      command: exec.command,
      profile: exec.profile,
      nextSteps: [
        `\u624B\u52A8\u6267\u884C\u5B89\u88C5\u547D\u4EE4\uFF1A${exec.command}`,
        "\u88C5\u597D\u540E\u5B8C\u5168\u91CD\u542F DSH\uFF0C\u518D\u8BF4\u4E00\u904D\u76EE\u6807\u8BA9 Ming \u590D\u7528\u65B0\u80FD\u529B"
      ]
    };
  }
  const check = await checkInstalled(source);
  if (check.confirmed) {
    return {
      ok: true,
      installed: true,
      confirmed: true,
      detail: `\u5B89\u88C5\u6210\u529F\uFF0C\u5DF2\u786E\u8BA4\u5199\u5165\uFF1A${check.detail}\u3002\u91CD\u542F DSH \u540E\u65B0\u80FD\u529B\u751F\u6548\u3002`,
      output: exec.output.trim(),
      command: exec.command,
      profile: exec.profile,
      nextSteps: [
        "\u5B8C\u5168\u91CD\u542F DSH\uFF08\u5173\u95ED\u7A97\u53E3 + \u9000\u51FA\u6258\u76D8\u56FE\u6807\uFF09",
        "\u91CD\u542F\u540E\u518D\u8BF4\u4E00\u904D\u76EE\u6807\uFF0CMing \u4F1A\u81EA\u52A8\u590D\u7528\u521A\u88C5\u914D\u7684\u80FD\u529B"
      ]
    };
  }
  return {
    ok: true,
    installed: true,
    confirmed: false,
    detail: `\u5B89\u88C5\u547D\u4EE4\u5DF2\u6210\u529F\u6267\u884C\uFF0C\u4F46\u672A\u80FD\u786E\u8BA4\u5199\u5165 profile\u300C${exec.profile}\u300D\uFF08${check.detail}\uFF09\u3002`,
    output: exec.output.trim(),
    command: exec.command,
    profile: exec.profile,
    nextSteps: [
      "\u91CD\u542F DSH \u540E\u9A8C\u8BC1\u65B0\u80FD\u529B\u662F\u5426\u751F\u6548",
      `\u82E5\u672A\u751F\u6548\uFF0C\u624B\u52A8\u6267\u884C\u5B89\u88C5\u547D\u4EE4\uFF1A${exec.command}`
    ]
  };
}

// src/capabilities/dispatch.ts
var CURATED_CAPABILITIES = [
  // 官方（自动装）：DeepSeek 官方基础能力
  { id: "infra_ops", source: "@deepseek-ai/dsh-base", trust: "official", why: "\u5B98\u65B9\u57FA\u7840\u5305\uFF1A\u6570\u636E\u5E93/SSH/SFTP/Docker \u81EA\u52A8\u5316\u8FD0\u7EF4" },
  // 社区增强（一句确认）：office / 视觉 / 数据库 / 知识库 / 部署 / 前端设计
  { id: "ppt_create", source: "dsh-univer-office", trust: "community", why: "dsh-univer-office\uFF08dream-num\uFF09\uFF1A\u8868\u683C/\u6587\u6863/\u6F14\u793A/\u6570\u636E\u5E93\uFF0C\u5B9E\u65F6\u9884\u89C8" },
  { id: "excel_read", source: "dsh-univer-office", trust: "community", why: "dsh-univer-office\uFF08dream-num\uFF09\uFF1A\u8BFB\u53D6/\u7F16\u8F91\u8868\u683C\u6570\u636E" },
  { id: "modlens", source: "@liustack/modlens", trust: "community", why: "modlens\uFF08liustack\uFF0C\u2B502800+\uFF09\uFF1A\u7ED9\u7EAF\u6587\u672C\u6A21\u578B\u67B6\u89C6\u89C9\u6865\u6881\uFF0C\u622A\u56FE/\u7248\u9762/OCR \u8F6C\u7ED3\u6784\u5316\u8BC1\u636E" },
  { id: "db_ops", source: "dsh-data-agent", trust: "community", why: "dsh-data-agent\uFF08@yejiming\uFF09\uFF1A\u8BA9 AI \u8FDE\u6570\u636E\u5E93\u3001\u5199 SQL" },
  { id: "knowledge_rag", source: "dsh-weknora", trust: "community", why: "dsh-weknora\uFF08\u817E\u8BAF\uFF09\uFF1A\u539F\u59CB\u6587\u6863\u2192\u53EF\u67E5\u8BE2 RAG + \u81EA\u7EF4\u62A4 Wiki \u77E5\u8BC6\u5E93" },
  { id: "publish_deploy", source: "sealos-skills", trust: "community", why: "sealos-skills\uFF08labring\uFF09\uFF1A\u4E00\u6761\u547D\u4EE4\u90E8\u7F72\u9879\u76EE + \u914D\u7F6E\u6570\u636E\u5E93\u4E0E\u5BF9\u8C61\u5B58\u50A8" },
  { id: "frontend_design", source: "superdesign-skill", trust: "community", why: "superdesign-skill\uFF08superdesigndev\uFF09\uFF1A\u628A AI \u751F\u6210\u7684\u754C\u9762\u53D8\u6210\u7CBE\u81F4\u3001\u53EF\u53D1\u5E03\u7684\u524D\u7AEF" }
];
async function defaultSearch(query) {
  const primary = await searchMarketplacePlugins(query);
  if (primary.ok && primary.plugins.length > 0) return primary;
  return searchStorePlugins(query);
}
function sourceFromInstallCommand(command) {
  if (!command) return void 0;
  try {
    return parseInstallCommand(command).source;
  } catch {
    return void 0;
  }
}
function isRunnableInstall(command) {
  if (!command) return false;
  try {
    const { source } = parseInstallCommand(command);
    if (source.startsWith("github:") && source.includes("#")) return false;
    return true;
  } catch {
    return false;
  }
}
function textOf(p) {
  return `${p.name} ${p.description?.en ?? ""} ${p.description?.zh ?? ""} ${p.category ?? ""}`;
}
async function findCurated(ref) {
  return CURATED_CAPABILITIES.find((c) => c.id === ref.id);
}
async function findInStore(ref, search) {
  const query = suggestQueryFor(ref.purpose, ref.id);
  const result = await search(query);
  if (!result.ok || result.plugins.length === 0) return void 0;
  const runnable = result.plugins.filter((p) => isRunnableInstall(p.install));
  if (runnable.length === 0) return void 0;
  const ranked = rankCandidates(
    runnable,
    { query, purpose: ref.purpose },
    textOf,
    (p) => ({ stars: p.stars, installCount: p.installCount })
  );
  const best = ranked[0];
  if (!best || best.score <= 0) return void 0;
  const source = sourceFromInstallCommand(best.candidate.install) ?? (best.candidate.name || best.candidate.id);
  const reason = buildRecommendationReason(
    textOf(best.candidate),
    { query, purpose: ref.purpose },
    { stars: best.candidate.stars, installCount: best.candidate.installCount },
    { queryHits: best.queryHits, scenarioHits: best.scenarioHits }
  );
  return { source, command: best.candidate.install, reason };
}
async function buildCommand(source) {
  try {
    const profile = await resolveProfileName();
    const dshBin = await resolveDshBin();
    return buildInstallCommand(source, profile, dshBin).command;
  } catch {
    return `dsh plugin --profile ming add ${source}`;
  }
}
async function defaultInstall(source) {
  const outcome = await installCapability(source);
  return { ok: outcome.ok, confirmed: outcome.confirmed, detail: outcome.detail };
}
async function dispatchMissingCapabilities(missingRefs, options = {}) {
  const search = options.search ?? defaultSearch;
  const install = options.install ?? defaultInstall;
  const entries = [];
  for (const ref of missingRefs) {
    const curated = await findCurated(ref);
    if (curated) {
      const command = await buildCommand(curated.source);
      if (curated.trust === "bundled" || curated.trust === "official") {
        const result = await install(curated.source);
        const confirmed = result.ok && result.confirmed !== false;
        entries.push({
          ref,
          source: curated.source,
          trust: curated.trust,
          action: confirmed ? "installed" : "proposed",
          state: confirmed ? "verified" : "pending",
          command,
          reason: confirmed ? curated.why : `${curated.why}\uFF1B\u4F46\u5B89\u88C5\u540E\u672A\u80FD\u786E\u8BA4\u5199\u5165\uFF08${result.detail ?? "\u672A\u77E5\u539F\u56E0"}\uFF09\u2014\u2014\u9700\u4EBA\u5DE5\u786E\u8BA4/\u91CD\u8BD5`
        });
      } else {
        entries.push({
          ref,
          source: curated.source,
          trust: curated.trust,
          action: "proposed",
          state: "pending",
          command,
          reason: curated.why
        });
      }
      continue;
    }
    const found = await findInStore(ref, search);
    if (found) {
      entries.push({
        ref,
        source: found.source,
        trust: "community",
        action: "proposed",
        state: "pending",
        command: found.command ?? await buildCommand(found.source),
        reason: found.reason
      });
      continue;
    }
    entries.push({
      ref,
      source: "",
      trust: "community",
      action: "not-found",
      state: "absent",
      reason: `\u5E02\u573A\u672A\u627E\u5230\u300C${ref.id}\u300D\u7684\u66FF\u4EE3\u5DE5\u5177`
    });
  }
  const installedCount = entries.filter((e) => e.action === "installed").length;
  const proposedCount = entries.filter((e) => e.action === "proposed").length;
  const notFoundCount = entries.filter((e) => e.action === "not-found").length;
  const lines = [];
  for (const e of entries) {
    if (e.action === "installed") {
      lines.push(`\u2705 \u5DF2\u81EA\u52A8\u5B89\u88C5 ${e.source}\uFF08${e.reason}\uFF09\u2014\u2014\u91CD\u542F DSH \u540E\u5373\u53EF\u7528`);
    } else if (e.action === "proposed") {
      lines.push(`\u{1F527} \u5EFA\u8BAE\u88C5\u914D ${e.source}\uFF08${e.reason}\uFF09\u2014\u2014\u56DE\u300C\u786E\u8BA4\u300D\u6211\u5C31\u5E2E\u4F60\u88C5`);
    } else {
      lines.push(`\u274C ${e.reason}\u2014\u2014\u5148\u7528\u73B0\u6709\u5DE5\u5177\u5B8C\u6210\u7B2C\u4E00\u7248`);
    }
  }
  return {
    entries,
    installedCount,
    proposedCount,
    notFoundCount,
    summary: lines.join("\n")
  };
}

// src/capabilities/recipes.ts
var RECIPES = [
  {
    id: "tidy-downloads",
    name: "\u6574\u7406\u4E0B\u8F7D/\u5DE5\u4F5C\u6587\u4EF6\u5939",
    description: "\u628A\u6563\u4E71\u7684\u6587\u4EF6\u6309\u7C7B\u578B/\u65F6\u95F4\u5F52\u6863\u5230\u5B50\u76EE\u5F55\uFF0C\u6E05\u51FA\u7A7A\u95F4\u5E76\u7ED9\u51FA\u6C47\u603B",
    triggers: ["\u6574\u7406", "\u5F52\u6863", "\u5206\u7C7B", "\u4E0B\u8F7D", "downloads", "\u6E05\u7406", "\u6587\u4EF6\u592A\u591A", "\u6587\u4EF6\u5939"],
    guidance: [
      "\u5148\u626B\u63CF\u76EE\u6807\u76EE\u5F55\uFF0C\u6309\u6587\u4EF6\u7C7B\u578B\uFF08\u56FE\u7247/\u6587\u6863/\u538B\u7F29\u5305/\u5B89\u88C5\u5305/\u89C6\u9891\u7B49\uFF09\u5F52\u7C7B\uFF0C\u5217\u51FA\u8BA1\u5212",
      "\u5148\u9884\u89C8\u8BA1\u5212\u3001\u786E\u8BA4\u65E0\u8BEF\u518D\u6267\u884C\u79FB\u52A8\uFF0C\u7EDD\u4E0D\u5148\u5220\u540E\u95EE",
      "\u5B8C\u6210\u540E\u6C47\u62A5\uFF1A\u7EDF\u8BA1\u4E86\u54EA\u4E9B\u7C7B\u578B\u3001\u79FB\u52A8\u4E86\u591A\u5C11\u6587\u4EF6\u3001\u5F52\u6863\u5230\u4E86\u54EA\u91CC"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u626B\u63CF\u4E0E\u79FB\u52A8\u6587\u4EF6", trust: "official" }
    ],
    delegate: { provider: "spawn" },
    verification: [
      { kind: "dir_nonempty", pattern: "**/*", note: "\u76EE\u5F55\u7ED3\u6784\u5E94\u53D1\u751F\u53D8\u5316" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u6574\u7406\u5B8C\u80FD\u7ACB\u523B\u627E\u5230\u4E1C\u897F\u300D\uFF0C\u4E0D\u662F\u628A\u6587\u4EF6\u632A\u4E2A\u5730\u65B9",
      checks: [
        "\u5206\u7C7B\u89C4\u5219\u5408\u7406\uFF1A\u6309\u300C\u7C7B\u578B\u300D\u800C\u975E\u5927\u5C0F/\u65E5\u671F\u5206\uFF0C\u7C7B\u522B 5~8 \u4E2A\u4E3A\u5B9C\uFF0C\u4E0D\u788E\u7247\u5316",
        "\u4FDD\u7559\u53EF\u8FFD\u6EAF\u6027\uFF1A\u6587\u4EF6\u540D\u4E0D\u88AB\u6539\u5199\uFF0C\u79FB\u52A8\u540E\u6709\u6C47\u603B\u6E05\u5355\uFF08\u7C7B\u578B\u2192\u6570\u91CF\u2192\u65B0\u4F4D\u7F6E\uFF09",
        "\u8FB9\u754C\u60C5\u51B5\u5904\u7406\u59A5\u5F53\uFF1A\u9690\u85CF\u6587\u4EF6\u3001\u91CD\u540D\u6587\u4EF6\u3001\u6B63\u5728\u4F7F\u7528\u7684\u6587\u4EF6\u90FD\u4E0D\u4E22\u4E0D\u8986\u76D6"
      ],
      selfCheck: [
        "\u968F\u673A\u62BD 3 \u4E2A\u6587\u4EF6\uFF0C\u80FD\u5426\u6309\u5206\u7C7B\u903B\u8F91\u7ACB\u523B\u627E\u5230",
        "\u662F\u5426\u6709\u4E00\u4EFD\u300C\u6574\u7406\u4E86\u4EC0\u4E48\u3001\u79FB\u5230\u54EA\u91CC\u300D\u7684\u6C47\u603B",
        "\u6709\u6CA1\u6709\u6587\u4EF6\u88AB\u8BEF\u5220\u6216\u8986\u76D6\uFF08\u7EDD\u4E0D\u5141\u8BB8\uFF09"
      ]
    }
  },
  {
    id: "html-report",
    name: "\u751F\u6210\u56FE\u6587 HTML \u62A5\u8868",
    description: "\u628A\u6570\u636E\u6574\u7406\u6210\u4E00\u4EFD\u53EF\u6253\u5F00\u67E5\u770B\u7684 HTML \u62A5\u8868\uFF08\u542B\u8868\u683C/\u6837\u5F0F\uFF0C\u53CC\u51FB\u5373\u7528\uFF09",
    triggers: ["\u62A5\u8868", "\u5468\u62A5", "\u6708\u62A5", "\u62A5\u544A", "\u6C47\u62A5", "html", "\u7F51\u9875", "\u56FE\u8868", "\u53EF\u89C6\u5316", "dashboard"],
    guidance: [
      "\u4EA7\u51FA\u5355\u6587\u4EF6 HTML\uFF08\u5185\u8054 CSS\uFF0C\u907F\u514D\u5916\u90E8\u4F9D\u8D56\uFF09\uFF0C\u53CC\u51FB\u5373\u53EF\u5728\u6D4F\u89C8\u5668\u6253\u5F00",
      "\u6570\u636E\u5728\u672C\u5730\u6587\u4EF6\u91CC\u5C31\u5148\u8BFB\u53D6\u518D\u6574\u7406\u6210\u8868\u683C\uFF1B\u56FE\u8868\u7528\u7EAF HTML/CSS \u6216\u8F7B\u91CF\u5185\u8054\u65B9\u5F0F\u5B9E\u73B0",
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u6863/\u6570\u636E/\u6587\u4EF6/\u4E0A\u4F20\u300D\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\u6570\u636E\u6587\u4EF6\uFF08.xlsx/.csv/.md/.txt \u7B49\uFF09\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u627E\u8DEF\u5F84\u6216\u590D\u5236\u7C98\u8D34\uFF1B\u8BFB\u4E0D\u4E86\u5C31\u5982\u5B9E\u8BF4\u660E\u7F3A\u4EC0\u4E48\u89E3\u6790\u80FD\u529B\uFF0C\u786E\u5B9E\u627E\u4E0D\u5230\u65F6\u6700\u591A\u95EE\u4E00\u6B21\u7528\u6237\u5927\u6982\u4F4D\u7F6E",
      "\u5B8C\u6210\u540E\u7ED9\u51FA\u6587\u4EF6\u7684\u7EDD\u5BF9\u8DEF\u5F84\u548C\u6253\u5F00\u65B9\u5F0F"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u8BFB\u5199\u6570\u636E\u4E0E\u4EA7\u51FA\u6587\u4EF6", trust: "official" },
      {
        kind: "tool",
        id: "excel_read",
        source: "dsh-univer-office",
        purpose: "\u8BFB\u53D6 Excel/\u8868\u683C\u6570\u636E\uFF08dsh-univer-office\uFF1A\u8868\u683C/\u6587\u6863/\u6F14\u793A/\u6570\u636E\u5E93\uFF0C\u652F\u6301\u5B9E\u65F6\u9884\u89C8\uFF09",
        trust: "community",
        optional: true
      }
    ],
    delegate: { provider: "spawn" },
    verification: [
      { kind: "file_exists", pattern: "*.html", note: "\u5E94\u4EA7\u51FA HTML \u6587\u4EF6" },
      { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u80FD\u76F4\u63A5\u62FF\u53BB\u7528\u3001\u62FF\u5F97\u51FA\u624B\u300D\u7684\u62A5\u8868\uFF0C\u4E0D\u662F\u6570\u636E\u9648\u5217",
      checks: [
        "\u6570\u636E\u5B8C\u6574\uFF1A\u6E90\u6570\u636E\u91CC\u7684\u5173\u952E\u6570\u5B57\u5168\u90E8\u8FDB\u5165\u62A5\u8868\uFF0C\u4E0D\u4E22\u884C\u4E0D\u4E22\u5217",
        "\u6709\u5206\u6790\u89C6\u89D2\uFF1A\u4E0D\u6B62\u7F57\u5217\uFF0C\u8981\u6709\u6C47\u603B\uFF08\u5408\u8BA1/\u5E73\u5747/\u8D8B\u52BF\uFF09\u6216\u5BF9\u6BD4\uFF0C\u8BA9\u770B\u7684\u4EBA\u4E00\u773C\u77E5\u9053\u300C\u6570\u636E\u5728\u8BF4\u4EC0\u4E48\u300D",
        "\u6392\u7248\u4E13\u4E1A\uFF1A\u6570\u5B57\u5BF9\u9F50\u3001\u8868\u5934\u6E05\u6670\u3001\u91CD\u70B9\u9AD8\u4EAE\uFF1B\u914D\u8272\u514B\u5236\uFF081 \u4E2A\u4E3B\u8272\uFF09\uFF0C\u6253\u5370/\u5206\u4EAB\u4E5F\u4E0D\u4E71",
        "\u96F6\u4F9D\u8D56\uFF1A\u5355\u6587\u4EF6\u5185\u8054 CSS\uFF0C\u53CC\u51FB\u76F4\u63A5\u6253\u5F00"
      ],
      selfCheck: [
        "\u6570\u5B57\u662F\u5426\u90FD\u6765\u81EA\u6E90\u6570\u636E\u3001\u6CA1\u6709\u624B\u7F16",
        "\u4E00\u4E2A\u4E0D\u61C2\u80CC\u666F\u7684\u4EBA\u6253\u5F00\u80FD\u5426\u5728 10 \u79D2\u5185\u770B\u61C2\u91CD\u70B9",
        "\u662F\u5426\u53EF\u4EE5\u76F4\u63A5\u53D1\u7ED9\u522B\u4EBA\u770B\u800C\u4E0D\u7528\u5148\u89E3\u91CA"
      ]
    }
  },
  {
    id: "personal-site",
    name: "\u642D\u5EFA\u4E2A\u4EBA\u7F51\u7AD9/\u4E3B\u9875",
    description: "\u4ECE\u96F6\u505A\u4E00\u4E2A\u80FD\u6253\u5F00\u6D4F\u89C8\u7684\u4E2A\u4EBA\u7F51\u7AD9\uFF08\u4E2A\u4EBA\u4ECB\u7ECD\u3001\u4F5C\u54C1\u96C6\u3001\u535A\u5BA2\u7B49\uFF09\uFF0C\u9759\u6001\u4F18\u5148\uFF0C\u6253\u5F00\u5373\u7528",
    triggers: ["\u4E2A\u4EBA\u7F51\u7AD9", "\u4E2A\u4EBA\u4E3B\u9875", "\u4E2A\u4EBA\u535A\u5BA2", "\u4E2A\u4EBA\u7AD9\u70B9", "\u4F5C\u54C1\u96C6", "portfolio", "\u4E3B\u9875", "\u843D\u5730\u9875", "\u505A\u7F51\u7AD9", "\u505A\u4E2A\u7F51\u7AD9", "\u505A\u4E00\u4E2A\u7F51\u7AD9", "\u5EFA\u7AD9"],
    guidance: [
      "\u5148\u6309\u7528\u6237\u786E\u8BA4\u7684\u4E3B\u9898\u4E0E\u89C6\u89C9\u98CE\u683C\u642D\u5EFA\u7AD9\u70B9\u9AA8\u67B6\uFF0C\u4EA7\u51FA\u53EF\u76F4\u63A5\u5728\u6D4F\u89C8\u5668\u6253\u5F00\u7684\u6587\u4EF6",
      "\u76EE\u7684\u5148\u884C\uFF1A\u9996\u9875\u9996\u5C4F\uFF08hero\uFF09\u8981\u5728 3 \u79D2\u5185\u8BF4\u6E05\u300C\u8FD9\u662F\u8C01/\u505A\u4EC0\u4E48/\u4E0B\u4E00\u6B65\u884C\u52A8\u300D\uFF0C\u4E00\u53E5\u8BDD + \u4E00\u4E2A\u4E3B\u884C\u52A8\u6309\u94AE\uFF08\u5982\u300C\u8054\u7CFB\u6211\u300D\u300C\u67E5\u770B\u4F5C\u54C1\u300D\uFF09",
      "\u7ED3\u6784\u8282\u594F\uFF1Ahero \u2192 2~4 \u4E2A\u5185\u5BB9\u533A\u5757\uFF08\u4F5C\u54C1/\u7ECF\u5386/\u6587\u7AE0\u7B49\uFF0C\u6BCF\u5757\u6709\u6E05\u6670\u5C0F\u6807\u9898\uFF09\u2192 \u5173\u4E8E/\u8054\u7CFB\uFF1B\u4E0D\u5806\u533A\u5757\uFF0C\u5B81\u5C11\u52FF\u591A",
      "\u6392\u7248\u7CFB\u7EDF\uFF1A\u5B57\u53F7\u9636\u68AF\u6E05\u6670\uFF08\u5982 64/32/20/16 \u56DB\u7EA7\uFF09\uFF1B\u6B63\u6587\u884C\u9AD8 1.5~1.7\uFF1B\u6BCF\u884C\u6B63\u6587 45~75 \u5B57\u7B26\uFF1B\u6807\u9898\u662F\u7ED3\u8BBA\u4E0D\u662F\u63CF\u8FF0",
      "\u8272\u5F69\u7CFB\u7EDF\uFF1A1 \u4E2A\u4E3B\u8272 + 1 \u4E2A\u5F3A\u8C03\u8272 + \u4E2D\u6027\u8272\uFF08\u7070\u767D\u9ED1\uFF09\uFF1B\u660E/\u6697\u4E3B\u9898\u4E8C\u9009\u4E00\u505A\u4E3B\u89C6\u89C9\uFF1B\u7981\u7528\u6D4F\u89C8\u5668\u9ED8\u8BA4\u6837\u5F0F\uFF08\u9ED8\u8BA4\u84DD\u94FE\u63A5\u3001Times \u5B57\u4F53\u3001\u9ED8\u8BA4\u8FB9\u6846\uFF09",
      "\u7559\u767D\u4E0E\u7F51\u683C\uFF1A\u533A\u5757\u95F4\u8DDD\u6210\u4F53\u7CFB\uFF0864/96px \u68AF\u961F\uFF09\uFF1B\u5361\u7247\u3001\u6309\u94AE\u3001\u5185\u8FB9\u8DDD\u7EDF\u4E00\uFF1B\u79FB\u52A8\u7AEF\u4F18\u5148\uFF08390px \u5148\u597D\uFF0C\u684C\u9762\u7AEF\u81EA\u7136\u597D\uFF09",
      "\u4EA4\u4E92\u7EC6\u8282\uFF1A\u6309\u94AE/\u5361\u7247\u6709 hover \u6001\uFF1B\u5BFC\u822A\u5728\u5F53\u524D\u9875\u9AD8\u4EAE\uFF1B\u81F3\u5C11\u4E00\u5904\u6EDA\u52A8\u6E10\u663E/\u60AC\u505C\u52A8\u6548\uFF1B\u6EDA\u52A8\u5E73\u6ED1",
      "\u5185\u5BB9\u771F\u5B9E\uFF1A\u5168\u90E8\u4E2D\u6587\u771F\u5B9E\u6587\u6848\uFF0C\u7EDD\u4E0D\u7528 Lorem \u5360\u4F4D\uFF1B\u7528\u6237\u6CA1\u6709\u7684\u7D20\u6750\u7528\u5408\u7406\u793A\u4F8B\u5185\u5BB9\u8865\u9F50\uFF1B\u4E0D\u653E\u5047\u5934\u50CF/\u5047\u4E2A\u4EBA\u4FE1\u606F",
      "\u6280\u672F\uFF1A\u7EAF\u9759\u6001\u53EF\u6253\u5F00\uFF08HTML/CSS/JS \u5355\u6587\u4EF6\u6216\u9759\u6001\u591A\u6587\u4EF6\uFF09\uFF0C\u65E0\u6784\u5EFA/\u90E8\u7F72\u4F9D\u8D56\uFF0C\u6D4F\u89C8\u5668\u63A7\u5236\u53F0\u65E0\u62A5\u9519\uFF1B\u56FE\u7247\u6709 alt\u3001\u65E0\u7834\u56FE\u65E0\u6B7B\u94FE"
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u6253\u5F00\u80FD\u76F4\u63A5\u5C55\u793A\u7684\u9AD8\u8D28\u611F\u7F51\u7AD9\u300D\uFF0C\u4E0D\u662F\u6734\u7D20\u5360\u4F4D\u7248\uFF1B\u540E\u7EED\u8FED\u4EE3\u53EA\u505A\u7EC6\u8282\u6253\u78E8",
      checks: [
        "\u6709\u660E\u786E\u7684\u89C6\u89C9\u4E3B\u9898\uFF1A\u7EDF\u4E00\u7684\u914D\u8272\u4F53\u7CFB\uFF081 \u4E3B\u8272 + 1 \u5F3A\u8C03\u8272 + \u4E2D\u6027\u8272\uFF09\u3001\u6E05\u6670\u7684\u5B57\u53F7\u9636\u68AF\uFF08\u6807\u9898/\u6B63\u6587/\u8F85\u52A9\uFF09\u3001\u5361\u7247\u4E0E\u6309\u94AE\u6837\u5F0F\u2014\u2014\u7B2C\u4E00\u773C\u6709\u8BBE\u8BA1\u611F\uFF0C\u4E0D\u662F\u9ED8\u8BA4\u767D\u5E95\u9ED1\u5B57",
        "\u9996\u5C4F\u5373\u4EAE\u70B9\uFF1Ahero \u4E00\u53E5\u8BDD\u8BF4\u6E05\u300C\u8FD9\u662F\u8C01/\u505A\u4EC0\u4E48\u300D+ \u4E00\u4E2A\u884C\u52A8\u6309\u94AE\uFF0C3 \u79D2\u6293\u4F4F\u6CE8\u610F\u529B",
        "\u5185\u5BB9\u6709\u771F\u5B9E\u8D28\u611F\uFF1A\u6807\u9898\u3001\u4E2A\u4EBA\u4ECB\u7ECD\u3001\u4F5C\u54C1\u6761\u76EE\u3001\u8054\u7CFB\u65B9\u5F0F\u90FD\u662F\u901A\u987A\u771F\u5B9E\u7684\u4E2D\u6587\u6587\u6848\uFF0C\u4E0D\u7528 Lorem \u5360\u4F4D\uFF1B\u6CA1\u6709\u7684\u7D20\u6750\u7528\u5408\u7406\u7684\u793A\u4F8B\u5185\u5BB9\u8865\u9F50",
        "\u6709\u5B58\u5728\u611F\u7684\u4EA4\u4E92\uFF1A\u81F3\u5C11\u4E00\u5904\u6EDA\u52A8/\u60AC\u505C/\u5165\u573A\u52A8\u6548\uFF08\u6EDA\u52A8\u6E10\u663E\u3001\u5361\u7247 hover \u62AC\u5347\u3001\u5BFC\u822A\u9AD8\u4EAE\u7B49\uFF09\uFF0C\u8BA9\u9875\u9762\u300C\u6D3B\u300D\u8D77\u6765\u800C\u4E0D\u662F\u6B7B\u677F",
        "\u9002\u914D\u5B8C\u6574\uFF1A\u79FB\u52A8\u7AEF\u5355\u5217\u53EF\u8BFB\u3001\u684C\u9762\u7AEF\u591A\u5217\u5E03\u5C40\uFF0C\u5BFC\u822A\u5728\u6240\u6709\u9875\u9762\u53EF\u70B9\u51FB\u8DF3\u8F6C\uFF0C\u65E0\u6B7B\u94FE\u65E0\u7834\u56FE\uFF0C\u63A7\u5236\u53F0\u65E0\u62A5\u9519"
      ],
      selfCheck: [
        "\u7B2C\u4E00\u773C\u662F\u5426\u300C\u6709\u8BBE\u8BA1\u611F\u300D\u800C\u4E0D\u662F\u300C\u50CF\u6CA1\u505A\u8FC7\u6837\u5F0F\u300D",
        "\u9996\u5C4F 3 \u79D2\u5185\u80FD\u5426\u8BF4\u6E05\u300C\u8FD9\u662F\u8C01\u7684\u7F51\u7AD9\u3001\u505A\u4EC0\u4E48\u7684\u300D",
        "\u6709\u6CA1\u6709\u9ED8\u8BA4\u84DD\u94FE\u63A5\u3001Times \u5B57\u4F53\u3001\u6D4F\u89C8\u5668\u9ED8\u8BA4\u6837\u5F0F\u6B8B\u7559",
        "\u6240\u6709\u5BFC\u822A\u94FE\u63A5\u662F\u5426\u90FD\u80FD\u70B9\u51FB\u8DF3\u8F6C\u3001\u6CA1\u6709\u6B7B\u94FE",
        "\u6587\u6848\u662F\u5426\u771F\u5B9E\u901A\u987A\uFF0C\u6709\u65E0\u9519\u522B\u5B57\u3001\u5360\u4F4D\u6B8B\u7559\u6216\u5047\u4FE1\u606F",
        "\u624B\u673A\u5BBD\u5EA6\uFF08\u7EA6 390px\uFF09\u4E0B\u662F\u5426\u8FD8\u80FD\u6B63\u5E38\u9605\u8BFB"
      ]
    },
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u521B\u5EFA\u7AD9\u70B9\u6587\u4EF6\u4E0E\u76EE\u5F55", trust: "official" }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "theme",
        question: "\u8FD9\u4E2A\u7F51\u7AD9\u4E3B\u8981\u7528\u6765\u505A\u4EC0\u4E48\uFF1F",
        default: "\u4E2A\u4EBA\u4ECB\u7ECD + \u4F5C\u54C1\u5C55\u793A",
        options: ["\u4E2A\u4EBA\u4ECB\u7ECD + \u4F5C\u54C1\u5C55\u793A", "\u4E2A\u4EBA\u535A\u5BA2", "\u4F5C\u54C1\u96C6 / portfolio", "\u4EA7\u54C1\u843D\u5730\u9875"],
        translate: "\u7528\u6237\u8BF4\u300C\u5C55\u793A\u4F5C\u54C1/\u6444\u5F71/\u8BBE\u8BA1/\u753B\u753B\u300D\u2192 \u4F5C\u54C1\u96C6\u7ED3\u6784\uFF08\u9996\u9875 + \u5206\u7C7B + \u4F5C\u54C1\u8BE6\u60C5\uFF09\uFF1B\u300C\u5199\u6587\u7AE0/\u65E5\u8BB0/\u5206\u4EAB\u300D\u2192 \u535A\u5BA2\u7ED3\u6784\uFF08\u6587\u7AE0\u5217\u8868 + \u8BE6\u60C5\u9875\uFF09\uFF1B\u300C\u4ECB\u7ECD\u81EA\u5DF1\u300D\u2192 \u4E2A\u4EBA\u4ECB\u7ECD\uFF08\u5934\u50CF/\u7ECF\u5386/\u8054\u7CFB\u65B9\u5F0F\uFF09\uFF1B\u300C\u5356\u4E1C\u897F/\u63A8\u5E7F\u4EA7\u54C1\u300D\u2192 \u843D\u5730\u9875\uFF08\u4EA7\u54C1\u5356\u70B9 + \u884C\u52A8\u6309\u94AE\uFF09\u3002"
      },
      {
        key: "style",
        question: "\u89C6\u89C9\u98CE\u683C\u504F\u597D\uFF1F",
        default: "\u7B80\u6D01\u73B0\u4EE3",
        options: ["\u7B80\u6D01\u73B0\u4EE3", "\u6DF1\u8272\u79D1\u6280", "\u6E05\u65B0\u7B80\u7EA6", "\u6742\u5FD7\u98CE"],
        translate: "\u7528\u6237\u8BF4\u300C\u6587\u827A/\u6E05\u65B0/\u6E29\u67D4\u300D\u2192 \u6D45\u8272\u80CC\u666F + \u886C\u7EBF/\u624B\u5199\u5B57\u4F53 + \u5927\u56FE\u7559\u767D\uFF1B\u300C\u79D1\u6280/\u6781\u5BA2/\u70AB\u9177\u300D\u2192 \u6DF1\u8272\u80CC\u666F + \u7B49\u5BBD\u5B57\u4F53 + \u9713\u8679\u5F3A\u8C03\u8272\uFF1B\u300C\u7B80\u7EA6/\u9AD8\u7EA7\u300D\u2192 \u5927\u91CF\u7559\u767D + \u65E0\u886C\u7EBF + \u514B\u5236\u914D\u8272\uFF1B\u300C\u6742\u5FD7/\u65F6\u5C1A\u300D\u2192 \u5927\u6807\u9898 + \u5206\u680F\u7F51\u683C + \u56FE\u7247\u4E3A\u4E3B\u3002"
      },
      {
        key: "scope",
        question: "\u8FD9\u6B21\u505A\u5230\u4EC0\u4E48\u7A0B\u5EA6\uFF1F",
        default: "\u5148\u51FA\u53EF\u770B\u7684\u9996\u9875 + 2~3 \u4E2A\u5185\u9875",
        options: ["\u5148\u51FA\u53EF\u770B\u7684\u9996\u9875 + 2~3 \u4E2A\u5185\u9875", "\u5B8C\u6574\u591A\u9875\u9762\u7AD9\u70B9", "\u53EA\u8981\u4E00\u4E2A\u843D\u5730\u9875"],
        translate: "\u7528\u6237\u8BF4\u300C\u5148\u770B\u770B/\u5148\u505A\u4E2A\u80FD\u770B\u7684/\u968F\u4FBF\u5148\u5F04\u300D\u2192 \u7528\u9ED8\u8BA4\uFF08\u9996\u9875 + 2~3 \u4E2A\u5185\u9875\uFF09\uFF0C\u5185\u5BB9\u5148\u884C\u8865\u8DB3\u540E\u6309\u53CD\u9988\u8FED\u4EE3\uFF1B\u300C\u5168\u90E8/\u5B8C\u6574/\u6B63\u5F0F\u300D\u2192 \u5B8C\u6574\u7AD9\u70B9\u7ED3\u6784\uFF1B\u300C\u53EA\u8981\u4E00\u9875/\u5355\u9875\u300D\u2192 \u5355\u9875\u843D\u5730\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "index.html", note: "\u5E94\u6709\u9996\u9875 index.html" },
      { kind: "content_match", pattern: "index.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" },
      { kind: "content_absent", pattern: "index.html", mustNotContain: "Lorem", note: "\u7EDD\u65E0\u5360\u4F4D\u6587\u5B57" }
    ]
  },
  {
    id: "infographic",
    name: "\u6587\u5B57\u53D8\u4FE1\u606F\u56FE/\u89C6\u89C9\u8868\u8FBE",
    description: "\u628A\u4E00\u6BB5\u6587\u5B57\u6216\u6570\u636E\u53D8\u6210\u4E00\u5F20\u80FD\u770B\u61C2\u7684\u4FE1\u606F\u56FE\uFF08\u6D41\u7A0B\u56FE/\u65F6\u95F4\u7EBF/\u5BF9\u6BD4\u56FE/\u56FE\u6807\u5316\uFF09\uFF0C\u7EAF SVG/HTML \u4EA7\u51FA",
    triggers: ["\u4FE1\u606F\u56FE", "\u4E00\u5F20\u56FE\u770B\u61C2", "\u89C6\u89C9\u8868\u8FBE", "\u505A\u6210\u56FE", "infographic", "\u6D41\u7A0B\u56FE", "\u65F6\u95F4\u7EBF", "\u793A\u610F\u56FE", "\u6D77\u62A5", "diagram", "poster", "\u5173\u7CFB\u56FE", "\u56FE\u6807"],
    guidance: [
      "\u7528 SVG/HTML/CSS \u7EAF\u6587\u672C\u4EA7\u51FA\u89C6\u89C9\u8868\u8FBE\uFF08\u77E2\u91CF\u3001\u6D4F\u89C8\u5668\u53EF\u770B\u53EF\u7F29\u653E\uFF09\uFF0C\u4E0D\u8981\u4F9D\u8D56\u5916\u90E8\u751F\u6210 API \u6216\u56FE\u7247\u7D20\u6750\u5E93",
      "\u5185\u5BB9\u8981\u63D0\u70BC\uFF1A\u6807\u9898\u3001\u5173\u952E\u8981\u70B9\u3001\u6570\u5B57\u4E00\u76EE\u4E86\u7136\uFF0C\u907F\u514D\u5927\u6BB5\u6587\u5B57\u5806\u780C",
      "\u914D\u8272\u514B\u5236\uFF081 \u4E2A\u4E3B\u8272 + 1~2 \u4E2A\u8F85\u8272\uFF09\uFF0C\u5B57\u53F7\u5C42\u7EA7\u6E05\u6670\uFF0C\u79FB\u52A8\u7AEF\u4E5F\u8981\u80FD\u770B",
      "\u4EA7\u51FA .svg + \u9884\u89C8 .html\uFF1B\u5B8C\u6210\u540E\u7ED9\u51FA\u6587\u4EF6\u7EDD\u5BF9\u8DEF\u5F84\u4E0E\u6253\u5F00\u65B9\u5F0F",
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u6863/\u6587\u4EF6/\u4E0A\u4F20\u300D\u6216\u76EE\u6807\u91CC\u6709\u5177\u4F53\u6587\u5B57\u5185\u5BB9\u6765\u6E90\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\uFF08.md/.txt/.docx/.pdf \u7B49\u5E38\u89C1\u683C\u5F0F\uFF0C\u5728\u7528\u6237\u5DE5\u4F5C\u533A/\u5E38\u89C1\u6587\u6863\u4F4D\u7F6E\u627E\uFF09\uFF1B\u8BFB\u4E0D\u4E86\uFF08\u5982\u7F3A\u683C\u5F0F\u89E3\u6790\u80FD\u529B\uFF09\u5C31\u5982\u5B9E\u8BF4\u660E\u7F3A\u4EC0\u4E48\uFF0C\u5E76\u7528 ming_store_search \u627E\u6587\u6863\u89E3\u6790\u7C7B\u63D2\u4EF6\uFF1B\u786E\u5B9E\u627E\u4E0D\u5230\u7D20\u6750\u65F6\u6700\u591A\u95EE\u7528\u6237\u4E00\u6B21\uFF0C\u8981\u4E00\u53E5\u300C\u5927\u6982\u5728\u54EA\u4E2A\u6587\u4EF6\u5939\u300D\u5373\u53EF\uFF0C\u7EDD\u4E0D\u8BA9\u7528\u6237\u590D\u5236\u7C98\u8D34\u5168\u6587\u6216\u81EA\u5DF1\u627E\u8DEF\u5F84"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u4EA7\u51FA SVG/HTML \u6587\u4EF6", trust: "official" },
      {
        kind: "skill",
        id: "modlens",
        source: "@liustack/modlens",
        purpose: "\u89C6\u89C9\u81EA\u68C0\uFF08\u53EF\u9009\uFF0Cmodlens\uFF1A\u622A\u56FE/\u7248\u9762/OCR \u8F6C\u7ED3\u6784\u5316\u8BC1\u636E\uFF0C\u88C5\u540E\u5347\u7EA7\u89C6\u89C9\u68C0\u67E5\uFF09",
        trust: "community",
        optional: true
      }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "form",
        question: "\u60F3\u505A\u6210\u54EA\u79CD\u89C6\u89C9\u8868\u8FBE\uFF1F",
        default: "\u4FE1\u606F\u56FE",
        options: ["\u4FE1\u606F\u56FE", "\u6D41\u7A0B\u56FE", "\u65F6\u95F4\u7EBF", "\u5BF9\u6BD4\u56FE", "\u56FE\u6807\u5316"],
        translate: "\u7528\u6237\u8BF4\u300C\u6574\u7406\u6210\u4E00\u5F20\u56FE/\u4E00\u5F20\u56FE\u770B\u61C2/\u603B\u7ED3\u6210\u56FE\u300D\u2192 \u4FE1\u606F\u56FE\uFF08\u6807\u9898+\u8981\u70B9+\u6570\u5B57\u5206\u533A\uFF09\uFF1B\u300C\u6D41\u7A0B/\u6B65\u9AA4/\u600E\u4E48\u505A\u300D\u2192 \u6D41\u7A0B\u56FE\uFF08\u6B65\u9AA4\u8282\u70B9+\u7BAD\u5934\uFF09\uFF1B\u300C\u5148\u540E\u987A\u5E8F/\u65F6\u95F4\u53D1\u5C55\u300D\u2192 \u65F6\u95F4\u7EBF\uFF1B\u300C\u6BD4\u8C01\u5F3A/\u5BF9\u6BD4\u4E00\u4E0B\u300D\u2192 \u5BF9\u6BD4\u56FE\uFF08\u5E76\u6392\u5DEE\u5F02\uFF09\uFF1B\u300C\u505A\u4E2A logo/\u6807\u5FD7/\u5C0F\u56FE\u6807\u300D\u2192 \u56FE\u6807\u5316\uFF08\u7B80\u6D01\u7B26\u53F7\uFF09\u3002"
      },
      {
        key: "style",
        question: "\u89C6\u89C9\u98CE\u683C\u504F\u597D\uFF1F",
        default: "\u7B80\u6D01\u73B0\u4EE3",
        options: ["\u7B80\u6D01\u73B0\u4EE3", "\u5546\u52A1\u6B63\u5F0F", "\u6D3B\u6CFC\u5361\u901A", "\u79D1\u6280\u611F"],
        translate: "\u7528\u6237\u8BF4\u300C\u597D\u770B/\u53EF\u7231/\u751F\u52A8/\u6709\u8DA3\u300D\u2192 \u6D3B\u6CFC\u5361\u901A\uFF08\u660E\u4EAE\u8272\u5757+\u5706\u89D2\uFF09\uFF1B\u300C\u6B63\u5F0F/\u5F00\u4F1A/\u6C47\u62A5\u7528\u300D\u2192 \u5546\u52A1\u6B63\u5F0F\uFF08\u767D\u5E95+\u6DF1\u8272\u6807\u9898+\u54C1\u724C\u8272\uFF09\uFF1B\u300C\u9177/\u672A\u6765/\u79D1\u6280\u300D\u2192 \u79D1\u6280\u611F\uFF08\u6DF1\u8272\u5E95+\u9713\u8679\u5F3A\u8C03\uFF09\uFF1B\u9ED8\u8BA4 \u2192 \u7B80\u6D01\u73B0\u4EE3\uFF08\u7559\u767D+\u65E0\u886C\u7EBF+\u514B\u5236\u914D\u8272\uFF09\u3002"
      },
      {
        key: "output",
        question: "\u505A\u5B8C\u4E3B\u8981\u7528\u5728\u54EA\uFF1F",
        default: "\u7F51\u9875\u4E0A\u5C55\u793A + \u53EF\u4E0B\u8F7D\u7684 SVG",
        options: ["\u7F51\u9875\u4E0A\u5C55\u793A + \u53EF\u4E0B\u8F7D\u7684 SVG", "\u8981\u653E\u8FDB PPT/\u6587\u6863/\u90AE\u4EF6", "\u6253\u5370\u6D77\u62A5"],
        translate: "\u7528\u6237\u8BF4\u300C\u653E PPT/\u6587\u6863/\u90AE\u4EF6\u91CC\u300D\u2192 \u77E2\u91CF SVG\uFF08\u653E\u5927\u4E0D\u5931\u771F\uFF09\uFF1B\u300C\u6253\u5370/\u8D34\u51FA\u6765\u300D\u2192 \u7AD6\u7248\u6D77\u62A5\u5C3A\u5BF8\uFF08\u5927\u6807\u9898+\u5927\u5B57\uFF09\uFF1B\u300C\u7F51\u9875/\u53D1\u670B\u53CB\u5708\u300D\u2192 \u6A2A\u7248\u7F51\u9875\u5C3A\u5BF8\uFF1B\u9ED8\u8BA4 \u2192 \u7F51\u9875\u5C55\u793A\u5C3A\u5BF8\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "*.svg", note: "\u5E94\u4EA7\u51FA SVG \u6587\u4EF6" },
      { kind: "content_match", pattern: "*.svg", contains: "<svg", note: "\u5E94\u4E3A\u6709\u6548 SVG" },
      { kind: "content_match", pattern: "*.svg", contains: "viewBox", note: "SVG \u5E94\u6709\u753B\u5E03\u5C3A\u5BF8" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u80FD\u76F4\u63A5\u53D1\u51FA\u53BB\u7684\u4FE1\u606F\u56FE\u300D\u2014\u2014\u7AD9\u5728\u4E00\u7C73\u5916\u4E5F\u80FD\u770B\u61C2\u6838\u5FC3\u4FE1\u606F",
      checks: [
        "\u4FE1\u606F\u5C42\u6B21\u6E05\u6670\uFF1A\u6807\u9898\u2192\u8981\u70B9\u2192\u6570\u5B57\u4E09\u5C42\uFF0C\u5927\u6BB5\u6587\u5B57\u5148\u63D0\u70BC\u6210\u77ED\u53E5/\u5173\u952E\u8BCD\uFF0C\u4E0D\u5806\u780C",
        "\u6784\u56FE\u6709\u547C\u5438\u611F\uFF1A\u7559\u767D\u5145\u8DB3\uFF0C\u533A\u5757\u4E4B\u95F4\u6709\u89C6\u89C9\u5206\u9694\uFF0C\u4E0D\u6324\u6210\u4E00\u56E2",
        "\u914D\u8272\u514B\u5236\uFF1A1 \u4E2A\u4E3B\u8272 + 1~2 \u4E2A\u8F85\u8272\uFF0C\u5B57\u53F7\u5C42\u7EA7 3 \u7EA7\u4EE5\u5185\uFF0C\u79FB\u52A8\u7AEF\u53EF\u8BFB",
        "\u77E2\u91CF\u8F93\u51FA\uFF1ASVG \u4E0D\u5931\u771F\uFF0C\u914D .html \u9884\u89C8\u9875\uFF0C\u53CC\u51FB\u53EF\u770B"
      ],
      selfCheck: [
        "\u4E00\u7C73\u5916\u80FD\u5426\u4E00\u773C\u770B\u61C2\u300C\u8FD9\u5F20\u56FE\u5728\u8BB2\u4EC0\u4E48\u300D",
        "\u6709\u6CA1\u6709\u5927\u6BB5\u6587\u5B57\u5806\u780C\uFF08\u6709\u5C31\u8BE5\u63D0\u70BC\uFF09",
        "\u989C\u8272\u662F\u5426\u8D85\u8FC7 3 \u4E2A\u4E3B\u8272\uFF08\u8D85\u4E86\u5C31\u662F\u82B1\uFF09"
      ]
    }
  },
  {
    id: "content-cards",
    name: "\u6587\u7AE0\u8F6C\u591A\u5E73\u53F0\u4FE1\u606F\u56FE\uFF08\u516C\u4F17\u53F7\u5C01\u9762 / \u5C0F\u7EA2\u4E66 / \u6296\u97F3\uFF09",
    description: "\u628A\u4E00\u7BC7\u516C\u4F17\u53F7\u6587\u7AE0\u6216\u5185\u5BB9\u4E3B\u9898\uFF0C\u63D0\u70BC\u6210\u4E00\u7EC4\u4F4E\u5BC6\u5EA6\u4FE1\u606F\u56FE\u5361\u7247\uFF1A\u516C\u4F17\u53F7\u5C01\u9762 + \u5C0F\u7EA2\u4E66\u7AD6\u5361 + \u6296\u97F3\u7AD6\u5361\uFF0C\u54C1\u724C\u5316\u3001\u53EF\u76F4\u63A5\u53D1\u5E03",
    triggers: ["\u4FE1\u606F\u56FE", "\u505A\u6210\u56FE", "\u5C01\u9762", "\u914D\u56FE", "\u5361\u7247", "\u56FE\u6587", "\u81EA\u5A92\u4F53", "\u516C\u4F17\u53F7", "\u5C0F\u7EA2\u4E66", "\u6296\u97F3", "\u5185\u5BB9\u56FE", "\u53D1\u5E03\u56FE", "social media"],
    guidance: [
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u7AE0/\u6587\u6863/\u6211\u7684\u5185\u5BB9\u300D\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\u7D20\u6750\uFF08.md/.txt/.docx \u7B49\uFF09\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u627E\u8DEF\u5F84\u6216\u590D\u5236\u7C98\u8D34",
      "\u5148\u63D0\u70BC\u5185\u5BB9\u9AA8\u67B6\uFF1A\u6807\u9898\uFF08\u226412 \u5B57\uFF09\u30013~5 \u4E2A\u6838\u5FC3\u8981\u70B9\u30011 \u53E5\u91D1\u53E5\u30011 \u4E2A\u884C\u52A8\u5F15\u5BFC\uFF1B\u4FE1\u606F\u56FE\u53EA\u5448\u73B0\u9AA8\u67B6\uFF0C\u4E0D\u5806\u6B63\u6587",
      "\u5185\u5BB9\u5BC6\u5EA6\u89C4\u5219\uFF08\u6700\u91CD\u8981\uFF09\uFF1A\u4E00\u5361\u4E00\u70B9\u2014\u2014\u5927\u6807\u9898\uFF08\u226412 \u5B57\uFF09+ \u4E00\u53E5\u526F\u6807\uFF08\u226420 \u5B57\uFF09+ \u81F3\u591A 3 \u4E2A\u5173\u952E\u8BCD\u6807\u7B7E\uFF1B\u4EFB\u4F55\u4E00\u5F20\u5361\u90FD\u4E0D\u653E\u6BB5\u843D\u6587\u5B57\uFF0C\u4E00\u5361\u8BB2\u4E0D\u6E05\u5C31\u62C6\u6210\u591A\u5361",
      "\u5E73\u53F0\u5C3A\u5BF8\uFF1A\u516C\u4F17\u53F7\u5C01\u9762 900\xD7383\uFF082.35:1\uFF0C\u6807\u9898 \u226410 \u5B57\uFF0C\u4E00\u53E5\u8BDD + \u4E3B\u89C6\u89C9\uFF09\uFF1B\u5C0F\u7EA2\u4E66 1080\xD71440\uFF083:4\uFF0C\u6807\u9898 + \u6807\u7B7E\u7EC4\uFF09\uFF1B\u6296\u97F3 1080\xD71920\uFF089:16\uFF0C\u91D1\u53E5\u5355\u70B9\uFF0C\u4E2D\u4E0B\u90E8\u7559\u7A7A\u907F\u5F00\u5E95\u90E8 UI\uFF09\u3002\u7528\u6237\u672A\u6307\u5B9A\u65F6\u4E09\u79CD\u90FD\u505A",
      "\u7248\u5F0F\u7CFB\u7EDF\uFF1A\u56DB\u5468\u8FB9\u8DDD \u2265 \u753B\u5E03\u5BBD 8%\uFF081080 \u5BBD \u2192 \u8FB9\u8DDD \u2265 86px\uFF09\uFF1B\u5C42\u7EA7\u4ECE\u4E0A\u5230\u4E0B\u56FA\u5B9A\u4E3A\u300C\u54C1\u724C\u5C0F\u5B57 \u2192 \u5927\u6807\u9898 \u2192 \u4E00\u53E5\u526F\u6807 \u2192 \u6807\u7B7E/\u5E95\u90E8\u54C1\u724C\u300D\uFF1B\u6574\u5361\u5BF9\u9F50\u7EDF\u4E00\uFF08\u8981\u4E48\u5168\u5DE6\u5BF9\u9F50\u8981\u4E48\u5168\u5C45\u4E2D\uFF0C\u7EDD\u4E0D\u6DF7\u7528\uFF09\uFF1B\u5143\u7D20\u95F4\u8DDD\u7528 8/16/24/32/48 \u68AF\u961F\uFF0C\u4E0D\u968F\u624B\u6446",
      "\u8272\u5F69\u7CFB\u7EDF\uFF1A1 \u4E2A\u4E3B\u8272\uFF08\u5360\u753B\u9762 70% \u4EE5\u4E0A\uFF09+ 1 \u4E2A\u5F3A\u8C03\u8272\uFF08\u53EA\u7528\u4E8E\u6807\u9898/\u91D1\u53E5/\u6807\u7B7E\uFF09+ \u4E2D\u6027\u8272\uFF1B\u6E10\u53D8\u53EA\u4ECE\u4E3B\u8272\u884D\u751F\uFF1B\u6DF1\u5E95\u6D45\u5B57\u6216\u6D45\u5E95\u6DF1\u5B57\u4E8C\u9009\u4E00\uFF0C\u6587\u5B57\u4E0E\u80CC\u666F\u5BF9\u6BD4 \u2265 4.5:1\uFF1B\u4E0D\u8981\u9713\u8679\u5806\u53E0\u3001\u4E0D\u8981\u591A\u91CD\u9634\u5F71\u3001\u4E0D\u8981\u4E94\u989C\u516D\u8272",
      "\u5B57\u4F53\u7CFB\u7EDF\uFF1A\u4E2D\u6587\u6807\u9898\u7528\u7CFB\u7EDF\u9ED1\u4F53\uFF08PingFang SC / Microsoft YaHei / \u601D\u6E90\u9ED1\u4F53\uFF09\uFF0C1080 \u5BBD\u4E0B\u6807\u9898 \u2265 72px\u3001\u526F\u6807 \u2265 32px\u3001\u6807\u7B7E \u2265 28px\uFF1B\u6807\u9898\u4E0D\u6362\u884C\u8D85\u8FC7 2 \u884C\uFF1B\u4E0D\u7528\u886C\u7EBF\u4F53\u505A\u6807\u9898\uFF1B\u4E0D\u7528 emoji",
      "\u4E13\u4E1A\u7EC6\u8282\uFF1A\u540C\u7EC4\u5143\u7D20\u5706\u89D2\u534A\u5F84\u7EDF\u4E00\uFF1B\u6807\u7B7E\u7528\u6D45\u8272\u5E95 + \u5F3A\u8C03\u8272\u5B57\uFF08\u6216\u5F3A\u8C03\u8272\u5E95 + \u767D\u5B57\uFF09\uFF1B\u91D1\u53E5\u53EF\u7528\u5F3A\u8C03\u8272\uFF1B\u5E95\u90E8\u54C1\u724C\u5C0F\u5B57\uFF08\u2264 26px\uFF09\uFF1B\u7559\u767D\u5145\u8DB3\u4E0D\u6324",
      "\u54C1\u724C\u5316\uFF1A\u56FE\u4E0A\u53EA\u51FA\u73B0\u7528\u6237\u54C1\u724C\u540D\uFF08\u5982 FamilySpace\uFF09\u4E0E\u4EA7\u54C1\u89D2\u8272\u540D\uFF08\u5982\u5BB6\u660E\uFF09\uFF0C\u7EDD\u4E0D\u51FA\u73B0 Ming\u3001\u63D2\u4EF6\u540D\u3001\u6A21\u578B\u540D\u3001dsh \u7B49\u5DE5\u5177\u75D5\u8FF9\uFF0C\u4E5F\u4E0D\u51FA\u73B0\u300C\u7531XX\u751F\u6210\u300D\u6C34\u5370",
      "\u6BCF\u4E2A SVG \u914D\u4E00\u4E2A .html \u9884\u89C8\u9875\uFF08\u5185\u8054\u5F15\u5165\uFF0C\u900F\u660E\u5E95\u5C45\u4E2D\uFF09\uFF0C\u53CC\u51FB\u5373\u53EF\u770B\u6574\u7EC4\u6548\u679C"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u5B9A\u4F4D\u8BFB\u53D6\u7D20\u6750\u3001\u4EA7\u51FA SVG/HTML", trust: "official" }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "brand",
        question: "\u56FE\u4E0A\u653E\u4EC0\u4E48\u54C1\u724C\u540D\uFF1F",
        default: "FamilySpace",
        options: ["FamilySpace", "\u4E0D\u52A0\u7F72\u540D"],
        translate: "\u7528\u6237\u7ED9\u4E86\u54C1\u724C\u540D\uFF08\u5982 FamilySpace\u3001\u4EA7\u54C1\u540D\uFF09\u2192 \u4F7F\u7528\u8BE5\u54C1\u724C\uFF1B\u300C\u4E0D\u7F72\u540D/\u5E72\u51C0\u300D\u2192 \u56FE\u4E0A\u4E0D\u51FA\u73B0\u54C1\u724C\u5B57\u6837\uFF1B\u300C\u7528\u6237\u54C1\u724C\u662F\u4EC0\u4E48\u300D\u2192 \u7528 FamilySpace\uFF08\u91CC\u9762\u5BF9\u8BDD\u7684\u53EB\u5BB6\u660E\uFF09\u3002"
      },
      {
        key: "platform",
        question: "\u8FD9\u4E9B\u4FE1\u606F\u56FE\u53D1\u5230\u54EA\u91CC\uFF1F",
        default: "\u516C\u4F17\u53F7\u5C01\u9762 + \u5C0F\u7EA2\u4E66 + \u6296\u97F3",
        options: ["\u516C\u4F17\u53F7\u5C01\u9762 + \u5C0F\u7EA2\u4E66 + \u6296\u97F3", "\u53EA\u8981\u516C\u4F17\u53F7\u5C01\u9762", "\u53EA\u8981\u5C0F\u7EA2\u4E66\u7AD6\u5361", "\u53EA\u8981\u6296\u97F3\u7AD6\u5361"],
        translate: "\u7528\u6237\u8BF4\u300C\u516C\u4F17\u53F7\u300D\u2192 900\xD7383 \u5C01\u9762\uFF1B\u300C\u5C0F\u7EA2\u4E66\u300D\u2192 1080\xD71440 \u7AD6\u5361\uFF1B\u300C\u6296\u97F3\u300D\u2192 1080\xD71920 \u7AD6\u5361\uFF1B\u300C\u90FD\u8981/\u5168\u5E73\u53F0/\u81EA\u5A92\u4F53\u300D\u2192 \u4E09\u79CD\u5C3A\u5BF8\u90FD\u4EA7\u51FA\uFF0C\u5185\u5BB9\u8981\u70B9\u6309\u5E73\u53F0\u62C6\u5206\u590D\u7528\u3002"
      },
      {
        key: "source",
        question: "\u5185\u5BB9\u4ECE\u54EA\u91CC\u6765\uFF1F",
        default: "\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u8BFB\u5DE5\u4F5C\u533A\u91CC\u7684\u6587\u7AE0/\u6587\u6863",
        options: ["\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u8BFB\u5DE5\u4F5C\u533A\u91CC\u7684\u6587\u7AE0/\u6587\u6863", "\u76F4\u63A5\u6309\u4E0B\u9762\u7684\u4E3B\u9898\u505A"],
        translate: "\u7528\u6237\u7ED9\u4E86\u6587\u7AE0/\u6587\u6863 \u2192 \u5B9A\u4F4D\u8BFB\u53D6\u540E\u63D0\u70BC\uFF1B\u53EA\u7ED9\u4E3B\u9898\u6CA1\u7ED9\u6587\u7AE0 \u2192 \u6309\u4E3B\u9898 + \u4EA7\u54C1\u80CC\u666F\u76F4\u63A5\u63D0\u70BC\u8981\u70B9\u505A\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "*.svg", note: "\u5E94\u4EA7\u51FA SVG \u4FE1\u606F\u56FE\u5361\u7247" },
      { kind: "content_match", pattern: "*.svg", contains: "<svg", note: "\u5E94\u4E3A\u6709\u6548 SVG" },
      { kind: "content_match", pattern: "*.svg", contains: "viewBox", note: "SVG \u5E94\u6709\u753B\u5E03\u5C3A\u5BF8" },
      { kind: "content_absent", pattern: "*.svg", mustNotContain: "Ming", note: "\u7EDD\u65E0\u5DE5\u5177\u75D5\u8FF9/\u6C34\u5370" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u80FD\u76F4\u63A5\u53D1\u5E03\u7684\u4F4E\u5BC6\u5EA6\u4FE1\u606F\u56FE\u7EC4\u300D\uFF1A\u516C\u4F17\u53F7\u5C01\u9762 + \u5C0F\u7EA2\u4E66/\u6296\u97F3\u7AD6\u5361\uFF0C\u54C1\u724C\u5316\u3001\u96F6\u5DE5\u5177\u75D5\u8FF9",
      checks: [
        "\u4F4E\u5BC6\u5EA6\uFF1A\u6BCF\u5F20\u56FE\u4E00\u4E2A\u4FE1\u606F\u70B9\uFF08\u5927\u6807\u9898 \u226412 \u5B57 + \u4E00\u53E5\u526F\u6807 + \u81F3\u591A 3 \u4E2A\u6807\u7B7E\uFF09\uFF0C\u7EDD\u65E0\u6BB5\u843D\u6587\u5B57",
        "\u591A\u5E73\u53F0\u5C3A\u5BF8\uFF1A\u516C\u4F17\u53F7\u5C01\u9762 900\xD7383\uFF082.35:1\uFF09\uFF1B\u5C0F\u7EA2\u4E66 1080\xD71440\uFF083:4\uFF09\uFF1B\u6296\u97F3 1080\xD71920\uFF089:16\uFF09",
        "\u7248\u5F0F\u6709\u8BBE\u8BA1\u611F\uFF1A\u8FB9\u8DDD \u2265 8% \u753B\u5E03\u5BBD\u3001\u5C42\u7EA7\u300C\u54C1\u724C\u2192\u6807\u9898\u2192\u526F\u6807\u2192\u6807\u7B7E\u300D\u6E05\u6670\u3001\u5BF9\u9F50\u5168\u5361\u7EDF\u4E00\u3001\u95F4\u8DDD\u6210\u68AF\u961F",
        "\u8272\u5F69\u514B\u5236\uFF1A1 \u4E3B\u8272 + 1 \u5F3A\u8C03\u8272 + \u4E2D\u6027\u8272\uFF0C\u6E10\u53D8\u53EA\u4ECE\u4E3B\u8272\u884D\u751F\uFF0C\u6587\u5B57\u5BF9\u6BD4 \u2265 4.5:1",
        "\u54C1\u724C\u5316\uFF1A\u51FA\u73B0\u7528\u6237\u54C1\u724C\uFF08\u5982 FamilySpace / \u5BB6\u660E\uFF09\uFF0C\u7EDD\u65E0 Ming/\u63D2\u4EF6/\u6A21\u578B\u6C34\u5370\u6216\u300C\u7531XX\u751F\u6210\u300D\u5B57\u6837",
        "\u79FB\u52A8\u7AEF\u53EF\u8BFB\uFF1A\u6807\u9898 \u2265 72px\uFF081080 \u5BBD\uFF09\u3001\u624B\u673A\u7AD6\u5C4F\u4E00\u773C\u770B\u61C2"
      ],
      selfCheck: [
        "\u7F29\u6210\u624B\u673A\u5C4F\u5E55\u5927\u5C0F\uFF0C\u6807\u9898\u4E00\u773C\u80FD\u770B\u6E05\u3001\u6CA1\u6709\u5C0F\u5B57\u5806\u53E0\u5417",
        "\u6709\u6CA1\u6709\u300C\u7531XX\u751F\u6210\u300D\u8FD9\u7C7B\u5DE5\u5177\u6C34\u5370\u6216\u4EFB\u4F55\u5DE5\u5177\u75D5\u8FF9\uFF08\u7EDD\u4E0D\u80FD\u6709\uFF09",
        "\u6BCF\u5F20\u56FE\u662F\u4E0D\u662F\u53EA\u8BB2\u4E00\u4E2A\u8981\u70B9\u3001\u5185\u5BB9\u5BC6\u5EA6\u4F1A\u4E0D\u4F1A\u592A\u9AD8",
        "\u6709\u6CA1\u6709 emoji\u3001\u82B1\u54E8\u6E10\u53D8\u3001\u591A\u91CD\u9634\u5F71\u3001\u4E94\u989C\u516D\u8272\uFF08\u6709\u5C31\u5220\uFF09"
      ]
    }
  },
  {
    id: "presentation",
    name: "\u751F\u6210\u6F14\u793A\u6587\u7A3F\uFF08PPT/\u5E7B\u706F\u7247\uFF09",
    description: "\u628A\u8981\u70B9\u6574\u7406\u6210\u4E00\u5957\u80FD\u7FFB\u9875\u6F14\u793A\u7684\u5E7B\u706F\u7247\uFF0C\u6253\u5F00\u5C31\u80FD\u8BB2",
    triggers: ["ppt", "\u5E7B\u706F\u7247", "\u6F14\u793A\u6587\u7A3F", "slides", "presentation", "\u5BA3\u8BB2", "deck", "\u505A\u4E00\u5957\u8BB2\u89E3"],
    guidance: [
      "\u5148\u63D0\u70BC\u8981\u70B9\uFF08\u7ED3\u8BBA\u5148\u884C\u3001\u4E00\u9875\u4E00\u4E2A\u4E3B\u9898\uFF09\uFF0C\u518D\u4EA7\u51FA\u5E7B\u706F\u7247",
      "\u4F18\u5148\u4EA7\u51FA HTML \u5E7B\u706F\u7247\uFF08\u6BCF\u9875\u4E00\u4E2A section\uFF0C\u5185\u8054 CSS\uFF0C\u6D4F\u89C8\u5668\u53EF\u7FFB\u9875\u6F14\u793A\uFF09\uFF1B\u82E5\u73AF\u5883\u6709 ppt_create \u80FD\u529B\u5219\u540C\u65F6\u4EA7\u51FA .pptx",
      "\u914D\u56FE\u7528\u7EAF CSS/\u5F62\u72B6\u5373\u53EF\uFF0C\u4E0D\u4F9D\u8D56\u5916\u90E8\u56FE\u7247\uFF1B\u5B8C\u6210\u540E\u7ED9\u51FA\u6587\u4EF6\u8DEF\u5F84\u4E0E\u6253\u5F00\u65B9\u5F0F",
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u6863/\u8D44\u6599/\u4E0A\u4F20\u300D\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\u7D20\u6750\uFF08.md/.docx/.txt \u7B49\uFF09\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u627E\u8DEF\u5F84\u6216\u590D\u5236\u7C98\u8D34\uFF1B\u8BFB\u4E0D\u4E86\u5C31\u5982\u5B9E\u8BF4\u660E\u7F3A\u4EC0\u4E48\uFF0C\u786E\u5B9E\u627E\u4E0D\u5230\u65F6\u6700\u591A\u95EE\u4E00\u6B21\u7528\u6237\u5927\u6982\u4F4D\u7F6E"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u4EA7\u51FA\u5E7B\u706F\u7247\u6587\u4EF6", trust: "official" },
      {
        kind: "tool",
        id: "ppt_create",
        source: "dsh-univer-office",
        purpose: "\u751F\u6210 .pptx\uFF08dsh-univer-office\uFF1A\u8868\u683C/\u6587\u6863/\u6F14\u793A/\u6570\u636E\u5E93\uFF0C\u88C5\u540E\u53EF\u4EA7\u51FA .pptx\uFF09",
        trust: "community",
        optional: true
      }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "audience",
        question: "\u8FD9\u5957\u5E7B\u706F\u7247\u4E3B\u8981\u7ED9\u8C01\u8BB2\uFF1F",
        default: "\u901A\u7528/\u5185\u90E8\u6C47\u62A5",
        options: ["\u7ED9\u4E0A\u7EA7/\u8001\u677F\u6C47\u62A5", "\u7ED9\u5BA2\u6237/\u5BF9\u5916", "\u7ED9\u540C\u4E8B/\u5185\u90E8\u57F9\u8BAD", "\u901A\u7528"],
        translate: "\u7528\u6237\u8BF4\u300C\u7ED9\u8001\u677F/\u4E0A\u7EA7/\u9886\u5BFC\u300D\u2192 \u7ED3\u8BBA\u5148\u884C + \u6570\u636E\u652F\u6491 + \u4E00\u9875\u4E00\u8981\u70B9\uFF1B\u300C\u7ED9\u5BA2\u6237/\u5BF9\u5916\u300D\u2192 \u4EF7\u503C\u5356\u70B9 + \u6848\u4F8B + \u884C\u52A8\u547C\u5401\uFF1B\u300C\u57F9\u8BAD/\u6559\u540C\u4E8B\u300D\u2192 \u6B65\u9AA4\u8BB2\u89E3 + \u56FE\u793A + \u7559\u4E92\u52A8\uFF1B\u9ED8\u8BA4 \u2192 \u901A\u7528\u7ED3\u6784\u3002"
      },
      {
        key: "style",
        question: "\u89C6\u89C9\u98CE\u683C\u504F\u597D\uFF1F",
        default: "\u5546\u52A1\u7B80\u6D01",
        options: ["\u5546\u52A1\u7B80\u6D01", "\u79D1\u6280\u611F", "\u6D3B\u6CFC\u660E\u4EAE"],
        translate: "\u7528\u6237\u8BF4\u300C\u6B63\u5F0F/\u4E13\u4E1A\u300D\u2192 \u5546\u52A1\u7B80\u6D01\uFF08\u767D\u5E95+\u6DF1\u8272\u6807\u9898+\u54C1\u724C\u8272\uFF09\uFF1B\u300C\u4EA7\u54C1\u53D1\u5E03/\u9177\u300D\u2192 \u6DF1\u8272\u6E10\u53D8+\u9713\u8679\u5F3A\u8C03\uFF1B\u300C\u8F7B\u677E/\u57F9\u8BAD/\u5E74\u8F7B\u300D\u2192 \u660E\u4EAE\u8272\u5757+\u5927\u56FE\u6807\u3002"
      },
      {
        key: "depth",
        question: "\u5185\u5BB9\u91CF\u505A\u591A\u5C11\uFF1F",
        default: "10 \u9875\u5DE6\u53F3\u6838\u5FC3\u8981\u70B9",
        options: ["\u7CBE\u70BC 5~8 \u9875", "10 \u9875\u5DE6\u53F3", "\u8BE6\u5C3D 15 \u9875\u4EE5\u4E0A"],
        translate: "\u7528\u6237\u8BF4\u300C\u7B80\u5355/\u5FEB\u901F/\u5148\u5F04\u4E00\u7248\u300D\u2192 \u7CBE\u70BC 5~8 \u9875\uFF1B\u300C\u8BE6\u7EC6/\u5B8C\u6574/\u8981\u8BB2\u5F88\u4E45\u300D\u2192 \u8BE6\u5C3D 15 \u9875\u4EE5\u4E0A\uFF08\u542B\u76EE\u5F55+\u9644\u5F55\uFF09\uFF1B\u9ED8\u8BA4 \u2192 10 \u9875\u5DE6\u53F3\u6838\u5FC3\u8981\u70B9\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "*.html", note: "\u5E94\u4EA7\u51FA HTML \u5E7B\u706F\u7247" },
      { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u5C31\u4EA4\u4ED8\u300C\u6253\u5F00\u5C31\u80FD\u8BB2\u7684\u5E7B\u706F\u7247\u300D\uFF0C\u4E0D\u662F\u8981\u70B9\u6E05\u5355",
      checks: [
        "\u4E00\u9875\u4E00\u4E3B\u9898\uFF1A\u6BCF\u9875\u53EA\u8BB2\u4E00\u4EF6\u4E8B\uFF0C\u6807\u9898\u5373\u7ED3\u8BBA\uFF0C\u6B63\u6587\u662F\u652F\u6491\u4E0D\u662F\u91CD\u590D",
        "\u7ED3\u8BBA\u5148\u884C\uFF1A\u5F00\u573A\u9875\u76F4\u63A5\u7ED9\u300C\u8FD9\u6B21\u8BB2\u4EC0\u4E48\u3001\u7ED3\u8BBA\u662F\u4EC0\u4E48\u300D\uFF0C\u4E0D\u4ECE\u80CC\u666F\u94FA\u57AB",
        "\u6392\u7248\u6709\u5C42\u6B21\uFF1A\u6807\u9898/\u8981\u70B9/\u56FE\u793A\u4E09\u7EA7\u6E05\u6670\uFF0C\u7559\u767D\u5145\u8DB3\uFF0C\u52A8\u753B\u514B\u5236\u4F46\u5B58\u5728\uFF08\u7FFB\u9875\u8FC7\u6E21/\u8981\u70B9\u6E10\u663E\uFF09",
        "\u4E0D\u4F9D\u8D56\u5916\u90E8\u56FE\u7247\uFF1B\u6295\u5F71\u4E0E\u624B\u673A\u90FD\u80FD\u770B\u6E05"
      ],
      selfCheck: [
        "\u6BCF\u9875\u80FD\u5426\u4E0D\u770B\u7A3F\u8BB2\u6EE1 30 \u79D2",
        "\u8FDE\u8D77\u6765\u7FFB\u4E00\u904D\u662F\u5426\u901A\u987A\u3001\u6709\u6CA1\u6709\u8DF3\u6B65",
        "\u7AD9\u5728\u4F1A\u8BAE\u5BA4\u540E\u6392\u80FD\u5426\u770B\u6E05\u5B57"
      ]
    }
  },
  {
    id: "publish-site",
    name: "\u53D1\u5E03\u7F51\u7AD9/\u4E0A\u7EBF\uFF08\u4E00\u6761\u9F99\uFF1A\u5EFA\u7AD9 \u2192 \u6821\u9A8C \u2192 \u53D1\u5E03\uFF09",
    description: "\u4ECE\u96F6\u5230\u516C\u5F00\u8BBF\u95EE\u4E00\u6761\u9F99\uFF1A\u6CA1\u6709\u7AD9\u70B9\u5148\u5EFA\u4E00\u4E2A\uFF0C\u6821\u9A8C\u53EF\u6253\u5F00\uFF0C\u518D\u53D1\u5E03\u4E0A\u7EBF\uFF0C\u751F\u6210\u53EF\u516C\u5F00\u8BBF\u95EE\u7684\u5730\u5740",
    triggers: ["\u53D1\u5E03", "\u4E0A\u7EBF", "\u90E8\u7F72", "deploy", "\u6258\u7BA1", "github pages", "vercel", "netlify", "\u8BA9\u522B\u4EBA\u80FD\u770B", "\u516C\u5F00\u8BBF\u95EE", "\u4E00\u6761\u9F99"],
    guidance: [
      "\u8FD9\u662F\u4E00\u6761\u591A\u6B65\u5DE5\u4F5C\u6D41\uFF1A\u5148\u786E\u4FDD\u6709\u7AD9\u70B9\uFF08\u6CA1\u6709\u5C31\u5EFA\uFF09\u2192 \u6821\u9A8C\u53EF\u6253\u5F00 \u2192 \u53D1\u5E03\u4E0A\u7EBF",
      "\u7528\u6237\u63D0\u5230\u300C\u5148\u672C\u5730\u770B\u770B\u300D\u65F6\uFF0C\u53D1\u5E03\u6B65\u53EF\u4EE5\u53EA\u505A\u672C\u5730\u9884\u89C8\u5E76\u8BF4\u660E\u5982\u4F55\u672C\u5730\u6253\u5F00",
      "\u53D1\u5E03\u80FD\u529B\u672A\u88C5\u914D\u65F6\uFF0C\u505C\u5728\u672C\u6B65\u5E76\u5F15\u5BFC\u88C5\u914D\uFF0C\u4E0D\u5047\u88C5\u5DF2\u53D1\u5E03"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u51C6\u5907\u4E0E\u68C0\u67E5\u53D1\u5E03\u5185\u5BB9", trust: "official" }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "target",
        question: "\u53D1\u5E03\u5230\u54EA\u91CC\u8BA9\u522B\u4EBA\u770B\uFF1F",
        default: "\u5148\u672C\u5730\u9884\u89C8\uFF0C\u786E\u8BA4\u6CA1\u95EE\u9898\u518D\u53D1\u5E03",
        options: ["\u5148\u672C\u5730\u9884\u89C8\uFF0C\u786E\u8BA4\u6CA1\u95EE\u9898\u518D\u53D1\u5E03", "GitHub Pages\uFF08\u514D\u8D39\u9759\u6001\u6258\u7BA1\uFF09", "Vercel\uFF08\u514D\u8D39\u9759\u6001\u6258\u7BA1\uFF09", "\u751F\u6210\u53EF\u53D1\u7ED9\u522B\u4EBA\u7684\u6253\u5305\u6587\u4EF6"],
        translate: "\u7528\u6237\u8BF4\u300C\u514D\u8D39/\u4E0D\u8981\u94B1/\u767D\u5AD6\u300D\u2192 \u514D\u8D39\u9759\u6001\u6258\u7BA1\uFF08GitHub Pages \u6216 Vercel\uFF09\uFF1B\u300C\u81EA\u5DF1\u770B\u770B/\u5148\u770B\u6548\u679C\u300D\u2192 \u672C\u5730\u9884\u89C8\u5373\u53EF\uFF0C\u4E0D\u6025\u7740\u516C\u5F00\uFF1B\u300C\u53D1\u7ED9\u522B\u4EBA/\u522B\u4EBA\u80FD\u6253\u5F00\u300D\u2192 \u9700\u8981\u516C\u5F00\u6258\u7BA1\u5730\u5740\u3002"
      },
      {
        key: "content",
        question: "\u8981\u53D1\u5E03\u7684\u662F\u54EA\u4E2A\u6587\u4EF6\u5939/\u6587\u4EF6\uFF1F",
        default: "\u5F53\u524D\u5DE5\u4F5C\u533A\u91CC\u521A\u505A\u597D\u7684\u7F51\u7AD9",
        options: ["\u5F53\u524D\u5DE5\u4F5C\u533A\u91CC\u521A\u505A\u597D\u7684\u7F51\u7AD9", "\u6211\u6307\u5B9A\u4E00\u4E2A\u6587\u4EF6\u5939"],
        translate: "\u7528\u6237\u8BF4\u300C\u521A\u505A\u7684/\u521A\u624D\u90A3\u4E2A/\u8FD9\u4E2A\u300D\u2192 \u5F53\u524D\u5DE5\u4F5C\u533A\u6700\u8FD1\u751F\u6210\u7684\u7AD9\u70B9\uFF1B\u300CXX \u6587\u4EF6\u5939\u300D\u2192 \u7528\u6237\u6307\u5B9A\u7684\u8DEF\u5F84\uFF08\u81EA\u5DF1\u5B9A\u4F4D\uFF0C\u4E0D\u8981\u8BA9\u5BF9\u65B9\u590D\u5236\u7C98\u8D34\u8DEF\u5F84\uFF09\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "*.html", note: "\u53D1\u5E03\u5185\u5BB9\u5E94\u5305\u542B HTML \u9875\u9762" },
      { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
    ],
    qualityBar: {
      bar: "\u53D1\u5E03\u51FA\u53BB\u7684\u7AD9\u70B9\u7B2C\u4E00\u773C\u5C31\u8981\u300C\u62FF\u5F97\u51FA\u624B\u300D\uFF0C\u4E0D\u662F\u534A\u6210\u54C1",
      checks: [
        "\u7AD9\u70B9\u5185\u5BB9\u5B8C\u6574\uFF1A\u9996\u9875 + \u5FC5\u8981\u5185\u9875\u9F50\u5168\uFF0C\u6587\u6848\u771F\u5B9E\u901A\u987A\uFF0C\u6CA1\u6709\u5360\u4F4D\u6B8B\u7559",
        "\u9875\u9762\u6709\u8BBE\u8BA1\u611F\uFF1A\u7EDF\u4E00\u7684\u914D\u8272\u4E0E\u6392\u7248\uFF0C\u4E0D\u662F\u9ED8\u8BA4\u6837\u5F0F",
        "\u8D44\u6E90\u8DEF\u5F84\u6B63\u786E\uFF1Acss/js/\u56FE\u7247\u7528\u76F8\u5BF9\u8DEF\u5F84\u5F15\u7528\uFF0C\u6253\u5F00\u65E0\u7834\u56FE\u65E0\u6B7B\u94FE"
      ],
      selfCheck: [
        "\u7528\u6D4F\u89C8\u5668\u6253\u5F00\u9996\u9875\uFF0C\u7B2C\u4E00\u773C\u662F\u5426\u6709\u8BBE\u8BA1\u611F",
        "\u6240\u6709\u94FE\u63A5/\u8D44\u6E90\u662F\u5426\u90FD\u80FD\u52A0\u8F7D",
        "\u662F\u5426\u53EF\u4EE5\u76F4\u63A5\u53D1\u7ED9\u522B\u4EBA\u770B"
      ]
    },
    workflow: [
      {
        id: "prepare-site",
        name: "\u51C6\u5907\u7AD9\u70B9\u5185\u5BB9",
        goal: "\u786E\u4FDD\u5DE5\u4F5C\u533A\u91CC\u6709\u4E00\u4EFD\u53EF\u53D1\u5E03\u7684\u9759\u6001\u7F51\u7AD9\uFF1A\u82E5\u6CA1\u6709\uFF0C\u5C31\u57FA\u4E8E\u7528\u6237\u76EE\u6807\u73B0\u505A\u4E00\u7248\uFF08\u4E2A\u4EBA\u7F51\u7AD9/\u843D\u5730\u9875/\u4F5C\u54C1\u96C6\uFF09\uFF1B\u82E5\u6709\uFF0C\u786E\u8BA4 index.html \u7B49\u5173\u952E\u6587\u4EF6\u9F50\u5168\u3002",
        guidance: [
          "\u5148\u68C0\u67E5\u5DE5\u4F5C\u533A\u662F\u5426\u5DF2\u6709\u7F51\u7AD9\u6587\u4EF6\uFF08index.html \u7B49\uFF09\uFF1B\u6709\u5C31\u7528\u73B0\u6709\u7684\uFF0C\u6CA1\u6709\u5C31\u57FA\u4E8E\u7528\u6237\u76EE\u6807\u505A\u4E00\u7248",
          "\u7528\u6237\u63D0\u5230\u7684\u4E3B\u9898/\u98CE\u683C/\u5185\u5BB9\u65B9\u5411\uFF08\u5982\u300C\u4F5C\u54C1\u96C6\u300D\u300C\u6DF1\u8272\u79D1\u6280\u98CE\u300D\uFF09\u6309\u786E\u8BA4\u7684\u65B9\u5411\u505A",
          "\u5FC5\u987B\u4EA7\u51FA\u771F\u5B9E .html \u6587\u4EF6\u5E76\u62A5\u544A\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4E0D\u8BB8\u53EA\u7ED9\u5EFA\u8BAE"
        ],
        verification: [
          { kind: "file_exists", pattern: "*.html", note: "\u5E94\u6709 HTML \u9875\u9762" }
        ],
        pitfalls: [
          { symptom: "\u5B50\u4EE3\u7406\u53EA\u7ED9\u4E86\u5EFA\u8BAE\u6CA1\u4EA7\u51FA\u6587\u4EF6", fix: "\u91CD\u8BD5\u65F6\u660E\u786E\u8981\u6C42\uFF1A\u5FC5\u987B\u4EA7\u51FA\u771F\u5B9E .html \u6587\u4EF6\u5E76\u62A5\u544A\u7EDD\u5BF9\u8DEF\u5F84" }
        ]
      },
      {
        id: "check-site",
        name: "\u6821\u9A8C\u7AD9\u70B9\u53EF\u6253\u5F00",
        goal: "\u68C0\u67E5\u7AD9\u70B9\uFF1A\u9996\u9875\u5B58\u5728\u3001\u662F\u6709\u6548 HTML\u3001\u5F15\u7528\u7684\u8D44\u6E90\uFF08css/js/\u56FE\u7247\uFF09\u8DEF\u5F84\u6B63\u786E\uFF0C\u6D4F\u89C8\u5668\u80FD\u76F4\u63A5\u6253\u5F00\u3002",
        guidance: [
          "\u7528\u6587\u4EF6\u5DE5\u5177\u68C0\u67E5 index.html \u662F\u5426\u5B58\u5728\u4E14\u5185\u5BB9\u6709\u6548\uFF08\u542B <html> \u6807\u7B7E\uFF09",
          "\u68C0\u67E5\u5F15\u7528\u7684\u76F8\u5BF9\u8D44\u6E90\u8DEF\u5F84\u90FD\u5B58\u5728\uFF1B\u53D1\u73B0\u574F\u94FE\u5C31\u4FEE\u590D"
        ],
        verification: [
          { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u9996\u9875\u5E94\u4E3A\u6709\u6548 HTML" }
        ],
        pitfalls: [
          { symptom: "\u9996\u9875\u662F\u7A7A\u6587\u4EF6\u6216\u7EAF\u6A21\u677F\u5360\u4F4D", fix: "\u786E\u8BA4\u9996\u9875\u6709\u771F\u5B9E\u5185\u5BB9\uFF08\u6807\u9898/\u6BB5\u843D/\u5BFC\u822A\uFF09\uFF0C\u4E0D\u662F\u7A7A\u58F3\u6A21\u677F" }
        ]
      },
      {
        id: "publish",
        name: "\u53D1\u5E03\u4E0A\u7EBF",
        goal: "\u628A\u7AD9\u70B9\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740\uFF0C\u8BA9\u522B\u4EBA\u80FD\u901A\u8FC7\u94FE\u63A5\u6253\u5F00\uFF1B\u6216\u6309\u7528\u6237\u8981\u6C42\u53EA\u505A\u672C\u5730\u9884\u89C8\u3002",
        guidance: [
          "\u4F18\u5148\u9759\u6001\u6258\u7BA1\uFF08GitHub Pages / Vercel / \u672C\u5730\u9759\u6001\u670D\u52A1\uFF09\uFF0C\u5148\u8BF4\u660E\u53D1\u5E03\u540E\u7684\u8BBF\u95EE\u65B9\u5F0F\u518D\u52A8\u624B",
          "\u53D1\u5E03\u5B8C\u6210\u540E\u7ED9\u51FA\u53EF\u8BBF\u95EE\u7684\u5730\u5740\uFF08URL \u6216\u672C\u5730\u5730\u5740\uFF09\u548C\u9A8C\u8BC1\u65B9\u5F0F"
        ],
        capabilities: [
          {
            kind: "tool",
            id: "publish_deploy",
            source: "sealos-skills",
            purpose: "\u628A\u9759\u6001\u7F51\u7AD9\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740\uFF08sealos-skills\uFF1A\u4E00\u6761\u547D\u4EE4\u90E8\u7F72+\u6570\u636E\u5E93+\u5BF9\u8C61\u5B58\u50A8\uFF09",
            trust: "community"
          }
        ],
        verification: [
          { kind: "file_exists", pattern: "*.html", note: "\u53D1\u5E03\u5185\u5BB9\u5E94\u5305\u542B HTML \u9875\u9762" }
        ],
        pitfalls: [
          { symptom: "\u6CA1\u6709\u53D1\u5E03/\u90E8\u7F72\u80FD\u529B\uFF08\u672A\u88C5\u914D publish_deploy\uFF09", fix: "\u4E2D\u95F4\u4EF6\u5DF2\u81EA\u52A8\u53BB\u5E02\u573A\u627E\u6700\u597D\u7684\uFF08sealos-skills\uFF1A\u90E8\u7F72+\u6570\u636E\u5E93+\u5B58\u50A8\uFF09\u5E76\u5EFA\u8BAE\u88C5\u914D\uFF1B\u88C5\u597D\u91CD\u542F\u540E\u4ECE\u53D1\u5E03\u6B65\u7EE7\u7EED" },
          { symptom: "\u53D1\u5E03\u540E\u94FE\u63A5\u6253\u4E0D\u5F00", fix: "\u68C0\u67E5\u662F\u5426\u771F\u7684\u4E0A\u4F20\u4E86 index.html\uFF1B\u514D\u8D39\u6258\u7BA1\u9996\u6B21\u751F\u6548\u53EF\u80FD\u9700\u7B49 1~2 \u5206\u949F" }
        ]
      }
    ]
  },
  {
    id: "big-project",
    name: "\u5F00\u53D1/\u7EF4\u62A4\u9879\u76EE\uFF08\u4ECE 0 \u6216\u5DF2\u6709\u4EE3\u7801\uFF09",
    description: "\u5927\u578B/\u590D\u6742\u9879\u76EE\u7684\u5168\u6D41\u7A0B\u52A9\u624B\uFF1A\u4ECE 0 \u5F00\u53D1\uFF08\u9AA8\u67B6\u5148\u884C\u3001\u5206\u6A21\u5757\u4EA4\u4ED8\uFF09\u6216\u5DF2\u6709\u9879\u76EE\uFF08\u4FEE bug / \u52A0\u529F\u80FD / \u8FF7\u832B\u7ED9\u5EFA\u8BAE\uFF09\uFF0C\u5148\u770B\u61C2\u73B0\u72B6\u518D\u52A8\u624B\uFF0C\u4EA4\u4ED8\u53EF\u8FD0\u884C\u3001\u9A8C\u8BC1\u8FC7\u7684\u7ED3\u679C",
    triggers: [
      // 从 0 开发
      "\u5927\u578B\u9879\u76EE",
      "\u590D\u6742\u9879\u76EE",
      "\u5F00\u53D1\u9879\u76EE",
      "\u505A\u9879\u76EE",
      "\u5F00\u53D1\u4E00\u4E2A",
      "\u505A\u4E00\u4E2A\u5E94\u7528",
      "\u505A\u4E2A\u5E94\u7528",
      "\u505A\u4E00\u4E2A\u7CFB\u7EDF",
      "\u505A\u4E2A\u7CFB\u7EDF",
      "\u505A\u4E00\u4E2A\u5DE5\u5177",
      "\u505A\u4E2A\u5DE5\u5177",
      "\u5199\u4E00\u4E2A\u7A0B\u5E8F",
      "\u5168\u6808",
      "\u540E\u53F0",
      "\u7BA1\u7406\u7CFB\u7EDF",
      "web\u5E94\u7528",
      "\u5C0F\u7A0B\u5E8F",
      "\u722C\u866B",
      "\u81EA\u52A8\u5316",
      "\u673A\u5668\u4EBA",
      "\u7CFB\u7EDF",
      "\u5E94\u7528",
      "\u5DE5\u5177",
      "\u6570\u636E\u5E93",
      "\u6CE8\u518C",
      "\u767B\u5F55",
      "\u8D26\u53F7",
      "api",
      "\u63A5\u53E3",
      "\u670D\u52A1\u7AEF",
      // 存量项目：修 bug / 加功能 / 迷茫
      "\u4FEE bug",
      "\u4FEE\u4E2A bug",
      "\u6539 bug",
      "\u6709 bug",
      "\u51FA bug",
      "\u62A5\u9519",
      "\u5D29\u6E83",
      "\u574F\u4E86",
      "\u4E0D\u5DE5\u4F5C",
      "\u6CA1\u53CD\u5E94",
      "\u52A0\u4E2A\u529F\u80FD",
      "\u52A0\u529F\u80FD",
      "\u5B9E\u73B0\u529F\u80FD",
      "\u5B9E\u73B0\u4E00\u4E2A\u529F\u80FD",
      "\u52A0\u4E00\u4E2A\u529F\u80FD",
      "\u65B0\u529F\u80FD",
      "\u505A\u4E2A\u529F\u80FD",
      "\u4F18\u5316\u4E00\u4E0B",
      "\u91CD\u6784",
      "\u6211\u7684\u9879\u76EE",
      "\u8FD9\u4E2A\u9879\u76EE",
      "\u90A3\u4E2A\u9879\u76EE",
      "\u5DF2\u6709\u9879\u76EE",
      "\u73B0\u6709\u9879\u76EE",
      "\u63A5\u624B",
      "\u522B\u4EBA\u5199\u7684",
      "\u514B\u9686",
      "clone",
      "\u4EE3\u7801\u5E93",
      "\u6E90\u7801",
      "\u770B\u4E0D\u61C2",
      "\u4E0D\u77E5\u9053\u4E0B\u4E00\u6B65",
      "\u63A5\u4E0B\u6765\u505A\u4EC0\u4E48",
      "\u4E0D\u77E5\u9053\u505A\u4EC0\u4E48",
      "\u8FF7\u832B",
      "\u770B\u770B\u8FD9\u4E2A\u9879\u76EE",
      "\u5206\u6790\u4E00\u4E0B\u8FD9\u4E2A\u9879\u76EE",
      "\u9879\u76EE\u662F\u5E72\u561B\u7684",
      "\u600E\u4E48\u8FD0\u884C\u7684"
    ],
    guidance: [
      "\u73B0\u72B6\u81EA\u9002\u5E94\uFF1A\u5148\u63A2\u6D4B\u76EE\u6807\u662F\u300C\u7A7A\u76EE\u5F55/\u65B0\u9879\u76EE\u300D\u8FD8\u662F\u300C\u5DF2\u6709\u4EE3\u7801\u300D\u3002\u4ECE 0 \u2192 \u9AA8\u67B6\u5148\u884C\u5206\u6A21\u5757\uFF1B\u5DF2\u6709 \u2192 \u5148\u770B\u61C2\u518D\u6700\u5C0F\u6539\u52A8\uFF0C\u4E0D\u778E\u6539",
      "\u6280\u672F\u6808\u81EA\u9009\u6210\u719F\u9ED8\u8BA4\uFF1A\u7EAF\u5C55\u793A \u2192 \u9759\u6001 HTML/CSS/JS\uFF1B\u5E26\u6570\u636E/\u767B\u5F55/\u540E\u53F0 \u2192 \u8F7B\u91CF\u540E\u7AEF\uFF08Node/Express \u6216 Python\uFF09+ SQLite \u672C\u5730\u5E93\uFF1B\u5DE5\u5177/\u81EA\u52A8\u5316 \u2192 \u5BF9\u5E94\u8BED\u8A00\u547D\u4EE4\u884C\u811A\u672C\u3002\u80FD\u7528\u6807\u51C6\u5E93\u5C31\u4E0D\u5F15\u4F9D\u8D56\uFF0C\u4E0D\u8FFD\u91CD\u578B\u6846\u67B6",
      "\u5B58\u91CF\u9879\u76EE\uFF1A\u6539\u524D\u5148\u770B\u76F8\u5173\u4EE3\u7801\uFF0C\u8BF4\u6E05\u300C\u95EE\u9898\u5728\u54EA/\u8981\u6539\u54EA\u3001\u600E\u4E48\u6539\u300D\uFF1B\u6700\u5C0F\u6539\u52A8\uFF0C\u4E0D\u987A\u624B\u91CD\u6784\u65E0\u5173\u4EE3\u7801\uFF1B\u771F\u5B9E\u4EE3\u7801\u4E0D\u5360\u4F4D\uFF0C\u6CA1\u505A\u7684\u5982\u5B9E\u6807\u6CE8",
      "\u7528\u6237\u8FF7\u832B/\u770B\u4E0D\u61C2/\u4E0D\u77E5\u9053\u4E0B\u4E00\u6B65\uFF1A\u4EA7\u51FA\u300C\u9879\u76EE\u5730\u56FE + \u4E0B\u4E00\u6B65\u5EFA\u8BAE\u6E05\u5355\u300D\uFF083~5 \u6761\u6309\u4EF7\u503C/\u98CE\u9669\u6392\u5E8F\uFF09\uFF0C\u7B49\u7528\u6237\u9009\u4E00\u4E2A\u518D\u52A8\u624B\uFF0C\u4E0D\u8981\u81EA\u4F5C\u4E3B\u5F20\u5927\u6539",
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6211\u7684\u9879\u76EE/\u90A3\u4E2A\u6587\u4EF6/\u6587\u6863\u300D\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\uFF08\u5DE5\u4F5C\u533A\u3001\u5E38\u89C1\u76EE\u5F55\u3001\u7ED9\u5B9A\u8DEF\u5F84\uFF09\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u627E\u8DEF\u5F84\u6216\u590D\u5236\u7C98\u8D34\uFF1B\u627E\u4E0D\u5230\u65F6\u6700\u591A\u95EE\u4E00\u6B21\u5927\u6982\u4F4D\u7F6E",
      "\u80FD\u529B\u52A8\u6001\u8865\uFF1A\u63A2\u7D22\u65F6\u8BC6\u522B\u9879\u76EE\u6280\u672F\u6808\u4E0E\u7528\u5230\u7684\u683C\u5F0F\uFF08Excel/\u56FE\u7247/\u6570\u636E\u5E93/\u7279\u5B9A\u8FD0\u884C\u65F6\uFF09\uFF1B\u73AF\u5883\u7F3A\u800C\u9879\u76EE\u9700\u8981\u7684\u80FD\u529B\uFF0C\u5148\u7528\u73B0\u6709\u5DE5\u5177\uFF1B\u660E\u786E\u505A\u4E0D\u4E86\u65F6\u7528 ming_store_search \u627E\u6700\u597D\u7684\u63D2\u4EF6\uFF0C\u786E\u8BA4\u540E\u5B89\u88C5\u518D\u7EE7\u7EED\uFF0C\u4E0D\u8DF3\u8FC7",
      "\u672C\u5730\u53EF\u8FD0\u884C\u4F18\u5148\uFF1A\u7B2C\u4E00\u7248\u4FDD\u8BC1\u80FD\u542F\u52A8/\u6253\u5F00\u4E14\u4E0D\u62A5\u9519\uFF1B\u53D1\u5E03\u5C3D\u529B\u800C\u4E3A\uFF0C\u7F3A\u53D1\u5E03\u80FD\u529B\u65F6\u5982\u5B9E\u8BF4\u660E\u4E0A\u7EBF\u8DEF\u5F84\uFF0C\u4E0D\u963B\u585E\u4EA4\u4ED8"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u8BFB\u5199\u9879\u76EE\u6587\u4EF6\u4E0E\u6587\u6863", trust: "official" },
      {
        kind: "tool",
        id: "infra_ops",
        source: "@deepseek-ai/dsh-base",
        purpose: "\u6570\u636E\u5E93/SSH/SFTP/Docker \u57FA\u7840\u8FD0\u7EF4\uFF08DeepSeek \u5B98\u65B9\u57FA\u7840\u5305\uFF0C\u88C5\u540E\u81EA\u52A8\u589E\u5F3A\uFF09",
        trust: "official",
        optional: true
      },
      {
        kind: "tool",
        id: "db_ops",
        source: "dsh-data-agent",
        purpose: "\u8FDE\u6570\u636E\u5E93\u5199 SQL\uFF08dsh-data-agent\uFF0C\u8BA9 AI \u8FDE\u5E93\u5199 SQL\uFF09",
        trust: "community",
        optional: true
      },
      {
        kind: "tool",
        id: "knowledge_rag",
        source: "dsh-weknora",
        purpose: "\u77E5\u8BC6\u5E93/RAG\uFF08\u817E\u8BAF dsh-weknora\uFF1A\u539F\u59CB\u6587\u6863\u2192\u53EF\u67E5\u8BE2 RAG + \u81EA\u7EF4\u62A4 Wiki\uFF09",
        trust: "community",
        optional: true
      },
      {
        kind: "skill",
        id: "frontend_design",
        source: "superdesign-skill",
        purpose: "\u524D\u7AEF\u8BBE\u8BA1\u8D28\u91CF\uFF08superdesign-skill\uFF1A\u628A AI \u751F\u6210\u7684\u754C\u9762\u53D8\u6210\u7CBE\u81F4\u3001\u53EF\u53D1\u5E03\u7684\u524D\u7AEF\uFF09",
        trust: "community",
        optional: true
      }
    ],
    delegate: { provider: "spawn" },
    questions: [
      {
        key: "task",
        question: "\u8FD9\u4E2A\u9879\u76EE\u662F\u5DF2\u7ECF\u6709\u7684\uFF0C\u8FD8\u662F\u8981\u4ECE 0 \u5F00\u59CB\u505A\uFF1F",
        default: "\u4E0D\u786E\u5B9A\uFF0C\u4F60\u770B\u4E0B\u73B0\u72B6\u5B9A",
        options: ["\u4ECE 0 \u5F00\u59CB\u505A\u65B0\u7684", "\u5DF2\u7ECF\u6709\u4E00\u4E2A\u9879\u76EE\uFF08\u4FEE bug / \u52A0\u529F\u80FD\uFF09", "\u8BF4\u4E0D\u6E05\uFF0C\u4F60\u770B\u770B\u6211\u7684\u9879\u76EE"],
        translate: "\u7528\u6237\u8BF4\u300C\u5DF2\u6709\u7684/\u522B\u4EBA\u5199\u7684/\u514B\u9686\u7684/\u4E0B\u8F7D\u7684\u300D\u2192 \u5B58\u91CF\u6A21\u5F0F\uFF08\u5148\u63A2\u7D22\u518D\u6539\uFF09\uFF1B\u300C\u65B0\u7684/\u4ECE\u96F6/\u8FD8\u6CA1\u6709\u300D\u2192 \u4ECE 0 \u6A21\u5F0F\uFF08\u5148\u8BBE\u8BA1\u518D\u642D\u9AA8\u67B6\uFF09\uFF1B\u300C\u8BF4\u4E0D\u6E05/\u4F60\u770B\u7740\u529E\u300D\u2192 \u5148\u63A2\u6D4B\u73B0\u72B6\uFF0C\u6309\u63A2\u6D4B\u7ED3\u679C\u5206\u6D41\u3002"
      },
      {
        key: "purpose",
        question: "\u8FD9\u4E2A\u9879\u76EE\u4E3B\u8981\u7ED9\u8C01\u7528\u3001\u662F\u5E72\u4EC0\u4E48\u7684\uFF1F",
        default: "\u4E2A\u4EBA\u7528\u7684\u5DE5\u5177/\u5E94\u7528",
        options: ["\u4E2A\u4EBA\u7528\u7684\u5DE5\u5177/\u811A\u672C", "\u5E26\u6570\u636E\u7684\u5E94\u7528\uFF08\u8BB0\u8D26/\u7BA1\u7406\u540E\u53F0\uFF09", "\u7ED9\u522B\u4EBA\u7528\u7684\u7F51\u7AD9/\u5E94\u7528", "\u81EA\u52A8\u5316/\u722C\u866B\u7C7B"],
        translate: "\u7528\u6237\u8BF4\u300C\u8BB0\u8D26/\u7BA1\u7406/\u540E\u53F0/\u5B58\u6570\u636E\u300D\u2192 \u8F7B\u91CF\u540E\u7AEF + SQLite\uFF0C\u80FD\u589E\u5220\u6539\u67E5\uFF1B\u300C\u5DE5\u5177/\u811A\u672C/\u5E2E\u6211\u5E72\u6D3B\u7684\u300D\u2192 \u547D\u4EE4\u884C\u5DE5\u5177\uFF08\u8F93\u5165\u2192\u5904\u7406\u2192\u8F93\u51FA\uFF09\uFF1B\u300C\u7ED9\u522B\u4EBA\u7528/\u4EA7\u54C1\u300D\u2192 \u5B8C\u6574\u53EF\u8FD0\u884C + \u4F7F\u7528\u8BF4\u660E\uFF1B\u300C\u81EA\u52A8\u6293/\u722C/\u6279\u91CF\u300D\u2192 \u81EA\u52A8\u5316\u811A\u672C\uFF08\u53EF\u914D\u7F6E\u8F93\u5165\u8F93\u51FA\uFF09\u3002"
      },
      {
        key: "scope",
        question: "\u8FD9\u6B21\u505A\u5230\u4EC0\u4E48\u7A0B\u5EA6\uFF1F",
        default: "\u53EF\u8FD0\u884C\u7684\u6838\u5FC3\u7248\u672C\uFF08\u9AA8\u67B6 + \u6838\u5FC3\u529F\u80FD\u8D70\u901A\uFF09",
        options: ["\u6838\u5FC3\u7248\u672C\u5148\u8DD1\u901A", "\u5B8C\u6574\u529F\u80FD\u5168\u90E8\u5B9E\u73B0", "\u5148\u53EA\u642D\u9AA8\u67B6\u770B\u7ED3\u6784"],
        translate: "\u7528\u6237\u8BF4\u300C\u5148\u770B\u770B/\u5148\u5F04\u4E00\u7248/\u5148\u8DD1\u901A\u300D\u2192 \u6838\u5FC3\u7248\u672C\uFF08\u9AA8\u67B6 + \u6700\u5173\u952E\u7684\u4E00\u6761\u529F\u80FD\u8DEF\u5F84\u8D70\u901A\uFF09\uFF1B\u300C\u5168\u90E8/\u5B8C\u6574/\u6B63\u5F0F\u300D\u2192 \u5B8C\u6574\u529F\u80FD\uFF1B\u300C\u7ED3\u6784/\u6846\u67B6/\u5148\u89C4\u5212\u300D\u2192 \u53EA\u642D\u9AA8\u67B6 + \u6A21\u5757\u6E05\u5355\uFF0C\u4E0D\u5B9E\u73B0\u7EC6\u8282\u3002"
      },
      {
        key: "publish",
        question: "\u8981\u4E0D\u8981\u53D1\u5E03\u4E0A\u7EBF\u8BA9\u522B\u4EBA\u8BBF\u95EE\uFF1F",
        default: "\u5148\u672C\u5730\u53EF\u8FD0\u884C\uFF0C\u4E0A\u7EBF\u4EE5\u540E\u518D\u8BF4",
        options: ["\u5148\u672C\u5730\u53EF\u8FD0\u884C", "\u8981\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740"],
        translate: "\u7528\u6237\u8BF4\u300C\u4E0A\u7EBF/\u53D1\u5E03/\u7ED9\u522B\u4EBA\u7528\u300D\u2192 \u8D70\u53D1\u5E03\u6B65\uFF08\u9700\u53D1\u5E03\u80FD\u529B\uFF0C\u7F3A\u5931\u65F6\u5982\u5B9E\u8BF4\u660E\u5E76\u5F15\u5BFC\uFF09\uFF1B\u9ED8\u8BA4 \u2192 \u672C\u5730\u53EF\u8FD0\u884C\uFF0CREADME \u5199\u6E05\u672C\u5730\u6253\u5F00\u65B9\u5F0F\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "PROJECT.md", note: "\u9879\u76EE\u5E94\u6709\u9879\u76EE\u5730\u56FE\u6587\u6863" },
      { kind: "content_match", pattern: "PROJECT.md", contains: "\u8FD0\u884C", note: "\u9879\u76EE\u5730\u56FE\u5E94\u5199\u6E05\u600E\u4E48\u8FD0\u884C" },
      { kind: "content_absent", pattern: "*.md", mustNotContain: "Lorem", note: "\u6587\u6863\u7EDD\u65E0\u5360\u4F4D\u6587\u5B57" }
    ],
    qualityBar: {
      bar: "\u8FD9\u4E00\u8F6E\u4EA4\u4ED8\u300C\u80FD\u8DD1\u8D77\u6765\u3001\u6539\u5F97\u5BF9\u3001\u9A8C\u8BC1\u8FC7\u3001\u8BF4\u6E05\u6539\u4E86\u4EC0\u4E48\u300D\u7684\u9879\u76EE\u7ED3\u679C\uFF1A\u4ECE 0 \u662F\u53EF\u7528\u9AA8\u67B6\uFF0C\u5B58\u91CF\u662F\u4FEE\u597D/\u52A0\u597D\u4E14\u6CA1\u5F04\u574F",
      checks: [
        "\u4ECE 0\uFF1A\u53EF\u8FD0\u884C\uFF08\u6309 README/PROJECT.md \u80FD\u542F\u52A8\u4E0D\u62A5\u9519\uFF09+ \u7ED3\u6784\u6E05\u6670\uFF08\u5165\u53E3/\u6838\u5FC3/\u6570\u636E/\u6587\u6863\u5206\u5C42\uFF09+ \u6838\u5FC3\u8DEF\u5F84\u8D70\u901A",
        "\u5B58\u91CF\uFF1A\u5148\u770B\u61C2\u518D\u6539\u2014\u2014\u6539\u524D\u8BF4\u6E05\u300C\u95EE\u9898\u5728\u54EA/\u8981\u6539\u54EA\u300D\uFF0C\u6700\u5C0F\u6539\u52A8\uFF0C\u4E0D\u987A\u624B\u91CD\u6784\u65E0\u5173\u4EE3\u7801",
        "\u771F\u5B9E\u9A8C\u8BC1\uFF1A\u6309\u9879\u76EE\u771F\u5B9E\u8FD0\u884C/\u6D4B\u8BD5\u65B9\u5F0F\u9A8C\u8BC1\u8FC7\uFF0C\u786E\u8BA4\u6CA1\u5F04\u574F\u522B\u5904\uFF08\u56DE\u5F52\uFF09",
        "\u771F\u5B9E\u4E0D\u5360\u4F4D\uFF1A\u5173\u952E\u6587\u4EF6\u5168\u662F\u771F\u4EE3\u7801\u771F\u6587\u6848\uFF0C\u6CA1\u6709 TODO/Lorem \u5192\u5145\uFF1B\u6CA1\u505A\u7684\u6A21\u5757\u5982\u5B9E\u6807\u6CE8",
        "\u6587\u6863\u5408\u683C\uFF1APROJECT.md/README \u5199\u6E05\u300C\u662F\u4EC0\u4E48\u3001\u600E\u4E48\u8DD1\u3001\u6539\u4E86\u4EC0\u4E48\u3001\u600E\u4E48\u7528\u3001\u76EE\u5F55\u7ED3\u6784\u3001\u4E0B\u4E00\u6B65\u300D",
        "\u53D1\u5E03\u5C3D\u529B\u800C\u4E3A\uFF1A\u80FD\u53D1\u5E03\u5C31\u7ED9\u4E86\u516C\u5F00\u5730\u5740\uFF1B\u4E0D\u80FD\u5C31\u5982\u5B9E\u8BF4\u660E\u4E0A\u7EBF\u8DEF\u5F84"
      ],
      selfCheck: [
        "\u6211\u6309\u6587\u6863\u80FD\u590D\u73B0\u542F\u52A8/\u9A8C\u8BC1\u5417\uFF08\u547D\u4EE4\u662F\u5426\u5199\u5168\uFF09",
        "\u6539\u524D\u771F\u7684\u770B\u61C2\u90A3\u6BB5\u4EE3\u7801\u4E86\u5417\uFF08\u4E0D\u662F\u76F2\u6539\uFF09",
        "\u6709\u6CA1\u6709\u6539\u574F\u522B\u7684\u5730\u65B9\uFF08\u56DE\u5F52\u9A8C\u8BC1\u8FC7\u4E86\u5417\uFF09",
        "\u6709\u6CA1\u6709 TODO/Lorem \u5360\u4F4D\u5192\u5145\u5DF2\u5B8C\u6210",
        "\u8FF7\u832B\u65F6\u6709\u6CA1\u6709\u7ED9\u7528\u6237\u53EF\u9009\u6E05\u5355\uFF0C\u800C\u4E0D\u662F\u81EA\u4F5C\u4E3B\u5F20\u5927\u6539"
      ]
    },
    workflow: [
      {
        id: "orient",
        name: "\u73B0\u72B6\u63A2\u6D4B\u4E0E\u9879\u76EE\u7406\u89E3",
        goal: "\u5148\u63A2\u6D4B\u76EE\u6807\u76F8\u5173\u76EE\u5F55\u662F\u300C\u7A7A\u76EE\u5F55/\u65B0\u9879\u76EE\u300D\u8FD8\u662F\u300C\u5DF2\u6709\u4EE3\u7801\u300D\uFF0C\u7136\u540E\u4EA7\u51FA\u4E00\u4EFD\u300A\u9879\u76EE\u5730\u56FE\u300B\u6587\u6863 PROJECT.md\uFF1A\u9879\u76EE\u662F\u4EC0\u4E48\u3001\u6280\u672F\u6808\u3001\u76EE\u5F55\u7ED3\u6784\u3001\u5165\u53E3\u3001\u600E\u4E48\u8FD0\u884C\u3001\u5F53\u524D\u72B6\u6001\u3001\u672C\u6B21\u8981\u505A\u4EC0\u4E48\u3002",
        guidance: [
          "\u9879\u76EE\u5B9A\u4F4D\uFF1A\u5148\u770B\u5DE5\u4F5C\u533A\u4E0E\u5E38\u89C1\u76EE\u5F55\uFF08\u684C\u9762/\u6587\u6863/\u4E0B\u8F7D\uFF09\uFF1B\u7528\u6237\u7ED9\u4E86\u8DEF\u5F84\u6216\u8BF4\u4E86\u300C\u6211\u7684\u9879\u76EE\u300D\u5C31\u81EA\u5DF1\u53BB\u5B9A\u4F4D\uFF0C\u627E\u4E0D\u5230\u6700\u591A\u95EE\u4E00\u6B21\u5927\u6982\u4F4D\u7F6E",
          "\u6280\u672F\u6808\u8BC6\u522B\uFF1A\u770B package.json / requirements.txt / *.py / *.js / tsconfig.json / pom.xml \u7B49\uFF1B\u5217\u51FA\u672C\u9879\u76EE\u9700\u8981\u7684\u8FD0\u884C\u65F6\u4E0E\u683C\u5F0F\uFF08Excel/\u56FE\u7247/\u6570\u636E\u5E93/\u7279\u5B9A\u8BED\u8A00\uFF09",
          "\u4ECE 0 \u5F00\u53D1\uFF1APROJECT.md \u5199\u6E05\u6280\u672F\u9009\u578B\u3001\u76EE\u5F55\u89C4\u5212\u3001\u6A21\u5757\u6E05\u5355\uFF08\u6807\u6838\u5FC3\u6A21\u5757\uFF09\uFF0C\u672C\u6B21\u4ECE\u642D\u9AA8\u67B6\u5F00\u59CB",
          "\u5B58\u91CF\u9879\u76EE\uFF08\u4FEE bug/\u52A0\u529F\u80FD\uFF09\uFF1APROJECT.md \u5199\u6E05\u4EFB\u52A1\u5B9A\u4F4D\u2014\u2014\u76F8\u5173\u6587\u4EF6\u3001\u6839\u56E0\u5206\u6790\u3001\u6539\u52A8\u8BA1\u5212\uFF08\u6700\u5C0F\u6539\u52A8\uFF09",
          "\u7528\u6237\u8FF7\u832B/\u770B\u4E0D\u61C2/\u4E0D\u77E5\u9053\u4E0B\u4E00\u6B65\uFF1APROJECT.md \u52A0\u300C\u4E0B\u4E00\u6B65\u505A\u4EC0\u4E48\u300D\u7AE0\u8282\uFF0C\u7ED9 3~5 \u6761\u6309\u4EF7\u503C\u6392\u5E8F\u7684\u5EFA\u8BAE\uFF0C\u7B49\u7528\u6237\u9009\u62E9\uFF1B\u4E0D\u8981\u6539\u52A8\u4EFB\u4F55\u4EE3\u7801",
          "\u80FD\u529B\u6E05\u5355\uFF08curated \u5DF2\u914D\u597D\u7684\u589E\u5F3A\u5DE5\u5177\uFF09\uFF1A\u6570\u636E\u5E93\u2192dsh-data-agent\uFF1B\u77E5\u8BC6\u5E93/RAG\u2192dsh-weknora\uFF08\u817E\u8BAF\uFF09\uFF1B\u57FA\u7840\u8FD0\u7EF4\u2192@deepseek-ai/dsh-base\uFF08\u5B98\u65B9\uFF0C\u81EA\u52A8\u88C5\uFF09\uFF1B\u524D\u7AEF\u8BBE\u8BA1\u2192superdesign-skill\u3002\u7B2C\u4E00\u7248\u7528 Harness \u539F\u751F\u80FD\u529B\u5373\u53EF\u4EA4\u4ED8\uFF0C\u8FD9\u4E9B\u5DE5\u5177\u662F\u300C\u88C5\u597D\u91CD\u542F\u540E\u7B2C\u4E8C\u7248\u5347\u7EA7\u300D\u7528\u7684\u589E\u5F3A\uFF0C\u4E0D\u963B\u585E\u7B2C\u4E00\u7248\uFF1Bcurated \u6CA1\u6709\u7684\u7F3A\u53E3\u518D\u53BB ming_store_search \u627E\u6700\u597D\u7684\uFF0C\u786E\u8BA4\u540E\u5B89\u88C5",
          "\u5FC5\u987B\u4EA7\u51FA\u771F\u5B9E PROJECT.md \u6587\u4EF6\u5E76\u62A5\u544A\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4E0D\u8BB8\u53EA\u7ED9\u5EFA\u8BAE"
        ],
        verification: [
          { kind: "file_exists", pattern: "PROJECT.md", note: "\u5E94\u6709\u9879\u76EE\u5730\u56FE PROJECT.md" },
          { kind: "content_match", pattern: "PROJECT.md", contains: "\u8FD0\u884C", note: "\u9879\u76EE\u5730\u56FE\u5E94\u5199\u6E05\u600E\u4E48\u8FD0\u884C" }
        ],
        pitfalls: [
          { symptom: "\u5B50\u4EE3\u7406\u53EA\u804A\u65B9\u6848\u6CA1\u4EA7\u51FA\u6587\u4EF6", fix: "\u91CD\u8BD5\u65F6\u660E\u786E\u8981\u6C42\uFF1A\u5FC5\u987B\u4EA7\u51FA\u771F\u5B9E PROJECT.md \u6587\u4EF6\u5E76\u62A5\u544A\u7EDD\u5BF9\u8DEF\u5F84" },
          { symptom: "\u627E\u4E0D\u5230\u9879\u76EE\u4F4D\u7F6E", fix: "\u5148\u5728\u5DE5\u4F5C\u533A\u4E0E\u5E38\u89C1\u76EE\u5F55\uFF08\u684C\u9762/\u6587\u6863/\u4E0B\u8F7D\uFF09\u626B\u63CF\uFF0C\u627E\u4E0D\u5230\u6700\u591A\u95EE\u4E00\u6B21\u5927\u6982\u4F4D\u7F6E" }
        ],
        stopAfter: true
      },
      {
        id: "build",
        name: "\u52A8\u624B\u5B9E\u73B0",
        goal: "\u6309 PROJECT.md \u52A8\u624B\uFF1A\u4ECE 0 \u5F00\u53D1 \u2192 \u642D\u9AA8\u67B6\uFF08\u76EE\u5F55/\u5165\u53E3/\u914D\u7F6E\uFF09\u5E76\u5B9E\u73B0\u6838\u5FC3\u6A21\u5757\u8BA9\u6838\u5FC3\u8DEF\u5F84\u8D70\u901A\uFF1B\u5DF2\u6709\u9879\u76EE \u2192 \u4FEE bug / \u5B9E\u73B0\u529F\u80FD\uFF0C\u6700\u5C0F\u6539\u52A8\uFF0C\u4E0D\u78B0\u65E0\u5173\u4EE3\u7801\u3002",
        guidance: [
          "\u4ECE 0\uFF1A\u5148\u9AA8\u67B6\uFF08\u5165\u53E3/\u6838\u5FC3/\u6570\u636E/\u6587\u6863\u5206\u5C42\uFF0C\u6BCF\u5C42\u81F3\u5C11\u4E00\u4E2A\u771F\u5B9E\u6587\u4EF6\uFF09\u518D\u6838\u5FC3\u6A21\u5757\uFF0C\u6BCF\u5B9E\u73B0\u4E00\u5757\u5C31\u9A8C\u8BC1\u4E00\u6B21\uFF0C\u4E0D\u6512\u5230\u6700\u540E",
          "\u5B58\u91CF\uFF1A\u5148\u770B\u61C2\u76F8\u5173\u4EE3\u7801\u518D\u6539\uFF0C\u6539\u524D\u8BF4\u6E05\u300C\u6539\u54EA\u91CC\u3001\u600E\u4E48\u6539\u300D\uFF1B\u6700\u5C0F\u6539\u52A8\uFF0C\u4E0D\u987A\u624B\u91CD\u6784\u65E0\u5173\u4EE3\u7801",
          "\u7528\u6237\u8FF7\u832B\u5F85\u9009\uFF1A\u82E5\u4E0A\u4E00\u6B65\u4EA7\u51FA\u7684\u662F\u300C\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u6E05\u5355\u300D\uFF08\u7528\u6237\u8FD8\u5728\u9009\u62E9\u4E2D\uFF09\uFF0C\u672C\u6B65\u4E0D\u4FEE\u6539\u4EE3\u7801\uFF0C\u628A\u6E05\u5355\u4F5C\u4E3A\u4EA4\u4ED8\u7B49\u7528\u6237\u9009",
          "\u6280\u672F\u6808\u6309\u9879\u76EE\u7C7B\u578B\u81EA\u9009\u6210\u719F\u9ED8\u8BA4\uFF08\u7EAF\u5C55\u793A\u2192\u9759\u6001\uFF1B\u5E26\u6570\u636E/\u767B\u5F55\u2192\u8F7B\u91CF\u540E\u7AEF+SQLite\uFF1B\u5DE5\u5177/\u81EA\u52A8\u5316\u2192\u547D\u4EE4\u884C\uFF09\uFF1B\u7B2C\u4E00\u7248\u7528\u539F\u751F\u80FD\u529B\u4EA4\u4ED8\uFF0C\u4E0D\u5FC5\u7B49\u63D2\u4EF6",
          "\u771F\u5B9E\u4EE3\u7801\u4E0D\u5360\u4F4D\uFF1A\u5173\u952E\u6587\u4EF6\u90FD\u662F\u80FD\u8DD1\u7684\u771F\u4EE3\u7801\u771F\u6587\u6848\uFF0C\u6CA1\u6709 TODO/Lorem \u5192\u5145\uFF1B\u6CA1\u505A\u7684\u6A21\u5757\u5982\u5B9E\u6807\u6CE8",
          "\u88C5\u597D\u7684\u589E\u5F3A\u5DE5\u5177\uFF08\u6570\u636E\u5E93/\u77E5\u8BC6\u5E93/\u524D\u7AEF\u8BBE\u8BA1\uFF09\u91CD\u542F DSH \u540E\u5BF9\u7B2C\u4E8C\u7248\u751F\u6548\uFF0C\u5728\u4EA4\u4ED8\u8BF4\u660E\u91CC\u9884\u544A\u5347\u7EA7\u70B9"
        ],
        verification: [
          { kind: "dir_nonempty", pattern: "**/*", note: "\u5B9E\u73B0\u5E94\u6709\u771F\u5B9E\u6587\u4EF6" },
          // 方案级验收在工作流路径不执行，占位检查必须落在步骤级，否则文档占位会被放行
          { kind: "content_absent", pattern: "*.md", mustNotContain: "Lorem", note: "\u6587\u6863\u65E0\u5360\u4F4D\u6587\u5B57" }
        ],
        pitfalls: [
          { symptom: "\u53EA\u5199\u4E86\u51FD\u6570\u6CA1\u8C03\u7528/\u6CA1\u8D70\u901A", fix: "\u91CD\u8BD5\u65F6\u660E\u786E\u8981\u6C42\uFF1A\u6838\u5FC3\u8DEF\u5F84\u5FC5\u987B\u6F14\u793A\u8D70\u901A\uFF08\u6570\u636E\u8FDB\u2192\u51FA/\u9875\u9762\u53EF\u4EA4\u4E92\uFF09" },
          { symptom: "\u76F2\u6539\u5B58\u91CF\u4EE3\u7801", fix: "\u6539\u524D\u5FC5\u987B\u8BF4\u6E05\u6839\u56E0\u4E0E\u843D\u70B9\uFF0C\u6700\u5C0F\u6539\u52A8\uFF0C\u6539\u5B8C\u9A8C\u8BC1\u4E0D\u5F04\u574F\u522B\u5904" },
          { symptom: "\u4EA7\u51FA\u5927\u91CF TODO \u5360\u4F4D", fix: "\u5173\u952E\u6587\u4EF6\u4E0D\u80FD\u7559 TODO \u5192\u5145\u5B8C\u6210\uFF0C\u6CA1\u505A\u7684\u5982\u5B9E\u8BF4\u660E" }
        ]
      },
      {
        id: "verify",
        name: "\u8FD0\u884C\u9A8C\u8BC1",
        goal: "\u6309\u9879\u76EE\u8FD0\u884C\u65B9\u5F0F\u771F\u5B9E\u8DD1\u4E00\u904D\uFF08\u542F\u52A8/\u6253\u5F00/\u6D4B\u8BD5\uFF09\uFF0C\u786E\u8BA4\u6539\u597D\u4E14\u6CA1\u5F04\u574F\u522B\u5904\uFF1B\u628A\u8FD0\u884C\u7ED3\u679C\u4E0E\u590D\u73B0\u6B65\u9AA4\u5199\u8FDB PROJECT.md\u3002",
        guidance: [
          "\u771F\u5B9E\u6267\u884C\u542F\u52A8\u547D\u4EE4/\u6D4B\u8BD5\u6216\u6253\u5F00\u5165\u53E3\u6587\u4EF6\uFF0C\u628A\u7ED3\u679C\uFF08\u6210\u529F/\u62A5\u9519\uFF09\u5199\u8FDB PROJECT.md \u4E0E\u4EA4\u4ED8\u8BF4\u660E",
          "\u8FD0\u884C\u4E0D\u4E86\u7684\u5982\u5B9E\u8BF4\u660E\u7F3A\u4EC0\u4E48\uFF08\u7F3A\u8FD0\u884C\u65F6/\u7F3A\u4F9D\u8D56/\u7F3A\u6570\u636E\uFF09\uFF0C\u4E0D\u5047\u88C5\u80FD\u8DD1"
        ],
        verification: [
          { kind: "file_exists", pattern: "PROJECT.md", note: "PROJECT.md \u5E94\u8BB0\u5F55\u9A8C\u8BC1\u7ED3\u679C" }
        ],
        pitfalls: [
          { symptom: "\u58F0\u79F0\u80FD\u8DD1\u4F46\u6CA1\u9A8C\u8BC1", fix: "\u5FC5\u987B\u771F\u5B9E\u6267\u884C\u542F\u52A8\u547D\u4EE4/\u6D4B\u8BD5\uFF0C\u628A\u8F93\u51FA\u5199\u8FDB\u4EA4\u4ED8\u8BF4\u660E" }
        ]
      },
      {
        id: "deliver",
        name: "\u4EA4\u4ED8\u8BF4\u660E\uFF08\u5C3D\u91CF\u53D1\u5E03\uFF09",
        goal: "\u5B8C\u5584 PROJECT.md/README\uFF08\u662F\u4EC0\u4E48/\u600E\u4E48\u8DD1/\u6539\u4E86\u4EC0\u4E48/\u600E\u4E48\u7528/\u4E0B\u4E00\u6B65\uFF09\uFF0C\u4EA7\u51FA\u4EA4\u4ED8\u603B\u7ED3\uFF1B\u82E5\u7528\u6237\u8981\u53D1\u5E03\u4E14\u73AF\u5883\u6709\u53D1\u5E03\u80FD\u529B\u5219\u53D1\u5E03\u5E76\u7ED9\u51FA\u516C\u5F00\u5730\u5740\u3002",
        guidance: [
          "\u5B58\u91CF\uFF1A\u5199\u6E05\u300C\u6539\u4E86\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u3001\u600E\u4E48\u9A8C\u8BC1\u300D\uFF1B\u4ECE 0\uFF1A\u5199\u6E05\u300C\u600E\u4E48\u8DD1\u3001\u600E\u4E48\u7528\u3001\u76EE\u5F55\u7ED3\u6784\u300D",
          "\u53D1\u5E03\u80FD\u529B\u7F3A\u5931\u65F6\u4E0D\u963B\u585E\uFF1A\u672C\u5730\u5DF2\u53EF\u8FD0\u884C\u5373\u53EF\u4EA4\u4ED8\uFF0C\u5982\u5B9E\u8BF4\u660E\u4E0A\u7EBF\u8DEF\u5F84"
        ],
        capabilities: [
          {
            kind: "tool",
            id: "publish_deploy",
            source: "sealos-skills",
            purpose: "\u628A\u9879\u76EE\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740\uFF08sealos-skills\uFF1A\u4E00\u6761\u547D\u4EE4\u90E8\u7F72+\u6570\u636E\u5E93+\u5BF9\u8C61\u5B58\u50A8\uFF09",
            trust: "community",
            // 可选：发布是「尽量」，缺了不阻塞交付——本地可运行即视为第一版交付。
            // 必选发布只在 publish-site（发布即目标）里声明，这里刻意给 optional。
            optional: true
          }
        ],
        verification: [
          { kind: "file_exists", pattern: "PROJECT.md", note: "\u4EA4\u4ED8\u65F6\u5E94\u6709\u4E00\u4EFD\u5B8C\u6574\u9879\u76EE\u6587\u6863" }
        ],
        pitfalls: [
          { symptom: "\u53D1\u5E03\u80FD\u529B\u7F3A\u5931\uFF08\u672A\u88C5\u914D publish_deploy\uFF09", fix: "\u4E2D\u95F4\u4EF6\u5DF2\u81EA\u52A8\u53BB\u5E02\u573A\u627E\u6700\u597D\u7684\uFF08sealos-skills\uFF09\u5E76\u5EFA\u8BAE\u88C5\u914D\uFF1B\u88C5\u597D\u91CD\u542F\u540E\u4ECE\u4EA4\u4ED8\u6B65\u7EE7\u7EED\uFF0C\u672C\u5730\u5DF2\u53EF\u8FD0\u884C\u4E0D\u963B\u585E" },
          { symptom: "\u6587\u6863\u6CA1\u5199\u600E\u4E48\u8DD1", fix: "\u5FC5\u987B\u5199\u6E05\u5B89\u88C5\u4F9D\u8D56\u4E0E\u542F\u52A8\u547D\u4EE4\uFF0C\u522B\u4EBA\u7167\u7740\u80FD\u590D\u73B0" }
        ]
      }
    ]
  }
];
function findRecipesByGoal(goal) {
  const lower = goal.toLowerCase();
  const found = [];
  for (const recipe of RECIPES) {
    const hits = recipe.triggers.filter((t) => lower.includes(t.toLowerCase()));
    if (hits.length > 0) found.push({ recipe, hits });
  }
  return found;
}
function getRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}
function recipeCatalog() {
  return RECIPES.map(({ id, name, description, triggers }) => ({ id, name, description, triggers }));
}

// src/capabilities/protocol.ts
var ACCEPTANCE_PROTOCOL_VERSION = 1;
var SUPPORTED_CHECK_KINDS = /* @__PURE__ */ new Set(["file_exists", "content_match", "content_absent", "dir_nonempty", "browser_acceptance"]);
function kindOf(check) {
  return check?.kind ?? "";
}
function validateVerificationChecks(checks) {
  const errors = [];
  if (!Array.isArray(checks)) {
    errors.push({ path: "verification", message: "\u9A8C\u6536\u65AD\u8A00\u5E94\u4E3A\u6570\u7EC4" });
    return errors;
  }
  checks.forEach((check, i) => {
    const path = `verification[${i}]`;
    const kind = kindOf(check);
    if (!kind || !SUPPORTED_CHECK_KINDS.has(kind)) {
      errors.push({ path, message: `\u65AD\u8A00\u7C7B\u578B\u300C${kind || "\u7F3A\u5931"}\u300D\u4E0D\u5408\u6CD5` });
      return;
    }
    if (check.kind === "browser_acceptance") {
      if (typeof check.spec !== "string" || check.spec.trim() === "") {
        errors.push({ path, message: "browser_acceptance \u7F3A\u5C11\u975E\u7A7A spec\uFF08JSON \u9A8C\u6536\u89C4\u683C\u8DEF\u5F84\uFF09" });
      }
      return;
    }
    if (typeof check.pattern !== "string" || check.pattern.trim() === "") {
      errors.push({ path, message: `${kind} \u7F3A\u5C11\u975E\u7A7A pattern` });
    }
    if (check.kind === "content_match" && (typeof check.contains !== "string" || check.contains === "")) {
      errors.push({ path, message: "content_match \u7F3A\u5C11\u975E\u7A7A contains" });
    }
    if (check.kind === "content_absent" && (typeof check.mustNotContain !== "string" || check.mustNotContain === "")) {
      errors.push({ path, message: "content_absent \u7F3A\u5C11\u975E\u7A7A mustNotContain" });
    }
  });
  return errors;
}
function validateQualityBar(bar) {
  if (!bar) return [];
  const errors = [];
  if (typeof bar.bar !== "string" || bar.bar.trim() === "") {
    errors.push({ path: "qualityBar.bar", message: "\u8D28\u91CF\u95E8\u69DB\u7F3A\u5C11\u4E00\u53E5\u8BDD\u5B9A\u4F4D bar" });
  }
  if (!Array.isArray(bar.checks) || bar.checks.some((c) => typeof c !== "string" || c.trim() === "")) {
    errors.push({ path: "qualityBar.checks", message: "\u8D28\u91CF\u68C0\u67E5\u9879\u5E94\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\u6570\u7EC4" });
  }
  if (!Array.isArray(bar.selfCheck) || bar.selfCheck.some((c) => typeof c !== "string" || c.trim() === "")) {
    errors.push({ path: "qualityBar.selfCheck", message: "\u81EA\u67E5\u9879\u5E94\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\u6570\u7EC4" });
  }
  return errors;
}
function formatProtocolErrors(errors) {
  if (errors.length === 0) return "";
  return errors.map((e) => `- ${e.path}: ${e.message}`).join("\n");
}
function validateRecipeProtocol(recipe) {
  const errors = [
    ...validateVerificationChecks(recipe.verification),
    ...validateQualityBar(recipe.qualityBar)
  ];
  for (const step of recipe.workflow ?? []) {
    const stepErrors = validateVerificationChecks(step.verification ?? []);
    for (const e of stepErrors) {
      errors.push({ path: `workflow[${step.id}].${e.path}`, message: e.message });
    }
  }
  return errors;
}

// src/capabilities/types.ts
var DEFAULT_DELEGATE = { provider: "spawn" };

// src/capabilities/resolver.ts
var WILDCARD_TOOL = /^\w+\*$/;
var TRIGGER_WEIGHT = {
  // 从 0 开发的复杂信号
  \u5927\u578B\u9879\u76EE: 3,
  \u590D\u6742\u9879\u76EE: 3,
  \u5F00\u53D1\u9879\u76EE: 3,
  \u505A\u9879\u76EE: 3,
  \u5F00\u53D1\u4E00\u4E2A: 3,
  \u505A\u4E00\u4E2A\u5E94\u7528: 3,
  \u505A\u4E2A\u5E94\u7528: 3,
  \u505A\u4E00\u4E2A\u7CFB\u7EDF: 3,
  \u505A\u4E2A\u7CFB\u7EDF: 3,
  \u505A\u4E00\u4E2A\u5DE5\u5177: 3,
  \u505A\u4E2A\u5DE5\u5177: 3,
  \u5199\u4E00\u4E2A\u7A0B\u5E8F: 3,
  \u5168\u6808: 3,
  \u540E\u53F0: 3,
  \u7BA1\u7406\u7CFB\u7EDF: 3,
  web\u5E94\u7528: 3,
  \u5C0F\u7A0B\u5E8F: 3,
  \u722C\u866B: 3,
  \u81EA\u52A8\u5316: 3,
  \u673A\u5668\u4EBA: 3,
  \u7CFB\u7EDF: 3,
  \u5E94\u7528: 3,
  \u5DE5\u5177: 3,
  \u6570\u636E\u5E93: 3,
  \u6CE8\u518C: 3,
  \u767B\u5F55: 3,
  \u8D26\u53F7: 3,
  api: 3,
  \u63A5\u53E3: 3,
  \u670D\u52A1\u7AEF: 3,
  // 存量项目的强信号（修 bug / 加功能 / 迷茫 / 已有代码）
  "\u4FEE bug": 3,
  "\u4FEE\u4E2A bug": 3,
  "\u6539 bug": 3,
  "\u6709 bug": 3,
  "\u51FA bug": 3,
  "\u62A5\u9519": 3,
  "\u5D29\u6E83": 3,
  "\u574F\u4E86": 3,
  "\u4E0D\u5DE5\u4F5C": 3,
  "\u6CA1\u53CD\u5E94": 3,
  "\u52A0\u4E2A\u529F\u80FD": 3,
  "\u52A0\u529F\u80FD": 3,
  "\u5B9E\u73B0\u529F\u80FD": 3,
  "\u5B9E\u73B0\u4E00\u4E2A\u529F\u80FD": 3,
  "\u52A0\u4E00\u4E2A\u529F\u80FD": 3,
  "\u65B0\u529F\u80FD": 3,
  "\u505A\u4E2A\u529F\u80FD": 3,
  "\u4F18\u5316\u4E00\u4E0B": 3,
  "\u91CD\u6784": 3,
  "\u6211\u7684\u9879\u76EE": 3,
  "\u8FD9\u4E2A\u9879\u76EE": 3,
  "\u90A3\u4E2A\u9879\u76EE": 3,
  "\u5DF2\u6709\u9879\u76EE": 3,
  "\u73B0\u6709\u9879\u76EE": 3,
  "\u63A5\u624B": 3,
  "\u522B\u4EBA\u5199\u7684": 3,
  "\u514B\u9686": 3,
  "\u4EE3\u7801\u5E93": 3,
  "\u6E90\u7801": 3,
  "\u770B\u4E0D\u61C2": 3,
  "\u4E0D\u77E5\u9053\u4E0B\u4E00\u6B65": 3,
  "\u63A5\u4E0B\u6765\u505A\u4EC0\u4E48": 3,
  "\u4E0D\u77E5\u9053\u505A\u4EC0\u4E48": 3,
  "\u8FF7\u832B": 3,
  "\u770B\u770B\u8FD9\u4E2A\u9879\u76EE": 3,
  "\u5206\u6790\u4E00\u4E0B\u8FD9\u4E2A\u9879\u76EE": 3,
  "\u9879\u76EE\u662F\u5E72\u561B\u7684": 3,
  "\u600E\u4E48\u8FD0\u884C\u7684": 3
};
var RECIPE_SPECIFICITY = {
  "personal-site": 2,
  "big-project": 1
};
function weightOfHits(hits) {
  return hits.reduce((score, h) => score + (TRIGGER_WEIGHT[h] ?? 1), 0);
}
async function probeCapability(ctx, ref) {
  if (ref.kind === "tool" && WILDCARD_TOOL.test(ref.id)) {
    return { ref, available: true };
  }
  if (ref.kind === "skill") {
    const skills = ctx.get("skills");
    if (skills) {
      try {
        const list = await skills.list();
        if (list.some((s) => s.name === ref.id)) return { ref, available: true };
      } catch {
      }
    }
    return {
      ref,
      available: false,
      installHint: `\u7F3A\u5C11 skill\u300C${ref.id}\u300D\uFF1B\u82E5\u4E3A\u793E\u533A\u63D2\u4EF6\u63D0\u4F9B\uFF0C\u53EF\u5C1D\u8BD5 dsh plugin add ${ref.source ?? ref.id}`
    };
  }
  if (ref.kind === "tool") {
    try {
      const schemas = ctx.tools.schemas();
      if (schemas.some((s) => s.name === ref.id)) return { ref, available: true };
    } catch {
    }
    return {
      ref,
      available: false,
      installHint: `\u7F3A\u5C11\u5DE5\u5177\u300C${ref.id}\u300D${ref.source ? `\uFF1B\u53EF\u5C1D\u8BD5 dsh plugin add ${ref.source}` : ""}`
    };
  }
  return {
    ref,
    available: false,
    installHint: `\u80FD\u529B ${ref.kind}:${ref.id} \u672A\u88C5\u914D${ref.source ? `\uFF1B\u53EF\u5C1D\u8BD5 dsh plugin add ${ref.source}` : ""}`
  };
}
async function probeCapabilities(ctx, refs) {
  const out = [];
  for (const ref of refs) {
    out.push(await probeCapability(ctx, ref));
  }
  return out;
}
function planFromRecipe(goal, recipe, matchedBy, capabilities) {
  const protocolErrors = validateRecipeProtocol(recipe);
  if (protocolErrors.length > 0) {
    throw new Error(`\u65B9\u6848\u300C${recipe.id}\u300D\u9A8C\u6536\u534F\u8BAE\u4E0D\u5408\u6CD5\uFF0C\u5DF2\u4E2D\u6B62\u88C5\u914D\uFF08\u8BF7\u4FEE\u6B63\u65B9\u6848\u5B9A\u4E49\uFF09\uFF1A
${formatProtocolErrors(protocolErrors)}`);
  }
  const missingRequired = capabilities.filter((c) => !c.available && !c.ref.optional).map((c) => `${c.ref.kind}:${c.ref.id}`);
  return {
    goal,
    recipeId: recipe.id,
    recipeName: recipe.name,
    matchedBy,
    capabilities,
    guidance: recipe.guidance,
    delegate: recipe.delegate ?? DEFAULT_DELEGATE,
    verification: recipe.verification,
    questions: recipe.questions,
    workflow: recipe.workflow,
    qualityBar: recipe.qualityBar,
    executable: missingRequired.length === 0,
    missingRequired
  };
}
function genericPlan(goal, matchedBy) {
  return {
    goal,
    recipeId: null,
    recipeName: null,
    matchedBy,
    capabilities: [],
    guidance: [],
    delegate: DEFAULT_DELEGATE,
    verification: [],
    executable: true,
    missingRequired: []
  };
}
async function resolveCapabilities(ctx, input) {
  if (input.recipeId) {
    const recipe2 = getRecipe(input.recipeId);
    if (recipe2) {
      const capabilities2 = [];
      for (const ref of recipe2.capabilities) {
        capabilities2.push(await probeCapability(ctx, ref));
      }
      return planFromRecipe(input.goal, recipe2, `explicit:${input.recipeId}`, capabilities2);
    }
    return genericPlan(input.goal, `explicit-unknown:${input.recipeId}`);
  }
  const candidates = findRecipesByGoal(input.goal);
  if (candidates.length === 0) return genericPlan(input.goal, "no-recipe");
  candidates.sort(
    (a, b) => weightOfHits(b.hits) - weightOfHits(a.hits) || (RECIPE_SPECIFICITY[b.recipe.id] ?? 1) - (RECIPE_SPECIFICITY[a.recipe.id] ?? 1)
  );
  const { recipe, hits } = candidates[0];
  const capabilities = [];
  for (const ref of recipe.capabilities) {
    capabilities.push(await probeCapability(ctx, ref));
  }
  return planFromRecipe(input.goal, recipe, `rules:${hits.join("\u3001")}`, capabilities);
}

// src/capabilities/planner.ts
function resolveAnswers(plan, strategy, answers) {
  const questions = plan.questions ?? [];
  if (questions.length === 0) return void 0;
  const resolved = {};
  for (const q of questions) {
    const userValue = answers?.[q.key];
    resolved[q.key] = strategy === "clarify-first" && userValue?.trim() ? userValue.trim() : q.default;
  }
  return resolved;
}
var STRATEGY_OPTIONS = [
  {
    id: "mvp-first",
    label: "\u76F4\u63A5\u505A\u4E00\u7248\u5B8C\u6574\u7684",
    description: "\u4E0D\u6253\u65AD\u4F60\uFF0C\u7528\u9AD8\u6807\u51C6\u7684\u9ED8\u8BA4\u503C\u76F4\u63A5\u505A\u51FA\u4E00\u7248\u5B8C\u6574\u53EF\u5C55\u793A\u7684\u6210\u679C\uFF0C\u505A\u5B8C\u4F60\u518D\u6253\u78E8\u7EC6\u8282",
    recommended: true
  },
  {
    id: "clarify-first",
    label: "\u5148\u5BF9\u9F50\u9700\u6C42\u518D\u505A",
    description: "\u5148\u95EE\u4F60\u51E0\u4E2A\u5173\u952E\u95EE\u9898\uFF08\u4E0D\u8D85\u8FC7 3 \u4E2A\uFF09\uFF0C\u505A\u5F97\u66F4\u8D34\u5408\u4F60\u7684\u9700\u8981"
  }
];
async function planExecution(ctx, input) {
  const plan = await resolveCapabilities(ctx, input);
  return {
    plan,
    strategyOptions: STRATEGY_OPTIONS,
    questions: plan.questions ?? []
  };
}
function formatStrategyOptions(options) {
  const lines = ["\u4F60\u60F3\u600E\u4E48\u505A\uFF1F", ""];
  for (const o of options) {
    lines.push(`- [${o.id}] ${o.label}${o.recommended ? "\uFF08\u63A8\u8350\uFF09" : ""}`);
    lines.push(`  ${o.description}`);
  }
  lines.push("", "\u628A\u9009\u4E2D\u7684 id\uFF08mvp-first / clarify-first\uFF09\u4F20\u7ED9 ming_auto \u7684 strategy \u53C2\u6570\u5373\u53EF\u3002");
  return lines.join("\n");
}
function clarifyStatus(plan, answers) {
  const questions = plan.questions ?? [];
  const confirmed = {};
  const missing = [];
  for (const q of questions) {
    const value = answers?.[q.key];
    if (value && value.trim()) {
      confirmed[q.key] = value.trim();
    } else {
      missing.push({
        key: q.key,
        question: q.question,
        default: q.default,
        options: q.options,
        translate: q.translate
      });
    }
  }
  return { done: missing.length === 0, confirmed, missing };
}
function formatClarify(status) {
  if (status.done) {
    const parts = Object.entries(status.confirmed).map(([k, v]) => `${k} = ${v}`).join("\u3001");
    return `\u4FE1\u606F\u591F\u4E86\uFF0C\u5DF2\u786E\u8BA4\uFF1A${parts}\u3002\u53EF\u4EE5\u8C03\u7528 ming_auto\uFF08strategy=clarify-first\uFF0Canswers \u7528\u8FD9\u4E9B\u503C\uFF09\u5F00\u59CB\u505A\u4E86\u3002`;
  }
  const lines = [`\u8FD8\u9700\u8981\u786E\u8BA4 ${status.missing.length} \u4E2A\u5173\u952E\u70B9\uFF08\u53EF\u4EE5\u56DE\u7B54\uFF0C\u4E5F\u53EF\u4EE5\u8BF4\u300C\u4F60\u770B\u7740\u529E\u300D\uFF0C\u6211\u4F1A\u7528\u9ED8\u8BA4\u503C\uFF09\uFF1A`, ""];
  for (const m of status.missing) {
    const opts = m.options?.length ? `\uFF08${m.options.join(" / ")}\uFF09` : "";
    lines.push(`- ${m.question}${opts}\uFF5C\u9ED8\u8BA4\uFF1A${m.default}`);
    if (m.translate) {
      lines.push(`  \u7FFB\u8BD1\u53C2\u8003\uFF1A${m.translate}`);
    }
  }
  lines.push("", "\u6BCF\u786E\u8BA4\u4E00\u70B9\u5C31\u8C03\u7528\u4E00\u6B21 ming_clarify \u4F20\u5165\u65B0\u7B54\u6848\uFF1B\u90FD\u786E\u8BA4\u4E86\u5B83\u4F1A\u63D0\u793A\u5F00\u59CB\u505A\u3002");
  return lines.join("\n");
}

// src/services/browser-verify.ts
import { spawn as spawn2 } from "child_process";
import { access as access2 } from "fs/promises";
import { join as join3 } from "path";
async function probeDshVerify() {
  try {
    await access2("dsh-verify");
    return true;
  } catch {
  }
  const code = await new Promise((resolve2) => {
    const child = spawn2("npx", ["--no-install", "dsh-verify", "--help"], { stdio: "ignore" });
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
      }
    }, 1e4);
    child.on("error", () => {
      clearTimeout(timer);
      resolve2(null);
    });
    child.on("close", (c) => {
      clearTimeout(timer);
      resolve2(c);
    });
  });
  return code === 0;
}
async function runBrowserAcceptance(spec, workdir, deps = {}) {
  const probe = deps.probe ?? probeDshVerify;
  const run = deps.run ?? (async (specPath2) => {
    const result = await new Promise((resolve2) => {
      const child = spawn2("npx", ["--yes", "dsh-verify", "--spec", specPath2], { cwd: workdir, stdio: ["ignore", "pipe", "pipe"] });
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
        }
      }, 12e4);
      let output2 = "";
      child.stdout?.on("data", (c) => {
        output2 += String(c);
      });
      child.stderr?.on("data", (c) => {
        output2 += String(c);
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve2({ code: null, output: `${output2}
\u542F\u52A8 dsh-verify \u5931\u8D25\uFF1A${err.message}` });
      });
      child.on("close", (code2) => {
        clearTimeout(timer);
        resolve2({ code: code2, output: output2 });
      });
    });
    return result;
  });
  if (!await probe()) {
    return {
      passed: false,
      skipped: true,
      detail: "\u6D4F\u89C8\u5668\u9A8C\u6536\u672A\u6267\u884C\uFF1A\u672C\u673A\u672A\u88C5\u914D dsh-verify\uFF08Witness\uFF09\u3002\u9700\u8981\u65F6\u7528 `dsh plugin add dsh-verify` \u88C5\u914D\u540E\u518D\u9A8C\u6536\u3002"
    };
  }
  const specPath = join3(workdir, spec);
  const { code, output } = await run(specPath);
  const verdict = /FAIL/iu.test(output) ? "FAIL" : /PASS/iu.test(output) ? "PASS" : null;
  const ok = code === 0 && verdict === "PASS";
  if (ok) {
    return { passed: true, detail: `\u771F\u5B9E\u6D4F\u89C8\u5668\u9A8C\u6536\u901A\u8FC7\uFF08PASS\uFF09\u2014\u2014${output.trim().split("\n")[0] || "spec \u5168\u90E8\u901A\u8FC7"}` };
  }
  return {
    passed: false,
    detail: `\u771F\u5B9E\u6D4F\u89C8\u5668\u9A8C\u6536\u672A\u901A\u8FC7\uFF08${verdict ?? `\u9000\u51FA\u7801 ${code ?? "\u672A\u77E5"}`}\uFF09\u3002\u56DE\u6267\u89C1\u8F93\u51FA\u524D\u51E0\u884C\uFF1A${output.trim().split("\n").slice(0, 3).join(" | ") || "\uFF08\u65E0\u8F93\u51FA\uFF09"}`
  };
}

// src/capabilities/verifier.ts
import { readdir as readdir2, readFile as readFile3, stat as stat2 } from "fs/promises";
import { join as join4 } from "path";
async function expandPattern(workdir, pattern, signal) {
  const trimmed = pattern.trim();
  const recursive = trimmed.startsWith("**/");
  const base = trimmed.replace(/^\*?\*\//, "");
  const results = [];
  const walk = async (dir, depth) => {
    signal?.throwIfAborted();
    let entries;
    try {
      entries = await readdir2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join4(dir, entry.name);
      const rel = full.slice(workdir.length + 1).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        if (recursive) await walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (matchesSimplePattern(rel, base)) results.push(full);
    }
  };
  await walk(workdir, 0);
  return results;
}
function matchesSimplePattern(relPath, base) {
  if (base === "*" || base === "**/*") return true;
  if (!base.includes("*")) return relPath === base;
  const suffix = base.slice(1);
  return relPath.endsWith(suffix);
}
async function verifyOne2(check, workdir, signal) {
  if (check.kind === "browser_acceptance") {
    const outcome = await runBrowserAcceptance(check.spec, workdir);
    return {
      check,
      passed: outcome.passed,
      skipped: outcome.skipped,
      detail: outcome.detail
    };
  }
  const files = await expandPattern(workdir, check.pattern, signal);
  switch (check.kind) {
    case "file_exists": {
      if (files.length === 0) {
        return { check, passed: false, detail: `\u672A\u627E\u5230\u5339\u914D\u300C${check.pattern}\u300D\u7684\u6587\u4EF6` };
      }
      return {
        check,
        passed: true,
        detail: `\u5339\u914D ${files.length} \u4E2A\u6587\u4EF6\uFF1A${files.slice(0, 5).join("\u3001")}${files.length > 5 ? " \u2026" : ""}`
      };
    }
    case "content_match": {
      if (files.length === 0) {
        return { check, passed: false, detail: `\u672A\u627E\u5230\u5339\u914D\u300C${check.pattern}\u300D\u7684\u6587\u4EF6\uFF0C\u65E0\u6CD5\u68C0\u67E5\u5185\u5BB9` };
      }
      const hits = [];
      for (const file of files) {
        signal?.throwIfAborted();
        try {
          const content = await readFile3(file, "utf-8");
          if (content.includes(check.contains)) hits.push(file);
        } catch {
        }
      }
      if (hits.length === 0) {
        return { check, passed: false, detail: `\u5339\u914D\u7684\u6587\u4EF6\u4E2D\u5747\u672A\u5305\u542B\u300C${check.contains}\u300D` };
      }
      return { check, passed: true, detail: `${hits.length} \u4E2A\u6587\u4EF6\u5305\u542B\u300C${check.contains}\u300D\uFF1A${hits.join("\u3001")}` };
    }
    case "content_absent": {
      if (files.length === 0) {
        return { check, passed: false, detail: `\u672A\u627E\u5230\u5339\u914D\u300C${check.pattern}\u300D\u7684\u6587\u4EF6\uFF0C\u65E0\u6CD5\u68C0\u67E5\u5185\u5BB9` };
      }
      const violations = [];
      for (const file of files) {
        signal?.throwIfAborted();
        try {
          const content = await readFile3(file, "utf-8");
          if (content.includes(check.mustNotContain)) violations.push(file);
        } catch {
        }
      }
      if (violations.length > 0) {
        return { check, passed: false, detail: `${violations.length} \u4E2A\u6587\u4EF6\u5305\u542B\u7981\u6B62\u5185\u5BB9\u300C${check.mustNotContain}\u300D\uFF1A${violations.join("\u3001")}` };
      }
      return { check, passed: true, detail: `${files.length} \u4E2A\u6587\u4EF6\u5747\u672A\u5305\u542B\u300C${check.mustNotContain}\u300D` };
    }
    case "dir_nonempty": {
      if (files.length === 0) {
        return { check, passed: false, detail: "\u76EE\u5F55\u4E2D\u672A\u53D1\u73B0\u4EFB\u4F55\u6587\u4EF6" };
      }
      return { check, passed: true, detail: `\u76EE\u5F55\u542B ${files.length} \u4E2A\u6587\u4EF6` };
    }
    default:
      return { check, passed: false, detail: `\u4E0D\u652F\u6301\u7684\u65AD\u8A00\u7C7B\u578B\uFF1A${check.kind}` };
  }
}
async function verifyChecks(checks, workdir, signal) {
  const results = [];
  for (const check of checks) {
    results.push(await verifyOne2(check, workdir, signal));
  }
  const skipped = results.filter((r) => r.skipped).length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed - skipped;
  return { passed, failed, skipped, results };
}
function formatVerification(summary) {
  if (summary.results.length === 0) return "";
  const lines = summary.results.map(
    (r) => r.skipped ? `\u23ED\uFE0F ${describeCheck(r.check)}\uFF1A${r.detail}` : `${r.passed ? "\u2705" : "\u274C"} ${describeCheck(r.check)}\uFF1A${r.detail}`
  );
  const skipNote = summary.skipped > 0 ? `\uFF08\u8DF3\u8FC7 ${summary.skipped} \u9879\u2014\u2014\u5916\u90E8\u9A8C\u6536\u80FD\u529B\u672A\u88C5\u914D\uFF0C\u672A\u6267\u884C\uFF09` : "";
  return `\u3010\u72EC\u7ACB\u9A8C\u8BC1\u3011\u901A\u8FC7 ${summary.passed} / ${summary.failed + summary.passed}${skipNote}
${lines.join("\n")}`;
}
function describeCheck(check) {
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
      return `\u771F\u5B9E\u6D4F\u89C8\u5668\u9A8C\u6536\u300C${check.spec}\u300D`;
  }
}
function matchesSimplePatternForTest(relPath, base) {
  return matchesSimplePattern(relPath, base);
}

// src/services/evidence-collector.ts
import { createHash } from "crypto";
import { mkdir as mkdir2, writeFile } from "fs/promises";
import { join as join5 } from "path";
function hashGoal(goal) {
  return createHash("sha256").update(goal, "utf-8").digest("hex");
}
async function writeEvidence(payload) {
  const dir = join5(payload.workdir, "ming-evidence");
  await mkdir2(dir, { recursive: true });
  const id = `evidence-${Date.now()}`;
  const card = {
    id,
    schemaVersion: 1,
    /** 本次任务使用的验收协议版本（供未来协议演进时历史迁移） */
    acceptanceProtocolVersion: ACCEPTANCE_PROTOCOL_VERSION,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...payload
  };
  const filepath = join5(dir, `${id}.json`);
  await writeFile(filepath, JSON.stringify(card, null, 2), "utf-8");
  return { path: filepath, id };
}

// src/services/next-steps.ts
function nextStepsFor(outcome) {
  if (outcome.success) {
    return ["\u67E5\u770B\u4E0A\u9762\u5217\u51FA\u7684\u4EA7\u51FA\u6587\u4EF6", "\u5982\u9700\u4FEE\u6539\uFF0C\u76F4\u63A5\u544A\u8BC9\u6211\u6539\u54EA\u91CC", "\u6EE1\u610F\u540E\u53EF\u7EE7\u7EED\u4E0B\u4E00\u4E2A\u4EFB\u52A1"];
  }
  switch (outcome.errorKind) {
    case "engine-unavailable":
      return [
        "\u5F53\u524D\u73AF\u5883\u672A\u542F\u7528\u5B50\u4EE3\u7406\u6267\u884C\u5F15\u64CE\uFF0C\u53EF\u76F4\u63A5\u8BA9\u6211\u7528\u81EA\u5E26\u5DE5\u5177\u5B8C\u6210\u8BE5\u76EE\u6807",
        "\u6216\u5728\u542F\u7528\u4E86\u5B50\u4EE3\u7406\u7684 profile \u4E2D\u91CD\u8BD5"
      ];
    case "resource-missing":
      return ["\u68C0\u67E5\u4E0A\u9762\u5217\u51FA\u7684\u8D44\u6E90\u8DEF\u5F84\u662F\u5426\u6B63\u786E\uFF08\u6CE8\u610F\u5927\u5C0F\u5199\u4E0E\u76D8\u7B26\uFF09\uFF0C\u4FEE\u6B63\u540E\u91CD\u8BD5"];
    case "timeout":
      return ["\u628A\u4EFB\u52A1\u62C6\u5F97\u66F4\u5C0F\u4E00\u4E9B\u518D\u8BD5", "\u6216\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF MING_TIMEOUT_MS \u8C03\u5927\u8D85\u65F6\u65F6\u95F4"];
    case "aborted":
      return ["\u91CD\u65B0\u63CF\u8FF0\u4EFB\u52A1\u518D\u8BD5\u4E00\u6B21"];
    case "max-tokens":
      return ["\u628A\u76EE\u6807\u62C6\u5206\u6210\u591A\u4E2A\u5C0F\u6B65\u9AA4\u5206\u6B21\u6267\u884C"];
    case "refusal":
      return ["\u6362\u4E00\u79CD\u8868\u8FF0\u65B9\u5F0F\u63CF\u8FF0\u76EE\u6807"];
    default:
      return ["\u7A0D\u540E\u91CD\u8BD5", "\u82E5\u6301\u7EED\u5931\u8D25\uFF0C\u53EF\u643A\u5E26\u8BC1\u636E\u5361\u5185\u5BB9\u53CD\u9988\u95EE\u9898"];
  }
}
function workflowNextSteps(result) {
  const steps = [];
  if (result.stoppedAt) {
    const next = result.resumeFrom ?? result.stoppedAt;
    steps.push(`\u770B\u5B8C\u4E0A\u9762\u7684\u7ED3\u679C\u540E\uFF0C\u5BF9 Ming \u8BF4\u300C\u7EE7\u7EED\u300D\uFF0C\u4F1A\u4ECE\u4E0B\u4E00\u6B65\u63A5\u7740\u505A\uFF08workflowFrom=${next}\uFF09`);
    return steps;
  }
  if (result.failureKind === "capability-missing") {
    const blocked = result.stepResults.find((r) => r.blockedBy);
    if (blocked?.blockedBy) {
      const ref = blocked.blockedBy.ref;
      const fromHint = `\u91CD\u542F\u540E\u5BF9 Ming \u8BF4\u300C\u7EE7\u7EED\u300D\uFF08workflowFrom=${blocked.step.id}\uFF09\uFF0C\u4ECE\u5931\u8D25\u6B65\u63A5\u7740\u505A\uFF0C\u524D\u9762\u5DF2\u5B8C\u6210\u7684\u4E0D\u91CD\u505A`;
      if (result.summary.includes("\u5EFA\u8BAE\u88C5\u914D")) {
        steps.push(`\u80FD\u529B\u300C${ref.id}\u300D\u7F3A\u5931\uFF1A\u4E2D\u95F4\u4EF6\u5DF2\u5728\u5E02\u573A\u627E\u5230\u6700\u4F73\u5DE5\u5177\uFF08\u89C1\u4E0A\u9762\u6458\u8981\uFF09\uFF0C\u56DE\u4E00\u53E5\u300C\u786E\u8BA4\u300D\u6211\u5C31\u5E2E\u4F60\u88C5\uFF0C\u88C5\u597D\u540E\u5B8C\u5168\u91CD\u542F DSH`);
        steps.push(fromHint);
      } else {
        steps.push(`\u80FD\u529B\u300C${ref.id}\u300D\u7F3A\u5931\uFF1A\u4E2D\u95F4\u4EF6\u5DF2\u81EA\u52A8\u5B89\u88C5\u5B98\u65B9\u5DE5\u5177\uFF0C\u5B8C\u5168\u91CD\u542F DSH \u540E\u751F\u6548`);
        steps.push(fromHint);
      }
    }
  } else if (result.failureKind === "step-failed" || result.failureKind === "verification-failed") {
    const pit = result.pitfalls ?? [];
    if (pit.length > 0) {
      for (const p of pit.slice(0, 3)) {
        steps.push(`\u82E5\u73B0\u8C61\u662F\u300C${p.symptom}\u300D\u2192 ${p.fix}`);
      }
    }
    steps.push("\u91CD\u8DD1\u540C\u4E00\u76EE\u6807\u518D\u8BD5\u4E00\u6B21\uFF1B\u53CD\u590D\u5931\u8D25\u65F6\u628A\u5931\u8D25\u73B0\u8C61\u544A\u8BC9\u6211");
  } else {
    steps.push("\u67E5\u770B\u4E0A\u9762\u5217\u51FA\u7684\u4EA7\u51FA\u6587\u4EF6", "\u6EE1\u610F\u540E\u53EF\u7EE7\u7EED\u4E0B\u4E00\u4E2A\u4EFB\u52A1");
  }
  return steps;
}
function appendMissingNotice(outcome) {
  const missing = (outcome.artifactChecks ?? []).filter((c) => c.kind === "missing");
  if (!outcome.success || missing.length === 0) return outcome.summary;
  const lines = missing.map((m) => `  - ${m.raw}`);
  return `${outcome.summary}

\u26A0\uFE0F \u6821\u9A8C\u63D0\u9192\uFF1A\u4EE5\u4E0B\u6C47\u62A5\u4E2D\u7684\u8DEF\u5F84\u5728\u672C\u5730\u672A\u627E\u5230\uFF0C\u8BF7\u4EE5\u5B9E\u9645\u78C1\u76D8\u4E3A\u51C6\uFF1A
${lines.join("\n")}`;
}

// src/services/workflow.ts
function buildStepGoal(goal, step, resuming) {
  const lines = [
    `\u3010\u6574\u4F53\u76EE\u6807\u3011
${goal}`,
    "",
    `\u3010\u5F53\u524D\u8FD9\u4E00\u6B65\uFF08${step.name}\uFF09\u3011
${step.goal}`
  ];
  if (resuming) {
    lines.push("", "\u8BF4\u660E\uFF1A\u524D\u9762\u7684\u6B65\u9AA4\u5728\u6B64\u524D\u8FD0\u884C\u4E2D\u5DF2\u5B8C\u6210\uFF08\u4EA7\u7269\u5DF2\u843D\u76D8\uFF09\uFF0C\u672C\u6B65\u76F4\u63A5\u57FA\u4E8E\u73B0\u6709\u6587\u4EF6\u7EE7\u7EED\uFF0C\u4E0D\u8981\u91CD\u505A\u3002");
  }
  return lines.join("\n");
}
async function runWorkflow(ctx, exec, goal, resources, steps, workdir, options = {}) {
  const startedAt = Date.now();
  const stepResults = [];
  const fromId = options.workflowFrom;
  if (fromId && !steps.some((s) => s.id === fromId)) {
    return {
      success: false,
      failedStepId: fromId,
      failureKind: "invalid-workflow-from",
      stepResults: [],
      pitfalls: [],
      summary: `\u65E0\u6CD5\u4ECE\u300C${fromId}\u300D\u7EED\u8DD1\uFF1A\u5DE5\u4F5C\u6D41\u91CC\u6CA1\u6709\u8FD9\u4E00\u6B65\u3002\u60F3\u7EE7\u7EED\u7684\u8BDD\uFF0C\u76F4\u63A5\u5BF9 Ming \u8BF4\u300C\u7EE7\u7EED\u300D\u4E24\u4E2A\u5B57\u5373\u53EF\uFF0C\u4F1A\u4ECE\u4F60\u505C\u4E0B\u7684\u4E0B\u4E00\u6B65\u63A5\u7740\u505A\u3002`,
      durationMs: Date.now() - startedAt
    };
  }
  let reachedFrom = !fromId;
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];
    if (!reachedFrom) {
      if (step.id === fromId) {
        reachedFrom = true;
      } else {
        stepResults.push({ step, skipped: true });
        continue;
      }
    }
    if (step.capabilities && step.capabilities.length > 0) {
      const caps = await probeCapabilities(ctx, step.capabilities);
      const missing = caps.find((c) => !c.available && !c.ref.optional);
      if (missing) {
        const missingRefs = caps.filter((c) => !c.available && !c.ref.optional).map((c) => c.ref);
        const dispatch = await dispatchMissingCapabilities(missingRefs, options.dispatch);
        stepResults.push({ step, skipped: false, blockedBy: missing });
        const verb = dispatch.installedCount > 0 ? "\u5DF2\u81EA\u52A8\u5B89\u88C5\u5B98\u65B9\u80FD\u529B" : "\u5DF2\u53BB\u5E02\u573A\u627E\u5230\u6700\u4F73\u5DE5\u5177";
        const followup = dispatch.installedCount > 0 ? "\u88C5\u597D\u540E\u5B8C\u5168\u91CD\u542F DSH\uFF0C\u518D\u5BF9 Ming \u8BF4\u4E00\u58F0\u300C\u7EE7\u7EED\u300D\uFF0C\u5C31\u4F1A\u4ECE\u8FD9\u4E00\u6B65\u63A5\u7740\u505A\uFF08\u524D\u9762\u7684\u5DF2\u5B8C\u6210\u6B65\u9AA4\u4E0D\u4F1A\u91CD\u8DD1\uFF09\u3002" : "\u9700\u8981\u4F60\u56DE\u4E00\u53E5\u300C\u786E\u8BA4\u300D\u6211\u624D\u4F1A\u5E2E\u4F60\u88C5\uFF1B\u88C5\u597D\u5E76\u5B8C\u5168\u91CD\u542F DSH \u540E\uFF0C\u518D\u8BF4\u300C\u7EE7\u7EED\u300D\u4ECE\u8FD9\u4E00\u6B65\u63A5\u7740\u505A\u3002";
        const summaryLines = [
          `\u6B65\u9AA4\u300C${step.name}\u300D\u9700\u8981\u80FD\u529B\u300C${missing.ref.kind}:${missing.ref.id}\u300D\uFF08${missing.ref.purpose ?? ""}\uFF09\uFF0C\u4E2D\u95F4\u4EF6${verb}\uFF1A`,
          dispatch.summary,
          "",
          followup
        ];
        return {
          success: false,
          failedStepId: step.id,
          failureKind: "capability-missing",
          stepResults,
          pitfalls: step.pitfalls,
          summary: summaryLines.join("\n"),
          durationMs: Date.now() - startedAt
        };
      }
    }
    const resuming = fromId !== void 0 && step.id === fromId;
    const stepGoal = buildStepGoal(goal, step, resuming);
    const outcome = await execute(ctx, stepGoal, resources, exec, {
      contextual: [...options.baseContext ?? [], ...step.guidance ?? []]
    });
    if (!outcome.success) {
      stepResults.push({ step, outcome, skipped: false });
      return {
        success: false,
        failedStepId: step.id,
        failureKind: "step-failed",
        stepResults,
        pitfalls: step.pitfalls,
        summary: `\u6B65\u9AA4\u300C${step.name}\u300D\u6267\u884C\u5931\u8D25\uFF1A${outcome.summary}`,
        durationMs: Date.now() - startedAt
      };
    }
    let verification;
    if (step.verification && step.verification.length > 0) {
      verification = await verifyChecks(step.verification, workdir);
      if (verification.failed > 0) {
        stepResults.push({ step, outcome, verification, skipped: false });
        return {
          success: false,
          failedStepId: step.id,
          failureKind: "verification-failed",
          stepResults,
          pitfalls: step.pitfalls,
          summary: `\u6B65\u9AA4\u300C${step.name}\u300D\u4EA7\u51FA\u672A\u901A\u8FC7\u9A8C\u6536\uFF1A${formatVerification(verification)}`,
          durationMs: Date.now() - startedAt
        };
      }
    }
    stepResults.push({ step, outcome, verification, skipped: false });
    if (step.stopAfter) {
      return {
        success: true,
        stoppedAt: step.id,
        resumeFrom: steps[stepIdx + 1]?.id,
        stepResults,
        summary: `\u5DF2\u5B8C\u6210\u300C${step.name}\u300D\uFF0C\u5728\u8FD9\u91CC\u7B49\u4F60\u786E\u8BA4/\u9009\u62E9\uFF0C\u7136\u540E\u5BF9 Ming \u8BF4\u4E00\u58F0\u300C\u7EE7\u7EED\u300D\uFF0C\u5C31\u63A5\u7740\u505A\u4E0B\u4E00\u6B65\u3002`,
        durationMs: Date.now() - startedAt
      };
    }
  }
  const skippedCount = stepResults.filter((r) => r.skipped).length;
  const doneCount = stepResults.length - skippedCount;
  return {
    success: true,
    stepResults,
    summary: `\u5DE5\u4F5C\u6D41\u5B8C\u6210\uFF1A${doneCount} \u6B65\u6267\u884C\u6210\u529F${skippedCount > 0 ? `\uFF0C${skippedCount} \u6B65\u6309\u300C\u7EE7\u7EED\u300D\u8DF3\u8FC7\uFF08\u6B64\u524D\u5DF2\u5B8C\u6210\uFF09` : ""}`,
    durationMs: Date.now() - startedAt
  };
}
function collectWorkflowArtifacts(result) {
  const out = /* @__PURE__ */ new Set();
  for (const r of result.stepResults) {
    for (const a of r.outcome?.artifacts ?? []) {
      if (a) out.add(a);
    }
  }
  return [...out];
}

// src/tools/ming-auto.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
function formatDeliveryReview(value) {
  const revised = Boolean(value.revised);
  const lines = ["", revised ? "\u2500\u2500 \u4EA4\u4ED8\u5C55\u793A\uFF08\u5DF2\u6309\u4F60\u610F\u89C1\u4FEE\u6B63\uFF09\uFF1A\u8BF7\u4F60\u8FC7\u76EE \u2500\u2500" : "\u2500\u2500 \u4EA4\u4ED8\u5C55\u793A\uFF1A\u8BF7\u4F60\u8FC7\u76EE \u2500\u2500"];
  if (value.revised) {
    lines.push(`\u8FD9\u6B21\u6309\u4F60\u8BF4\u7684\u300C${value.revised}\u300D\u8C03\u6574\u540E\uFF0C\u91CD\u65B0\u505A\u3001\u5E76\u91CD\u65B0\u72EC\u7ACB\u68C0\u67E5\u8FC7\uFF08\u4E0D\u662F\u6539\u5B8C\u5C31\u7B97\uFF09\u3002`);
  }
  lines.push(`\u6211\u505A\u4E86 ${value.artifacts.length} \u9879\u4EA7\u51FA\uFF0C${value.verificationSummary ? "\u5E76\u5DF2\u72EC\u7ACB\u68C0\u67E5\uFF08\u7EC6\u8282\u89C1\u4E0A\uFF09" : "\u5DF2\u4EA4\u4ED8"}\u3002`);
  if (value.evidence) {
    lines.push(`\u8BC1\u636E\u8BB0\u5F55\u53EF\u56DE\u67E5\uFF1A${value.evidence}`);
  }
  lines.push("", revised ? "\u8BF7\u518D\u770B\u4E00\u773C\uFF1A\u8FD9\u6B21\u7B26\u5408\u4F60\u7684\u9884\u671F\u4E86\u5417\uFF1F\u8FD8\u8981\u8C03\u6574\u54EA\u91CC\uFF1F\u76F4\u63A5\u544A\u8BC9\u6211\u3002" : "\u8BF7\u4F60\u770B\u4E00\u773C\u7ED3\u679C\uFF1A\u7B26\u5408\u4F60\u7684\u9884\u671F\u5417\uFF1F\u54EA\u91CC\u8981\u8C03\u6574\uFF1F\u76F4\u63A5\u544A\u8BC9\u6211\uFF0C\u6211\u9A6C\u4E0A\u6539\u3002");
  return lines.join("\n");
}
function formatMingResult(value) {
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
  if (value.acceptanceHealth) {
    lines.push("", value.acceptanceHealth);
  }
  if (value.evidence) {
    lines.push("", `\u8BC1\u636E\u5361\uFF1A${value.evidence}`);
  }
  if (value.nextSteps.length > 0) {
    lines.push("", "\u63A5\u4E0B\u6765\uFF1A");
    value.nextSteps.forEach((n) => lines.push(`  - ${n}`));
  }
  if (value.success && (value.artifacts.length > 0 || value.verificationSummary || value.evidence)) {
    lines.push(formatDeliveryReview(value));
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
      },
      revision: {
        type: "string",
        description: "\u53EF\u9009\uFF1A\u7528\u6237\u5BF9\u4E0A\u6B21\u4EA4\u4ED8\u4E0D\u6EE1\u610F\u3001\u8981\u6C42\u4FEE\u6B63\u7684\u610F\u89C1\uFF08\u81EA\u7136\u8BED\u8A00\uFF09\u3002\u4F20\u5165\u65F6\u6309\u300C\u4FEE\u6B63\u8FED\u4EE3\u300D\u6267\u884C\uFF1A\u91CD\u65B0\u505A\u5E76\u91CD\u65B0\u72EC\u7ACB\u9A8C\u8BC1\uFF0C\u4EA4\u4ED8\u5C55\u793A\u660E\u786E\u300C\u5DF2\u6309\u4F60\u610F\u89C1\u4FEE\u6B63\u300D\u3002"
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
          verificationSummary: { type: "string", required: true },
          acceptanceHealth: { type: "string", required: true },
          revised: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatMingResult(value) }]
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
        return workflowToResult(wfResult, plan, goal, resources, workdir, args.revision);
      }
      const outcome = await execute(ctx, goal, resources, exec, { contextual });
      let verificationSummary = "";
      let verification;
      if (outcome.success && plan.verification.length > 0) {
        const summary = await verifyChecks(plan.verification, workdir);
        verification = { passed: summary.passed, failed: summary.failed, results: summary.results };
        verificationSummary = formatVerification(summary);
        try {
          await appendAcceptanceRecord(workdir, {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            recipeId: plan.recipeId,
            recipeName: plan.recipeName,
            passed: summary.passed,
            failed: summary.failed,
            failedKinds: failedKindsOf(summary.results)
          });
        } catch {
        }
      }
      let acceptanceHealth = "";
      if (verification) {
        acceptanceHealth = await computeAcceptanceHealth(workdir, plan.recipeId);
      }
      let evidencePath = "";
      try {
        const evidence = await writeEvidence({
          goal,
          resources,
          outcome,
          workdir,
          recipe: plan.recipeId ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities } : void 0,
          verification,
          provenance: {
            source: "auto",
            goalHash: hashGoal(goal),
            recipeId: plan.recipeId
          }
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
        verificationSummary,
        acceptanceHealth,
        revised: args.revision ?? ""
      };
      return result;
    }
  }));
}
async function computeAcceptanceHealth(workdir, recipeId) {
  if (!recipeId) return "";
  try {
    const history = await readAcceptanceHistory(workdir);
    const summary = summarizeAcceptance(history).find((item) => item.recipeId === recipeId);
    return summary ? formatAcceptance([summary]) : "";
  } catch {
    return "";
  }
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
async function workflowToResult(wf, plan, goal, resources, workdir, revision) {
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
      recipe: plan.recipeId ? { id: plan.recipeId, name: plan.recipeName, matchedBy: plan.matchedBy, capabilities: plan.capabilities } : void 0,
      provenance: {
        source: "auto",
        goalHash: hashGoal(goal),
        recipeId: plan.recipeId
      }
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
    verificationSummary: workflowVerificationSummary(wf),
    acceptanceHealth: await computeAcceptanceHealth(workdir, plan.recipeId),
    revised: revision ?? ""
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

export {
  failedKindsOf,
  appendAcceptanceRecord,
  readAcceptanceHistory,
  summarizeAcceptance,
  formatAcceptance,
  monthKeyOf,
  computeVte,
  computeVteTrend,
  formatVte,
  resolveTimeoutMs,
  looksLikeLocalPath,
  resolveWorkdir,
  extractArtifacts,
  kindFromStopReason,
  stopReasonText,
  assembleContext,
  tokensOf,
  rankCandidates,
  buildRecommendationReason,
  suggestQueryFor,
  searchMarketplacePlugins,
  searchStorePlugins,
  formatStoreResult,
  parseInstallCommand,
  buildInstallArgs,
  buildInstallCommand,
  dshBinCandidates,
  resolveDshHome,
  profileDirsOf,
  matchReason,
  resolveProfileName,
  checkInstalled,
  runDshInstall,
  installCapability,
  CURATED_CAPABILITIES,
  dispatchMissingCapabilities,
  RECIPES,
  findRecipesByGoal,
  getRecipe,
  recipeCatalog,
  ACCEPTANCE_PROTOCOL_VERSION,
  validateVerificationChecks,
  validateQualityBar,
  formatProtocolErrors,
  validateRecipeProtocol,
  resolveCapabilities,
  resolveAnswers,
  STRATEGY_OPTIONS,
  planExecution,
  formatStrategyOptions,
  clarifyStatus,
  formatClarify,
  probeDshVerify,
  runBrowserAcceptance,
  verifyChecks,
  formatVerification,
  matchesSimplePatternForTest,
  hashGoal,
  writeEvidence,
  nextStepsFor,
  workflowNextSteps,
  appendMissingNotice,
  runWorkflow,
  collectWorkflowArtifacts,
  formatDeliveryReview,
  formatMingResult,
  registerMingAutoTool
};
