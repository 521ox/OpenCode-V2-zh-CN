/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { ConfigProvider, resolve, type Info, type Interface } from "../src/config"
import { I18nProvider, useI18n } from "../src/context/i18n"
import { settings, settingID, settingTitle, settingCategory } from "../src/component/dialog-config"
import { translate, type Translator, type Key } from "../src/i18n"
import en from "../src/i18n/main/en"
import zh from "../src/i18n/main/zh"
import { permissionAlwaysLines, permissionOptionLabel, permissionPresentation } from "../src/util/permission"
import { switchLabel } from "../src/util/model"
import { sessionEpilogue } from "../src/util/presentation"
import { formValidateValue } from "../src/util/form"
import { sortModelOptions } from "../src/component/dialog-model"

test("main catalog has exact key and placeholder parity", () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(key.startsWith("main.")).toBe(true)
    expect(placeholders(zh[key])).toEqual(placeholders(en[key]))
  }
})

test("main settings labels react to config locale without changing stable setting identities", async () => {
  let current: Info = { locale: "zh", mouse: false }
  const service: Interface = {
    get: async () => current,
    update: async (update) => {
      const draft = { ...current }
      update(draft)
      current = draft
      return current
    },
  }
  let context: ReturnType<typeof useI18n> | undefined
  const setting = settings.find((setting) => settingID(setting) === "theme.name")!
  const language = settings.find((setting) => settingID(setting) === "locale")!
  const tabs = settings.find((setting) => settingID(setting) === "tabs.mode")!
  function Consumer() {
    context = useI18n()
    return (
      <text>
        {settingCategory(setting, context.t)} / {settingTitle(setting, context.t)}
        {" · "}
        {settingCategory(tabs, context.t)} / {settingTitle(tabs, context.t)}
      </text>
    )
  }
  const app = await testRender(() => (
    <ConfigProvider config={resolve(current, { terminalSuspend: true })} service={service}>
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    </ConfigProvider>
  ))
  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("外观 / 主题")
    expect(app.captureCharFrame()).toContain("标签页 / 模式")
    if (!context) throw new Error("Missing locale fixture")
    await context.setLocale("en")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Appearance / Theme")
    expect(app.captureCharFrame()).toContain("Tabs / Mode")
    expect(current).toEqual({ locale: "en", mouse: false })
    expect(settingID(setting)).toBe("theme.name")
    expect(language.values).toEqual(["zh", "en"])
    expect(tabs.values).toEqual(["off", "on", "auto"])
  } finally {
    app.renderer.destroy()
  }
})

test("main helper chrome localizes while dynamic values remain literal", () => {
  const t: Translator<Key> = (key, params) => translate("zh", key, params)
  const raw = "C:\\raw\\$&{{name}}$t(main.close)"
  expect(permissionPresentation({ action: "read", resources: [raw] }, t).title).toBe(`读取 ${raw}`)
  expect(permissionAlwaysLines({ action: raw, save: ["*"] }, t)[0]).toContain(raw)
  expect(permissionOptionLabel("once", t)).toBe("允许一次")
  expect(switchLabel({ providerID: "provider", id: raw }, t)).toBe(`已切换模型为 provider/${raw}`)
  expect(sessionEpilogue({ title: raw, sessionID: "ses_literal" }, t)).toContain("opencode -s ses_literal")
  expect(sessionEpilogue({ title: raw, sessionID: "ses_literal" }, t)).toContain(raw)
  expect(formValidateValue({ key: "raw", type: "string", required: true }, "", t)).toBe("需要回答")
})

test("model free priority is not based on a translated display label", () => {
  const options = [
    { title: "Paid", releaseDate: 9, free: false, footer: "Free" },
    { title: "Free model", releaseDate: 1, free: true, footer: "免费" },
  ]
  expect(sortModelOptions(options, false)[0].title).toBe("Free model")
})
