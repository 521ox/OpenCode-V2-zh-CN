import assert from "node:assert/strict"
import { diagnose } from "./identity-diagnose.ts"

// W-11 · M-B2 · T10：清册权威副本与镜像 sha256 一致 → OK
assert.equal(diagnose({ registryPath: "/a", registrySha256: "abc", mirrorSha256: "abc" }), "OK")
assert.equal(diagnose({ registryPath: "/a", registrySha256: "111", mirrorSha256: "111" }), "OK")

// W-11 · M-B2 · T10：sha256 不一致 → 必抛 OLO_REGISTRY_DRIFT（禁静默降级）
assert.equal(diagnose({ registryPath: "/a", registrySha256: "abc", mirrorSha256: "def" }), "OLO_REGISTRY_DRIFT")
assert.equal(diagnose({ registryPath: "/a", registrySha256: "111", mirrorSha256: "222" }), "OLO_REGISTRY_DRIFT")

// 反向对称：仅 mirror 一方变化亦为漂移
assert.equal(diagnose({ registryPath: "/b", registrySha256: "xyz", mirrorSha256: "xyz" }), "OK")
assert.equal(diagnose({ registryPath: "/b", registrySha256: "xyz", mirrorSha256: "zzz" }), "OLO_REGISTRY_DRIFT")

console.log("identity-diagnose 6/6 PASS")
