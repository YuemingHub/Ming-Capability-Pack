/**
 * 证据收集器
 *
 * 把一次任务的完整过程写成可追溯的证据卡（JSON），落盘到工作区的 ming-evidence/。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExecutionOutcome } from '../types.js'

export interface EvidencePayload {
  goal: string
  resources: string[]
  outcome: ExecutionOutcome
}

export interface EvidenceFile {
  path: string
  id: string
}

export async function writeEvidence(payload: EvidencePayload): Promise<EvidenceFile> {
  const dir = join(process.cwd(), 'ming-evidence')
  await mkdir(dir, { recursive: true })

  const id = `evidence-${Date.now()}`
  const card = {
    id,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  const filepath = join(dir, `${id}.json`)
  await writeFile(filepath, JSON.stringify(card, null, 2), 'utf-8')

  return { path: filepath, id }
}
