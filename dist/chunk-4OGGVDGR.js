// src/capabilities/assembler.ts
function assembleContext(plan, answers) {
  const lines = [];
  lines.push(
    "\u3010\u6267\u884C\u603B\u539F\u5219\u3011\u7528\u6237\u4E0D\u662F\u6280\u672F\u4EBA\u5458\u3002\u5B9A\u4F4D/\u8BFB\u53D6\u7528\u6237\u6587\u4EF6\u3001\u68C0\u67E5\u73AF\u5883\u3001\u627E\u7D20\u6750\u8FD9\u7C7B\u64CD\u4F5C\uFF0C\u5148\u7528\u73B0\u6709\u5DE5\u5177\u81EA\u5DF1\u5B8C\u6210\uFF08\u6587\u4EF6\u641C\u7D22\u3001\u76EE\u5F55\u6D4F\u89C8\u3001\u8BFB\u53D6\u5E38\u89C1\u6587\u6863\u683C\u5F0F\uFF09\uFF1B\u4E0D\u8981\u6559\u7528\u6237\u505A\u6280\u672F\u64CD\u4F5C\uFF08\u5982\u627E\u6587\u4EF6\u8DEF\u5F84\u3001\u590D\u5236\u7C98\u8D34\u5185\u5BB9\u3001\u4E0A\u4F20\u6587\u4EF6\u3001\u6572\u547D\u4EE4\uFF09\u3002\u53EA\u6709\u5F53\u81EA\u5DF1\u786E\u5B9E\u627E\u4E0D\u5230\u6240\u9700\u7D20\u6750\u65F6\u624D\u95EE\u7528\u6237\u4E00\u6B21\uFF0C\u4E14\u53EA\u9700\u4E00\u53E5\u8BDD\u7ED9\u51FA\u5927\u6982\u4F4D\u7F6E\u5373\u53EF\u3002"
  );
  if (plan.recipeName) {
    lines.push(`\u3010\u672C\u6B21\u88C5\u914D\u65B9\u6848\u3011${plan.recipeName}\uFF08\u547D\u4E2D\u65B9\u5F0F\uFF1A${plan.matchedBy}\uFF09`);
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
      "\u7D20\u6750\u83B7\u53D6\uFF1A\u7528\u6237\u63D0\u5230\u300C\u6587\u6863/\u6570\u636E/\u6587\u4EF6/\u4E0A\u4F20\u300D\u65F6\uFF0C\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u81EA\u5DF1\u5B9A\u4F4D\u5E76\u8BFB\u53D6\u6570\u636E\u6587\u4EF6\uFF08.xlsx/.csv/.md/.txt \u7B49\uFF09\uFF0C\u4E0D\u8981\u6559\u7528\u6237\u627E\u8DEF\u5F84\u6216\u590D\u5236\u7C98\u8D34\uFF1B\u8BFB\u4E0D\u4E86\u5C31\u5982\u5B9E\u8BF4\u660E\u7F3A\u4EC0\u4E48\u89E3\u6790\u80FD\u529B\uFF0C\u786E\u5B9E\u627E\u4E0D\u5230\u65F6\u6700\u591A\u95EE\u4E00\u6B21\u7528\u6237\u5927\u6982\u4F4D\u7F6E",
      "\u5B8C\u6210\u540E\u7ED9\u51FA\u6587\u4EF6\u7684\u7EDD\u5BF9\u8DEF\u5F84\u548C\u6253\u5F00\u65B9\u5F0F"
    ],
    capabilities: [
      { kind: "tool", id: "fs_*", purpose: "\u8BFB\u5199\u6570\u636E\u4E0E\u4EA7\u51FA\u6587\u4EF6", trust: "official" },
      {
        kind: "tool",
        id: "excel_read",
        source: "dsh-office-tools",
        purpose: "\u8BFB\u53D6 Excel \u6570\u636E\uFF08\u5DF2\u88C5\u793E\u533A\u63D2\u4EF6\u63D0\u4F9B\uFF09",
        trust: "community",
        optional: true
      }
    ],
    delegate: { provider: "spawn" },
    verification: [
      { kind: "file_exists", pattern: "*.html", note: "\u5E94\u4EA7\u51FA HTML \u6587\u4EF6" },
      { kind: "content_match", pattern: "*.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
    ]
  },
  {
    id: "personal-site",
    name: "\u642D\u5EFA\u4E2A\u4EBA\u7F51\u7AD9/\u4E3B\u9875",
    description: "\u4ECE\u96F6\u505A\u4E00\u4E2A\u80FD\u6253\u5F00\u6D4F\u89C8\u7684\u4E2A\u4EBA\u7F51\u7AD9\uFF08\u4E2A\u4EBA\u4ECB\u7ECD\u3001\u4F5C\u54C1\u96C6\u3001\u535A\u5BA2\u7B49\uFF09\uFF0C\u9759\u6001\u4F18\u5148\uFF0C\u6253\u5F00\u5373\u7528",
    triggers: ["\u4E2A\u4EBA\u7F51\u7AD9", "\u4E2A\u4EBA\u4E3B\u9875", "\u4E2A\u4EBA\u535A\u5BA2", "\u4E2A\u4EBA\u7AD9\u70B9", "\u4F5C\u54C1\u96C6", "portfolio", "\u4E3B\u9875", "\u843D\u5730\u9875", "\u505A\u7F51\u7AD9", "\u5EFA\u7AD9"],
    guidance: [
      "\u5148\u6309\u7528\u6237\u786E\u8BA4\u7684\u4E3B\u9898\u4E0E\u89C6\u89C9\u98CE\u683C\u642D\u5EFA\u7AD9\u70B9\u9AA8\u67B6\uFF0C\u4EA7\u51FA\u53EF\u76F4\u63A5\u5728\u6D4F\u89C8\u5668\u6253\u5F00\u7684\u6587\u4EF6",
      "\u7EAF\u9759\u6001\u4F18\u5148\uFF08HTML/CSS/JS\uFF09\uFF0C\u4E0D\u8981\u5F15\u5165\u9700\u8981\u6784\u5EFA\u6216\u90E8\u7F72\u624D\u80FD\u770B\u7684\u6548\u679C\uFF1B\u79FB\u52A8\u7AEF\u4E5F\u8981\u80FD\u770B",
      "\u5185\u5BB9\u5148\u7528\u5360\u4F4D/\u793A\u4F8B\uFF0C\u7ED3\u6784\u5B8C\u6574\u3001\u53EF\u70B9\u51FB\u5BFC\u822A\uFF1B\u5B8C\u6210\u540E\u7ED9\u51FA\u9996\u9875\u7EDD\u5BF9\u8DEF\u5F84\u4E0E\u6253\u5F00\u65B9\u5F0F"
    ],
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
        translate: "\u7528\u6237\u8BF4\u300C\u5148\u770B\u770B/\u5148\u505A\u4E2A\u80FD\u770B\u7684/\u968F\u4FBF\u5148\u5F04\u300D\u2192 \u7528\u9ED8\u8BA4\uFF08\u9996\u9875 + 2~3 \u4E2A\u5185\u9875\uFF09\uFF0C\u5185\u5BB9\u5360\u4F4D\u540E\u8FED\u4EE3\uFF1B\u300C\u5168\u90E8/\u5B8C\u6574/\u6B63\u5F0F\u300D\u2192 \u5B8C\u6574\u7AD9\u70B9\u7ED3\u6784\uFF1B\u300C\u53EA\u8981\u4E00\u9875/\u5355\u9875\u300D\u2192 \u5355\u9875\u843D\u5730\u3002"
      }
    ],
    verification: [
      { kind: "file_exists", pattern: "index.html", note: "\u5E94\u6709\u9996\u9875 index.html" },
      { kind: "content_match", pattern: "index.html", contains: "<html", note: "\u5E94\u4E3A\u6709\u6548 HTML \u6587\u6863" }
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
        purpose: "\u89C6\u89C9\u81EA\u68C0\uFF08\u53EF\u9009\uFF0C\u5DF2\u88C5\u793E\u533A\u63D2\u4EF6\u63D0\u4F9B\uFF09",
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
    ]
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
        source: "dsh-office-tools",
        purpose: "\u751F\u6210 .pptx\uFF08\u5DF2\u88C5\u793E\u533A\u63D2\u4EF6\u63D0\u4F9B\uFF09",
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
    ]
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
            source: "dsh-deploy-tools",
            purpose: "\u628A\u9759\u6001\u7F51\u7AD9\u53D1\u5E03\u5230\u516C\u5F00\u5730\u5740",
            trust: "community"
          }
        ],
        verification: [
          { kind: "file_exists", pattern: "*.html", note: "\u53D1\u5E03\u5185\u5BB9\u5E94\u5305\u542B HTML \u9875\u9762" }
        ],
        pitfalls: [
          { symptom: "\u6CA1\u6709\u53D1\u5E03/\u90E8\u7F72\u80FD\u529B\uFF08\u672A\u88C5\u914D publish_deploy\uFF09", fix: "\u6309\u6307\u5F15\u8D70 ming_install \u88C5\u914D\u95ED\u73AF\uFF1A\u641C\u7D22\u5019\u9009\u7ED9\u7528\u6237\u9009\u2192\u5B89\u88C5\u2192\u91CD\u542F\u2192\u4ECE\u53D1\u5E03\u6B65\u7EE7\u7EED" },
          { symptom: "\u53D1\u5E03\u540E\u94FE\u63A5\u6253\u4E0D\u5F00", fix: "\u68C0\u67E5\u662F\u5426\u771F\u7684\u4E0A\u4F20\u4E86 index.html\uFF1B\u514D\u8D39\u6258\u7BA1\u9996\u6B21\u751F\u6548\u53EF\u80FD\u9700\u7B49 1~2 \u5206\u949F" }
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
async function probeCapabilities(ctx, refs) {
  const out = [];
  for (const ref of refs) {
    out.push(await probeCapability(ctx, ref));
  }
  return out;
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
    questions: recipe.questions,
    workflow: recipe.workflow,
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
    label: "\u5148\u8DD1\u4E00\u4E2A\u80FD\u770B\u7684 MVP",
    description: "\u4E0D\u6253\u65AD\u4F60\uFF0C\u76F4\u63A5\u7528\u5408\u7406\u9ED8\u8BA4\u503C\u505A\u51FA\u6765\uFF0C\u4F60\u770B\u5B8C\u518D\u63D0\u4FEE\u6539",
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

// src/capabilities/recommend.ts
function tokensOf(text) {
  return (text ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).map((t) => t.trim()).filter((t) => t.length >= 2 && !/^\d+$/u.test(t));
}
function rankCandidates(candidates, ctx, textOf, signalOf) {
  const queryTokens = [...new Set(tokensOf(ctx.query ?? ""))];
  const scenarioTerms = (ctx.scenario ?? []).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2);
  const scored = candidates.map((candidate) => {
    const text = (textOf(candidate) ?? "").toLowerCase();
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
function workflowNextSteps(result, answers) {
  const steps = [];
  if (result.failureKind === "capability-missing") {
    const blocked = result.stepResults.find((r) => r.blockedBy);
    if (blocked?.blockedBy) {
      const ref = blocked.blockedBy.ref;
      const q = suggestQueryFor(ref.purpose, ref.id);
      const answersText = answers && Object.keys(answers).length > 0 ? `\uFF0Canswers=${JSON.stringify(answers)}` : "";
      steps.push(`\u8C03\u7528 ming_install\uFF08mode=search\uFF0Cquery=\u300C${q}\u300D\uFF0Cpurpose=\u300C${ref.purpose ?? ""}\u300D${answersText}\uFF09\u641C\u7D22\u66FF\u4EE3\u63D2\u4EF6\uFF0C\u5019\u9009\u6309\u4F60\u7684\u9700\u6C42\u6392\u597D\u5E8F\u5C55\u793A\u7ED9\u4F60\u9009`);
      steps.push(`\u7528\u6237\u9009\u5B9A\u540E\u5B89\u88C5\uFF0C\u91CD\u542F DSH\uFF0C\u7136\u540E\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u300D\uFF0C\u628A workflowFrom=${blocked.step.id} \u4F20\u7ED9 ming_auto \u4ECE\u5931\u8D25\u6B65\u7EE7\u7EED\uFF08\u524D\u9762\u5DF2\u5B8C\u6210\uFF0C\u4E0D\u91CD\u505A\uFF09`);
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
  let reachedFrom = !fromId;
  for (const step of steps) {
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
        stepResults.push({ step, skipped: false, blockedBy: missing });
        return {
          success: false,
          failedStepId: step.id,
          failureKind: "capability-missing",
          stepResults,
          pitfalls: step.pitfalls,
          summary: `\u6B65\u9AA4\u300C${step.name}\u300D\u9700\u8981\u80FD\u529B\u300C${missing.ref.kind}:${missing.ref.id}\u300D\uFF08${missing.ref.purpose ?? ""}\uFF09\u4F46\u672C\u673A\u672A\u88C5\u914D\uFF0C\u672A\u6267\u884C\u3002\u8BF7\u5148\u88C5\u914D\u8BE5\u80FD\u529B\u3002`,
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

// src/services/installer.ts
import { spawn } from "child_process";
import { access, readFile as readFile2, readdir as readdir2 } from "fs/promises";
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
      const entries = await readdir2(profilesDir, { withFileTypes: true });
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

export {
  assembleContext,
  RECIPES,
  findRecipesByGoal,
  getRecipe,
  recipeCatalog,
  resolveCapabilities,
  resolveAnswers,
  STRATEGY_OPTIONS,
  planExecution,
  formatStrategyOptions,
  clarifyStatus,
  formatClarify,
  tokensOf,
  rankCandidates,
  buildRecommendationReason,
  suggestQueryFor,
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
  workflowNextSteps,
  appendMissingNotice,
  runWorkflow,
  collectWorkflowArtifacts,
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
  installCapability
};
