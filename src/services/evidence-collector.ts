/**
 * 证据收集器
 *
 * 把一次任务的完整过程写成可追溯的证据卡（JSON），落盘到工作区的 ming-evidence/。
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ACCEPTANCE_PROTOCOL_VERSION } from '../capabilities/protocol.js'
import type { ExecutionOutcome } from '../types.js'

/** 计算目标内容的 SHA-256 指纹（溯源用：检测目标被外部注入篡改） */
export function hashGoal(goal: string): string {
  return createHash('sha256').update(goal, 'utf-8').digest('hex')
}

export interface EvidencePayload {
  goal: string
  resources: string[]
  outcome: ExecutionOutcome
  /** 证据卡落盘目录（会话工作区，而非进程 cwd） */
  workdir: string
  /** 命中的方案信息（能力织机） */
  recipe?: { id: string | null; name: string | null; matchedBy: string; capabilities: unknown[] }
  /** 独立验证结果（能力织机） */
  verification?: { passed: number; failed: number; results: unknown[] }
  /** 溯源（provenance）：谁发起、目标指纹，供审计注入来源与追溯（OWASP 2026 方向） */
  provenance?: {
    /** 发起方：user 直接发起 / auto 自动触发 / plan 规划后执行 */
    source: 'user' | 'auto' | 'plan'
    /** 用户目标内容的 SHA-256 指纹（检测目标被外部注入篡改） */
    goalHash: string
    /** 命中的方案 id（若有） */
    recipeId?: string | null
  }
}

export interface EvidenceFile {
  path: string
  id: string
}

export async function writeEvidence(payload: EvidencePayload): Promise<EvidenceFile> {
  const dir = join(payload.workdir, 'ming-evidence')
  await mkdir(dir, { recursive: true })

  const id = `evidence-${Date.now()}`
  const card = {
    id,
    schemaVersion: 1,
    /** 本次任务使用的验收协议版本（供未来协议演进时历史迁移） */
    acceptanceProtocolVersion: ACCEPTANCE_PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  const filepath = join(dir, `${id}.json`)
  await writeFile(filepath, JSON.stringify(card, null, 2), 'utf-8')

  return { path: filepath, id }
}
