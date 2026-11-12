// W-35 · agent_uid 单测（node --experimental-strip-types 直接执行；与 aib/guard 同形态）
import { buildAgentUid, parseAgentUid, segmentHash } from "./agent-uid.ts"

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

check("buildAgentUid 形态 ag.<m8>.<i8>.<boot>.<spawn>", () => {
  const uid = buildAgentUid({ machine8: "abcdef01", install8: "12345678", boot_seq: 2, spawn_seq: 7 })
  if (uid !== "ag.abcdef01.12345678.2.7") throw new Error("unexpected " + uid)
})

check("parseAgentUid 往返一致", () => {
  const ctx = { machine8: "abcdef01", install8: "12345678", boot_seq: 2, spawn_seq: 7 }
  const p = parseAgentUid(buildAgentUid(ctx))
  if (p.machine8 !== ctx.machine8 || p.install8 !== ctx.install8 || p.boot_seq !== 2 || p.spawn_seq !== 7)
    throw new Error("roundtrip mismatch " + JSON.stringify(p))
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

check("parseAgentUid 拒段长度不符", () => {
  let msg = ""
  try {
    parseAgentUid("ag.abc.1234.1.1")
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_UID_MALFORMED")) throw new Error("expected OLO_UID_MALFORMED, got " + msg)
})

console.log(`\nRESULT passed=${passed} failed=${failed}`)
if (failed > 0) process.exit(1)
