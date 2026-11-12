// W-35 · agent_uid 生成器（[REGISTERED] → 实现挂点 olo/coexist；配套 Python 判据 tools/t33_t36_identity_tests.py 属 W-41 待落）
// 格式遵循 W-51 owner 回执裁定（2026-11-11 SIGNED）：agent-{role}-{machine}-{ULID}
//   - role 段：沿用既有 agent_id 的 agent-{role} 语义（不含前缀 agent-，如 build-ops / code-main / kb-ingest）
//   - machine 段：承载 T37 跨机互斥（如 GTX75060 / spark40；列表名 GTX750-60 的段内形态由调用方归一）
//   - ULID 尾段：段内可证唯一（Crockford 26 位，无 I/L/O/U）
// 零 OpenCode 运行时依赖，可由 node --experimental-strip-types 直接执行验证（与 aib/guard 同形态）。
// 诚实边界：machine/role 段可含连字符，故 UID 串的反向解析对「末 hyphen 之后」判为 machine、其余为 role；
//   含内部连字符的 machine（如 GTX750-60）经 parse 回取得 best-effort，生产态以 registry 事件结构化字段为准。
export interface AgentKey {
  install_family: string
  agent_id: string
}

export interface AgentUidContext {
  /** role 段：agent-{role} 中 {role} 部分（不含 agent- 前缀） */
  role: string
  /** machine 段：承载 T37 跨机互斥 */
  machine: string
  /** ULID 尾段：Crockford 26 位（段内可证唯一） */
  ulid: string
}

/** W-35 裁定格式：agent-{role}-{machine}-{ULID}；ULID = Crockford 26 位（无 I/L/O/U）。 */
export const UID_RE = /^agent-(.+)-([0-9A-HJKMNP-TV-Z]{26})$/

/** Crockford ULID 字符集（排除 I/L/O/U）。 */
export const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function encodeBase32(n: bigint): string {
  let s = ""
  let v = n & 0xffffffffffffffffn
  for (let i = 0; i < 26; i++) {
    s += ULID_ALPHABET[Number(v % 32n)]
    v = (v >> 5n) & 0xffffffffffffffffn
  }
  return s
}

/** 生成 26 位 Crockford ULID（10 位时间高位 + 16 位随机低位）。 */
export function newUlid(): string {
  const time = BigInt(Date.now())
  const timeStr = encodeBase32(time).slice(0, 10)
  let rand = BigInt(Date.now()) ^ BigInt(Math.floor(Math.random() * 0x7fffffff))
  let randStr = ""
  for (let i = 0; i < 16; i++) {
    randStr += ULID_ALPHABET[Number(rand % 32n)]
    rand = (rand * 1103515245n + 12345n) & 0xffffffffffffffffn
  }
  return timeStr + randStr
}

export function buildAgentUid(ctx: AgentUidContext): string {
  return `agent-${ctx.role}-${ctx.machine}-${ctx.ulid}`
}

export function parseAgentUid(uid: string): AgentUidContext {
  const m = UID_RE.exec(uid)
  if (!m) throw new Error("OLO_UID_MALFORMED")
  const middle = m[1]
  const ulid = m[2]
  const idx = middle.lastIndexOf("-")
  const role = idx >= 0 ? middle.slice(0, idx) : middle
  const machine = idx >= 0 ? middle.slice(idx + 1) : ""
  return { role, machine, ulid }
}

/** 段取值来源工具：FNV-1a 64 → 16 位 hex（方案 §18.2 / §18.9 备用；新格式 machine 段直接用机器标识名）。 */
export function segmentHash(seed: string): string {
  let h = 0xcbf29ce484222325n
  const PRIME = 0x100000001b3n
  const MASK = 0xffffffffffffffffn
  for (let i = 0; i < seed.length; i++) {
    h ^= BigInt(seed.charCodeAt(i) & 0xff)
    h = (h * PRIME) & MASK
  }
  return h.toString(16).padStart(16, "0").slice(0, 8)
}
