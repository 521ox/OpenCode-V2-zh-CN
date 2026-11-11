import { loadCard, assertSpiffeAnchor, bindingId, type BindingCard } from "./aib.ts"
import { writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"

function makeCard(overrides: Partial<BindingCard> = {}): BindingCard {
  const seed = {
    agent_id: "a1",
    permission_domain: "pd",
    install_id: "i1",
    install_family: "f1",
    instance_nonce: "n1",
    issued_at: "2026-11-12",
  }
  const binding_id = bindingId(seed)
  return {
    ...seed,
    binding_id,
    spiffe_id: null,
    scope: "repository-local",
    risk_tier: "T1",
    status: "registered",
    key_id: null,
    signature: null,
    ...overrides,
  }
}

const tmp = tmpdir() + "/aib_card_test.json"
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

check("valid card loads + binding_id consistent", () => {
  const card = makeCard()
  writeFileSync(tmp, JSON.stringify(card))
  const r = loadCard(tmp)
  if (r.binding_id !== card.binding_id) throw new Error("binding_id mismatch")
  rmSync(tmp)
})

check("tampered binding_id throws OLO_CARD_INVALID", () => {
  const card = makeCard({ binding_id: "tampered" })
  writeFileSync(tmp, JSON.stringify(card))
  let msg = ""
  try {
    loadCard(tmp)
  } catch (e) {
    msg = (e as Error).message
  }
  rmSync(tmp)
  if (!msg.includes("OLO_CARD_INVALID")) throw new Error("expected OLO_CARD_INVALID, got " + msg)
})

check("non-null spiffe_id throws OLO_SPIFFE_NOT_ISSUED", () => {
  const card = makeCard({ spiffe_id: "spiffe://x" })
  writeFileSync(tmp, JSON.stringify(card))
  let threw = false
  try {
    loadCard(tmp)
  } catch {
    threw = true
  }
  rmSync(tmp)
  if (!threw) throw new Error("expected throw")
})

check("signature present throws OLO_CARD_UNVERIFIED", () => {
  const card = makeCard({ key_id: "k1", signature: "s1" })
  writeFileSync(tmp, JSON.stringify(card))
  let msg = ""
  try {
    loadCard(tmp)
  } catch (e) {
    msg = (e as Error).message
  }
  rmSync(tmp)
  if (!msg.includes("OLO_CARD_UNVERIFIED")) throw new Error("expected OLO_CARD_UNVERIFIED, got " + msg)
})

check("missing seed field throws OLO_CARD_INVALID", () => {
  const card = makeCard()
  delete (card as any).agent_id
  writeFileSync(tmp, JSON.stringify(card))
  let msg = ""
  try {
    loadCard(tmp)
  } catch (e) {
    msg = (e as Error).message
  }
  rmSync(tmp)
  if (!msg.includes("OLO_CARD_INVALID")) throw new Error("expected OLO_CARD_INVALID, got " + msg)
})

check("assertSpiffeAnchor rejects non-null", () => {
  let threw = false
  try {
    assertSpiffeAnchor(makeCard({ spiffe_id: "spiffe://x" }))
  } catch {
    threw = true
  }
  if (!threw) throw new Error("expected throw")
})

console.log(`\nRESULT passed=${passed} failed=${failed}`)
if (failed > 0) process.exit(1)
