// W-40 · 存量/外部 agent 清点 + quarantine 迁移 单测（node --experimental-strip-types；注入式自测）
import { Registry, MemoryStore } from "./registry.ts"
import { scanAndQuarantine, defaultQuarantineUid, type LegacyAgentRecord } from "./agent-inventory.ts"
import { UID_RE } from "./agent-uid.ts"

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

const SHA = "sha-local-0001"
const TS = "2026-11-12T12:00:00"

/** 合法 UID（供「已带 UID 应跳过」用例）。 */
const VALID_UID = `agent-code-main-gtx1-${"Q".repeat(26)}`

function countQuarantineEvents(reg: Registry): number {
  // MemoryStore 暴露内部 buf；通过再读一次 parseAll 的等价路径统计 quarantine 事件
  const raw = (reg as any).store.read() as string
  if (!raw.trim()) return 0
  return raw
    .split("\n")
    .filter((l: string) => l.trim().length > 0)
    .filter((l: string) => (JSON.parse(l) as any).event === "quarantine").length
}

check("W-40 全覆盖：2 条无 UID 记录 → 全部 quarantine，无静默跳过", () => {
  const reg = new Registry(new MemoryStore())
  const records: LegacyAgentRecord[] = [
    { legacy_id: "legacy/agent-A" },
    { legacy_id: "legacy/agent-B" },
  ]
  const report = scanAndQuarantine(reg, records, TS, SHA)
  if (report.scanned !== 2) throw new Error("scanned!=2")
  if (report.quarantined !== 2) throw new Error("quarantined!=2 (静默跳过?)")
  if (report.skipped_valid !== 0) throw new Error("skipped_valid!=0")
  if (countQuarantineEvents(reg) !== 2) throw new Error("落盘 quarantine 事件数!=2")
  if (report.quarantined_legacy_ids.join(",") !== "legacy/agent-A,legacy/agent-B")
    throw new Error("报告未如实记录原始 legacy_id")
})

check("W-40 跳过：已带合法 UID 的记录不重复 quarantine", () => {
  const reg = new Registry(new MemoryStore())
  const records: LegacyAgentRecord[] = [
    { legacy_id: "modern/agent-X", agent_uid: VALID_UID },
  ]
  const report = scanAndQuarantine(reg, records, TS, SHA)
  if (report.skipped_valid !== 1) throw new Error("skipped_valid!=1")
  if (report.quarantined !== 0) throw new Error("不应 quarantine 合法 UID")
  if (countQuarantineEvents(reg) !== 0) throw new Error("不应落 quarantine 事件")
})

check("W-40 混合：3 条（1 合法 + 2 无 UID）→ quarantined=2 / skipped_valid=1 / scanned=3", () => {
  const reg = new Registry(new MemoryStore())
  const records: LegacyAgentRecord[] = [
    { legacy_id: "legacy/A" },
    { legacy_id: "modern/B", agent_uid: VALID_UID },
    { legacy_id: "legacy/C" },
  ]
  const report = scanAndQuarantine(reg, records, TS, SHA)
  if (report.scanned !== 3) throw new Error("scanned!=3")
  if (report.quarantined !== 2) throw new Error("quarantined!=2")
  if (report.skipped_valid !== 1) throw new Error("skipped_valid!=1")
  if (countQuarantineEvents(reg) !== 2) throw new Error("落盘数!=2")
  // T36 不可伪造：报告覆盖数 == 真实落盘数
  if (report.quarantined !== countQuarantineEvents(reg))
    throw new Error("报告 quarantined 与落盘事件数不符（伪造?）")
})

check("W-40 T36 不可伪造：合成 quarantine UID 必过格式闸，否则 OLO_QUARANTINE_UID_MALFORMED", () => {
  const reg = new Registry(new MemoryStore())
  const records: LegacyAgentRecord[] = [{ legacy_id: "legacy/Z" }]
  // 注入一个产出非法 UID 的合成器，应被拦截（不放行伪造 UID）
  let threw = ""
  try {
    scanAndQuarantine(reg, records, TS, SHA, () => "not-a-valid-uid")
  } catch (e) {
    threw = (e as Error).message
  }
  if (!threw.includes("OLO_QUARANTINE_UID_MALFORMED")) throw new Error("未拦截非法 UID")
  if (countQuarantineEvents(reg) !== 0) throw new Error("非法 UID 不应落盘")
})

check("W-40 默认合成器：defaultQuarantineUid 产出合法 UID_RE 串", () => {
  const uid = defaultQuarantineUid({ legacy_id: "legacy/abc" }, 0)
  if (!UID_RE.test(uid)) throw new Error("defaultQuarantineUid 不合法: " + uid)
  if (!uid.startsWith("agent-quar-")) throw new Error("缺 agent-quar- 前缀")
})

console.log(`\nW-40 agent-inventory 单测：${passed} PASS / ${failed} FAIL`)
if (failed > 0) process.exit(1)
