/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { Schema } from "effect"
import { ConfigProvider, Info, resolve, useConfig, type Interface } from "../src/config"
import { I18nProvider, useI18n } from "../src/context/i18n"

const decode = Schema.decodeUnknownSync(Info)

test("locale is optional, normalized centrally and independent of unrelated defaults", () => {
  expect(decode({})).toEqual({})
  expect(resolve({}, { terminalSuspend: true }).locale).toBe("zh")
  for (const [value, expected] of [
    ["zh_CN", "zh"],
    ["zh-Hans", "zh"],
    ["en-US", "en"],
    ["fr", "en"],
  ] as const) {
    expect(resolve(decode({ locale: value }), { terminalSuspend: true }).locale).toBe(expected)
  }
  const config = resolve(decode({ locale: "en", mouse: false, mini: { replay_limit: 42 } }), { terminalSuspend: true })
  expect(config.locale).toBe("en")
  expect(config.mouse).toBe(false)
  expect(config.mini?.replay_limit).toBe(42)
})

test("locale rejects non-string configuration", () => {
  for (const locale of [false, 0, null, [], {}]) {
    expect(() => decode({ locale })).toThrow()
  }
})

test("locale changes flow through config and reactively update translations", async () => {
  let current: Info = { mouse: false }
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
  let config: ReturnType<typeof useConfig> | undefined
  function Consumer() {
    context = useI18n()
    config = useConfig()
    return <text>{context.t("language.title")}</text>
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
    expect(app.captureCharFrame()).toContain("语言")
    if (!context || !config) throw new Error("Locale context was not provided")
    await context.setLocale("en")
    await app.renderOnce()
    expect(context.locale()).toBe("en")
    expect(current).toEqual({ mouse: false, locale: "en" })
    expect(app.captureCharFrame()).toContain("Language")
    await config.update((draft) => {
      draft.locale = "zh_CN"
    })
    await app.renderOnce()
    expect(context.locale()).toBe("zh")
    expect(app.captureCharFrame()).toContain("语言")
  } finally {
    app.renderer.destroy()
  }
})
