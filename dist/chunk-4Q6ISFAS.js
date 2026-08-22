// src/capabilities/assembler.ts
function assembleContext(plan) {
  const lines = [];
  if (plan.recipeName) {
    lines.push(`\u3010\u672C\u6B21\u88C5\u914D\u65B9\u6848\u3011${plan.recipeName}\uFF08\u547D\u4E2D\u65B9\u5F0F\uFF1A${plan.matchedBy}\uFF09`);
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
    ]
  },
  {
    id: "html-report",
    name: "\u751F\u6210\u56FE\u6587 HTML \u62A5\u8868",
    description: "\u628A\u6570\u636E\u6574\u7406\u6210\u4E00\u4EFD\u53EF\u6253\u5F00\u67E5\u770B\u7684 HTML \u62A5\u8868\uFF08\u542B\u8868\u683C/\u6837\u5F0F\uFF0C\u53CC\u51FB\u5373\u7528\uFF09",
    triggers: ["\u62A5\u8868", "\u5468\u62A5", "\u6708\u62A5", "\u62A5\u544A", "\u6C47\u62A5", "html", "\u7F51\u9875", "\u56FE\u8868", "\u53EF\u89C6\u5316", "dashboard"],
    guidance: [
      "\u4EA7\u51FA\u5355\u6587\u4EF6 HTML\uFF08\u5185\u8054 CSS\uFF0C\u907F\u514D\u5916\u90E8\u4F9D\u8D56\uFF09\uFF0C\u53CC\u51FB\u5373\u53EF\u5728\u6D4F\u89C8\u5668\u6253\u5F00",
      "\u6570\u636E\u5728\u672C\u5730\u6587\u4EF6\u91CC\u5C31\u5148\u8BFB\u53D6\u518D\u6574\u7406\u6210\u8868\u683C\uFF1B\u56FE\u8868\u7528\u7EAF HTML/CSS \u6216\u8F7B\u91CF\u5185\u8054\u65B9\u5F0F\u5B9E\u73B0",
      "\u5B8C\u6210\u540E\u7ED9\u51FA\u6587\u4EF6\u7684\u7EDD\u5BF9\u8DEF\u5F84\u548C\u6253\u5F00\u65B9\u5F0F"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u8BFB\u5199\u6570\u636E\u4E0E\u4EA7\u51FA\u6587\u4EF6", trust: "official" }
    ],
    delegate: { provider: "spawn" },
    verification: [
      { kind: "file_exists", pattern: "*.html", note: "\u5E94\u4EA7\u51FA HTML \u6587\u4EF6" },
      { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
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

// src/capabilities/types.ts
var DEFAULT_DELEGATE = { provider: "spawn" };

// src/capabilities/resolver.ts
var WILDCARD_TOOL = /^\w+\*$/;
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
function planFromRecipe(goal, recipe, matchedBy, capabilities) {
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
  candidates.sort((a, b) => b.hits.length - a.hits.length);
  const { recipe, hits } = candidates[0];
  const capabilities = [];
  for (const ref of recipe.capabilities) {
    capabilities.push(await probeCapability(ctx, ref));
  }
  return planFromRecipe(input.goal, recipe, `rules:${hits.join("\u3001")}`, capabilities);
}

// src/capabilities/verifier.ts
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
async function expandPattern(workdir, pattern, signal) {
  const trimmed = pattern.trim();
  const recursive = trimmed.startsWith("**/");
  const base = trimmed.replace(/^\*?\*\//, "");
  const results = [];
  const walk = async (dir, depth) => {
    signal?.throwIfAborted();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
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
async function verifyOne(check, workdir, signal) {
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
          const content = await readFile(file, "utf-8");
          if (content.includes(check.contains)) hits.push(file);
        } catch {
        }
      }
      if (hits.length === 0) {
        return { check, passed: false, detail: `\u5339\u914D\u7684\u6587\u4EF6\u4E2D\u5747\u672A\u5305\u542B\u300C${check.contains}\u300D` };
      }
      return { check, passed: true, detail: `${hits.length} \u4E2A\u6587\u4EF6\u5305\u542B\u300C${check.contains}\u300D\uFF1A${hits.join("\u3001")}` };
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
    results.push(await verifyOne(check, workdir, signal));
  }
  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results
  };
}
function formatVerification(summary) {
  if (summary.results.length === 0) return "";
  const lines = summary.results.map((r) => `${r.passed ? "\u2705" : "\u274C"} ${describeCheck(r.check)}\uFF1A${r.detail}`);
  return `\u3010\u72EC\u7ACB\u9A8C\u8BC1\u3011\u901A\u8FC7 ${summary.passed} / ${summary.failed + summary.passed}
${lines.join("\n")}`;
}
function describeCheck(check) {
  switch (check.kind) {
    case "file_exists":
      return `\u68C0\u67E5\u6587\u4EF6\u300C${check.pattern}\u300D\u5B58\u5728`;
    case "content_match":
      return `\u68C0\u67E5\u300C${check.pattern}\u300D\u5305\u542B\u300C${check.contains}\u300D`;
    case "dir_nonempty":
      return `\u68C0\u67E5\u76EE\u5F55\u300C${check.pattern}\u300D\u975E\u7A7A`;
  }
}
function matchesSimplePatternForTest(relPath, base) {
  return matchesSimplePattern(relPath, base);
}

// src/services/executor.ts
import { stat as stat2 } from "fs/promises";
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
    await stat2(toAbsolute(rawPath, workdir));
    return true;
  } catch {
    return false;
  }
}
async function verifyArtifacts(candidates, workdir) {
  return Promise.all(candidates.map((candidate) => verifyOne2(candidate, workdir)));
}
async function verifyOne2(raw, workdir) {
  if (isUrl(raw)) return { raw, kind: "url" };
  try {
    const info = await stat2(toAbsolute(raw, workdir));
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
function appendMissingNotice(outcome) {
  const missing = (outcome.artifactChecks ?? []).filter((c) => c.kind === "missing");
  if (!outcome.success || missing.length === 0) return outcome.summary;
  const lines = missing.map((m) => `  - ${m.raw}`);
  return `${outcome.summary}

\u26A0\uFE0F \u6821\u9A8C\u63D0\u9192\uFF1A\u4EE5\u4E0B\u6C47\u62A5\u4E2D\u7684\u8DEF\u5F84\u5728\u672C\u5730\u672A\u627E\u5230\uFF0C\u8BF7\u4EE5\u5B9E\u9645\u78C1\u76D8\u4E3A\u51C6\uFF1A
${lines.join("\n")}`;
}

// src/capabilities/store.ts
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
  if (!result.ok) return `1024Store \u67E5\u8BE2\u5931\u8D25\uFF1A${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`;
  if (result.plugins.length === 0) {
    return `1024Store \u6CA1\u6709\u627E\u5230\u4E0E\u300C${result.query}\u300D\u76F8\u5173\u7684\u63D2\u4EF6\uFF08\u5171 ${result.total ?? 0} \u6761\u5339\u914D\u4F46\u5747\u88AB\u8FC7\u6EE4\uFF09\u3002`;
  }
  const lines = [`1024Store \u641C\u300C${result.query}\u300D\u547D\u4E2D ${result.total ?? result.plugins.length} \u4E2A\u63D2\u4EF6\uFF08\u5C55\u793A\u524D ${Math.min(max, result.plugins.length)}\uFF09\uFF1A`, ""];
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

export {
  assembleContext,
  RECIPES,
  findRecipesByGoal,
  getRecipe,
  recipeCatalog,
  resolveCapabilities,
  verifyChecks,
  formatVerification,
  matchesSimplePatternForTest,
  resolveTimeoutMs,
  looksLikeLocalPath,
  resolveWorkdir,
  execute,
  extractArtifacts,
  kindFromStopReason,
  stopReasonText,
  nextStepsFor,
  appendMissingNotice,
  searchStorePlugins,
  formatStoreResult
};
