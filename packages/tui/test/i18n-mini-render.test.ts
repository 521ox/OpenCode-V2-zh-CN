import { expect, test } from "bun:test"
import { createComponent } from "solid-js"
import { testRender } from "@opentui/solid"
import { RunPermissionBody } from "../src/mini/footer.permission"
import { RunFormBody } from "../src/mini/footer.form"
import { RUN_THEME_FALLBACK } from "../src/mini/theme"
import type { PermissionReply } from "../src/mini/types"

for (const locale of ["zh", "en"] as const) {
  for (const width of [24, 80]) {
    test(`${locale} permission chrome at ${width} columns preserves raw decisions`, async () => {
      const replies: PermissionReply[] = []
      const app = await testRender(
        () =>
          createComponent(RunPermissionBody, {
            locale,
            request: { id: "req_RAW", sessionID: "ses_RAW", action: "RAW_tool", resources: ["RAW_{{x}}"] },
            theme: RUN_THEME_FALLBACK.footer,
            block: RUN_THEME_FALLBACK.block,
            onReply: (reply) => {
              replies.push(reply)
            },
          }),
        { width, height: 12 },
      )
      try {
        await app.renderOnce()
        await Bun.sleep(0)
        await app.renderOnce()
        expect(app.captureCharFrame()).toContain(locale === "zh" ? "允许一次" : "Allow once")
        expect(app.captureCharFrame()).toContain("RAW_tool")
        app.mockInput.pressEnter()
        await app.renderOnce()
        expect(replies).toEqual([{ sessionID: "ses_RAW", requestID: "req_RAW", decision: "once" }])
      } finally {
        app.renderer.destroy()
      }
    })
  }
  test(`${locale} form boolean labels use the configured translator`, async () => {
    const app = await testRender(
      () =>
        createComponent(RunFormBody, {
          locale,
          request: {
            id: "form_RAW",
            sessionID: "ses_RAW",
            title: "RAW {{title}}",
            fields: [{ key: "RAW_flag", type: "boolean" }],
          },
          theme: RUN_THEME_FALLBACK.footer,
          onReply: () => {},
          onCancel: () => {},
        }),
      { width: 80, height: 20 },
    )
    try {
      await app.renderOnce()
      await Bun.sleep(0)
      await app.renderOnce()
      expect(app.captureCharFrame()).toContain("RAW {{title}}")
      expect(app.captureCharFrame()).toContain(locale === "zh" ? "是" : "Yes")
      expect(app.captureCharFrame()).toContain(locale === "zh" ? "否" : "No")
    } finally {
      app.renderer.destroy()
    }
  })
}
