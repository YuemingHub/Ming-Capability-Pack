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
async function execute(ctx, goal, resources, exec) {
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
    return executeViaSubagent(subagents, provider, goal, resources, exec, startedAt);
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
async function executeViaSubagent(subagents, provider, goal, resources, exec, startedAt) {
  const workdir = resolveWorkdir(exec);
  const prompt = buildPrompt(goal, resources, workdir);
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
function buildPrompt(goal, resources, workdir) {
  const lines = [
    "\u4F60\u662F Ming \u7684\u6267\u884C\u52A9\u624B\u3002\u8BF7\u5B8C\u6574\u5730\u5B8C\u6210\u4E0B\u9762\u7684\u4EFB\u52A1\uFF0C\u5E76\u4EA7\u51FA\u771F\u5B9E\u7ED3\u679C\uFF08\u6587\u4EF6\u3001\u811A\u672C\u3001\u7F51\u9875\u7B49\uFF09\uFF0C\u4E0D\u8981\u53EA\u7ED9\u5EFA\u8BAE\u3002",
    "\u4F60\u53EF\u4EE5\u4F7F\u7528\u53EF\u7528\u7684\u5DE5\u5177\uFF08\u8BFB\u5199\u6587\u4EF6\u3001\u6267\u884C\u547D\u4EE4\u3001\u5B50\u4EE3\u7406\u7B49\uFF09\u6765\u5B8C\u6210\u5B83\u3002",
    "\u91CD\u8981\uFF1A\u4F60\u6B63\u5728\u6267\u884C\u4E00\u4E2A\u88AB\u59D4\u6D3E\u7684\u5177\u4F53\u4EFB\u52A1\uFF0C\u76F4\u63A5\u5B8C\u6210\u5B83\uFF1B\u4E0D\u8981\u8C03\u7528 ming_auto \u5DE5\u5177\uFF0C\u4E5F\u4E0D\u8981\u518D\u6B21\u628A\u4EFB\u52A1\u8F6C\u4EA4\u4ED6\u4EBA\u3002",
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

export {
  resolveTimeoutMs,
  looksLikeLocalPath,
  resolveWorkdir,
  execute,
  extractArtifacts,
  kindFromStopReason,
  stopReasonText,
  nextStepsFor,
  appendMissingNotice
};
