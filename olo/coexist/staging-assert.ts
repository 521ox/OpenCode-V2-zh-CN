// W-58 · R-CC-3 暂存集断言（机制落码 + 注入式自测 PASS；尚未翻 [RUNTIME]：r630-10 仅为 AVX2 回退构建机，本机 bun 1.4.4 已可用；断言逻辑已落码，运行期接线未做）
// commit 前断言 staged ⊆ 本会话声明路径集；越界即拒（防代收口他会话文件）。
// 判据（方案 §20.2 R-CC-3）：注入一个他会话文件 ⇒ FAIL，且指名越界路径。
// 运行期接线已落：pre-commit 钩子（.husky/pre-commit → olo/coexist/scripts/staging-precommit.ts）调本函数；声明路径集经 OLO_DECLARED_PATHS / .olo-declared.json 注入。**默认 fail-closed**（未配置声明集 ⇒ deny-unknown，防静默放行；2026-11-14 由 opt-in 翻为 fail-closed，账本 v1.64/v1.65）。
// 声明集支持两种匹配：① 精确路径；② 目录前缀（以 "/" 结尾，视作该目录下全部文件，供安装器种子化作用域用）。
export interface StagingAssertInput {
  /** `git diff --cached --name-only` 实际暂存集 */
  staged: string[]
  /** 本会话声明可写路径集 */
  declared: string[]
  /** 可选归一化（如统一为正斜杠 / 去重 / 拆 pathspec）；默认恒等 */
  normalize?: (p: string) => string
}

export interface StagingAssertResult {
  ok: boolean
  /** 在 staged 但不在 declared 的越界路径（R-CC-3 要求指名） */
  violations: string[]
}

export function assertStagingSet(input: StagingAssertInput): StagingAssertResult {
  const norm = input.normalize ?? ((p: string) => p)
  const declared = input.declared.map(norm)
  const declaredSet = new Set(declared)
  // 目录前缀声明：以 "/" 结尾的 declared 条目匹配该目录下全部文件（安装器种子化作用域用）
  const prefixDirs = declared.filter((d) => d.endsWith("/"))
  const violations = input.staged.filter((p) => {
    const np = norm(p)
    if (declaredSet.has(np)) return false
    if (prefixDirs.some((d) => np.startsWith(d))) return false
    return true
  })
  return { ok: violations.length === 0, violations }
}
