// W-13 · M-B4 tool-guard 决策逻辑（W-13 仍 [CONTRACT]：需 OLO_AIB_CARD_PATH 身份卡，本环境未加载；R-CC-2 写工具门 [RUNTIME]：r630-10 bun 实测通过）
// T11：白名单外任意命令无卡 fail-closed；T14：身份卡写入零真实身份证号（扫描防御）。
// R-CC-2（W-57）：写工具须持本 agent 的有效租约，否则 fail-closed 拒写。
// 纯函数、零 OpenCode 运行时依赖，可由 node --experimental-strip-types 直接执行验证。
import type { LeaseStatus } from "./lease.ts"

export const OLO_TOOL_GUARD_CONTRACT = "olo-coexist/tool-guard/v1" as const

// R-CC-2：写类工具集合（方案 §20.2 R-CC-2）。运行期接线已由 direct-exec.ts rccAuthorizeBeforeExec 调用（r630-10 bun 实测通过）。
export const OLO_WRITE_TOOLS = ["write", "edit", "patch", "apply_patch"] as const
export type WriteTool = (typeof OLO_WRITE_TOOLS)[number]

// 真实身份证号形态扫描（防御性；T14：卡内不得写入真实身份证号）。
// 命中中国大陆 18 位身份证 或 美式 SSN（xxx-xx-xxxx）；仅作防御探针，避免误伤随机串。
const ID_NUMBER_PATTERN =
  /(?<!\d)(?:\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dxX]|\d{3}-\d{2}-\d{4})(?!\d)/

// 卡的最小结构（避免与 aib.ts 强耦合，保持本件可独立测试）
export interface BindingCardLike {
  binding_id: string
  status: string
  [key: string]: unknown
}

export interface GuardInput {
  contract: string
  commandId: string // 环境工具目录 id（direct-exec 传入的 valid.id）
  card: BindingCardLike | null // 当前机内身份卡；null = 无卡
  allowlist?: readonly string[] // 卡授权可执行的命令白名单；缺省为空=不限制（仅做状态/T14 检查）
}

export interface GuardResult {
  allow: boolean
  reason?: string
  bindingId?: string | null
}

// W-13 落码（仍 [CONTRACT] 未编译）：返回 allow=false 即 fail-closed 拒绝执行。
export function evaluateToolGuard(input: GuardInput): GuardResult {
  if (input.contract !== OLO_TOOL_GUARD_CONTRACT) {
    return { allow: false, reason: "OLO_TOOL_GUARD: contract mismatch" }
  }
  // T11：无卡即 fail-closed（白名单外任意命令无卡禁止执行）
  if (input.card === null) {
    return { allow: false, reason: "OLO_TOOL_GUARD: no identity card loaded (T11 fail-closed)" }
  }
  if (input.card.status !== "active" && input.card.status !== "registered") {
    return { allow: false, reason: `OLO_TOOL_GUARD: card status ${input.card.status} not executable` }
  }
  // T11：白名单外命令 fail-closed
  if (input.allowlist && input.allowlist.length > 0 && !input.allowlist.includes(input.commandId)) {
    return { allow: false, reason: `OLO_TOOL_GUARD: command ${input.commandId} not in allowlist (T11 fail-closed)` }
  }
  // T14：扫描卡内是否写入真实身份证号（防御性；卡本身不应含）
  if (ID_NUMBER_PATTERN.test(JSON.stringify(input.card))) {
    return { allow: false, reason: "OLO_TOOL_GUARD: real ID number detected in card (T14 violation)" }
  }
  return { allow: true, bindingId: input.card.binding_id }
}

// W-57 · R-CC-2 写工具 fail-closed 前置门（[RUNTIME] · r630-10 bun 运行期实测：非持有者拒写事件已产；运行期接线已落 direct-exec.ts rccAuthorizeBeforeExec）。
// 判据（方案 §20.2 R-CC-2）：write/edit/patch/apply_patch 一律经本门校验租约；
// 无租约 / 非持有者 / 租约过期 ⇒ 100% 拒绝且 caller 须落事件。非写工具不在此门约束。
export interface WriteGuardInput {
  commandId: string
  agentUid: string
  lease: LeaseStatus
}

export function evaluateWriteToolGuard(input: WriteGuardInput): GuardResult {
  if (!(OLO_WRITE_TOOLS as readonly string[]).includes(input.commandId)) {
    return { allow: true } // 非写工具：不在此门约束（由 evaluateToolGuard 另行裁决）
  }
  if (!input.lease.held || input.lease.expired) {
    return {
      allow: false,
      reason: "OLO_TOOL_GUARD: write tool requires an active lease (R-CC-2 fail-closed)",
      bindingId: null,
    }
  }
  if (input.lease.owner !== input.agentUid) {
    return {
      allow: false,
      reason: `OLO_TOOL_GUARD: lease held by ${input.lease.owner}, not ${input.agentUid} (R-CC-2)`,
      bindingId: null,
    }
  }
  return { allow: true, bindingId: null }
}
