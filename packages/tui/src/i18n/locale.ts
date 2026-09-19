export type Locale = "en" | "zh"

export const DEFAULT_LOCALE: Locale = "zh"

export function resolveLocale(value?: string): Locale {
  const normalized = value?.trim().toLowerCase().replaceAll("_", "-")
  if (!normalized) return DEFAULT_LOCALE
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh"
  return "en"
}
