// W-58 · R-CC-3 暂存集断言（[CONTRACT] 立卡于 v1.56 · 本轮落码 · 注入式自测 · 不翻 [RUNTIME]）
// commit 前断言 staged ⊆ 本会话声明路径集；越界即拒（防代收口他会话文件）。
// 判据（方案 §20.2 R-CC-3）：注入一个他会话文件 ⇒ FAIL，且指名越界路径。
// 运行期接线（pre-commit 调本函数、会话声明文件维护）属阶段 3，本轮未做 ⇒ 不翻 [RUNTIME]。
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
  const declaredSet = new Set(input.declared.map(norm))
  const violations = input.staged.filter((p) => !declaredSet.has(norm(p)))
  return { ok: violations.length === 0, violations }
}
