import { describe, expect, test } from "bun:test"
import en from "../src/i18n/en"
import zh from "../src/i18n/zh"
import mainEn from "../src/i18n/main/en"
import mainZh from "../src/i18n/main/zh"
import sessionEn from "../src/i18n/session/en"
import sessionZh from "../src/i18n/session/zh"
import featureEn from "../src/i18n/feature/en"
import featureZh from "../src/i18n/feature/zh"
import miniCliEn from "../src/i18n/miniCli/en"
import miniCliZh from "../src/i18n/miniCli/zh"
import { DEFAULT_LOCALE, resolveLocale, translate } from "../src/i18n"
import { createTranslator } from "../src/i18n/translator"

describe("locale", () => {
  test("defaults to Simplified Chinese independently of the machine locale", () => {
    expect(DEFAULT_LOCALE).toBe("zh")
    for (const value of [undefined, "", "  ", "zh", "ZH_cn", "zh-Hans", "zh-TW"]) {
      expect(resolveLocale(value)).toBe("zh")
    }
  })

  test("supports explicit English and falls back for unsupported languages", () => {
    for (const value of ["en", "EN_us", " en-GB ", "fr", "unknown"]) {
      expect(resolveLocale(value)).toBe("en")
    }
  })
})

describe("library translation", () => {
  const t = createTranslator({
    en: {
      greeting: "Hello {{ name }}: {{count}} / {{name}}",
      fallback: "Missing {{value}}",
      options: "{{lng}} {{context}} {{defaultValue}}",
    },
    zh: { greeting: "你好 {{ name }}：{{count}} / {{name}}" },
  })

  test("production dictionaries select the requested locale", () => {
    expect(translate("zh", "language.title")).toBe("语言")
    expect(translate("en", "language.title")).toBe("Language")
  })

  test("missing Chinese entries use interpolated English", () => {
    expect(t("zh", "fallback", { value: 0 })).toBe("Missing 0")
  })

  test("uses library interpolation with numbers, repeated and spaced placeholders", () => {
    expect(t("en", "greeting", { name: "Ada", count: 2 })).toBe("Hello Ada: 2 / Ada")
    expect(t("zh", "greeting", { name: "Ada", count: 0 })).toBe("你好 Ada：0 / Ada")
    expect(t("en", "fallback")).toBe("Missing {{value}}")
  })

  test("preserves literal user data rather than HTML escaping or re-interpolating it", () => {
    const value = "$& $$ $` $' <path>& {{count}} $t(language.title)"
    expect(t("en", "greeting", { name: value, count: 2 })).toBe(`Hello ${value}: 2 / ${value}`)
    expect(t("zh", "fallback", { value })).toBe(`Missing ${value}`)
  })

  test("raw values are never used as replacement markers or parsed as templates", () => {
    const values = [
      "{{count}}",
      "{{ name }} {{name}} {{count}} {{value}}",
      "$& $$ $` $'",
      "{{#count}}section{{/count}} {{>partial}} {{=<% %>=}} <%count%>",
      "\u0000\u0001\ue000__I18N_0__\uffff\n\r\t中文🙂",
      "<>&\"' ` \\ C:\\tmp\\{{count}}",
      "",
    ]
    for (const value of values) {
      for (const params of [
        { name: value, count: 2 },
        { count: 2, name: value },
      ]) {
        expect(t("en", "greeting", params)).toBe(`Hello ${value}: 2 / ${value}`)
        expect(t("zh", "greeting", params)).toBe(`你好 ${value}：2 / ${value}`)
      }
      expect(t("zh", "fallback", { value })).toBe(`Missing ${value}`)
    }
  })

  test("missing variables remain visible and raw values do not fill them", () => {
    expect(t("en", "greeting", { name: "{{count}}" })).toBe("Hello {{count}}: {{count}} / {{count}}")
    expect(t("en", "greeting", { count: 0 })).toBe("Hello {{name}}: 0 / {{name}}")
  })

  test("parameter names cannot override translator options", () => {
    expect(t("zh", "options", { lng: "zh", context: "raw", defaultValue: "literal" })).toBe("zh raw literal")
  })
})

test("all shipped keys and placeholders have parity", () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const placeholders = (value: string) =>
      [...value.matchAll(/{{\s*([A-Za-z0-9_]+)\s*}}/g)].map((match) => match[1]).sort()
    expect(placeholders(zh[key])).toEqual(placeholders(en[key]))
  }
})

test("fragment keys do not silently overwrite another owner's resources", () => {
  for (const fragments of [
    [mainEn, sessionEn, featureEn, miniCliEn],
    [mainZh, sessionZh, featureZh, miniCliZh],
  ]) {
    const keys = fragments.flatMap((fragment) => Object.keys(fragment))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.some((key) => key.startsWith("language."))).toBe(false)
  }
})
