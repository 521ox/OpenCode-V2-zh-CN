// W-58 · R-CC-3 pre-commit 暂存集断言执行器（**默认 fail-closed**，由安装器种子化声明集）
// 由 .husky/pre-commit 在 commit 前调用。
//
// 声明可写集来源（优先级）：
//   1. OLO_DECLARED_PATHS 环境变量（逗号分隔，覆盖）
//   2. 仓库根 .olo-declared.json（安装器落盘的种子集，可定制扩展；模板见 olo/coexist/olo-declared.seed.json）
//   3. 两者皆无 ⇒ **fail-closed deny-unknown**：拒绝提交并提示安装器种子化，防静默放行。
//
// 2026-11-14 决策（账本 v1.64/v1.65）：原 opt-in 放行语义翻为 fail-closed——
// 生产桌面安装默认强制暂存集断言；安装器（M-A3）在落盘时种子化 .olo-declared.json
// （写入安装自身已知可写作用域，如 ["olo/"]），故默认强制且不对 dev/CI 产生摩擦。
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

// 默认 fail-closed：未显式配置声明集 ⇒ 返回空数组（调用方据此 deny-unknown）。
// 安装器种子化的 .olo-declared.json 是生产默认作用域来源；OLO_DECLARED_PATHS 可临时覆盖。
function getDeclared(): string[] {
  const env = process.env.OLO_DECLARED_PATHS
  if (env && env.trim()) return env.split(",").map((s) => s.trim()).filter(Boolean)
  const f = resolve(process.cwd(), ".olo-declared.json")
  if (existsSync(f)) {
    try {
      const arr = JSON.parse(readFileSync(f, "utf8"))
      if (Array.isArray(arr) && arr.length > 0) return arr.map(String)
    } catch {
      process.stderr.write("R-CC-3: .olo-declared.json 解析失败，已忽略该声明源\n")
    }
  }
  return []
}

const declared = getDeclared()
if (declared.length === 0) {
  // 默认 fail-closed：未配置声明集 ⇒ 拒绝提交（deny-unknown），防静默放行。
  process.stderr.write(
    "R-CC-3 FAIL-CLOSED：未配置声明可写集（OLO_DECLARED_PATHS / .olo-declared.json 均无）。\n" +
      "  桌面安装默认强制暂存集断言；未声明即拒绝提交（deny-unknown）。\n" +
      "  解决：安装器应已种子化 .olo-declared.json（写入安装自身已知可写作用域）；\n" +
      "        或临时 `export OLO_DECLARED_PATHS=路径1,路径2` 后重试。\n",
  )
  process.exit(1)
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
