// W-56 · R-CC-1 单写者租约（[RUNTIME] · r630-10 bun 运行期实测通过：单写者租约 lease_denied 事件已产）
// per-worktree 租约文件：O_CREAT|O_EXCL 原子创建 + TTL 心跳 + 归属 agent_uid；仅持锁者可写。
// 判据（方案 §20.2 R-CC-1）：两实例同时申请 ⇒ 恰一个成功，另一个 OLO_LEASE_HELD 并留事件。
// 失败封闭（fail-closed）：无锁 / 他持锁 / 过期未续约 ⇒ 写操作被拒（由 guard.ts R-CC-2 门执行）。
// 运行期接线已落：direct-exec.ts 写前持锁（rccAuthorizeBeforeExec，r630-10 实测通过）；pre-commit 钩子在 commit 前持锁（本轮已接 .husky/pre-commit）。
import { openSync, writeSync, closeSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, appendFileSync } from "node:fs"
import { dirname } from "node:path"

export const OLO_LEASE_HELD = "OLO_LEASE_HELD" as const
export const OLO_LEASE_EXPIRED = "OLO_LEASE_EXPIRED" as const
export const OLO_LEASE_NOT_HELD = "OLO_LEASE_NOT_HELD" as const

export interface LeaseRecord {
  agent_uid: string
  worktree: string
  acquired_at: number
  last_heartbeat: number
  ttl_ms: number
}

export type LeaseEventType =
  | "lease_acquire"
  | "lease_denied"
  | "lease_released"
  | "lease_expired"
  | "lease_renew"
  | "lease_reclaim"
  | "staging_violation"

export interface LeaseEvent {
  type: LeaseEventType
  agent_uid: string
  worktree: string
  at: number
  detail?: string
}

export type LeaseEventSink = (e: LeaseEvent) => void

export interface LeaseStatus {
  held: boolean
  owner?: string
  worktree?: string
  expired?: boolean
  expired_by_ms?: number
}

export interface LeaseOptions {
  leasePath: string
  agentUid: string
  worktree: string
  ttlMs?: number
  now?: () => number
  emit?: LeaseEventSink
}

const DEFAULT_TTL_MS = 30_000

// 默认事件汇：运行时追加到租约同目录 lease.events.jsonl；测试注入记忆汇覆盖。
function defaultSink(leasePath: string): LeaseEventSink {
  const eventsPath = `${dirname(leasePath)}/lease.events.jsonl`
  return (e) => {
    try {
      appendFileSync(eventsPath, JSON.stringify(e) + "\n", "utf8")
    } catch {
      /* 事件落盘失败不得影响主流程（fail-closed 针对写操作，不针对事件汇本身） */
    }
  }
}

function readRecord(path: string): LeaseRecord | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LeaseRecord
  } catch {
    return null
  }
}

export function isExpired(rec: LeaseRecord, now: number): boolean {
  return now - rec.last_heartbeat > rec.ttl_ms
}

// 读取租约状态（非原子读；供 guard / status 查询）。
export function readLease(opts: { leasePath: string; now?: () => number }): LeaseStatus {
  const now = opts.now ? opts.now() : Date.now()
  const rec = readRecord(opts.leasePath)
  if (!rec) return { held: false }
  const expired = isExpired(rec, now)
  return {
    held: true,
    owner: rec.agent_uid,
    worktree: rec.worktree,
    expired,
    expired_by_ms: expired ? now - rec.last_heartbeat - rec.ttl_ms : 0,
  }
}

export interface ClaimResult {
  ok: boolean
  reclaimed?: boolean
  code?: string
  reason?: string
}

// 原子申请：O_CREAT|O_EXCL。
// - 文件不存在 ⇒ 创建并持有，ok:true。
// - 已存在且未过期且为他人 ⇒ 拒，OLO_LEASE_HELD + lease_denied 事件。
// - 已存在且过期（他人 TTL 心跳超时）⇒ 回收（覆盖写），登记 lease_expired + lease_reclaim，ok:true,reclaimed:true。
// - 已存在且为本 agent ⇒ 幂等续约，ok:true。
export function claimLease(opts: LeaseOptions): ClaimResult {
  const now = opts.now ? opts.now() : Date.now()
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS
  const emit = opts.emit ?? defaultSink(opts.leasePath)
  const rec: LeaseRecord = {
    agent_uid: opts.agentUid,
    worktree: opts.worktree,
    acquired_at: now,
    last_heartbeat: now,
    ttl_ms: ttl,
  }
  const dir = dirname(opts.leasePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  let fd: number
  try {
    fd = openSync(opts.leasePath, "wx") // O_CREAT | O_EXCL
  } catch (e: any) {
    if (e && e.code === "EEXIST") {
      const existing = readRecord(opts.leasePath)
      if (!existing) {
        emit({ type: "lease_denied", agent_uid: opts.agentUid, worktree: opts.worktree, at: now, detail: "race: record unreadable after EEXIST" })
        return { ok: false, code: OLO_LEASE_HELD, reason: "lease exists but record unreadable" }
      }
      if (isExpired(existing, now)) {
        emit({ type: "lease_expired", agent_uid: existing.agent_uid, worktree: existing.worktree, at: now, detail: `reclaimed by ${opts.agentUid}` })
        writeFileSync(opts.leasePath, JSON.stringify(rec), "utf8")
        emit({ type: "lease_reclaim", agent_uid: opts.agentUid, worktree: opts.worktree, at: now })
        return { ok: true, reclaimed: true }
      }
      if (existing.agent_uid === opts.agentUid) {
        writeFileSync(opts.leasePath, JSON.stringify({ ...existing, last_heartbeat: now }))
        emit({ type: "lease_renew", agent_uid: opts.agentUid, worktree: opts.worktree, at: now })
        return { ok: true }
      }
      emit({ type: "lease_denied", agent_uid: opts.agentUid, worktree: opts.worktree, at: now, detail: `held by ${existing.agent_uid}` })
      return { ok: false, code: OLO_LEASE_HELD, reason: `lease held by ${existing.agent_uid}` }
    }
    throw e
  }
  try {
    writeSync(fd, JSON.stringify(rec))
  } finally {
    closeSync(fd)
  }
  emit({ type: "lease_acquire", agent_uid: opts.agentUid, worktree: opts.worktree, at: now })
  return { ok: true }
}

// 续约：仅持锁者可在未过期时延长心跳；否则失败（fail-closed）。
export function renewLease(opts: LeaseOptions): { ok: boolean; code?: string; reason?: string } {
  const now = opts.now ? opts.now() : Date.now()
  const emit = opts.emit ?? defaultSink(opts.leasePath)
  const existing = readRecord(opts.leasePath)
  if (!existing) {
    emit({ type: "lease_denied", agent_uid: opts.agentUid, worktree: opts.worktree, at: now, detail: "renew without held lease" })
    return { ok: false, code: OLO_LEASE_NOT_HELD, reason: "no held lease to renew" }
  }
  if (existing.agent_uid !== opts.agentUid) {
    return { ok: false, code: OLO_LEASE_HELD, reason: `lease held by ${existing.agent_uid}` }
  }
  if (isExpired(existing, now)) {
    return { ok: false, code: OLO_LEASE_EXPIRED, reason: "lease expired, re-claim required" }
  }
  writeFileSync(opts.leasePath, JSON.stringify({ ...existing, last_heartbeat: now }))
  emit({ type: "lease_renew", agent_uid: opts.agentUid, worktree: opts.worktree, at: now })
  return { ok: true }
}

// 释放：仅持锁者可释放；释放他人锁被拒（fail-closed）；无锁释放幂等成功。
export function releaseLease(opts: LeaseOptions): { ok: boolean; code?: string; reason?: string } {
  const now = opts.now ? opts.now() : Date.now()
  const emit = opts.emit ?? defaultSink(opts.leasePath)
  const existing = readRecord(opts.leasePath)
  if (!existing) return { ok: true }
  if (existing.agent_uid !== opts.agentUid) {
    emit({ type: "lease_denied", agent_uid: opts.agentUid, worktree: opts.worktree, at: now, detail: `release blocked: held by ${existing.agent_uid}` })
    return { ok: false, code: OLO_LEASE_HELD, reason: `lease held by ${existing.agent_uid}; cannot release others` }
  }
  unlinkSync(opts.leasePath)
  emit({ type: "lease_released", agent_uid: opts.agentUid, worktree: opts.worktree, at: now })
  return { ok: true }
}
