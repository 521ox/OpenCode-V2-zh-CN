/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { Renderable, ScrollBoxRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { onMount } from "solid-js"
import { Answer } from "../../src/feature-plugins/prompt/btw"
import { ConfigProvider } from "../../src/config"
import { I18nProvider } from "../../src/context/i18n"
import { Keymap } from "../../src/context/keymap"
import { ThemeProvider } from "../../src/context/theme"
import { DialogProvider, useDialog } from "../../src/ui/dialog"
import { ToastProvider } from "../../src/ui/toast"
import { stringWidth } from "../../src/util/string-width"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

function scrollbox(node: Renderable): ScrollBoxRenderable | undefined {
  if (node instanceof ScrollBoxRenderable) return node
  for (const child of node.getChildren()) {
    const result = scrollbox(child)
    if (result) return result
  }
}

test.each(["en", "zh"] as const)("btw responsive dialog controls (%s)", async (locale) => {
  await using tmp = await tmpdir()
  const answer = Array.from({ length: 80 }, (_, index) => `Answer line ${index + 1}`).join("\n\n")
  const copies: string[] = []
  let dialog!: ReturnType<typeof useDialog>
  function Open() {
    dialog = useDialog()
    onMount(() => {
      dialog.replace(() => <Answer question="Side question 问题" answer={answer} markdown={() => undefined} />)
      dialog.setSize("large")
      dialog.setCentered(true)
    })
    return null
  }
  const app = await testRender(
    () => (
      <TestTuiContexts
        directory={tmp.path}
        paths={{ home: tmp.path, state: tmp.path, worktree: tmp.path }}
        clipboard={{
          read: async () => undefined,
          write: async (text) => {
            copies.push(text)
          },
        }}
      >
        <ConfigProvider config={createTuiResolvedConfig({ locale, animations: false })}>
          <I18nProvider>
            <Keymap.Provider>
              <ThemeProvider mode="dark" source={emptyThemeSource}>
                <ToastProvider>
                  <DialogProvider>
                    <Open />
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </Keymap.Provider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 120, height: 40, kittyKeyboard: true },
  )
  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes("Answer line 1"))
    for (const [width, height] of [
      [120, 40],
      [40, 20],
      [120, 40],
    ] as const) {
      app.resize(width, height)
      await app.renderOnce()
      const frame = app.captureCharFrame()
      console.log(`FRAME btw-${locale}-${width}x${height}\n${frame}`)
      expect(frame).toContain("/btw")
      expect(frame).toContain("Answer line 1")
      expect(frame).toContain("×")
      expect(frame).toContain(locale === "en" ? "j/k ↑/↓ scroll" : "j/k ↑/↓ 滚动")
      const scroll = scrollbox(app.renderer.root)
      expect(scroll).toBeDefined()
      expect(scroll!.height).toBe(Math.max(8, Math.floor(height * 0.6)))
      app.mockInput.pressKey("HOME")
      app.mockInput.pressKey("j")
      expect(scroll!.scrollTop).toBe(1)
      app.mockInput.pressKey("k")
      expect(scroll!.scrollTop).toBe(0)
      await app.mockInput.pressKeys(["\u001b[6~"])
      expect(scroll!.scrollTop).toBe(Math.max(8, Math.floor(height * 0.6)))
      app.mockInput.pressKey("HOME")
    }
    app.mockInput.pressKey("c")
    await app.renderOnce()
    expect(copies).toEqual([answer])
    expect(app.captureCharFrame()).toContain(locale === "en" ? "copied" : "已复制")
    const lines = app.captureCharFrame().split("\n")
    const y = lines.findIndex((line) => line.includes("×"))
    expect(y).toBeGreaterThanOrEqual(0)
    await app.mockMouse.click(stringWidth(lines[y]!.slice(0, lines[y]!.indexOf("×"))), y)
    await app.renderOnce()
    expect(dialog.stack).toHaveLength(0)
    dialog.replace(() => <Answer question="Again" answer={answer} markdown={() => undefined} />)
    await app.waitForFrame((frame) => frame.includes("Again"))
    expect(app.renderer.getSelection()).toBeTruthy()
    app.mockInput.pressEscape()
    expect(app.renderer.getSelection()).toBeNull()
    expect(dialog.stack).toHaveLength(1)
    app.mockInput.pressEscape()
    await app.waitFor(() => dialog.stack.length === 0)
    expect(dialog.stack).toHaveLength(0)
  } finally {
    app.renderer.destroy()
  }
})
