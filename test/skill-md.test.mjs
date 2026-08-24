import test from 'node:test'
import assert from 'node:assert/strict'
import { exportRecipeToSkillMd, RECIPES, getRecipe } from '../dist/internals.js'

test('SKILL.md frontmatter：只有 name + description 两个必填字段', () => {
  const md = exportRecipeToSkillMd(getRecipe('tidy-downloads'))
  assert.match(md, /^---\nname: tidy-downloads\ndescription: .+\n---/)
  // frontmatter 里不混入多余字段（保持标准最小形态，跨宿主兼容）
  assert.doesNotMatch(md, /^name: tidy-downloads\n(?:(?!description).)*\n---/ms)
})

test('SKILL.md 正文：执行指引 / 质量门槛 / 自查清单 / 验收断言 齐全', () => {
  const md = exportRecipeToSkillMd(getRecipe('tidy-downloads'))
  assert.match(md, /## 何时使用/)
  assert.match(md, /整理.*归档/)          // description 内容
  assert.match(md, /## 执行指引/)
  assert.match(md, /先扫描目标目录/)
  assert.match(md, /## 质量门槛/)
  assert.match(md, /分类规则合理/)
  assert.match(md, /## 交付前自查/)
  assert.match(md, /随机抽 3 个文件/)
  assert.match(md, /## 验收断言/)
  assert.match(md, /检查目录/)
})

test('SKILL.md 能力要求：来源与可选性如实标注', () => {
  const md = exportRecipeToSkillMd(getRecipe('html-report'))
  assert.match(md, /## 能力要求/)
  assert.match(md, /excel_read：读取 Excel\/表格数据/)
  assert.match(md, /来源 dsh-univer-office/)
  assert.match(md, /可选/)
})

test('SKILL.md 对精简方案（无质量门槛）也能生成且不崩', () => {
  const html = exportRecipeToSkillMd(getRecipe('html-report'))
  assert.ok(html.length > 100)
  // 全部内置方案都能导出，无缺失字段导致的异常
  for (const recipe of RECIPES) {
    const out = exportRecipeToSkillMd(recipe)
    assert.match(out, /^---\nname: .+\ndescription: .+\n---/)
  }
})

test('SKILL.md 是可独立加载的 markdown：frontmatter 后可被解析', () => {
  const md = exportRecipeToSkillMd(getRecipe('publish-site'))
  const frontmatter = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  assert.match(frontmatter, /name: publish-site/)
  assert.match(frontmatter, /description: /)
})
