// W-56/57/58 · R-CC 运行期实跑探针（本机 bun 1.4.4 运行，产运行期实跑证据；非 [RUNTIME] 翻态：fail-open 默认 / 生产接线未做，账本 v1.62：0 [RUNTIME]）
// 直接调用 production 接线函数 rccAuthorizeBeforeExec（packages/core direct-exec.ts），
// 经真实 olo-coexist/write-guard 模块解析 + 真实 FS 租约文件，捕获事件并断言 R-CC-1/3。
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { rccAuthorizeBeforeExec } from "../src/tool/plugin/direct-exec.ts"
import { evaluateWriteToolGuard } from "olo-coexist/guard"
import type { LeaseEvent, LeaseEventSink } from "olo-coexist/lease"

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
function memSink(events: LeaseEvent[]): LeaseEventSink {
  return (e) => events.push(e)
}
function freshLeasePath(): string {
  const d = mkdtempSync(join(tmpdir(), "olo-rcc-"))
  return join(d, "lease.json")
}

async function run() {
  // 1) R-CC-1：单写者租约 —— A 持锁，B 申请被拒 + lease_denied(held by A)
  {
    const lp = freshLeasePath()
    const evA: LeaseEvent[] = []
    await Effect.runPromise(
      rccAuthorizeBeforeExec({ commandId: "x", agentUid: "agent-A", worktree: "wt1", leasePath: lp, declared: ["x"], emit: memSink(evA) }),
    )
    const evB: LeaseEvent[] = []
    const rB = await Effect.runPromise(
      rccAuthorizeBeforeExec({ commandId: "x", agentUid: "agent-B", worktree: "wt1", leasePath: lp, declared: ["x"], emit: memSink(evB) }),
    )
    check("R-CC-1 B denied", rB.allow === false, rB)
    check("R-CC-1 lease_denied(held by A)", evB.some((e) => e.type === "lease_denied" && e.detail?.includes("agent-A")), evB)
    console.log(`  [R-CC-1] A=acquire, B=${rB.allow ? "allow" : "denied(" + rB.reason + ")"} events=${JSON.stringify(evB.map((e) => e.type))}`)
  }
  // 2) R-CC-3：暂存集越界 —— 请求的 catalog id 不在 declared 白名单 ⇒ 拒 + staging_violation 指名
  {
    const events: LeaseEvent[] = []
    const r = await Effect.runPromise(
      rccAuthorizeBeforeExec({ commandId: "evil-bin", agentUid: "agent-A", worktree: "wt1", leasePath: freshLeasePath(), declared: ["allowed-bin"], emit: memSink(events) }),
    )
    check("R-CC-3 staging denied", r.allow === false, r)
    check("R-CC-3 violation named", (r.stagingViolations ?? []).includes("evil-bin"), r)
    check("R-CC-3 staging_violation emitted", events.some((e) => e.type === "staging_violation" && e.detail?.includes("evil-bin")), events)
    console.log(`  [R-CC-3] evil-bin=${r.allow ? "allow" : "denied(" + r.reason + ")"} violations=${JSON.stringify(r.stagingViolations)}`)
  }
  // 3) 快乐路径：白名单内直执行 ⇒ 放行 + lease_acquire
  {
    const events: LeaseEvent[] = []
    const r = await Effect.runPromise(
      rccAuthorizeBeforeExec({ commandId: "allowed-bin", agentUid: "agent-A", worktree: "wt1", leasePath: freshLeasePath(), declared: ["allowed-bin"], emit: memSink(events) }),
    )
    check("happy allow", r.allow === true, r)
    check("happy lease_acquire emitted", events.some((e) => e.type === "lease_acquire"), events)
    console.log(`  [happy] allowed-bin=${r.allow ? "allow" : "denied(" + r.reason + ")"} events=${JSON.stringify(events.map((e) => e.type))}`)
  }
  // 4) R-CC-2：写工具门（生产级 evaluateWriteToolGuard）—— 持他人租约/非持有者 ⇒ fail-closed 拒写
  {
    const r = evaluateWriteToolGuard({ commandId: "write", agentUid: "agent-B", lease: { held: true, owner: "agent-A", expired: false } })
    check("R-CC-2 write-tool gate denies non-owner", r.allow === false, r)
    check("R-CC-2 reason mentions R-CC-2", (r.reason ?? "").includes("R-CC-2"), r)
    console.log(`  [R-CC-2] write by non-owner=${r.allow ? "allow" : "denied(" + r.reason + ")"}`)
  }
  const total = passed + failed
  console.log(`rcc-runtime-probe: ${passed}/${total} PASS${failed > 0 ? " (FAIL: " + fails.join(" | ") + ")" : ""}`)
  if (failed > 0) process.exit(1)
}
run()
