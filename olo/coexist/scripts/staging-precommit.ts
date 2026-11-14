// W-58 · R-CC-3 pre-commit 暂存集断言执行器（opt-in，violation 时 fail-closed）
// 由 .husky/pre-commit 在 commit 前调用。仅当声明路径集已配置时启用；未配置则放行（不影响普通提交）。
// 复用 olo/coexist 真正的 assertStagingSet；其运行期实跑见 rcc-runtime-probe.ts（本机 bun 1.4.4 运行 9/9 PASS；非 [RUNTIME]：pre-commit 链路默认休眠 HUSKY=0，账本 v1.62）
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { assertStagingSet } from "../staging-assert.ts"

function getStaged(): string[] {
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  })
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

function getDeclared(): string[] | null {
  const env = process.env.OLO_DECLARED_PATHS
  if (env && env.trim()) return env.split(",").map((s) => s.trim()).filter(Boolean)
  const f = resolve(process.cwd(), ".olo-declared.json")
  if (existsSync(f)) {
    try {
      const arr = JSON.parse(readFileSync(f, "utf8"))
      if (Array.isArray(arr)) return arr.map(String)
    } catch {
      process.stderr.write("R-CC-3: .olo-declared.json 解析失败，已忽略该声明源\n")
    }
  }
  return null
}

const declared = getDeclared()
if (!declared) {
  // opt-in：未配置声明集 ⇒ 放行（不阻断普通提交）
  process.exit(0)
}
const staged = getStaged()
const { ok, violations } = assertStagingSet({ staged, declared })
if (!ok) {
  process.stderr.write("R-CC-3 STAGING VIOLATION：以下暂存路径不在本会话声明可写集内：\n")
  for (const v of violations) process.stderr.write("  - " + v + "\n")
  process.stderr.write("（须在 OLO_DECLARED_PATHS / .olo-declared.json 声明后重试，或 git restore --staged <越界文件>）\n")
  process.exit(1)
}
process.exit(0)
