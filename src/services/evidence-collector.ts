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
  /** 证据卡落盘目录（会话工作区，而非进程 cwd） */
  workdir: string
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
    timestamp: new Date().toISOString(),
    ...payload,
  }

  const filepath = join(dir, `${id}.json`)
  await writeFile(filepath, JSON.stringify(card, null, 2), 'utf-8')

  return { path: filepath, id }
}
