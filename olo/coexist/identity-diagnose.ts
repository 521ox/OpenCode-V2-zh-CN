// W-11 · M-B2 identity-command 外置只读诊断骨架（[CONTRACT]）
// G.9 回退：不入 commands.ts / index.ts 注册，零源码挂点。
// T10：清册权威副本与镜像不一致必须抛 OLO_REGISTRY_DRIFT，禁静默降级。
export interface DiagnoseInput {
  registryPath: string; registrySha256: string; mirrorSha256: string
}
export function diagnose(input: DiagnoseInput): "OK" {
  // T10：不一致必须抛 OLO_REGISTRY_DRIFT，禁静默降级（返回态会被调用方忽略 → 静默放行）
  if (input.registrySha256 !== input.mirrorSha256) throw new Error("OLO_REGISTRY_DRIFT")
  return "OK"
}
