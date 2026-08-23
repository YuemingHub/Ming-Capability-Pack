import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ACCEPTANCE_PROTOCOL_VERSION, hashGoal, writeEvidence } from '../dist/internals.js'

// ---------- hashGoal（provenance 溯源） ----------

test('hashGoal 输出 64 位十六进制 SHA-256', () => {
  const hash = hashGoal('帮我做个个人网站')
  assert.match(hash, /^[0-9a-f]{64}$/)
})

test('hashGoal 相同目标输出相同哈希', () => {
  assert.equal(hashGoal('同一个目标'), hashGoal('同一个目标'))
})

test('hashGoal 不同目标输出不同哈希', () => {
  assert.notEqual(hashGoal('目标 A'), hashGoal('目标 B'))
})

// ---------- writeEvidence 落盘（含 provenance 字段） ----------

test('证据卡落盘包含 provenance 溯源字段与协议版本', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ming-evidence-'))
  try {
    const file = await writeEvidence({
      goal: '测试目标',
      resources: [],
      outcome: { mode: 'executed', success: true, summary: 'ok', artifacts: [] },
      workdir: dir,
      provenance: { source: 'auto', goalHash: hashGoal('测试目标'), recipeId: 'personal-site' },
    })
    assert.match(file.path, /ming-evidence[\\/]evidence-.*\.json$/)
    const raw = await readFile(file.path, 'utf-8')
    const card = JSON.parse(raw)
    assert.equal(card.acceptanceProtocolVersion, 1)
    assert.equal(card.provenance.source, 'auto')
    assert.equal(card.provenance.recipeId, 'personal-site')
    assert.match(card.provenance.goalHash, /^[0-9a-f]{64}$/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
