import assert from "node:assert/strict"
import { evaluateToolGuard, OLO_TOOL_GUARD_CONTRACT, evaluateWriteToolGuard } from "./guard.ts"
import type { LeaseStatus } from "./lease.ts"

const card = { binding_id: "olo-aib/v1/x", status: "active" } as const

// 1. 契约不一致 → 拒绝
assert.equal(evaluateToolGuard({ contract: "wrong/v0", commandId: "x", card }).allow, false)

// 2. T11：无卡 → fail-closed
assert.equal(evaluateToolGuard({ contract: OLO_TOOL_GUARD_CONTRACT, commandId: "x", card: null }).allow, false)

// 3. 卡状态 revoked → 拒绝
assert.equal(
  evaluateToolGuard({ contract: OLO_TOOL_GUARD_CONTRACT, commandId: "x", card: { ...card, status: "revoked" } }).allow,
  false,
)

// 4. T11：白名单外命令 → fail-closed
assert.equal(
  evaluateToolGuard({ contract: OLO_TOOL_GUARD_CONTRACT, commandId: "evil", card, allowlist: ["good"] }).allow,
  false,
)

// 5. T14：卡内写入真实身份证号 → 拒绝
assert.equal(
  evaluateToolGuard({
    contract: OLO_TOOL_GUARD_CONTRACT,
    commandId: "x",
    card: { ...card, agent_id: "11010119900307123X" },
  }).allow,
  false,
)

// 6. 常态放行 + 透出 bindingId
const ok = evaluateToolGuard({ contract: OLO_TOOL_GUARD_CONTRACT, commandId: "x", card })
assert.equal(ok.allow, true)
assert.equal(ok.bindingId, card.binding_id)

// --- R-CC-2 写工具 fail-closed（W-57）---
const heldByMe: LeaseStatus = { held: true, owner: "agentA", worktree: "wt", expired: false }
const heldByOther: LeaseStatus = { held: true, owner: "agentB", worktree: "wt", expired: false }
const noLease: LeaseStatus = { held: false }
const expiredLease: LeaseStatus = { held: true, owner: "agentA", worktree: "wt", expired: true }

// 7. 写工具 + 无租约 ⇒ 拒
assert.equal(evaluateWriteToolGuard({ commandId: "write", agentUid: "agentA", lease: noLease }).allow, false)
// 8. 写工具 + 他人持锁 ⇒ 拒
assert.equal(evaluateWriteToolGuard({ commandId: "edit", agentUid: "agentA", lease: heldByOther }).allow, false)
// 9. 写工具 + 租约过期 ⇒ 拒
assert.equal(evaluateWriteToolGuard({ commandId: "patch", agentUid: "agentA", lease: expiredLease }).allow, false)
// 10. 写工具 + 本 agent 有效租约 ⇒ 放行
assert.equal(evaluateWriteToolGuard({ commandId: "apply_patch", agentUid: "agentA", lease: heldByMe }).allow, true)
// 11. 非写工具不受本门约束（仍放行，由 evaluateToolGuard 另行裁决）
assert.equal(evaluateWriteToolGuard({ commandId: "read", agentUid: "agentA", lease: noLease }).allow, true)

console.log("guard.test.ts: 11/11 PASS")
