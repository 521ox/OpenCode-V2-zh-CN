import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  claimLease,
  renewLease,
  releaseLease,
  readLease,
  isExpired,
  OLO_LEASE_HELD,
  OLO_LEASE_EXPIRED,
  OLO_LEASE_NOT_HELD,
  type LeaseEvent,
} from "./lease.ts"

const dir = mkdtempSync(join(tmpdir(), "olo-lease-"))
const leasePath = join(dir, "lease.json")
const worktree = "wt-A"

// 可注入时钟与事件汇（规格级自测，不依赖运行期）
let clock = 1_000_000
const now = () => clock
const events: LeaseEvent[] = []
const emit = (e: LeaseEvent) => events.push(e)

function fresh(agentUid: string) {
  return { leasePath, agentUid, worktree, ttlMs: 30_000, now, emit }
}

try {
  // 1. 首次申请 ⇒ 成功持有
  const r1 = claimLease(fresh("agentA"))
  assert.equal(r1.ok, true, "first claim should succeed")
  assert.equal(readLease({ leasePath, now }).held, true)
  assert.equal(readLease({ leasePath, now }).owner, "agentA")

  // 2. 同一 agent 重复申请 ⇒ 幂等续约成功
  const r2 = claimLease(fresh("agentA"))
  assert.equal(r2.ok, true, "idempotent claim should succeed")

  // 3. 他人同时申请（未过期）⇒ 拒 + OLO_LEASE_HELD 事件
  const before = events.length
  const r3 = claimLease(fresh("agentB"))
  assert.equal(r3.ok, false, "concurrent claim by other agent must be denied")
  assert.equal(r3.code, OLO_LEASE_HELD)
  assert.ok(events.slice(before).some((e) => e.type === "lease_denied"), "denied event must be logged")

  // 4. 他人过期锁 ⇒ 回收成功（reclaim）+ 过期事件
  clock += 60_000 // 超过 TTL
  const beforeReclaim = events.length
  const r4 = claimLease(fresh("agentC"))
  assert.equal(r4.ok, true, "expired lease must be reclaimable")
  assert.equal(r4.reclaimed, true)
  assert.ok(events.slice(beforeReclaim).some((e) => e.type === "lease_expired"), "expired event must be logged")
  assert.ok(events.slice(beforeReclaim).some((e) => e.type === "lease_reclaim"), "reclaim event must be logged")
  assert.equal(readLease({ leasePath, now }).owner, "agentC")

  // 5. 续约：持锁者成功；非持锁者失败
  assert.equal(renewLease(fresh("agentC")).ok, true, "holder renew should succeed")
  assert.equal(renewLease(fresh("agentX")).ok, false, "non-holder renew must fail")
  assert.equal(renewLease(fresh("agentX")).code, OLO_LEASE_HELD)

  // 6. 过期后续约失败（须先 reclaim）
  clock += 60_000
  assert.equal(renewLease(fresh("agentC")).ok, false)
  assert.equal(renewLease(fresh("agentC")).code, OLO_LEASE_EXPIRED)

  // 7. 释放：持锁者成功移除；释放他人锁被拒；无锁释放幂等
  clock = 2_000_000
  assert.equal(releaseLease(fresh("agentC")).ok, true, "holder release should succeed")
  assert.equal(readLease({ leasePath, now }).held, false, "lease should be gone after release")
  const r7 = claimLease(fresh("agentD"))
  assert.equal(r7.ok, true)
  // 释放他人持有的锁被拒（fail-closed，不得误删他人锁）
  assert.equal(releaseLease(fresh("agentE")).ok, false, "cannot release others' lease")
  assert.equal(releaseLease(fresh("agentE")).code, OLO_LEASE_HELD)
  // 须由真正持锁者释放
  assert.equal(releaseLease(fresh("agentD")).ok, true, "holder agentD release should succeed")
  // 无锁释放幂等
  assert.equal(releaseLease(fresh("ghost")).ok, true, "release when none held is idempotent ok")

  // 8. isExpired 边界：恰好 TTL 不视为过期
  const rec = { agent_uid: "x", worktree: "w", acquired_at: 0, last_heartbeat: 0, ttl_ms: 1000 }
  assert.equal(isExpired(rec, 1000), false, "exactly TTL is not expired")
  assert.equal(isExpired(rec, 1001), true, "past TTL is expired")

  console.log(`lease.test.ts: 8/8 PASS (events logged=${events.length})`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
