// W-36/W-38 · 注册表 append-only 事件日志单测（node --experimental-strip-types；与 aib/guard 同形态）
import {
  Registry,
  MemoryStore,
  defaultRegistryStore,
  type AgentKey,
} from "./registry.ts"
import { buildAgentUid } from "./agent-uid.ts"
import { sep } from "node:path"

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

const KEY: AgentKey = { install_family: "f1", agent_id: "a1" }
const SHA = "sha-local-0001"

function ctx(boot: number, spawn: number) {
  return { machine8: "abcdef01", install8: "12345678", boot_seq: boot, spawn_seq: spawn }
}

check("schema: spiffe_id 非空 ⇒ OLO_SPIFFE_NOT_NULL", () => {
  const r = new Registry(new MemoryStore())
  let msg = ""
  try {
    ;(r as any).assertAppend({
      ts: "2026-11-12T10:00:00",
      event: "quarantine",
      agent_uid: "ag.abcdef01.12345678.1.1",
      spiffe_id: "spiffe://x",
      source_sha: SHA,
    })
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_SPIFFE_NOT_NULL")) throw new Error("expected OLO_SPIFFE_NOT_NULL, got " + msg)
})

check("append: ts 倒序 ⇒ OLO_REGISTRY_TS_REGRESSION", () => {
  const r = new Registry(new MemoryStore())
  r.spawn(KEY, ctx(1, 1), { ts: "2026-11-12T10:00:05", source_sha: SHA })
  let msg = ""
  try {
    r.spawn(KEY, ctx(1, 2), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_REGISTRY_TS_REGRESSION")) throw new Error("expected TS_REGRESSION, got " + msg)
})

check("spawn: write-ahead 落 spawn_intent + spawned 两行", () => {
  const s = new MemoryStore()
  const r = new Registry(s)
  const uid = r.spawn(KEY, ctx(1, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  const lines = s.read().trim().split("\n")
  if (lines.length !== 2) throw new Error("expected 2 lines, got " + lines.length)
  if (JSON.parse(lines[0]).event !== "spawn_intent") throw new Error("first must be spawn_intent")
  if (JSON.parse(lines[1]).event !== "spawned") throw new Error("second must be spawned")
  if (uid !== buildAgentUid(ctx(1, 1))) throw new Error("uid mismatch")
})

check("spawn: 同 UID 二次 ⇒ OLO_UID_REUSE_FORBIDDEN", () => {
  const r = new Registry(new MemoryStore())
  r.spawn(KEY, ctx(1, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  let msg = ""
  try {
    r.spawn(KEY, ctx(1, 1), { ts: "2026-11-12T10:00:01", source_sha: SHA })
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_UID_REUSE_FORBIDDEN")) throw new Error("expected REUSE_FORBIDDEN, got " + msg)
})

check("崩溃恢复: 悬挂 intent 转 tombstone 后复用仍 OLO_UID_REUSE_FORBIDDEN", () => {
  const s = new MemoryStore()
  const r = new Registry(s)
  // 模拟崩溃：只落了 spawn_intent（手动 append 一条 intent，不 spawned）
  s.append(JSON.stringify({ ts: "2026-11-12T10:00:00", event: "spawn_intent", agent_uid: buildAgentUid(ctx(1, 9)), agent_key: KEY, ephemeral: false, spiffe_id: null, source_sha: SHA }))
  r.crashTombstone(buildAgentUid(ctx(1, 9)), "2026-11-12T10:00:01", SHA)
  let msg = ""
  try {
    r.spawn(KEY, ctx(1, 9), { ts: "2026-11-12T10:00:02", source_sha: SHA })
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_UID_REUSE_FORBIDDEN")) throw new Error("expected REUSE_FORBIDDEN after crash, got " + msg)
})

check("aliveUids: spawned→revoked 后非 alive", () => {
  const r = new Registry(new MemoryStore())
  const uid = r.spawn(KEY, ctx(2, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  if (!r.aliveUids().has(uid)) throw new Error("should be alive after spawn")
  r.revoke(uid, "2026-11-12T10:00:01", SHA)
  r.tombstone(uid, "2026-11-12T10:00:02", SHA)
  if (r.aliveUids().has(uid)) throw new Error("should not be alive after tombstone")
})

check("级联删除: 父 revoked+tombstone + 子逐层", () => {
  const r = new Registry(new MemoryStore())
  const parent = r.spawn(KEY, ctx(3, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  const child = r.spawn(KEY, ctx(3, 2), { ts: "2026-11-12T10:00:01", source_sha: SHA })
  r.cascadeRevoke(parent, [child], "2026-11-12T10:00:02", SHA)
  if (r.aliveUids().has(parent) || r.aliveUids().has(child)) throw new Error("cascade failed")
})

check("W-37 三处同源 parity: 一致通过 / 不一致 OLO_DELEGATION_CHAIN_MISMATCH", () => {
  const a = ["u1", "u2", "u3"]
  Registry.verifyChainParity([a, [...a], [...a]])
  let msg = ""
  try {
    Registry.verifyChainParity([a, ["u1", "uX", "u3"], [...a]])
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes("OLO_DELEGATION_CHAIN_MISMATCH")) throw new Error("expected MISMATCH, got " + msg)
})

check("W-39 双键聚合: 按 (install_family,agent_id) 计数", () => {
  const r = new Registry(new MemoryStore())
  r.spawn(KEY, ctx(4, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  r.spawn(KEY, ctx(4, 2), { ts: "2026-11-12T10:00:01", source_sha: SHA })
  const m = r.aggregateByAgentKey()
  const agg = m.get("f1|a1")
  if (!agg || agg.count !== 2) throw new Error("expected 2 for f1|a1, got " + JSON.stringify(agg))
})

check("W-40 quarantine: 无 UID 存量全覆盖", () => {
  const r = new Registry(new MemoryStore())
  const n = r.quarantineInventory(
    [{ uid: "ag.aaaaaaaa.bbbbbbbb.1.1" }, { uid: "ag.aaaaaaaa.bbbbbbbb.1.2" }],
    "2026-11-12T10:00:00",
    SHA,
  )
  if (n !== 2) throw new Error("expected 2 quarantined, got " + n)
})

check("defaultRegistryStore 落点 %USERPROFILE%\\.olo\\registry\\agents.jsonl", () => {
  const s = defaultRegistryStore() as any
  if (!String(s.path).includes(".olo" + sep + "registry")) throw new Error("wrong path " + s.path)
})

check("W-37 委派链派生: 子代链 = 父链 + 子 uid（>2 层可递推）", () => {
  const store = new MemoryStore()
  const r = new Registry(store)
  const parent = r.spawn(KEY, ctx(5, 1), { ts: "2026-11-12T10:00:00", source_sha: SHA })
  const childUid = r.spawn(KEY, ctx(5, 2), { ts: "2026-11-12T10:00:01", source_sha: SHA, parentUid: parent })
  const events = store.read().trim().split("\n").map((l) => JSON.parse(l))
  const childSpawned = events.find((e: any) => e.event === "spawned" && e.agent_uid === childUid)
  if (!childSpawned || JSON.stringify(childSpawned.delegation_chain) !== JSON.stringify([parent, childUid]))
    throw new Error("chain mismatch: " + JSON.stringify(childSpawned?.delegation_chain))
  // 三层：孙代
  const grand = r.spawn(KEY, ctx(5, 3), { ts: "2026-11-12T10:00:02", source_sha: SHA, parentUid: childUid })
  const gEvents = store.read().trim().split("\n").map((l) => JSON.parse(l))
  const gSpawned = gEvents.find((e: any) => e.event === "spawned" && e.agent_uid === grand)
  if (JSON.stringify(gSpawned.delegation_chain) !== JSON.stringify([parent, childUid, grand]))
    throw new Error("3-level chain mismatch: " + JSON.stringify(gSpawned?.delegation_chain))
})

check("W-37 buildDelegationChain: 无父链 ⇒ [child] / 有父链 ⇒ 父+子", () => {
  if (JSON.stringify(Registry.buildDelegationChain(undefined, "c")) !== JSON.stringify(["c"]))
    throw new Error("no-parent should be [c]")
  if (JSON.stringify(Registry.buildDelegationChain(["a", "b"], "c")) !== JSON.stringify(["a", "b", "c"]))
    throw new Error("with-parent should be [a,b,c]")
})

check("W-37 三处同源 parity: registry 链 + receipt + audit 一致 ⇒ 通过", () => {
  // 三处同源：registry（本册代码侧）/ receipt v2（olo-may artifacts）/ audit（olo-may artifacts）
  // receipt/audit 两处落盘在 olo-may，此处用同值模拟三处落盘后的校验
  const chain = ["u1", "u2", "u3"]
  Registry.verifyChainParity([chain, [...chain], [...chain]])
})

console.log(`\nRESULT passed=${passed} failed=${failed}`)
if (failed > 0) process.exit(1)
