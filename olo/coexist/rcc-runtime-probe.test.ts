// R-CC-1/2 本地身份接线 dev 实证端到端断言（node/bun --experimental-strip-types · 与 lease/guard/write-guard 同风格）
// 复用 scripts/rcc-runtime-probe.ts 的 runScenarios：以真实本地 agent_uid（W-35/W-51）驱动
// W-36 spawn + R-CC-1 单写者租约 + R-CC-2 写工具门 + R-CC-3 暂存集断言，验证机制在本地身份下可运行。
import { mkdtempSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runScenarios } from "./scripts/rcc-runtime-probe.ts"
import { FileStore } from "./registry.ts"
import { loadCard } from "./aib.ts"
import { UID_RE } from "./agent-uid.ts"
import { resolveRuntimeAgentUid } from "./agent-identity.ts"

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) passed++
  else {
    failed++
    fails.push(`${name}${extra !== undefined ? " :: " + JSON.stringify(extra) : ""}`)
  }
}

const outDir = mkdtempSync(join(tmpdir(), "rcc-test-"))
const res = runScenarios(outDir, { machine: "GTX75060", role: "codecustom" })

// 1) 全部场景通过（R-CC-1 acquire / 并发独占 / 写工具门 / 暂存越界 / 过期回收）
check("all scenarios pass", res.allPass, res.scenarios)

// 2) W-36：agents.jsonl 含两个真实本地 uid 的 spawned 事件（双实例真实注册）
{
  const raw = existsSync(res.agentsJsonl) ? readFileSync(res.agentsJsonl, "utf8") : ""
  const lines = raw.trim().split("\n").filter(Boolean)
  check("agents.jsonl non-empty", lines.length >= 4, { count: lines.length })
  const spawned = lines.filter((l) => { try { return JSON.parse(l).event === "spawned" } catch { return false } })
  check("two spawned events", spawned.length === 2, { spawned: spawned.length })
  const uids = spawned.map((l) => JSON.parse(l).agent_uid)
  check("agent_uid_a well-formed", UID_RE.test(res.agent_uid_a), res.agent_uid_a)
  check("agent_uid_b well-formed", UID_RE.test(res.agent_uid_b), res.agent_uid_b)
  check("two distinct uids", uids[0] !== uids[1], uids)
}

// 3) 事件覆盖：R-CC-1 acquire / 并发独占 / R-CC-2 / R-CC-3 / 过期回收 全部事件类型出现
{
  const types = new Set(res.events.map((e) => e.type))
  for (const t of ["lease_acquire", "lease_denied", "staging_violation", "lease_expired", "lease_reclaim"]) {
    check(`event ${t} present`, types.has(t), [...types])
  }
}

// 4) R-CC-5：冲突事件须双 agent_uid（持锁方）+ 路径
{
  const denied = res.events.find((e) => e.type === "lease_denied")
  check("lease_denied names holder (agent_uid_a)", denied?.other_agent_uid === res.agent_uid_a, denied)
  check("lease_denied carries path", typeof denied?.path === "string" && denied!.path.length > 0, denied)
  const sv = res.events.find((e) => e.type === "staging_violation")
  check("staging_violation names path", Array.isArray(sv?.paths) && sv!.paths!.length > 0, sv)
}

// 5) W-10 本地卡：spiffe_id 恒 null + 可加载（诚实 [CONTRACT]，不冒充 SVID 锚）
{
  const card = loadCard(res.cardPath)
  check("card spiffe_id null", card.spiffe_id === null, card.spiffe_id)
  check("card status registered", card.status === "registered", card.status)
}

// 6) 诚实边界：收据声明 spiffe_id null 且 SVID 锚 [CONTRACT]
{
  const receipt = JSON.parse(readFileSync(res.receiptPath, "utf8"))
  check("receipt spiffe_id null", receipt.honest_boundary.spiffe_id === null, receipt.honest_boundary)
  check("receipt svid anchor CONTRACT", /CONTRACT/.test(receipt.honest_boundary.svid_anchor), receipt.honest_boundary)
}

// 7) 默认证据落盘：lease.events.jsonl 存在且含 lease_acquire（证明运行期真实写盘）
{
  const persisted = existsSync(res.leaseEventsJsonl) ? readFileSync(res.leaseEventsJsonl, "utf8") : ""
  check("lease.events.jsonl persisted", persisted.includes("lease_acquire"), { len: persisted.length })
}

// 8) 稳定身份解析（上游接线）：显式 instance_nonce ⇒ 稳定 + 格式合法 + 与输入 nonce 一致
{
  const cfg = { role: "codecustom", machine: "GTX75060", instance_nonce: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }
  const u1 = resolveRuntimeAgentUid(cfg)
  const u2 = resolveRuntimeAgentUid(cfg)
  check("resolveRuntimeAgentUid stable across calls", u1 === u2, { u1, u2 })
  check("resolveRuntimeAgentUid well-formed", UID_RE.test(u1), u1)
  check("resolveRuntimeAgentUid embeds input nonce", u1 === "agent-codecustom-GTX75060-01ARZ3NDEKTSV4RRFFQ69G5FAV", u1)
}

console.log(`rcc-runtime-probe.test.ts: ${passed}/${(passed + failed)} PASS${failed > 0 ? " (FAIL: " + fails.join(" | ") + ")" : ""}`)
if (failed > 0) process.exit(1)
