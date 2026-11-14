// X）SVID 外部锚 dev 实证（node/bun --experimental-strip-types · 与 svid-binding/aib 同风格）
// 用从 r620-66 归档的 iot.internal 真信任锚（SPIRE ServerCA）签发的真实 SPIFFE X509-SVID
// （ca.pem 信任锚 + svid.pem，URI SAN=spiffe://iot.internal/agent/codecustom-dev）。
// 验证 W-43/aib 的 SVID 外部锚机制：X509 链校验 + SPIFFE ID 匹配 + 序列号哈希回查。
// 运行期信任域 = iot.internal（r620-66 既有 SPIRE 服务器签发，spiffe://olo 不可签发；olo 仅作概念域）；
// 验证逻辑与运行期真实签发完全一致（同一 cert 格式 + 同一 CA bundle 形态），故 SPIRE-ready。
// **证书来源唯一正确方法：从 r620-66 获取 iot.internal 真信任锚（已归档于 test-fixtures/svid/）；
//   禁止在本机另起自签 SPIRE/PKI**（SVID 即该归档真锚签发，非本地自签）。
import { X509Certificate, createHash } from "node:crypto"
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  loadCard,
  loadCardWithAnchor,
  bindingId,
  type BindingSeed,
  type BindingCard,
} from "./aib.ts"
import { verifySvidX509, emptySvidBinding } from "./svid-binding.ts"

const CA = readFileSync(join(import.meta.dir, "test-fixtures/svid/ca.pem"), "utf8")
const SVID = readFileSync(join(import.meta.dir, "test-fixtures/svid/svid.pem"), "utf8")
const SPIFFE_ID = "spiffe://iot.internal/agent/codecustom-dev"

function makeSeed(): BindingSeed {
  return {
    agent_id: "codecustom-dev",
    permission_domain: "repository-local",
    install_id: "i1",
    install_family: "v2-custom-lite",
    instance_nonce: "n1",
    issued_at: "2026-11-14",
  }
}
function writeCard(path: string, overrides: Partial<BindingCard>) {
  const seed = makeSeed()
  const card: BindingCard = {
    ...seed,
    binding_id: bindingId(seed),
    spiffe_id: null,
    scope: "repository-local",
    risk_tier: "T3",
    status: "registered",
    key_id: null,
    signature: null,
    runtime: {},
    ...overrides,
  }
  writeFileSync(path, JSON.stringify(card, null, 2), "utf8")
}

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

const dir = mkdtempSync(join(tmpdir(), "svid-x509-"))
const cardOk = join(dir, "card-ok.json")
const cardWrong = join(dir, "card-wrong.json")
const cardNoAnchor = join(dir, "card-noanchor.json")
const cardSigned = join(dir, "card-signed.json")
const anchor = { svidPem: SVID, caBundlePem: CA }

// 1) 带锚加载：spiffe_id + 真实 SVID（链+SPIFFE ID 匹配）→ 通过
writeCard(cardOk, { spiffe_id: SPIFFE_ID })
try {
  loadCardWithAnchor(cardOk, anchor)
  check("anchored card with matching SVID passes", true)
} catch (e) {
  check("anchored card with matching SVID passes", false, (e as Error).message)
}

// 2) SPIFFE ID 不匹配 → 拒（防伪造）
writeCard(cardWrong, { spiffe_id: "spiffe://iot.internal/agent/other" })
try {
  loadCardWithAnchor(cardWrong, anchor)
  check("mismatched SPIFFE ID rejected", false)
} catch (e) {
  check("mismatched SPIFFE ID rejected", /OLO_SPIFFE_NOT_ISSUED/.test((e as Error).message), (e as Error).message)
}

// 3) 无锚 + 非空 spiffe_id → 仍拒（未签发恒 null 红线保留，防伪造）
writeCard(cardNoAnchor, { spiffe_id: SPIFFE_ID })
try {
  loadCard(cardNoAnchor)
  check("no-anchor non-null spiffe_id rejected", false)
} catch (e) {
  check("no-anchor non-null spiffe_id rejected", /OLO_SPIFFE_NOT_ISSUED/.test((e as Error).message), (e as Error).message)
}

// 4) 非空 signature/key_id + 锚验过 → 通过（签名校验放松：有可验锚即合法已签发卡）
writeCard(cardSigned, { spiffe_id: SPIFFE_ID, key_id: "k1", signature: "s1" })
try {
  loadCardWithAnchor(cardSigned, anchor)
  check("signed card with verified anchor passes", true)
} catch (e) {
  check("signed card with verified anchor passes", false, (e as Error).message)
}

// 5) SVID 外部锚真实 X509 校验（W-43）：serial hash 一致 + 链 + trust_domain=iot.internal
{
  const svid = new X509Certificate(SVID)
  const serialHash = createHash("sha256").update(svid.serialNumber, "utf8").digest("hex")
  const binding = {
    ...emptySvidBinding("agent-dev-gtx75060-01ARZ3NDEKTSV4RRFFQ69G5FAV"),
    agent_uid: "agent-x",
    svid_serial_hash: serialHash,
    svid_trust_domain: "iot.internal",
  }
  let pass = false
  let msg = ""
  try {
    verifySvidX509(binding, SVID, CA)
    pass = true
  } catch (e) {
    msg = (e as Error).message
  }
  check("verifySvidX509 real SVID PASS", pass, msg)
}

// 6) 错误证书（CA 当 SVID）→ 链校验失败
{
  let pass = false
  let msg = ""
  const binding = {
    ...emptySvidBinding("agent-dev-gtx75060-01ARZ3NDEKTSV4RRFFQ69G5FAV"),
    agent_uid: "agent-x",
    svid_serial_hash: "deadbeef",
    svid_trust_domain: "iot.internal",
  }
  try {
    verifySvidX509(binding, CA, CA)
    pass = true
  } catch (e) {
    msg = (e as Error).message
  }
  check("verifySvidX509 wrong cert FAILS", !pass, msg)
}

rmSync(dir, { recursive: true, force: true })
console.log(
  `svid-x509-probe.test.ts: ${passed}/${(passed + failed)} PASS${failed > 0 ? " (FAIL: " + fails.join(" | ") + ")" : ""}`,
)
if (failed > 0) process.exit(1)
