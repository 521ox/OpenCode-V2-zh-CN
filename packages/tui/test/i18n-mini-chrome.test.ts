import { describe, expect, test } from "bun:test"
import { resolve } from "../src/config"
import { translate } from "../src/i18n"
import en from "../src/i18n/miniCli/en"
import zh from "../src/i18n/miniCli/zh"
import { formErrorMessage, formPlaceholder, formUnsupported } from "../src/mini/form.shared"
import { formDisplay } from "../src/mini/form.shared"
import { formRows } from "../src/util/form"
import {
  createPermissionBodyState,
  permissionInfo,
  permissionLabel,
  permissionRun,
} from "../src/mini/permission.shared"
import { blockerStatus } from "../src/mini/session-data"
import { verbosityLabel } from "../src/mini/verbosity"
import { entryBody } from "../src/mini/entry.body"
import { toolInlineInfo } from "../src/mini/tool"

describe("Mini configured locale", () => {
  test("fragment keys and interpolation parameters agree", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(key.startsWith("miniCli.")).toBe(true)
      const params = (value: string) => [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
      expect(params(zh[key])).toEqual(params(en[key]))
    }
  })

  for (const locale of ["zh", "en"] as const) {
    test(`${locale} scrollback keeps payload text while localizing owned labels`, () => {
      const raw = "RAW {{path}} $& <tag> provider/model --flag"
      expect(entryBody({ kind: "assistant", source: "assistant", phase: "progress", text: raw }, { locale })).toEqual({
        type: "markdown",
        content: raw,
      })
      expect(
        entryBody(
          { kind: "reasoning", source: "reasoning", phase: "progress", text: `Thinking: ${raw}` },
          { locale, mono: true },
        ),
      ).toEqual({ type: "text", content: (locale === "zh" ? "思考： " : "Thinking: ") + raw })
      const tool = toolInlineInfo(
        {
          type: "tool",
          id: "call_RAW",
          name: "write",
          executed: false,
          time: { created: 1, completed: 2 },
          state: {
            status: "completed",
            input: { path: "RAW.txt" },
            metadata: {},
            content: [{ type: "text", text: raw }],
          },
        },
        "/unused",
        locale,
      )
      expect(tool.body).toBe(raw)
      expect(tool.title).toStartWith(locale === "zh" ? "写入 " : "Write ")
      const summary = entryBody(
        {
          kind: "tool",
          source: "tool",
          phase: "final",
          text: "",
          tool: "subagent",
          toolState: "completed",
          part: {
            type: "tool",
            id: "call_RAW",
            name: "subagent",
            time: { created: 1 },
            state: {
              status: "completed",
              input: { agent: "explore", description: raw },
              metadata: {},
              content: [{ type: "text", text: "" }],
            },
          },
        },
        { locale },
      )
      expect(summary).toEqual({
        type: "structured",
        snapshot: {
          kind: "task",
          title: locale === "zh" ? "# Explore 子智能体" : "# Explore Subagent",
          rows: [raw],
          tail: "",
        },
      })
    })
    test(`${locale} permission labels do not change reply protocol`, () => {
      const config = resolve({ locale }, { terminalSuspend: false })
      const state = createPermissionBodyState({ id: "req_RAW", sessionID: "ses_RAW" })
      expect(permissionLabel("once", config.locale)).toBe(locale === "zh" ? "允许一次" : "Allow once")
      expect(permissionRun(state, "req_RAW", "once").reply).toEqual({
        sessionID: "ses_RAW",
        requestID: "req_RAW",
        decision: "once",
      })
      expect(blockerStatus({ type: "prompt" }, config.locale)).toBe("")
      expect(verbosityLabel("quiet", config.locale)).toBe(locale === "zh" ? "简洁" : "Quiet")
      const raw = "RAW {{tool}} $& provider/model --flag"
      const info = permissionInfo(
        { id: "req_RAW", sessionID: "ses_RAW", action: raw, resources: [raw] },
        undefined,
        false,
        config.locale,
      )
      expect(info.title).toContain(raw)
      expect(info.lines.join("\n")).toContain(raw)
    })

    test(`${locale} form defaults translate without translating server text`, () => {
      const raw = "RAW {{type}} $& $t(language.title) C:\\file --flag"
      expect(formPlaceholder({ type: "string", key: "RAW", placeholder: raw }, locale)).toBe(raw)
      expect(formErrorMessage(new Error(raw), locale)).toBe(raw)
      expect(formErrorMessage({}, locale)).toBe(locale === "zh" ? "表单请求失败" : "Form request failed")
      expect(translate(locale, "miniCli.form.noFields")).toBe(
        locale === "zh" ? "此表单没有支持的字段。" : "This form has no supported fields.",
      )
      expect(
        formUnsupported(
          {
            id: "form_RAW",
            sessionID: "ses_RAW",
            title: raw,
            fields: [{ key: "RAW", type: "string", pattern: "^RAW" }],
          },
          locale,
        ),
      ).toBe(
        locale === "zh"
          ? "Mini 尚不支持带模式约束的表单。"
          : "Pattern-constrained forms are not supported in Mini yet.",
      )
      expect(translate(locale, "miniCli.newSession", { id: raw })).toContain(raw)
      const field = { type: "boolean", key: "flag" } as const
      const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
        translate(locale, key, params)
      expect(formRows(field, t).map((row) => row.value)).toEqual([true, false])
      expect(formDisplay(field, true, locale)).toBe(formRows(field, t)[0]!.label)
      expect(formDisplay(field, false, locale)).toBe(formRows(field, t)[1]!.label)
    })
  }
})
