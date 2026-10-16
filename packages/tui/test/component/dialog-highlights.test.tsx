/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount } from "solid-js"
import { DialogHighlights } from "../../src/component/dialog-highlights"
import { ConfigProvider } from "../../src/config"
import { I18nProvider } from "../../src/context/i18n"
import { Keymap } from "../../src/context/keymap"
import { ThemeProvider } from "../../src/context/theme"
import { DialogProvider, useDialog } from "../../src/ui/dialog"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

const items = Array.from({ length: 5 }, (_, index) => ({
  title: `Highlight ${index + 1}`,
  body: `Use \`command-${index + 1}\` to try the change. It explains what you can do now and why it matters to you.`,
}))

// Dialog key bindings are only active while the dialog is on the stack.
function Open() {
  const dialog = useDialog()
  onMount(() => dialog.replace(() => <DialogHighlights version="2.0.27" items={items} />))
  return null
}

test.each([
  { locale: "en", width: 70, title: "What's new in 2.0.27", scroll: "scroll ↑/↓" },
  { locale: "zh", width: 70, title: "2.0.27 版本新内容", scroll: "滚动 ↑/↓" },
  { locale: "en", width: 44, title: "What's new in 2.0.27", scroll: "scroll ↑/↓" },
  { locale: "zh", width: 44, title: "2.0.27 版本新内容", scroll: "滚动 ↑/↓" },
] as const)("scrolls long highlights between a fixed title and footer ($locale, $width)", async (input) => {
  await using temporary = await tmpdir()
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig({ locale: input.locale })}>
          <I18nProvider>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <Keymap.Provider>
                <ToastProvider>
                  <DialogProvider>
                    <Open />
                  </DialogProvider>
                </ToastProvider>
              </Keymap.Provider>
            </ThemeProvider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: input.width, height: 20, kittyKeyboard: true },
  )

  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes(input.title) && frame.includes("Highlight 1"))
    const top = app.captureCharFrame()
    expect(top).toContain("command-1")
    expect(top).toContain(input.scroll)
    expect(top).toContain(" × ")
    expect(top).not.toContain("Highlight 5")
    expect(top).not.toContain("`")

    app.mockInput.pressKey("END")
    await app.waitForFrame((frame) => frame.includes("Highlight 5"))
    const bottom = app.captureCharFrame()
    expect(bottom).toContain(input.title)
    expect(bottom).toContain(input.scroll)
    expect(bottom).not.toContain("Highlight 1")

    app.mockInput.pressKey("k")
    app.mockInput.pressKey("HOME")
    await app.waitForFrame((frame) => frame.includes("Highlight 1"))

    app.mockInput.pressEnter()
    await app.waitForFrame((frame) => !frame.includes(input.title))
  } finally {
    app.renderer.destroy()
  }
})
