// W-36 · 注册表事件 schema 与冲突裁决（[CONTRACT] → 实现挂点 olo/coexist）
// + W-38 · 生命周期 / 墓碑 / 级联删除（T35） + W-37 三处同源 parity 校验 + W-39 双键聚合（D17）
// append-only 一行一事件；零 OpenCode 运行时依赖；可由 node --experimental-strip-types 直接验证。
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { UID_RE, buildAgentUid, parseAgentUid, type AgentKey, type AgentUidContext } from "./agent-uid.ts"

export type RegistryEventType =
  | "spawn_intent"
  | "spawned"
  | "suspended"
  | "rotated"
  | "revoked"
  | "tombstone"
  | "quarantine"

export interface RegistryEvent {
  ts: string
  event: RegistryEventType
  agent_uid: string
  agent_key?: AgentKey
  ephemeral?: boolean
  /** 恒 null 断言（§0.5.2 层间挂点唯一）；非空未签发 ⇒ OLO_SPIFFE_NOT_NULL */
  spiffe_id: null
  source_sha: string
  /** W-37 · 委派链三处同源之一（registry 侧）；receipt/audit 另两处由 W-41/olo-may 承载 */
  delegation_chain?: string[]
}

/** 注入式存储适配：测试用 MemoryStore；运行时用 FileStore（%USERPROFILE%\.olo\registry\agents.jsonl）。 */
export interface RegistryStore {
  read(): string
  append(line: string): void
}

export class MemoryStore implements RegistryStore {
  private buf = ""
  read(): string {
    return this.buf
  }
  append(line: string): void {
    this.buf += line + "\n"
  }
}

export class FileStore implements RegistryStore {
  private readonly path: string
  constructor(path: string) {
    this.path = path
    const d = dirname(path)
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  }
  read(): string {
    if (!existsSync(this.path)) return ""
    return readFileSync(this.path, "utf8")
  }
  append(line: string): void {
    appendFileSync(this.path, line + "\n", "utf8")
  }
}

export function defaultRegistryStore(): RegistryStore {
  return new FileStore(join(homedir(), ".olo", "registry", "agents.jsonl"))
}

const TRANSITIONS: RegistryEventType[] = ["suspended", "rotated", "revoked", "tombstone", "quarantine"]

export class Registry {
  private readonly store: RegistryStore
  constructor(store: RegistryStore) {
    this.store = store
  }

  private parseAll(): RegistryEvent[] {
    const raw = this.store.read()
    if (!raw.trim()) return []
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as RegistryEvent)
  }

  private assertSchema(e: RegistryEvent): void {
    if (e.spiffe_id !== null) throw new Error("OLO_SPIFFE_NOT_NULL")
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.ts)) throw new Error("OLO_REGISTRY_TS_FORMAT")
    if (!UID_RE.test(e.agent_uid)) throw new Error("OLO_UID_MALFORMED")
    if (!TRANSITIONS.includes(e.event) && e.event !== "spawn_intent" && e.event !== "spawned")
      throw new Error("OLO_REGISTRY_EVENT_UNKNOWN")
  }

  private assertAppend(e: RegistryEvent): void {
    this.assertSchema(e)
    const all = this.parseAll()
    const lastTs = all.length ? all[all.length - 1].ts : ""
    if (lastTs && e.ts < lastTs) throw new Error("OLO_REGISTRY_TS_REGRESSION")
    this.store.append(JSON.stringify(e))
  }

  /** 任一 spawn_intent（悬挂或已完成）永久保留该 UID —— 实现「崩溃不复活」与「永不复用」统一守卫。 */
  private reservedUids(): Set<string> {
    const s = new Set<string>()
    for (const e of this.parseAll()) if (e.event === "spawn_intent") s.add(e.agent_uid)
    return s
  }

  /** 已 spawned（含 suspended/rotated）活着的 UID 集合。 */
  aliveUids(): Set<string> {
    const s = new Set<string>()
    for (const e of this.parseAll()) {
      if (e.event === "spawned" || e.event === "suspended" || e.event === "rotated") s.add(e.agent_uid)
      if (e.event === "revoked" || e.event === "tombstone") s.delete(e.agent_uid)
    }
    return s
  }

  /**
   * W-35 write-ahead + 并发唯一：先落 spawn_intent（落盘失败 ⇒ 调用方拒启），再落 spawned。
   * 同一 UID 二次 spawn（含悬挂 intent 后重启）→ OLO_UID_REUSE_FORBIDDEN。
   */
  spawn(
    key: AgentKey,
    ctx: AgentUidContext,
    opts: { ts: string; source_sha: string; ephemeral?: boolean; delegation_chain?: string[] },
  ): string {
    const uid = buildAgentUid(ctx)
    if (this.reservedUids().has(uid)) throw new Error("OLO_UID_REUSE_FORBIDDEN")
    const base = {
      ts: opts.ts,
      agent_uid: uid,
      agent_key: key,
      ephemeral: opts.ephemeral ?? false,
      spiffe_id: null as null,
      source_sha: opts.source_sha,
    } as const
    this.assertAppend({ ...base, event: "spawn_intent" })
    this.assertAppend({
      ...base,
      event: "spawned",
      delegation_chain: opts.delegation_chain,
    })
    return uid
  }

  /** 崩溃恢复：悬挂 spawn_intent（无后续 spawned）直接转 tombstone，确保该 UID 永不重启发号。 */
  crashTombstone(uid: string, ts: string, source_sha: string): void {
    const all = this.parseAll()
    const intent = all.find((e) => e.agent_uid === uid && e.event === "spawn_intent")
    if (!intent) throw new Error("OLO_TOMBSTONE_NO_INTENT")
    const completed = all.some((e) => e.agent_uid === uid && e.event === "spawned")
    if (completed) throw new Error("OLO_TOMBSTONE_ALREADY_SPAWNED")
    this.assertAppend({ ts, agent_uid: uid, spiffe_id: null, source_sha, event: "tombstone" })
  }

  private transition(event: RegistryEventType, uid: string, ts: string, source_sha: string): void {
    if (!this.reservedUids().has(uid) && !this.aliveUids().has(uid))
      throw new Error("OLO_REGISTRY_UID_UNKNOWN")
    this.assertAppend({ ts, agent_uid: uid, spiffe_id: null, source_sha, event })
  }

  suspend(uid: string, ts: string, source_sha: string): void {
    this.transition("suspended", uid, ts, source_sha)
  }
  rotate(uid: string, ts: string, source_sha: string): void {
    this.transition("rotated", uid, ts, source_sha)
  }
  revoke(uid: string, ts: string, source_sha: string): void {
    this.transition("revoked", uid, ts, source_sha)
  }
  tombstone(uid: string, ts: string, source_sha: string): void {
    this.transition("tombstone", uid, ts, source_sha)
  }
  /** W-40：对无 UID / 存量外部实例全覆盖登记；不要求 UID 预存在（这正是 quarantine 的语义）。 */
  quarantine(uid: string, ts: string, source_sha: string): void {
    this.assertAppend({ ts, agent_uid: uid, spiffe_id: null, source_sha, event: "quarantine" })
  }

  /** W-38 级联删除：父撤销 ⇒ 子链逐层 revoked + tombstone（历史行保留，append-only）。 */
  cascadeRevoke(uid: string, children: string[], ts: string, source_sha: string): void {
    this.revoke(uid, ts, source_sha)
    this.tombstone(uid, ts, source_sha)
    for (const c of children) {
      if (this.aliveUids().has(c)) {
        this.revoke(c, ts, source_sha)
        this.tombstone(c, ts, source_sha)
      }
    }
  }

  /**
   * W-37 三处同源 parity：registry / receipt / audit 的 delegation_chain 须逐项相等。
   * 缺一处视为未完成，不以「两处一致」冒充通过。
   */
  static verifyChainParity(chains: Array<string[] | undefined>): void {
    const present = chains.filter((c): c is string[] => Array.isArray(c))
    if (present.length < 3) throw new Error("OLO_DELEGATION_CHAIN_INCOMPLETE")
    const [a, b, c] = present
    const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i])
    if (!eq(a, b) || !eq(b, c)) throw new Error("OLO_DELEGATION_CHAIN_MISMATCH")
  }

  /** W-39 · 按双键 (install_family, agent_id) 聚合（配额/成本/审计），agent_uid 下钻。签名 [UNPROVEN] 不冒充。count = 已 spawned 实例数。 */
  aggregateByAgentKey(): Map<string, { count: number; uids: string[] }> {
    const m = new Map<string, { count: number; uids: string[] }>()
    for (const e of this.parseAll()) {
      if (e.event !== "spawned") continue
      const k = e.agent_key
      if (!k) continue
      const id = `${k.install_family}|${k.agent_id}`
      const cur = m.get(id) ?? { count: 0, uids: [] }
      cur.count++
      cur.uids.push(e.agent_uid)
      m.set(id, cur)
    }
    return m
  }

  /** W-40 辅助：对无 UID 的存量/外部实例生成 quarantine 事件（全覆盖，不静默跳过）。 */
  quarantineInventory(instances: Array<{ uid: string }>, ts: string, source_sha: string): number {
    let n = 0
    for (const inst of instances) {
      this.quarantine(inst.uid, ts, source_sha)
      n++
    }
    return n
  }
}

export { parseAgentUid, buildAgentUid }
