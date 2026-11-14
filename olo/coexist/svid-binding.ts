// W-43 · UID <-> SVID 绑定接口（[CONTRACT] -> 合约层实现挂点 olo/coexist）
// 规格：方案 §18.10.3 / §18.10.4 / T38（凭据可换、UID 不变）。
// 红线：SPIRE 未部署前 spiffe_id 恒 null（§0.5.2 层间挂点唯一 / R9 / C3）；
//       两列 svid_serial_hash / svid_trust_domain 未签发恒 null，禁伪造、禁预填。
// 边界：本模块只提供可空列 + 签发回填 + 验签回查的纯函数，零 OpenCode 运行时依赖、
//       零真实 SPIRE 依赖；verifier 由调用方注入（dev/test shim 工程解法）。
//       真实签发、卡-SVID 双向验证与运行期接线属阶段 3，本模块不冒充已具备。
import { createHash, X509Certificate } from "node:crypto"
import { UID_RE } from "./agent-uid.ts"

/** 已签发 SVID 的调用方凭据；spiffe_id 恒 null（未签发身份不得虚构）。 */
export interface SvidCredential {
  serial: string
  trust_domain: string
  spiffe_id: null
}

/** registry 侧可空绑定列；未签发时两列与 bound_at 恒 null。 */
export interface SvidBinding {
  agent_uid: string
  svid_serial_hash: string | null
  svid_trust_domain: string | null
  bound_at: string | null
  spiffe_id: null
}

/** 注入式验签器：生产由 SPIRE/Vault 侧提供，合约层单测用确定性替身。 */
export type SvidVerifier = (input: {
  agent_uid: string
  serial: string
  trust_domain: string
  serial_hash: string
}) => boolean

export interface SvidReceiptView {
  agent_uid: string
  svid_serial_hash: string
  svid_trust_domain: string
}

export function hashSvidSerial(serial: string): string {
  return createHash("sha256").update(serial, "utf8").digest("hex")
}

/** 未签发初始态：不预填、不合成、不猜测任何 SVID 字段。 */
export function emptySvidBinding(agentUid: string): SvidBinding {
  if (!UID_RE.test(agentUid)) throw new Error("OLO_SVID_UID_MALFORMED")
  return {
    agent_uid: agentUid,
    svid_serial_hash: null,
    svid_trust_domain: null,
    bound_at: null,
    spiffe_id: null,
  }
}

function assertCredential(cred: SvidCredential): void {
  if (cred.spiffe_id !== null) throw new Error("OLO_SVID_SPIFFE_NOT_ISSUED")
  if (!cred.serial || cred.serial.trim().length === 0) throw new Error("OLO_SVID_SERIAL_EMPTY")
  if (!cred.trust_domain || cred.trust_domain.trim().length === 0)
    throw new Error("OLO_SVID_TRUST_DOMAIN_MISMATCH")
}

function assertBindingShape(b: SvidBinding): void {
  if (!UID_RE.test(b.agent_uid)) throw new Error("OLO_SVID_UID_MALFORMED")
  if (b.spiffe_id !== null) throw new Error("OLO_SVID_SPIFFE_NOT_ISSUED")
  if (b.svid_serial_hash === null || b.svid_trust_domain === null)
    throw new Error("OLO_SVID_NOT_ISSUED")
}

/**
 * 签发回填：仅在显式提供已签发凭据且验签器通过时写入两列。
 * 只存 serial 的 sha256、不存明文；返回新对象（不可变），UID 恒定。
 */
export function bindSvid(
  binding: SvidBinding,
  cred: SvidCredential,
  verifier: SvidVerifier,
  ts: string,
): SvidBinding {
  if (!UID_RE.test(binding.agent_uid)) throw new Error("OLO_SVID_UID_MALFORMED")
  if (binding.spiffe_id !== null) throw new Error("OLO_SVID_SPIFFE_NOT_ISSUED")
  assertCredential(cred)
  const serialHash = hashSvidSerial(cred.serial)
  if (
    !verifier({
      agent_uid: binding.agent_uid,
      serial: cred.serial,
      trust_domain: cred.trust_domain,
      serial_hash: serialHash,
    })
  )
    throw new Error("OLO_SVID_VERIFY_FAILED")
  return {
    agent_uid: binding.agent_uid,
    svid_serial_hash: serialHash,
    svid_trust_domain: cred.trust_domain,
    bound_at: ts,
    spiffe_id: null,
  }
}

/** 验签回查：serial hash / trust domain / 注入式验签器三重比对。 */
export function verifySvidBinding(
  binding: SvidBinding,
  cred: SvidCredential,
  verifier: SvidVerifier,
): "PASS" {
  assertBindingShape(binding)
  assertCredential(cred)
  if (cred.trust_domain !== binding.svid_trust_domain)
    throw new Error("OLO_SVID_TRUST_DOMAIN_MISMATCH")
  const serialHash = hashSvidSerial(cred.serial)
  if (serialHash !== binding.svid_serial_hash) throw new Error("OLO_SVID_VERIFY_FAILED")
  if (
    !verifier({
      agent_uid: binding.agent_uid,
      serial: cred.serial,
      trust_domain: cred.trust_domain,
      serial_hash: serialHash,
    })
  )
    throw new Error("OLO_SVID_VERIFY_FAILED")
  return "PASS"
}

/** T38 · 凭据可换、UID 不变：先验旧凭据，再换新凭据并断言 UID 恒定。 */
export function rotateSvid(
  binding: SvidBinding,
  oldCred: SvidCredential,
  newCred: SvidCredential,
  verifier: SvidVerifier,
  ts: string,
): SvidBinding {
  verifySvidBinding(binding, oldCred, verifier)
  const next = bindSvid(binding, newCred, verifier, ts)
  if (next.agent_uid !== binding.agent_uid) throw new Error("OLO_SVID_UID_CHANGED")
  return next
}

/** receipt v2 侧投影：只带 UID + 两列，不带明文 serial、不带 spiffe_id。 */
export function embedReceiptSvidBinding<T extends Record<string, unknown>>(
  receipt: T,
  binding: SvidBinding,
): T & { svid_binding: SvidReceiptView } {
  assertBindingShape(binding)
  return {
    ...receipt,
    svid_binding: {
      agent_uid: binding.agent_uid,
      svid_serial_hash: binding.svid_serial_hash as string,
      svid_trust_domain: binding.svid_trust_domain as string,
    },
  }
}

/** 拆分 PEM 证书 bundle（支持真实 SPIRE 的 root+intermediate 多证书链）。 */
function splitPemCerts(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? []
}

/**
 * X）SVID 外部锚真实 X509 校验（SPIRE-ready）：验证 SVID 证书链到 CA bundle
 * （支持 root+intermediate 多证书），且其序列号 sha256 与 binding.svid_serial_hash 一致
 * （W-43 UID↔SVID 绑定回查）。运行期信任域 = iot.internal（r620-66 既有 SPIRE 服务器，
 * spiffe://olo 不可签发）；olo 仅作概念域。dev 实证用本地自签 iot.internal CA 生成的 SVID，
 * 验证逻辑与运行期真实签发完全一致（同一 cert 格式 + 同一 CA bundle 形态）。
 */
export function verifySvidX509(binding: SvidBinding, svidPem: string, caBundlePem: string): "PASS" {
  const svid = new X509Certificate(svidPem)
  // 链校验：SVID 须由 CA bundle 中某张 CA 证书签名（支持 root+intermediate 链）；
  // 真实 SPIRE 的 SVID 由其签发 CA（subject == SVID issuer）签名，标准 X.509 名称链校验即成立。
  let chainOk = false
  for (const c of splitPemCerts(caBundlePem)) {
    try {
      if (svid.verify(new X509Certificate(c).publicKey)) { chainOk = true; break }
    } catch { /* try next */ }
  }
  if (!chainOk) {
    throw new Error("OLO_SVID_VERIFY_FAILED: SVID signature does not verify against CA bundle")
  }
  const serialHash = createHash("sha256").update(svid.serialNumber, "utf8").digest("hex")
  if (serialHash !== binding.svid_serial_hash) {
    throw new Error("OLO_SVID_VERIFY_FAILED: SVID serial hash mismatch (binding not tied to this SVID)")
  }
  if (binding.svid_trust_domain !== "iot.internal") {
    throw new Error("OLO_SVID_TRUST_DOMAIN_MISMATCH: expected iot.internal, got " + String(binding.svid_trust_domain))
  }
  return "PASS"
}

/** receipt v2 验签回查：缺投影即 FAIL，UID 与 receipt 既有 agent_uid 不一致即 FAIL。 */
export function verifyReceiptSvidBinding(
  receipt: Record<string, unknown>,
  cred: SvidCredential,
  verifier: SvidVerifier,
): "PASS" {
  const view = receipt.svid_binding as SvidReceiptView | undefined
  if (!view) throw new Error("OLO_RECEIPT_SVID_MISSING")
  if (typeof receipt.agent_uid === "string" && receipt.agent_uid !== view.agent_uid)
    throw new Error("OLO_SVID_UID_CHANGED")
  return verifySvidBinding(
    {
      agent_uid: view.agent_uid,
      svid_serial_hash: view.svid_serial_hash,
      svid_trust_domain: view.svid_trust_domain,
      bound_at: null,
      spiffe_id: null,
    },
    cred,
    verifier,
  )
}
