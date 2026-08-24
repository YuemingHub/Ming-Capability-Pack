/**
 * 方案包 → Agent Skills（SKILL.md）出口
 *
 * 把 Ming 的内置方案包（Recipe）导出为跨宿主标准的 Agent Skill（SKILL.md）：
 * 一个文件夹 + SKILL.md（frontmatter name/description + 指令 + 资源），
 * Claude Code / Codex / Gemini CLI 等都能直接加载。
 *
 * 为什么做（不重复造轮子）：技能包载体生态已有事实标准（agentskills.io），
 * 方案包不该锁死在私有格式里；对齐标准后，Ming 策展的方案可以一键导出、
 * 在任何支持 Agent Skills 的宿主里复用。内部匹配规则（triggers）、验收断言
 * （verification）、质量门槛（qualityBar）是 Ming 的独有资产，保留在 Recipe 内部；
 * 本模块只负责把它们表达成标准 SKILL.md 的「指令 + 自查」形态。
 */

import type { Recipe } from './types.js'

/** 把一条执行/自查要求转成 markdown 列表项（自动补序号与缩进，防止换行破坏列表） */
function toListItems(lines: string[]): string {
  if (!lines || lines.length === 0) return ''
  return lines.map((l) => {
    const trimmed = l.trim()
    // 已带列表符号的行保留原样，其余补 `- `
    return trimmed.startsWith('-') || trimmed.startsWith('*')
      ? trimmed
      : `- ${trimmed}`
  }).join('\n')
}

/** 把验收断言描述成人话（与 verifier.describeCheck 语义一致，独立实现避免跨模块耦合） */
function describeVerification(check: { kind: string; pattern?: string; contains?: string; mustNotContain?: string; spec?: string }): string {
  switch (check.kind) {
    case 'file_exists':
      return `检查文件「${check.pattern}」存在`
    case 'content_match':
      return `检查「${check.pattern}」包含「${check.contains}」`
    case 'content_absent':
      return `检查「${check.pattern}」不含「${check.mustNotContain}」`
    case 'dir_nonempty':
      return `检查目录「${check.pattern}」非空`
    case 'browser_acceptance':
      return `用真实浏览器验收「${check.spec}」（dsh-verify，PASS/FAIL）`
    default:
      return `断言「${(check as { kind: string }).kind}」`
  }
}

/**
 * 把方案包导出为标准 SKILL.md 文本。
 * 纯函数、零副作用；不修改 Recipe。frontmatter 只含规范最小必填
 * （name + description），正文按「何时使用 / 执行指引 / 能力要求 /
 * 质量门槛 / 交付前自查 / 验收断言」组织，便于任意 agent 直接消费。
 */
export function exportRecipeToSkillMd(recipe: Recipe): string {
  const name = recipe.id
  const description = `${recipe.description}（适用：${recipe.triggers.slice(0, 8).join('、')}）`

  const sections: string[] = [
    `# ${recipe.name}`,
    '',
    '## 何时使用',
    `当用户提出以下方向的需求时使用本方案：${recipe.triggers.join('、')}。`,
    '',
  ]

  if (recipe.guidance && recipe.guidance.length > 0) {
    sections.push('## 执行指引', toListItems(recipe.guidance), '')
  }

  if (recipe.capabilities && recipe.capabilities.length > 0) {
    sections.push(
      '## 能力要求',
      toListItems(recipe.capabilities.map(c =>
        c.source
          ? `（${c.kind}）${c.id}：${c.purpose}（来源 ${c.source}${c.optional ? '，可选' : ''}）`
          : `（${c.kind}）${c.id}：${c.purpose}${c.optional ? '（可选）' : ''}`,
      )),
      '',
    )
  }

  if (recipe.qualityBar) {
    sections.push('## 质量门槛（第一轮交付就达到）', recipe.qualityBar.bar, '')
    sections.push(toListItems(recipe.qualityBar.checks), '')
    if (recipe.qualityBar.selfCheck && recipe.qualityBar.selfCheck.length > 0) {
      sections.push('## 交付前自查（全过再汇报完成）', toListItems(recipe.qualityBar.selfCheck), '')
    }
  }

  if (recipe.verification && recipe.verification.length > 0) {
    sections.push('## 验收断言（完成后独立检查）', toListItems(recipe.verification.map(describeVerification)), '')
  }

  const body = sections.join('\n').replace(/\n{3,}/gu, '\n\n').trim()
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`
}
