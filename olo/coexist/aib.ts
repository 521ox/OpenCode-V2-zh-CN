// W-10 · M-B1 aib-core 签名级骨架（[CONTRACT] · 未编译/未安装/未运行）
// IAM Canon C3：AIB 绑定卡是机内 Agent 身份唯一权威；schema 以上游 §11 为设计权威，本件只引用不复制。
// 层间挂点唯一：卡内 spiffe_id 是机内身份获得密码学锚的唯一字段；SPIRE 未签发时恒 null（禁伪造，R9 全项目口径）。
import { readFileSync } from "node:fs"
import { X509Certificate } from "node:crypto"

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
  // 索引签名使 BindingCard 结构化兼容 guard.ts 的 BindingCardLike（W-13 钩子直传）；不削弱既有强类型字段。
  [key: string]: unknown
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
export function loadCard(file: string, anchor?: SpiffeAnchor): BindingCard {
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

  // 挂点唯一：未签发恒 null 断言（带 SVID 锚时由 X509 真实校验放行，见 assertSpiffeAnchor）
  assertSpiffeAnchor(bindingCard, anchor)

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

  // B8：签名校验——预签发（key_id/signature 均为 null）放行；已签发须由 SVID 锚验签（X）。
  // 无锚且签名/密钥非空 ≡ 伪造（阶段3 未提供验签器）；有锚且 X509 验过 ≡ 合法已签发卡。
  if ((bindingCard.signature !== null || bindingCard.key_id !== null) && !anchor) {
    throw new Error("OLO_CARD_UNVERIFIED: signature present but SVID anchor not provided (unverified)")
  }

  return bindingCard
}

export function assertRegistered(seed: BindingSeed): void {
  if (!seed.agent_id) throw new Error("OLO_AGENT_NOT_REGISTERED")
}
// SVID 外部锚（X）：spiffe_id 非空须由真实 SVID（X509 链 + SPIFFE ID 匹配）锚定；否则仍判未签发（防伪造）。
// 未签发恒 null 红线保留：无锚路径（loadCard 不带 anchor）对非空 spiffe_id 仍抛 OLO_SPIFFE_NOT_ISSUED。
// 验证逻辑与 SPIRE 签发的 X509-SVID 完全一致（同一 cert 格式 + 同一 CA bundle），故 SPIRE-ready。
export interface SpiffeAnchor {
  /** SVID 证书（含链，PEM） */
  svidPem: string
  /** 信任锚 CA bundle（PEM） */
  caBundlePem: string
}
// URI SAN 提取：Node/Bun 的 X509Certificate.san 不暴露 URI SAN（只暴露 DNS/IP/email），
// 且 Bun 无 getExtension。改为直接从 DER 字节解析 SAN 扩展（[6] IMPLICIT IA5String）。
// 与 SPIRE 签发的 X509-SVID 同一 cert 格式，故 SPIRE-ready。
function pemToDer(pem: string): Buffer {
  const base64 = pem
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("-----"))
    .join("")
  return Buffer.from(base64, "base64")
}

function readDerNode(data: Buffer, offset: number): { tag: number; start: number; length: number; next: number } {
  const tag = data[offset]
  const lenByte = data[offset + 1]
  let length: number
  let valueStart: number
  if (lenByte < 0x80) {
    length = lenByte
    valueStart = offset + 2
  } else {
    const numBytes = lenByte & 0x7f
    length = 0
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | data[offset + 2 + i]
    }
    valueStart = offset + 2 + numBytes
  }
  return { tag, start: valueStart, length, next: valueStart + length }
}

// 在 DER 中定位 SAN 扩展（OID 2.5.29.17 = 06 03 55 1d 11）的 OCTET STRING 值。
function findSanExtensionValue(der: Buffer): Buffer | null {
  const needle = [0x06, 0x03, 0x55, 0x1d, 0x11]
  for (let i = 0; i + needle.length <= der.length; i++) {
    let match = true
    for (let j = 0; j < needle.length; j++) {
      if (der[i + j] !== needle[j]) {
        match = false
        break
      }
    }
    if (!match) continue
    let k = i + needle.length
    // 可选 critical BOOLEAN（tag 0x01）
    if (der[k] === 0x01) k += 2
    // 期望 OCTET STRING（tag 0x04）
    if (der[k] !== 0x04) continue
    const node = readDerNode(der, k)
    return der.subarray(node.start, node.start + node.length)
  }
  return null
}

// 从 SAN 扩展值（GeneralNames SEQUENCE）中提取 URI SAN（[6] IMPLICIT IA5String，tag 0x86）。
function extractUriSans(sanValue: Buffer): string[] {
  const seq = readDerNode(sanValue, 0)
  const uris: string[] = []
  let off = seq.start
  const end = seq.start + seq.length
  while (off < end) {
    const node = readDerNode(sanValue, off)
    if (node.tag === 0x86) {
      uris.push(sanValue.subarray(node.start, node.start + node.length).toString("utf8"))
    }
    off = node.next
  }
  return uris
}

export function verifySpiffeAnchorX509(spiffe_id: string, anchor: SpiffeAnchor): boolean {
  try {
    const svid = new X509Certificate(anchor.svidPem)
    const ca = new X509Certificate(anchor.caBundlePem)
    const chainOk = svid.verify(ca.publicKey)
    const der = pemToDer(anchor.svidPem)
    const sanValue = findSanExtensionValue(der)
    const uris = sanValue ? extractUriSans(sanValue) : []
    const idOk = uris.includes(spiffe_id)
    const notExpired = svid.validTo ? new Date(svid.validTo).getTime() > Date.now() : true
    return Boolean(chainOk) && Boolean(idOk) && Boolean(notExpired)
  } catch {
    return false
  }
}
export function assertSpiffeAnchor(card: BindingCard, anchor?: SpiffeAnchor): void {
  if (card.spiffe_id === null) return
  if (!anchor) throw new Error("OLO_SPIFFE_NOT_ISSUED: unsigned anchor forbidden (no SVID anchor provided)")
  if (!verifySpiffeAnchorX509(card.spiffe_id, anchor)) {
    throw new Error("OLO_SPIFFE_NOT_ISSUED: SVID X509 anchor verification failed (fake anchor)")
  }
}
/** 带 SVID 锚加载：非空 spiffe_id 须经 X509 锚验证通过，否则仍判未签发（防伪造）。 */
export function loadCardWithAnchor(file: string, anchor: SpiffeAnchor): BindingCard {
  return loadCard(file, anchor)
}
