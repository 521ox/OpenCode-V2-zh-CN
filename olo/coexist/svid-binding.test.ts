// W-43 · UID <-> SVID 绑定接口 规格级注入式自测（node --experimental-strip-types）
// 边界：verifier 为确定性替身（dev/test shim），不依赖真实 SPIRE/Vault、不产生运行期证据。
import {
  emptySvidBinding,
  bindSvid,
  verifySvidBinding,
  rotateSvid,
  embedReceiptSvidBinding,
  verifyReceiptSvidBinding,
  hashSvidSerial,
  type SvidCredential,
  type SvidVerifier,
} from "./svid-binding.ts"

let passed = 0
let failed = 0
function check(name: string, fn: () => void): void {
  try {
    fn()
    console.log("PASS", name)
    passed++
  } catch (e) {
    console.log("FAIL", name, (e as Error).message)
    failed++
  }
}
function expectError(code: string, fn: () => void): void {
  let got = ""
  try {
    fn()
  } catch (e) {
    got = (e as Error).message
  }
  if (got !== code) throw new Error("expected " + code + " got " + (got || "<none>"))
}

const UID = `agent-code-main-${"0".repeat(26)}`
const OTHER_UID = `agent-code-main-${"1".repeat(26)}`
const TD = "iot.internal"
const TS1 = "2026-11-12T12:00:00"
const TS2 = "2026-11-12T13:00:00"
const CRED1: SvidCredential = { serial: "svid-serial-0001", trust_domain: TD, spiffe_id: null }
const CRED2: SvidCredential = { serial: "svid-serial-0002", trust_domain: TD, spiffe_id: null }
const verifier: SvidVerifier = (i) =>
  i.serial.startsWith("svid-") && i.trust_domain === TD && i.serial_hash === hashSvidSerial(i.serial)
const denyAll: SvidVerifier = () => false

check("W-43 unissued: two nullable columns stay null, spiffe_id stays null", () => {
  const b = emptySvidBinding(UID)
  if (b.agent_uid !== UID) throw new Error("uid")
  if (b.svid_serial_hash !== null || b.svid_trust_domain !== null || b.bound_at !== null)
    throw new Error("prefilled unissued binding")
  if (b.spiffe_id !== null) throw new Error("spiffe_id must stay null")
})

check("W-43 bind: stores sha256(serial) and trust_domain, never plaintext serial", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  if (b.svid_serial_hash !== hashSvidSerial(CRED1.serial)) throw new Error("serial_hash")
  if (b.svid_trust_domain !== TD) throw new Error("trust_domain")
  if (b.bound_at !== TS1) throw new Error("bound_at")
  if (JSON.stringify(b).includes(CRED1.serial)) throw new Error("plaintext serial leaked")
  if (b.spiffe_id !== null) throw new Error("spiffe_id must stay null")
})

check("W-43 verify: issued binding passes injected verifier", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  if (verifySvidBinding(b, CRED1, verifier) !== "PASS") throw new Error("verify")
})

check("W-43 verify on unissued binding is rejected (no fake attestation)", () => {
  expectError("OLO_SVID_NOT_ISSUED", () =>
    verifySvidBinding(emptySvidBinding(UID), CRED1, verifier),
  )
})

check("W-43 spiffe_id non-null credential is rejected", () => {
  expectError("OLO_SVID_SPIFFE_NOT_ISSUED", () =>
    bindSvid(
      emptySvidBinding(UID),
      { serial: "svid-x", trust_domain: TD, spiffe_id: "spiffe://olo/agent" } as unknown as SvidCredential,
      verifier,
      TS1,
    ),
  )
})

check("W-43 tampered serial is rejected", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  expectError("OLO_SVID_VERIFY_FAILED", () =>
    verifySvidBinding(b, { ...CRED1, serial: "svid-serial-FORGED" }, verifier),
  )
})

check("W-43 trust_domain mismatch is rejected", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  expectError("OLO_SVID_TRUST_DOMAIN_MISMATCH", () =>
    verifySvidBinding(b, { ...CRED1, trust_domain: "other.domain" }, verifier),
  )
})

check("W-43 failing injected verifier blocks binding (fail-closed)", () => {
  expectError("OLO_SVID_VERIFY_FAILED", () =>
    bindSvid(emptySvidBinding(UID), CRED1, denyAll, TS1),
  )
})

check("W-43 T38 rotate: credential changes, agent_uid stays unchanged, verify still PASS", () => {
  const b1 = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  const b2 = rotateSvid(b1, CRED1, CRED2, verifier, TS2)
  if (b2.agent_uid !== b1.agent_uid) throw new Error("uid changed on rotation")
  if (b2.svid_serial_hash === b1.svid_serial_hash) throw new Error("serial hash unchanged")
  if (verifySvidBinding(b2, CRED2, verifier) !== "PASS") throw new Error("verify after rotate")
  if (verifySvidBinding(b1, CRED1, verifier) !== "PASS") throw new Error("old binding mutated")
})

check("W-43 rotate rejects a wrong old credential", () => {
  const b1 = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  expectError("OLO_SVID_VERIFY_FAILED", () => rotateSvid(b1, CRED2, CRED2, verifier, TS2))
})

check("W-43 receipt projection: embeds two columns and verifies back (T38)", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  const r = embedReceiptSvidBinding({ conclusion: "INCOMPLETE", agent_uid: UID }, b)
  if (JSON.stringify(r).includes(CRED1.serial)) throw new Error("plaintext serial leaked to receipt")
  if (verifyReceiptSvidBinding(r, CRED1, verifier) !== "PASS") throw new Error("receipt verify")
  const b2 = rotateSvid(b, CRED1, CRED2, verifier, TS2)
  const r2 = embedReceiptSvidBinding({ conclusion: "INCOMPLETE", agent_uid: UID }, b2)
  if (verifyReceiptSvidBinding(r2, CRED2, verifier) !== "PASS")
    throw new Error("receipt verify after rotate")
})

check("W-43 receipt without svid_binding projection is FAIL-closed", () => {
  expectError("OLO_RECEIPT_SVID_MISSING", () =>
    verifyReceiptSvidBinding({ conclusion: "INCOMPLETE" }, CRED1, verifier),
  )
})

check("W-43 receipt agent_uid mismatch is rejected", () => {
  const b = bindSvid(emptySvidBinding(UID), CRED1, verifier, TS1)
  const r = embedReceiptSvidBinding({ agent_uid: OTHER_UID }, b)
  expectError("OLO_SVID_UID_CHANGED", () => verifyReceiptSvidBinding(r, CRED1, verifier))
})

check("W-43 malformed agent_uid is rejected", () => {
  expectError("OLO_SVID_UID_MALFORMED", () => emptySvidBinding("not-a-uid"))
})

console.log("[RESULT]", failed === 0 ? "PASS" : "FAIL", "cases=" + (passed + failed), "bad=" + failed)
if (failed > 0) process.exitCode = 1
