import { expect, test } from "bun:test"
import en from "../src/i18n/session/en"
import zh from "../src/i18n/session/zh"
import { translate } from "../src/i18n"

test("session catalogs have matching keys and interpolation parameters", () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  const params = (value: string) => [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(key.startsWith("session.")).toBe(true)
    expect(params(zh[key])).toEqual(params(en[key]))
  }
})

test("session chrome preserves raw dynamic text in both languages", () => {
  const path = "D:\\raw\\$& {{title}} $t(other) <file>.ts"
  expect(translate("zh", "session.loaded", { path })).toBe(`↳ 已加载 ${path}`)
  expect(translate("en", "session.loaded", { path })).toBe(`↳ Loaded ${path}`)
  expect(translate("zh", "session.providerCompaction")).toBe("供应商压缩")
  expect(translate("en", "session.providerCompaction")).toBe("Provider compaction")
})
