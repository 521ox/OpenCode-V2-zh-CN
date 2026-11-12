// W-35 · agent_uid 单测（node --experimental-strip-types 直接执行；与 aib/guard 同形态）
import { buildAgentUid, parseAgentUid, newUlid, segmentHash, type AgentUidContext } from "./agent-uid.ts"

let passed = 0
let failed = 0
function check(name: string, fn: () => void): void {
  try {
    fn()
    console.log("PASS", name)
    passed++
  } catch (e) {
    console.log("FAIL", name, (e as Error).message)
    failed++
  }
}

function ctx(role: string, machine: string, ulid: string): AgentUidContext {
  return { role, machine, ulid }
}

check("buildAgentUid 形态 agent-{role}-{machine}-{ULID}", () => {
  const uid = buildAgentUid(ctx("code-main", "GTX75060", "01ABCDEF00GHJKMNPQRSTVWXYZ"))
  if (uid !== "agent-code-main-GTX75060-01ABCDEF00GHJKMNPQRSTVWXYZ") throw new Error("unexpected " + uid)
})

check("parseAgentUid 往返一致（machine 无内部连字符）", () => {
  const c = ctx("code-main", "GTX75060", "01ABCDEF00GHJKMNPQRSTVWXYZ")
  const p = parseAgentUid(buildAgentUid(c))
  if (p.role !== c.role || p.machine !== c.machine || p.ulid !== c.ulid)
    throw new Error("roundtrip mismatch " + JSON.stringify(p))
})

check("newUlid 生成 26 位 Crockford（无 I/L/O/U）", () => {
  const u = newUlid()
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(u)) throw new Error("bad ulid " + u)
})

check("newUlid 两次调用大概率不同（随机低位）", () => {
  const a = newUlid()
  const b = newUlid()
  if (a === b) throw new Error("ulid collision (unlikely)")
})

check("segmentHash 确定性 + 8 位 hex", () => {
  const a = segmentHash("machine-A")
  const b = segmentHash("machine-A")
  const c = segmentHash("machine-B")
  if (a !== b) throw new Error("non-deterministic")
  if (!/^[0-9a-f]{8}$/.test(a)) throw new Error("not 8 hex: " + a)
  if (a === c) throw new Error("collision")
})

check("parseAgentUid 拒非法形态 OLO_UID_MALFORMED", () => {
  let msg = ""
  try {
    parseAgentUid("not-a-uid")
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_UID_MALFORMED")) throw new Error("expected OLO_UID_MALFORMED, got " + msg)
})

check("parseAgentUid 拒缺 ULID 尾段 OLO_UID_MALFORMED", () => {
  let msg = ""
  try {
    parseAgentUid("agent-build-ops-gtx1")
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_UID_MALFORMED")) throw new Error("expected OLO_UID_MALFORMED, got " + msg)
})

console.log(`\nRESULT passed=${passed} failed=${failed}`)
if (failed > 0) process.exit(1)
