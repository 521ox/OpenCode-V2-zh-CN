import type { FooterView, MiniFormRequest, MiniPermissionRequest } from "./types"
import { resolveLocale, translate, type Locale } from "../i18n"

export function pickBlockerView(input: { permission?: MiniPermissionRequest; form?: MiniFormRequest }): FooterView {
  if (input.permission) return { type: "permission", request: input.permission }
  if (input.form) return { type: "form", request: input.form }
  return { type: "prompt" }
}

export function blockerStatus(view: FooterView, locale?: Locale) {
  if (view.type === "permission") return translate(resolveLocale(locale), "miniCli.awaitPermission")
  if (view.type === "form") return translate(resolveLocale(locale), "miniCli.awaitForm")
  return ""
}
