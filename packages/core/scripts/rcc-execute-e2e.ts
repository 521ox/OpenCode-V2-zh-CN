// W-56/57/58 · R-CC 真实 execute 端到端探针（GTX750-60 本机 bun 运行）
// 驱动 real DirectExecTool.Plugin.execute（经 6 个服务桩 + EnvironmentToolsCatalog.make 真实读 catalog），
// 经生产接线函数 rccAuthorizeBeforeExec 验证 R-CC-1/2/3 与快乐路径的「放行/拒绝」路由。
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Buffer } from "node:buffer"
import { Effect, Layer, Either, Option } from "effect"
import { ToolFailure } from "@opencode/ai/effect"
import { Plugin, rccAuthorizeBeforeExec } from "../src/tool/plugin/direct-exec.js"
import { Global } from "@opencode/util/global"
import { FSUtil } from "@opencode/util/fs-util"
import { EffectFlock } from "@opencode/util/effect-flock"
import { AppProcess } from "@opencode/util/process"
import { Location } from "../src/location.js"
import { FileAccess } from "../src/file-access.js"
import { Permission } from "../src/permission.js"

const ENV_ID = "11111111-1111-1111-1111-111111111111"
const EXE_PATH = "C:\\olo-e2e\\allowed-bin.exe"
const WORKTREE = "C:\\olo-e2e-worktree"
const ALLOW_ID = `${ENV_ID}:allowed-bin`
const catalogDoc = {
  schemaVersion: 1,
  environment: { id: ENV_ID, os: process.platform },
  tools: {
    "allowed-bin": {
      id: ALLOW_ID,
      name: "allowed-bin",
      aliases: [],
      path: EXE_PATH,
      kind: "native",
      launcher: null,
      capabilities: [],
      directExec: true,
      source: "user_provided",
      discoveredAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      lastUsedAt: null,
      status: "active",
      identity: { size: 0, modifiedAt: null },
      staleReason: null,
    },
  },
}

// ---- 7 个服务桩 ----
const globalLayer = Layer.succeed(Global.Service, Global.make({ config: "C:\\olo-e2e-seed", state: "C:\\olo-e2e-seed", data: "C:\\olo-e2e-seed" }) as any)
const fsLayer = Layer.succeed(
  FSUtil.Service,
  ({
    realPath: (t: string) => Effect.succeed(t),
    stat: (t: string) => Effect.succeed({ type: t === EXE_PATH ? "File" : "Directory", size: 0, mtime: Option.none() }),
    exists: () => Effect.succeed(true),
    readFileString: (p: string) => {
      if (String(p).endsWith("environment-tools.json")) return Effect.succeed(JSON.stringify(catalogDoc))
      if (String(p).endsWith("environment-id")) return Effect.succeed(ENV_ID + "\n")
      return Effect.succeed("")
    },
    ensureDir: () => Effect.succeed(undefined),
    writeFileString: () => Effect.succeed(undefined),
    rename: () => Effect.succeed(undefined),
    remove: () => Effect.succeed(undefined),
    makeDirectory: () => Effect.succeed(undefined),
    utimes: () => Effect.succeed(undefined),
  }) as any,
)
const flockLayer = Layer.succeed(
  EffectFlock.Service,
  ({
    acquire: () => Effect.succeed(undefined),
    withLock: ((...a: any[]) => a.find((x) => x && typeof x.pipe === "function") ?? Effect.succeed(undefined)) as any,
  }) as any,
)
const locationLayer = Layer.succeed(Location.Service, { directory: WORKTREE } as any)
const accessLayer = Layer.succeed(
  FileAccess.Service,
  ({
    resolve: (input: any) => Effect.succeed({ absolute: input.path, resource: input.path }),
    authorizeExternal: () => Effect.succeed(undefined),
    authorizeRead: (file: any) => Effect.succeed({ absolute: file, resource: file }),
  }) as any,
)
const permissionLayer = Layer.succeed(Permission.Service, { assert: () => Effect.succeed(undefined) } as any)
const processLayer = Layer.succeed(
  AppProcess.Service,
  ({
    run: () =>
      Effect.succeed({ exitCode: 0, stdout: Buffer.from("ok"), stderr: Buffer.from(""), stdoutTruncated: false, stderrTruncated: false }),
  }) as any,
)
const allLayers = Layer.mergeAll(globalLayer, fsLayer, flockLayer, locationLayer, accessLayer, permissionLayer, processLayer)

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

async function main() {
  // 捕获真实 execute
  let captured: any = null
  const fakeEditor = { add: (def: any) => { captured = def.execute } }
  const ctx: any = { tool: { transform: (cb: any) => Effect.sync(() => cb(fakeEditor)) } }
  await Effect.runPromise(Plugin.effect(ctx).pipe(Effect.provide(allLayers)))
  if (!captured) throw new Error("failed to capture execute from Plugin")

  const baseContext = (agent: string) => ({ agent, messageID: "m1", id: "i1", sessionID: "s1", progress: () => Effect.succeed(undefined) })

  // 预置：agent-A 持有 WORKTREE 租约
  const leaseHeldByA = join(mkdtempSync(join(tmpdir(), "olo-e2e-")), "lease.json")
  await Effect.runPromise(
    rccAuthorizeBeforeExec({ commandId: ALLOW_ID, agentUid: "agent-A", worktree: WORKTREE, leasePath: leaseHeldByA, declared: [ALLOW_ID] }),
  )

  const runExecute = async (input: any, agent: string, allowVal: string, leasePath: string) => {
    process.env.OLO_WRITE_GUARD_PATH = leasePath
    process.env.OLO_WRITE_GUARD_ALLOW = allowVal
    try {
      const ok = await Effect.runPromise(captured(input, baseContext(agent)))
      return { _tag: "Right" as const, right: ok }
    } catch (e: any) {
      return { _tag: "Left" as const, left: e }
    }
  }

  // 1) R-CC-3：staging 越界 —— evil-bin 不在白名单 ⇒ 拒绝
  {
    const lease = join(mkdtempSync(join(tmpdir(), "olo-e2e-")), "lease.json")
    const r = await runExecute({ id: `${ENV_ID}:evil-bin` }, "agent-A", ALLOW_ID, lease)
    const denied = r._tag === "Left"
    const reason = denied ? (r as any).left?.message : undefined
    check("R-CC-3 denied", denied, r)
    check("R-CC-3 reason names R-CC-3 + evil-bin", denied && typeof reason === "string" && reason.includes("R-CC-3") && reason.includes("evil-bin"), reason)
    console.log(`  [R-CC-3] evil-bin=${denied ? "denied(" + reason + ")" : "ALLOWED"}`)
  }

  // 2) R-CC-1/2：租约被 agent-A 持有，agent-B 申请 ⇒ 拒绝(lease held by A)
  {
    const r = await runExecute({ id: ALLOW_ID }, "agent-B", ALLOW_ID, leaseHeldByA)
    const denied = r._tag === "Left"
    const reason = denied ? (r as any).left?.message : undefined
    check("R-CC-1/2 denied", denied, r)
    check("R-CC-1/2 reason names agent-A lease", denied && typeof reason === "string" && reason.toLowerCase().includes("agent-a") && reason.toLowerCase().includes("lease"), reason)
    console.log(`  [R-CC-1/2] agent-B on A's lease=${denied ? "denied(" + reason + ")" : "ALLOWED"}`)
  }

  // 3) 快乐路径：agent-A + 白名单内 ⇒ 放行 + 真实走完 resolveExecutable→AppProcess.run
  {
    const lease = join(mkdtempSync(join(tmpdir(), "olo-e2e-")), "lease.json")
    const r = await runExecute({ id: ALLOW_ID }, "agent-A", ALLOW_ID, lease)
    const allowed = r._tag === "Right"
    const exitCode = allowed ? (r as any).right?.output?.exitCode : undefined
    check("happy allow", allowed, r)
    check("happy exitCode 0 (real execute path)", allowed && exitCode === 0, exitCode)
    const dbg = allowed ? "" : ` reason=${(r.left && (r.left.message ?? r.left._tag)) || String(r.left)} ctor=${r.left?.constructor?.name}`
    console.log(`  [happy] allowed-bin=${allowed ? "allow exitCode=" + exitCode : "DENIED" + dbg}`)
  }

  const total = passed + failed
  console.log(`rcc-execute-e2e: ${passed}/${total} PASS${failed > 0 ? " (FAIL: " + fails.join(" | ") + ")" : ""}`)
  if (failed > 0) process.exit(1)
}
main()
