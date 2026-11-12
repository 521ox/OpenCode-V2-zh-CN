// W-35 · agent_uid 生成器（[CONTRACT] → 实现挂点 olo/coexist；配套 Python 判据 tools/t33_t36_identity_tests.py 属 W-41 待落）
// 纯函数 + 段取值来源；write-ahead / 并发唯一 / 崩溃墓碑的协调在 registry.ts（W-36/W-38）。
// 零 OpenCode 运行时依赖，可由 node --experimental-strip-types 直接执行验证（与 aib/guard 同形态）。
export interface AgentKey {
  install_family: string
  agent_id: string
}

export interface AgentUidContext {
  /** 跨机互斥段：机器标识哈希前 8 位（换机必变） */
  machine8: string
  /** 二进制/构建哈希段：构建产物哈希前 8 位（跟版产生新构建 ⇒ 每段必变） */
  install8: string
  /** 进程启动序号：单调计数（进程重启必变） */
  boot_seq: number
  /** 实例派生序号：单调计数（同进程内不复用） */
  spawn_seq: number
}

/** W-35 分段命名形态：`ag.<machine8>.<install8>.<boot_seq>.<spawn_seq>` */
export const UID_RE = /^ag\.([0-9a-f]{8})\.([0-9a-f]{8})\.(\d+)\.(\d+)$/

export function buildAgentUid(ctx: AgentUidContext): string {
  return `ag.${ctx.machine8}.${ctx.install8}.${ctx.boot_seq}.${ctx.spawn_seq}`
}

export function parseAgentUid(uid: string): AgentUidContext {
  const m = UID_RE.exec(uid)
  if (!m) throw new Error("OLO_UID_MALFORMED")
  const machine8 = m[1]
  const install8 = m[2]
  if (machine8 === undefined || install8 === undefined) throw new Error("OLO_UID_MALFORMED")
  return {
    machine8,
    install8,
    boot_seq: Number(m[3]),
    spawn_seq: Number(m[4]),
  }
}

/** 段取值来源（方案 §18.2 / §18.9）：machine8/install8 各取标识哈希前 8 位（FNV-1a 64 → hex 截断）。 */
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
