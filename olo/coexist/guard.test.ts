import assert from "node:assert/strict"
import { evaluateToolGuard, OLO_TOOL_GUARD_CONTRACT } from "./guard.ts"

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

console.log("guard.test.ts: 6/6 PASS")
