import assert from "node:assert/strict"
import { assertStagingSet } from "./staging-assert.ts"

// 1. 暂存集为声明集子集 ⇒ 通过
{
  const r = assertStagingSet({ staged: ["a.ts"], declared: ["a.ts", "b.ts"] })
  assert.equal(r.ok, true)
  assert.deepEqual(r.violations, [])
}

// 2. 注入一个他会话文件 ⇒ 失败且指名越界路径
{
  const r = assertStagingSet({ staged: ["a.ts", "foreign.ts"], declared: ["a.ts"] })
  assert.equal(r.ok, false, "foreign file must be rejected")
  assert.deepEqual(r.violations, ["foreign.ts"], "violation path must be named")
}

// 3. 声明集为空而暂存有文件 ⇒ 全部越界
{
  const r = assertStagingSet({ staged: ["x.ts", "y.ts"], declared: [] })
  assert.equal(r.ok, false)
  assert.deepEqual(r.violations, ["x.ts", "y.ts"])
}

// 4. 归一化（统一正斜杠）后判定
{
  const norm = (p: string) => p.replace(/\\/g, "/")
  const r = assertStagingSet({ staged: ["src\\a.ts"], declared: ["src/a.ts"], normalize: norm })
  assert.equal(r.ok, true, "normalized paths should match")
}

// 5. 声明集含暂存全部（含额外声明）⇒ 通过
{
  const r = assertStagingSet({ staged: [], declared: ["z.ts"] })
  assert.equal(r.ok, true, "empty staging with non-empty declared is fine")
}

console.log("staging-assert.test.ts: 5/5 PASS")
