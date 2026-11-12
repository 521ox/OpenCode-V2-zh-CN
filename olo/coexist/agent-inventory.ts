// W-40 · 存量/外部 agent 清点 + quarantine 迁移（无 UID 实例全覆盖）
// 扫描存量/外部来源中的 agent 记录，对缺失合法 UID 的实例全覆盖登记 quarantine 事件
// （不静默跳过）；产出清点报告。T36 清点不可伪造 = 报告如实记录原始标识与覆盖数，
// 既不静默跳过、也不虚报计数。零 OpenCode 运行时依赖，可由 node --experimental-strip-types 直接验证。
import { Registry } from "./registry.ts"
import { UID_RE, newUlid, segmentHash } from "./agent-uid.ts"

/** 一条存量/外部 agent 记录（来源可注入：legacy 配置文件 / 外部清册 / 旧版注册表导出）。 */
export interface LegacyAgentRecord {
  /** 原始外部/存量标识（不含有效 agent_uid 时以此作为 quarantine 溯源载体） */
  legacy_id: string
  /** 可选：若已带合法 agent_uid 则不进 quarantine */
  agent_uid?: string
}

/** 清点报告（T36 不可伪造：scanned/quarantined/skipped_valid 与真实落盘事件逐项相等）。 */
export interface InventoryReport {
  scanned: number
  quarantined: number
  skipped_valid: number
  /** 被 quarantine 的原始 legacy_id 列表（如实溯源，不合成伪装） */
  quarantined_legacy_ids: string[]
}

/**
 * 为无 UID 实例合成真实 quarantine UID（调用方策略注入点）。
 * 默认：agent-quar-<legacyHash8>-<ULID>，machine 段取自 legacy_id 的 8 位 FNV 哈希，
 * ULID 走 Crockford 26 位（与 agent_uid 同形态），保证落到 registry 时通过 UID_RE 格式闸。
 */
export function defaultQuarantineUid(rec: LegacyAgentRecord, _index: number): string {
  const machine = segmentHash(rec.legacy_id).toLowerCase()
  return `agent-quar-${machine}-${newUlid()}`
}

/**
 * 清点并迁移：对每条记录，若已带合法 agent_uid 则跳过（不重复 quarantine）；
 * 否则视为无 UID 存量/外部实例，以合成的真实 quarantine UID 全覆盖登记，
 * 并在报告中如实记录原始 legacy_id（T36 溯源不伪造）。
 * @param makeQuarantineUid 注入式合成函数；默认 defaultQuarantineUid
 */
export function scanAndQuarantine(
  registry: Registry,
  records: LegacyAgentRecord[],
  ts: string,
  source_sha: string,
  makeQuarantineUid: (rec: LegacyAgentRecord, index: number) => string = defaultQuarantineUid,
): InventoryReport {
  const report: InventoryReport = {
    scanned: records.length,
    quarantined: 0,
    skipped_valid: 0,
    quarantined_legacy_ids: [],
  }
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    if (rec.agent_uid && UID_RE.test(rec.agent_uid)) {
      report.skipped_valid++
      continue
    }
    // T36 不可伪造：用原始 legacy_id 溯源，绝不把「被跳过/未扫到」伪装成已 quarantine
    const qUid = makeQuarantineUid(rec, i)
    if (!UID_RE.test(qUid)) throw new Error("OLO_QUARANTINE_UID_MALFORMED")
    registry.quarantine(qUid, ts, source_sha)
    report.quarantined++
    report.quarantined_legacy_ids.push(rec.legacy_id)
  }
  return report
}
