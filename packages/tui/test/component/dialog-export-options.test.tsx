/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount } from "solid-js"
import { ConfigProvider } from "../../src/config"
import { Keymap } from "../../src/context/keymap"
import { I18nProvider } from "../../src/context/i18n"
import { ThemeProvider, useTheme } from "../../src/context/theme"
import { DialogProvider, useDialog } from "../../src/ui/dialog"
import { DialogExportOptions } from "../../src/ui/dialog-export-options"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

test.each(["legacy", "zh", "en"] as const)("export options interaction: %s", async (mode) => {
  const saved: string[] = []
  await using temporary = await tmpdir()
  let theme: ReturnType<ReturnType<typeof useTheme>["surface"]> | undefined
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider
          config={createTuiResolvedConfig({
            locale: mode === "zh" ? "zh" : "en",
            experimental: { "new-designs": mode !== "legacy" },
          })}
        >
          <I18nProvider>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <Keymap.Provider>
                <ToastProvider>
                  <DialogProvider>
                    {(() => {
                      theme = useTheme().surface("dialog")
                      const dialog = useDialog()
                      onMount(() =>
                        dialog.replace(() => (
                          <DialogExportOptions
                            defaultThinking={true}
                            onConfirm={(options) => {
                              if (options.action === "export" && options.location) saved.push(options.location)
                            }}
                          />
                        )),
                      )
                      return null
                    })()}
                  </DialogProvider>
                </ToastProvider>
              </Keymap.Provider>
            </ThemeProvider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 24, kittyKeyboard: true },
  )
  const span = (text: string) =>
    app
      .captureSpans()
      .lines.flatMap((line) => line.spans)
      .find((span) => span.text.includes(text))
  const focusedButton = () => theme!.background.action.primary.focused
  const focusedField = () => theme!.text.formfield.focused
  const field = () => theme!.text.formfield.base

  try {
    app.renderer.start()
    if (mode !== "legacy") {
      await app.waitForFrame(
        (frame) =>
          frame.includes(mode === "zh" ? "保存位置" : "Location") &&
          frame.includes(mode === "zh" ? "当前工作目录" : "project"),
      )
      app.mockInput.pressEnter()
      app.mockInput.pressArrow("down")
      app.mockInput.pressArrow("right")
      await app.waitForFrame((frame) => frame.includes(mode === "zh" ? "临时目录" : "temp"))
      app.mockInput.pressEnter()
      await app.waitForFrame(() => saved.length === 2)
      expect(saved).toEqual(["project", "temp"])
      return
    }
    await app.waitForFrame((frame) => frame.includes("Copy") && frame.includes("Include tools"))
    // Only the focused field is highlighted; checked fields keep the base label colour.
    expect(span("Markdown")?.fg.equals(focusedField())).toBe(true)
    expect(span("Include thinking")?.fg.equals(field())).toBe(true)
    expect(span("Copy")?.bg.equals(focusedButton())).toBe(false)

    for (const _ of [1, 2, 3, 4]) app.mockInput.pressTab()
    await app.waitForFrame(() => span("Copy")?.bg.equals(focusedButton()) === true)
    expect(span("Include tools")?.fg.equals(field())).toBe(true)

    app.mockInput.pressTab({ shift: true })
    await app.waitForFrame(() => span("Include tools")?.fg.equals(focusedField()) === true)
    expect(span("Copy")?.bg.equals(focusedButton())).toBe(false)
  } finally {
    app.renderer.destroy()
  }
})
