import { describe, expect, spyOn, test } from "bun:test"
import { resolveLocale, translate } from "@opencode/tui/i18n"
import { UI } from "../src/run/ui"
import { reportRunError } from "../src/run/run"

const raw = "Error: RAW_provider/model --flag C:\\raw\\{{text}} $& $t(language.title) 中文"

describe("configured CLI chrome", () => {
  for (const locale of ["zh", "en"] as const) {
    test(`${locale} error output retains the complete external message`, () => {
      const chunks: string[] = []
      const write = spyOn(process.stderr, "write").mockImplementation((chunk) => {
        chunks.push(String(chunk))
        return true
      })
      try {
        UI.error(raw, resolveLocale(locale))
        expect(chunks.join("")).toContain((locale === "zh" ? "错误：" : "Error: ") + UI.Style.TEXT_NORMAL + raw)
      } finally {
        write.mockRestore()
      }
    })

    test(`${locale} JSON errors preserve wire keys, identifiers and raw values`, () => {
      const chunks: string[] = []
      const previous = process.exitCode
      const write = spyOn(process.stdout, "write").mockImplementation((chunk) => {
        chunks.push(String(chunk))
        return true
      })
      try {
        reportRunError({ format: "json", locale }, raw, "ses_RAW")
        expect(JSON.parse(chunks.join(""))).toEqual({
          type: "error",
          timestamp: expect.any(Number),
          sessionID: "ses_RAW",
          error: { type: "unknown", message: raw },
        })
        expect(process.exitCode).toBe(1)
      } finally {
        write.mockRestore()
        process.exitCode = previous ?? 0
      }
    })

    test(`${locale} reasoning and permission chrome interpolate raw values literally`, () => {
      expect(translate(locale, "miniCli.thinking", { text: raw })).toBe(
        (locale === "zh" ? "思考：" : "Thinking: ") + raw,
      )
      const line = translate(locale, "miniCli.permissionRejected", { action: raw, resources: raw })
      expect(line.split(raw)).toHaveLength(3)
      expect(line).toContain(locale === "zh" ? "自动拒绝" : "auto-rejecting")
    })
  }
})
