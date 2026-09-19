import type { SessionStatsInfo } from "@opencode/client"
import { TokenUsage } from "@opencode/schema/token-usage"
import type { Key, Translator } from "../../i18n"

const months: Readonly<Record<string, Key | undefined>> = {
  Jan: "feature.stats.month.Jan",
  Feb: "feature.stats.month.Feb",
  Mar: "feature.stats.month.Mar",
  Apr: "feature.stats.month.Apr",
  May: "feature.stats.month.May",
  Jun: "feature.stats.month.Jun",
  Jul: "feature.stats.month.Jul",
  Aug: "feature.stats.month.Aug",
  Sep: "feature.stats.month.Sep",
  Oct: "feature.stats.month.Oct",
  Nov: "feature.stats.month.Nov",
  Dec: "feature.stats.month.Dec",
}

export function statsMonthLabel(label: string, t: Translator<Key>) {
  const key = months[label]
  return key ? t(key) : label
}

export function statsMetrics(stats: SessionStatsInfo) {
  return [
    {
      label: "tokens",
      value: TokenUsage.total(stats.tokens),
    },
    { label: "best streak", value: stats.streak },
    { label: "active days", value: stats.activeDays },
    { label: "sessions", value: stats.sessions },
  ]
}

export function statsNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}
