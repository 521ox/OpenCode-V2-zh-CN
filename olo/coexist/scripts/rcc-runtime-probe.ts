// R-CC-1/2 本地身份接线 dev 实证（纯本地身份，不依赖 SPIRE/Vault/G-CV-1）
// 用法：bun run olo/coexist/scripts/rcc-runtime-probe.ts [--out <dir>]
// 产出证据：agents.jsonl（W-36 spawn 事件）+ lease.events.jsonl（租约/授权事件）+ rcc-runtime-receipt.json（断言 + 诚实边界）
// 机制：W-35/W-51 本地 agent_uid → W-36 Registry.spawn → R-CC-1 单写者租约 + R-CC-2 写工具 fail-closed 门 + R-CC-3 暂存集断言。
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeLocalAgent,
  loadLocalAgentConfig,
  spawnLocalAgent,
  authorizeLocalWrite,
  writeLocalCard,
  type LocalAgent,
} from "../agent-identity.ts"
import { FileStore } from "../registry.ts"
import { defaultSink, type LeaseEvent, type LeaseEventSink } from "../lease.ts"

export interface ScenarioResult {
  name: string
  expect: "allow" | "deny"
  actual: "allow" | "deny"
  pass: boolean
  detail?: string
}

export interface ProbeResult {
  agent_uid_a: string
  agent_uid_b: string
  machine: string
  role: string
  events: LeaseEvent[]
  scenarios: ScenarioResult[]
  evidenceDir: string
  agentsJsonl: string
  leaseEventsJsonl: string
  cardPath: string
  receiptPath: string
  allPass: boolean
}

function memSink(events: LeaseEvent[]): LeaseEventSink {
  return (e) => events.push(e)
}

/**
 * 运行 R-CC-1/2/3 本地身份接线全部场景，落证据件到 outDir。
 * 场景编排（单写者租约 + 写工具门 + 暂存集断言，全部以真实本地 agent_uid 驱动）：
 *  1) R-CC-1 acquire   : A 持锁（edit，staged⊆declared）→ allow + lease_acquire
 *  2) R-CC-1 并发独占   : B（不同 uid）争同一锁 → deny + lease_denied（held by A）
 *  3) R-CC-2 持锁写工具 : A 持锁下 write → allow
 *  4) R-CC-3 暂存越界   : A staged 含未声明路径 → deny + staging_violation（指名越界路径）
 *  5) R-CC-1 过期回收   : A1 锁 ttl=10 @t=0；A2 @t=100 申请 → 回收 → allow + lease_expired + lease_reclaim
 */
export function runScenarios(outDir: string, opts?: { machine?: string; role?: string }): ProbeResult {
  const cfg = loadLocalAgentConfig({ machine: opts?.machine, role: opts?.role })
  const agentA: LocalAgent = makeLocalAgent(cfg)
  // B 与 A 同 role/machine 但独立 ULID ⇒ 不同 uid（模拟另一并发实例）
  const agentB: LocalAgent = makeLocalAgent({ ...cfg, instance_nonce: "B" + cfg.instance_nonce.slice(1) })

  mkdirSync(outDir, { recursive: true })
  const agentsStore = new FileStore(join(outDir, "agents.jsonl"))
  const leasePath = join(outDir, "lease.json")
  const cardPath = join(outDir, "aib-card.json")

  const ts = new Date().toISOString()
  const source_sha = "dev-local-identity-probe"

  // W-36：两实例均真实 spawn 注册（证据：agents.jsonl 含两条 spawned 事件）
  spawnLocalAgent(agentA, agentsStore, { ts, source_sha })
  spawnLocalAgent(agentB, agentsStore, { ts, source_sha })
  // W-10：写本地身份卡并回读校验（spiffe_id 恒 null）
  writeLocalCard(agentA, cardPath, { issued_at: ts })

  const events: LeaseEvent[] = []
  // 组合汇：事件既入内存（断言用）又落盘（defaultSink → <dir>/lease.events.jsonl，运行期真实证据）
  const fileSink = defaultSink(leasePath)
  const emit: LeaseEventSink = (e) => {
    events.push(e)
    fileSink(e)
  }

  let clock = 1000
  const now = () => clock

  const scenarios: ScenarioResult[] = []

  // 1) R-CC-1 acquire
  {
    const r = authorizeLocalWrite(agentA, {
      commandId: "edit",
      leasePath,
      worktree: "wt1",
      staged: ["src/a.ts"],
      declared: ["src/a.ts", "src/b.ts"],
      now,
      emit,
    })
    const pass = r.allow === true
    scenarios.push({ name: "1-RCC1-acquire", expect: "allow", actual: r.allow ? "allow" : "deny", pass, detail: r.reason })
  }

  // 2) R-CC-1 single-writer contention：B 争 A 的锁
  {
    const r = authorizeLocalWrite(agentB, {
      commandId: "write",
      leasePath,
      worktree: "wt1",
      staged: [],
      declared: ["src/a.ts"],
      now,
      emit,
    })
    const pass = r.allow === false
    scenarios.push({ name: "2-RCC1-contention", expect: "deny", actual: r.allow ? "allow" : "deny", pass, detail: r.reason })
  }

  // 3) R-CC-2 write-tool guard：A 持锁下 write
  {
    const r = authorizeLocalWrite(agentA, {
      commandId: "write",
      leasePath,
      worktree: "wt1",
      staged: ["src/a.ts"],
      declared: ["src/a.ts", "src/b.ts"],
      now,
      emit,
    })
    const pass = r.allow === true
    scenarios.push({ name: "3-RCC2-write-holder", expect: "allow", actual: r.allow ? "allow" : "deny", pass, detail: r.reason })
  }

  // 4) R-CC-3 staging violation：A staged 含未声明路径
  {
    const r = authorizeLocalWrite(agentA, {
      commandId: "write",
      leasePath: join(outDir, "lease-v2.json"),
      worktree: "wt1",
      staged: ["src/a.ts", "src/foreign.ts"],
      declared: ["src/a.ts"],
      now,
      emit,
    })
    const pass = r.allow === false && (r.stagingViolations ?? []).includes("src/foreign.ts")
    scenarios.push({ name: "4-RCC3-staging-violation", expect: "deny", actual: r.allow ? "allow" : "deny", pass, detail: r.reason })
  }

  // 5) R-CC-1 expired reclaim：A1 锁 ttl=10 @t=0；A2 @t=100 申请 → 回收
  {
    const lp2 = join(outDir, "lease-expired.json")
    authorizeLocalWrite(agentA, {
      commandId: "edit",
      leasePath: lp2,
      worktree: "wt1",
      staged: [],
      declared: ["x"],
      ttlMs: 10,
      now: () => 0,
      emit,
    })
    clock = 100
    const r = authorizeLocalWrite(agentB, {
      commandId: "edit",
      leasePath: lp2,
      worktree: "wt1",
      staged: [],
      declared: ["x"],
      ttlMs: 10,
      now,
      emit,
    })
    const pass = r.allow === true
    scenarios.push({ name: "5-RCC1-expired-reclaim", expect: "allow", actual: r.allow ? "allow" : "deny", pass, detail: r.reason })
  }

  const allPass = scenarios.every((s) => s.pass)

  const receipt = {
    probe: "rcc-local-identity",
    honest_boundary: {
      mechanism: "R-CC-1/2 机制以本地身份（W-35/W-51 agent_uid，无 SVID）驱动，运行期可实证",
      spiffe_id: null,
      svid_anchor: "[CONTRACT]：W-43 UID↔SVID 绑定 + spiffe://olo 签发仍依赖 G-CV-1 五项（§18.13.4），未解除",
      production_default: "R-CC-1/2 运行期接线仍 opt-in fail-open（env/OLO_WRITE_GUARD_PATH 未设即跳过），未翻生产默认 fail-closed（属 owner 决策，非本探针范围）",
    },
    agent_uid_a: agentA.agent_uid,
    agent_uid_b: agentB.agent_uid,
    machine: cfg.machine,
    role: cfg.role,
    evidence: {
      agents_jsonl: "agents.jsonl",
      lease_events_jsonl: "lease.events.jsonl",
      aib_card: "aib-card.json",
    },
    required_event_types: ["lease_acquire", "lease_denied", "staging_violation", "lease_expired", "lease_reclaim"],
    event_coverage: {
      lease_acquire: events.some((e) => e.type === "lease_acquire"),
      lease_denied: events.some((e) => e.type === "lease_denied"),
      staging_violation: events.some((e) => e.type === "staging_violation"),
      lease_expired: events.some((e) => e.type === "lease_expired"),
      lease_reclaim: events.some((e) => e.type === "lease_reclaim"),
    },
    scenarios,
    all_pass: allPass,
    ts,
  }

  const receiptPath = join(outDir, "rcc-runtime-receipt.json")
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8")

  return {
    agent_uid_a: agentA.agent_uid,
    agent_uid_b: agentB.agent_uid,
    machine: cfg.machine,
    role: cfg.role,
    events,
    scenarios,
    evidenceDir: outDir,
    agentsJsonl: join(outDir, "agents.jsonl"),
    leaseEventsJsonl: join(outDir, "lease.events.jsonl"),
    cardPath,
    receiptPath,
    allPass,
  }
}

// CLI 入口（仅在作为主模块运行时执行）
if (process.argv[1] && process.argv[1].endsWith("rcc-runtime-probe.ts")) {
  const outIdx = process.argv.indexOf("--out")
  // 每次运行隔离到 run-<ts> 子目录，避免复用 --out 时残留 lease.json 造成租约碰撞。
  const outArg = outIdx >= 0 ? process.argv[outIdx + 1] : undefined
  const outDir = outArg
    ? join(outArg, `run-${Date.now()}`)
    : mkdtempSync(join(tmpdir(), "rcc-local-"))
  const res = runScenarios(outDir)
  console.log(`R-CC-1/2 本地身份接线 dev 实证：${res.allPass ? "ALL PASS" : "FAIL"}`)
  console.log(`  agent_uid_a = ${res.agent_uid_a}`)
  console.log(`  agent_uid_b = ${res.agent_uid_b}`)
  console.log(`  evidence    = ${res.evidenceDir}`)
  for (const s of res.scenarios) {
    console.log(`  [${s.pass ? "PASS" : "FAIL"}] ${s.name} expect=${s.expect} actual=${s.actual}${s.detail ? " :: " + s.detail : ""}`)
  }
  console.log(`  receipt     = ${res.receiptPath}`)
  if (!res.allPass) process.exit(1)
}
