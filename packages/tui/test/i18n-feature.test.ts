import { describe, expect, test } from "bun:test"
import en from "../src/i18n/feature/en"
import zh from "../src/i18n/feature/zh"
import { translate } from "../src/i18n"
import { statsMonthLabel } from "../src/feature-plugins/system/stats-data"
import { activityCalendar } from "@opencode/util/activity-calendar"

describe("feature chrome localization", () => {
  test("calendar month presentation localizes existing groups without changing calendar data", () => {
    const calendar = activityCalendar({
      activity: [],
      from: new Date(2026, 0, 1).getTime(),
      to: new Date(2027, 0, 1).getTime(),
      maxWeeks: 53,
    })
    const before = structuredClone(calendar)
    expect(
      calendar.months.map((month) => statsMonthLabel(month.label, (key, params) => translate("en", key, params))),
    ).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    expect(
      calendar.months.map((month) => statsMonthLabel(month.label, (key, params) => translate("zh", key, params))),
    ).toEqual(["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"])
    expect(calendar).toEqual(before)
  })
  test("catalogs have the same keys and interpolation parameters", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    const placeholders = (value: string) => [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(key.startsWith("feature.")).toBe(true)
      expect(placeholders(zh[key])).toEqual(placeholders(en[key]))
    }
  })

  test("chrome follows each requested locale without caching the initial language", () => {
    expect(translate("zh", "feature.plugins.title")).toBe("插件")
    expect(translate("en", "feature.plugins.title")).toBe("Plugins")
    expect(translate("zh", "feature.plugins.title")).toBe("插件")
    expect(translate("en", "feature.prompt.subagentOne", { count: 1 })).toBe("1 subagent")
    expect(translate("en", "feature.prompt.subagents", { count: 2 })).toBe("2 subagents")
    expect(translate("zh", "feature.prompt.subagents", { count: 2 })).toBe("2 个子代理")
  })

  test("plugin identifiers, error text and paths remain literal", () => {
    const id = "external.plugin/{{where}}"
    const where = "session.header"
    const error = "D:\\模型\\$& {{id}} $t(language.title) <raw>"
    expect(translate("en", "feature.plugins.crashed", { id, where, error })).toBe(`${id} crashed in ${where}: ${error}`)
    expect(translate("zh", "feature.plugins.crashed", { id, where, error })).toBe(`${id} 在 ${where} 崩溃：${error}`)
    expect(translate("zh", "feature.diff.vs", { base: "feature/my-branch" })).toBe("对比 feature/my-branch")
    expect(translate("en", "feature.plugins.details")).toContain("/plugins")
    expect(translate("zh", "feature.plugins.details")).toContain("/plugins")
  })
})
