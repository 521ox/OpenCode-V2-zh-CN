// W-10 · M-B1 aib-core 签名级骨架（[CONTRACT] · 未编译/未安装/未运行）
// IAM Canon C3：AIB 绑定卡是机内 Agent 身份唯一权威；schema 以上游 §11 为设计权威，本件只引用不复制。
// 层间挂点唯一：卡内 spiffe_id 是机内身份获得密码学锚的唯一字段；SPIRE 未签发时恒 null（禁伪造，R9 全项目口径）。
import { readFileSync } from "node:fs"

export type Scope = "repository-local"

export interface BindingSeed {
  agent_id: string
  permission_domain: string
  install_id: string
  install_family: string
  instance_nonce: string
  issued_at: string
}

export interface BindingCard extends BindingSeed {
  binding_id: string
  spiffe_id: string | null
  scope: Scope
  risk_tier: "T1" | "T2" | "T3" | "T4"
  runtime: {
    session_id?: string
    parent_id?: string
    child_id?: string
    subagent_depth?: number
    build_sha256?: string
    archived?: boolean | null
    worktree?: string | null
  }
  status: "registered" | "active" | "suspended" | "rotated" | "revoked"
  key_id: string | null
  signature: string | null
}

export function canonical(seed: BindingSeed): string {
  return JSON.stringify(seed, Object.keys(seed).sort() as any)
}

export function bindingId(seed: BindingSeed): string {
  return "olo-aib/v1/" + canonical(seed)
}

// B8：每轮加载校验 hash/signature，失败抛错（W-10 落码 · 仍 [CONTRACT] 未编译）
export function loadCard(file: string): BindingCard {
  let raw: string
  try {
    raw = readFileSync(file, "utf8")
  } catch (e) {
    throw new Error("OLO_CARD_INVALID: unreadable card file: " + (e as Error).message)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error("OLO_CARD_INVALID: malformed JSON: " + (e as Error).message)
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("OLO_CARD_INVALID: card must be a JSON object")
  }
  const card = parsed as Record<string, unknown>

  // 必填种子字段（BindingSeed）
  const SEED_KEYS: (keyof BindingSeed)[] = [
    "agent_id", "permission_domain", "install_id", "install_family", "instance_nonce", "issued_at",
  ]
  for (const k of SEED_KEYS) {
    if (typeof card[k] !== "string" || (card[k] as string).length === 0) {
      throw new Error("OLO_CARD_INVALID: missing/empty seed field: " + k)
    }
  }
  // 必填派生/状态字段
  if (typeof card.binding_id !== "string" || (card.binding_id as string).length === 0) {
    throw new Error("OLO_CARD_INVALID: missing binding_id")
  }
  if (card.scope !== "repository-local") {
    throw new Error("OLO_CARD_INVALID: scope must be repository-local (B3)")
  }
  if (!["T1", "T2", "T3", "T4"].includes(card.risk_tier as string)) {
    throw new Error("OLO_CARD_INVALID: risk_tier out of range")
  }
  if (!["registered", "active", "suspended", "rotated", "revoked"].includes(card.status as string)) {
    throw new Error("OLO_CARD_INVALID: status out of range")
  }
  if (card.spiffe_id !== null && typeof card.spiffe_id !== "string") {
    throw new Error("OLO_CARD_INVALID: spiffe_id must be null or string")
  }

  const bindingCard = card as unknown as BindingCard

  // 挂点唯一：未签发恒 null 断言（复用已有守卫）
  assertSpiffeAnchor(bindingCard)

  // B8：binding_id 须与种子规范化一致（防篡改/漂移）
  const seed: BindingSeed = {
    agent_id: card.agent_id as string,
    permission_domain: card.permission_domain as string,
    install_id: card.install_id as string,
    install_family: card.install_family as string,
    instance_nonce: card.instance_nonce as string,
    issued_at: card.issued_at as string,
  }
  if (bindingCard.binding_id !== bindingId(seed)) {
    throw new Error("OLO_CARD_INVALID: binding_id mismatch (tamper/drift)")
  }

  // B8：签名校验——预签发（key_id/signature 均为 null）放行；已签发须验签。
  // 验签器随 SPIRE/签署门在阶段 3 落地；本件不伪造验签，显式拒绝未验签卡。
  if (bindingCard.signature !== null || bindingCard.key_id !== null) {
    throw new Error("OLO_CARD_UNVERIFIED: signature present but verifier not provisioned (phase 3)")
  }

  return bindingCard
}

export function assertRegistered(seed: BindingSeed): void {
  if (!seed.agent_id) throw new Error("OLO_AGENT_NOT_REGISTERED")
}
// spiffe_id 恒 null 断言：未签发即 null，任何非空值须经 SPIRE 签发回填 + 验签回查（阶段 3）
export function assertSpiffeAnchor(card: BindingCard): void {
  if (card.spiffe_id !== null) throw new Error("OLO_SPIFFE_NOT_ISSUED: unsigned anchor forbidden")
}
