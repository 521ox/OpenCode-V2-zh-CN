// W-56/57/58 · R-CC 阶段 3 运行期接线编排（[REGISTERED] · 不翻 [RUNTIME]）
// 将三机制编排为「写工具调用前」单一授权入口，供定制版 OpenCode 扩展在 direct-exec.ts
// 写路径前调用：① R-CC-1 单写者租约 claim/renew ② R-CC-2 写工具 fail-closed 门
// ③ R-CC-3 暂存集断言 ④ 事件留痕（租约/越界）。
// 纯函数式组合 + 注入式事件汇，可由 node --experimental-strip-types 直接验证；
// 实际调用点（direct-exec.ts 在写前持锁 / pre-commit 调 assertStagingSet / 租约事件落 agents.jsonl）
// 属 OpenCode 运行时接线，本环境 bun 不可用（bun turbo SIGILL 阻断核心构建验证），
// 故运行期实跑证据不可产，[RUNTIME] 仍不可宣称（§20.7 DoD 缺第②项运行期实跑证据）。
import { claimLease, readLease, type LeaseEventSink, type LeaseStatus } from "./lease.ts"
import { evaluateWriteToolGuard, type GuardResult, type WriteGuardInput } from "./guard.ts"
import { assertStagingSet } from "./staging-assert.ts"

export const OLO_WRITE_GUARD_CONTRACT = "olo-coexist/write-guard/v1" as const

export interface WriteAuthorizationInput {
  contract: string
  /** 环境工具 id（write/edit/patch/apply_patch …）；非写工具亦经统一门 + 暂存集校验 */
  commandId: string
  agentUid: string
  worktree: string
  leasePath: string
  /** `git diff --cached --name-only` 实际暂存集 */
  staged: string[]
  /** 本会话声明可写路径集 */
  declared: string[]
  ttlMs?: number
  now?: () => number
  emit?: LeaseEventSink
  normalize?: (p: string) => string
}

export interface WriteAuthorizationResult extends GuardResult {
  lease?: LeaseStatus
  /** 在 staged 但不在 declared 的越界路径（R-CC-3 要求指名） */
  stagingViolations?: string[]
}

// 编排：① 持锁（无锁/他持锁/过期 ⇒ claimLease 内部已 emit 并回收）② 写工具门 ③ 暂存集断言 ④ 事件留痕
export function authorizeWrite(input: WriteAuthorizationInput): WriteAuthorizationResult {
  if (input.contract !== OLO_WRITE_GUARD_CONTRACT) {
    return { allow: false, reason: "OLO_WRITE_GUARD: contract mismatch" }
  }
  // ① R-CC-1：写前持锁（claimLease 已按 O_CREAT|O_EXCL 原子申请；他持锁/过期回收均 fail-closed）
  const claim = claimLease({
    leasePath: input.leasePath,
    agentUid: input.agentUid,
    worktree: input.worktree,
    ttlMs: input.ttlMs,
    now: input.now,
    emit: input.emit,
  })
  if (!claim.ok) {
    // claimLease 已 emit lease_denied（他持锁）或 lease_expired + lease_reclaim（回收中）；此处 fail-closed 拒写
    return {
      allow: false,
      reason: claim.reason ?? "OLO_WRITE_GUARD: lease not acquired (R-CC-1 fail-closed)",
      bindingId: null,
    }
  }
  // ② R-CC-2：写工具门（claim 成功 ⇒ 本 agent 持有效租约，仍经统一门再裁决，避免任何绕过路径）
  const lease = readLease({ leasePath: input.leasePath, now: input.now })
  const guardInput: WriteGuardInput = {
    commandId: input.commandId,
    agentUid: input.agentUid,
    lease,
  }
  const guard = evaluateWriteToolGuard(guardInput)
  if (!guard.allow) {
    return { allow: false, reason: guard.reason, bindingId: null }
  }
  // ③ R-CC-3：暂存集断言（staged ⊆ declared；越界即拒且指名越界路径）
  const staging = assertStagingSet({
    staged: input.staged,
    declared: input.declared,
    normalize: input.normalize,
  })
  if (!staging.ok) {
    const at = input.now ? input.now() : Date.now()
    input.emit?.({
      type: "staging_violation",
      agent_uid: input.agentUid,
      worktree: input.worktree,
      at,
      detail: `paths: ${staging.violations.join(",")}`,
    })
    return {
      allow: false,
      reason: `OLO_WRITE_GUARD: staging set violation (R-CC-3): ${staging.violations.join(", ")}`,
      bindingId: null,
      stagingViolations: staging.violations,
    }
  }
  return { allow: true, bindingId: null, lease }
}
