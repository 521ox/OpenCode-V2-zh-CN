// W-56/57/58 · R-CC 阶段 3 编排注入式自测（node --experimental-strip-types · 与 lease/guard/staging-assert 同风格）
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { authorizeWrite, OLO_WRITE_GUARD_CONTRACT, type WriteAuthorizationResult } from "./write-guard.ts"
import type { LeaseEvent, LeaseEventSink } from "./lease.ts"

let passed = 0
let failed = 0
const fails: string[] = []

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++
  } else {
    failed++
    fails.push(`${name}${extra !== undefined ? " :: " + JSON.stringify(extra) : ""}`)
  }
}

function memSink(events: LeaseEvent[]): LeaseEventSink {
  return (e) => events.push(e)
}

function freshLeasePath(): string {
  const d = mkdtempSync(join(tmpdir(), "olo-wg-"))
  return join(d, "lease.json")
}

// 全局时钟，便于过期回收测试
let CLOCK = 1000
const now = () => CLOCK

// 1) 快乐路径：无既有锁 ⇒ claim 成功 → 写工具 + staged⊆declared ⇒ 放行 + lease_acquire 事件
{
  const events: LeaseEvent[] = []
  const r: WriteAuthorizationResult = authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: "write",
    agentUid: "agent-A",
    worktree: "wt1",
    leasePath: freshLeasePath(),
    staged: ["src/a.ts"],
    declared: ["src/a.ts", "src/b.ts"],
    now,
    emit: memSink(events),
  })
  check("1 allow", r.allow === true, r)
  check("1 lease_acquire emitted", events.some((e) => e.type === "lease_acquire"), events)
}

// 2) 他持锁：A 先持锁，B 申请 ⇒ 拒 + lease_denied（held by A）
{
  const lp = freshLeasePath()
  const evA: LeaseEvent[] = []
  authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-A", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], now, emit: memSink(evA) })
  const evB: LeaseEvent[] = []
  const rB = authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-B", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], now, emit: memSink(evB) })
  check("2 B denied", rB.allow === false, rB)
  check("2 B lease_denied emitted", evB.some((e) => e.type === "lease_denied" && e.detail?.includes("agent-A")), evB)
  // R-CC-5：拒绝事件须双 agent_uid（持锁方 agent-A）+ 路径
  const dn2 = evB.find((e) => e.type === "lease_denied")
  check("2 R-CC-5 other_agent_uid=agent-A", dn2?.other_agent_uid === "agent-A", dn2)
  check("2 R-CC-5 path=lp", dn2?.path === lp, dn2)
}

// 3) 自持锁续约：A 再次申请 ⇒ 放行（renew，不重 acquire）
{
  const lp = freshLeasePath()
  const ev1: LeaseEvent[] = []
  authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-A", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], now, emit: memSink(ev1) })
  const ev2: LeaseEvent[] = []
  const r = authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-A", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], now, emit: memSink(ev2) })
  check("3 self renew allow", r.allow === true, r)
  check("3 renew emitted", ev2.some((e) => e.type === "lease_renew"), ev2)
}

// 4) 过期回收：A 锁 ttl=10 @t=0，B @t=100 申请 ⇒ 回收 → 放行 + lease_expired + lease_reclaim + lease_acquire
{
  const lp = freshLeasePath()
  authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-A", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], ttlMs: 10, now: () => 0 })
  const evB: LeaseEvent[] = []
  CLOCK = 100
  const r = authorizeWrite({ contract: OLO_WRITE_GUARD_CONTRACT, commandId: "write", agentUid: "agent-B", worktree: "wt1", leasePath: lp, staged: [], declared: ["x"], ttlMs: 10, now, emit: memSink(evB) })
  check("4 reclaim allow", r.allow === true, r)
  check("4 lease_expired emitted", evB.some((e) => e.type === "lease_expired"), evB)
  check("4 lease_reclaim emitted", evB.some((e) => e.type === "lease_reclaim"), evB)
  // R-CC-5：回收事件须双 agent_uid（前持锁方 agent-A）+ 路径
  const rc4 = evB.find((e) => e.type === "lease_reclaim")
  check("4 R-CC-5 other_agent_uid=agent-A", rc4?.other_agent_uid === "agent-A", rc4)
  check("4 R-CC-5 path=lp", rc4?.path === lp, rc4)
}

// 5) 暂存集越界：staged 含未声明路径 ⇒ 拒 + staging_violation 指名越界路径
{
  const events: LeaseEvent[] = []
  const r = authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: "write",
    agentUid: "agent-A",
    worktree: "wt1",
    leasePath: freshLeasePath(),
    staged: ["src/a.ts", "src/foreign.ts"],
    declared: ["src/a.ts"],
    now,
    emit: memSink(events),
  })
  check("5 staging denied", r.allow === false, r)
  check("5 violation named", (r.stagingViolations ?? []).includes("src/foreign.ts"), r)
  check("5 staging_violation emitted", events.some((e) => e.type === "staging_violation" && e.detail?.includes("src/foreign.ts")), events)
  // R-CC-5：越界事件须携带路径字段（paths 全量 + path 代表）
  const sv5 = events.find((e) => e.type === "staging_violation")
  check("5 R-CC-5 paths includes foreign", Array.isArray(sv5?.paths) && sv5!.paths!.includes("src/foreign.ts"), sv5)
  check("5 R-CC-5 path=foreign", sv5?.path === "src/foreign.ts", sv5)
}

// 6) 非写工具：read ⇒ 经统一门 + 暂存校验，放行
{
  const r = authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: "read",
    agentUid: "agent-A",
    worktree: "wt1",
    leasePath: freshLeasePath(),
    staged: [],
    declared: ["x"],
    now,
    emit: memSink([]),
  })
  check("6 non-write allow", r.allow === true, r)
}

// 7) contract 不匹配 ⇒ 拒
{
  const r = authorizeWrite({
    contract: "wrong/contract",
    commandId: "write",
    agentUid: "agent-A",
    worktree: "wt1",
    leasePath: freshLeasePath(),
    staged: [],
    declared: ["x"],
    now,
    emit: memSink([]),
  })
  check("7 contract mismatch denied", r.allow === false, r)
}

// 8) 写工具但暂存为空 ⊆ declared ⇒ 放行（合法空写）
{
  const r = authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: "edit",
    agentUid: "agent-A",
    worktree: "wt1",
    leasePath: freshLeasePath(),
    staged: [],
    declared: ["src/a.ts"],
    now,
    emit: memSink([]),
  })
  check("8 empty staged allow", r.allow === true, r)
}

// 9) staging_violation 无 emit 时仍落盘（账本 §10：生产静默丢弃缺口 → 修复）
{
  const td = mkdtempSync(join(tmpdir(), "wg-nofb-"))
  const lp = join(td, "lease.json")
  writeFileSync(lp, JSON.stringify({ agent_uid: "agent-A", worktree: td, acquired: Date.now(), last_heartbeat: Date.now() }))
  const r = authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: "write",
    agentUid: "agent-A",
    worktree: td,
    leasePath: lp,
    staged: ["src/foreign.ts"],
    declared: ["src/a.ts"],
    now,
    // 不传 emit：验证 defaultSink 落盘（修复生产静默丢弃）
  })
  check("9 staging denied (no emit)", r.allow === false, r)
  const auditPath = join(td, "lease.events.jsonl")
  let found = false
  if (existsSync(auditPath)) {
    const lines = readFileSync(auditPath, "utf8").trim().split("\n").filter(Boolean)
    found = lines.some((l) => { try { return JSON.parse(l).type === "staging_violation" } catch { return false } })
  }
  check("9 staging_violation persisted to defaultSink", found, { auditPath, found })
}

console.log(`write-guard.test.ts: ${passed}/${(passed + failed)} PASS${failed > 0 ? " (FAIL: " + fails.join(" | ") + ")" : ""}`)
if (failed > 0) process.exit(1)
