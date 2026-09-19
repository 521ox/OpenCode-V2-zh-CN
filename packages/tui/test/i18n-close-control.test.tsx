/** @jsxImportSource @opentui/solid */
import { Renderable, TextRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { createSignal, onMount, type JSX } from "solid-js"
import { ConfigProvider } from "../src/config"
import { I18nProvider } from "../src/context/i18n"
import { ClientProvider } from "../src/context/client"
import { DataProvider } from "../src/context/data"
import { Keymap } from "../src/context/keymap"
import { LocationProvider } from "../src/context/location"
import { RouteProvider } from "../src/context/route"
import { ThemeProvider } from "../src/context/theme"
import { Composer } from "../src/routes/session/composer"
import { DialogProvider, useDialog, type DialogContext } from "../src/ui/dialog"
import { DialogAlert } from "../src/ui/dialog-alert"
import { DialogConfirm } from "../src/ui/dialog-confirm"
import { DialogHelp } from "../src/ui/dialog-help"
import { DialogPrompt } from "../src/ui/dialog-prompt"
import { DialogSelect } from "../src/ui/dialog-select"
import { DialogExportResult } from "../src/ui/dialog-export-result"
import { ToastProvider } from "../src/ui/toast"
import { stringWidth } from "../src/util/string-width"
import { emptyThemeSource } from "./fixture/fixture"
import { createApi, createEventStream, createFetch } from "./fixture/tui-client"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

async function mount(input: { locale: "en" | "zh"; width?: number; content?: (dialog: DialogContext) => JSX.Element }) {
  let closed = 0
  let dialog!: DialogContext
  function Content() {
    dialog = useDialog()
    const [open, setOpen] = createSignal(true)
    if (input.content) {
      onMount(() =>
        dialog.replace(
          () => input.content!(dialog),
          () => closed++,
        ),
      )
      return null
    }
    return (
      <Composer
        sessionID="parent"
        open={open()}
        defaultTab="subagents"
        onClose={() => {
          closed++
          setOpen(false)
        }}
      />
    )
  }
  const root = process.env.OPENCODE_TEST_HOME!
  const calls = createFetch(() => undefined, createEventStream())
  const app = await testRender(
    () => (
      <TestTuiContexts directory={root} paths={{ home: root, state: root, worktree: root }}>
        <ConfigProvider config={createTuiResolvedConfig({ locale: input.locale }, { terminal: false })}>
          <I18nProvider>
            <Keymap.Provider>
              <ClientProvider api={createApi(calls.fetch)}>
                <DataProvider directory={root}>
                  <LocationProvider>
                    <RouteProvider initialRoute={{ type: "session", sessionID: "parent" }}>
                      <ThemeProvider mode={input.width === 40 ? "light" : "dark"} source={emptyThemeSource}>
                        <ToastProvider>
                          <DialogProvider>
                            <Content />
                          </DialogProvider>
                        </ToastProvider>
                      </ThemeProvider>
                    </RouteProvider>
                  </LocationProvider>
                </DataProvider>
              </ClientProvider>
            </Keymap.Provider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: input.width ?? 100, height: 24, kittyKeyboard: true },
  )
  app.renderer.start()
  await app.waitForFrame((frame) => frame.includes("×"))
  return { app, dialog, closed: () => closed }
}

function closeText(root: Renderable): TextRenderable | undefined {
  if (root instanceof TextRenderable && root.plainText.trim() === "×") return root
  for (const child of root.getChildren()) {
    const result = closeText(child)
    if (result) return result
  }
}

for (const locale of ["en", "zh"] as const) {
  for (const width of [40, 100]) {
    for (const action of ["left", "center", "right", "escape"] as const) {
      test(`close controls preserve hit area and single dismissal: ${locale} ${width} ${action}`, async () => {
        for (const composer of [false, true]) {
          let confirmed = 0
          let cancelled = 0
          const fixture = await mount({
            locale,
            width,
            content: composer
              ? undefined
              : () => (
                  <DialogConfirm
                    title="Selection audit"
                    message="alpha beta gamma"
                    onConfirm={() => confirmed++}
                    onCancel={() => cancelled++}
                  />
                ),
          })
          try {
            const control = closeText(fixture.app.renderer.root)!
            expect(control).toBeDefined()
            expect(control.width).toBe(3)
            expect(control.plainText).toBe(" × ")
            expect(control.x + control.width).toBeLessThanOrEqual(width)
            if (action === "escape") fixture.app.mockInput.pressEscape()
            else await fixture.app.mockMouse.click(control.x + ["left", "center", "right"].indexOf(action), control.y)
            await fixture.app.renderOnce()
            expect(fixture.closed()).toBe(1)
            expect(confirmed).toBe(0)
            expect(cancelled).toBe(0)
            expect(fixture.app.captureCharFrame()).not.toContain("×")
          } finally {
            fixture.app.renderer.destroy()
          }
        }
      })
    }
  }

  test(`custom prompt/select cancel remains single-dispatch in ${locale}`, async () => {
    for (const kind of ["prompt", "select"] as const) {
      for (const action of ["click", "escape"] as const) {
        let cancelled = 0
        const fixture = await mount({
          locale,
          content: (dialog) => {
            const cancel = () => {
              cancelled++
              dialog.clear()
            }
            return kind === "prompt" ? (
              <DialogPrompt title="Rename" value="draft" onCancel={cancel} />
            ) : (
              <DialogSelect title="Choose" options={[{ title: "One", value: "one" }]} onCancel={cancel} />
            )
          },
        })
        try {
          const control = closeText(fixture.app.renderer.root)!
          if (action === "click") await fixture.app.mockMouse.click(control.x + 1, control.y)
          else fixture.app.mockInput.pressEscape()
          await fixture.app.renderOnce()
          expect(cancelled, `${kind} ${action}`).toBe(1)
          expect(fixture.closed()).toBe(1)
        } finally {
          fixture.app.renderer.destroy()
        }
      }
    }
  })

  test(`busy prompt retains cancel guard in ${locale}`, async () => {
    let cancelled = 0
    const fixture = await mount({
      locale,
      content: () => <DialogPrompt title="Busy" busy onCancel={() => cancelled++} />,
    })
    try {
      const control = closeText(fixture.app.renderer.root)!
      await fixture.app.mockMouse.click(control.x + 1, control.y)
      fixture.app.mockInput.pressEscape()
      expect(cancelled).toBe(0)
      expect(fixture.closed()).toBe(0)
    } finally {
      fixture.app.renderer.destroy()
    }
  })

  test(`Escape clears a real selection before dismissing in ${locale}`, async () => {
    const fixture = await mount({
      locale,
      content: () => <DialogAlert title="Selection audit" message="alpha beta gamma" />,
    })
    try {
      const lines = fixture.app.captureCharFrame().split("\n")
      const y = lines.findIndex((line) => line.includes("alpha beta gamma"))
      const x = lines[y].indexOf("alpha")
      await fixture.app.mockMouse.drag(x, y, x + 9, y)
      expect(fixture.app.renderer.getSelection()?.getSelectedText()).toContain("alpha")
      expect(fixture.closed()).toBe(0)
      fixture.app.mockInput.pressEscape()
      expect(fixture.app.renderer.getSelection() === null).toBe(true)
      expect(fixture.closed()).toBe(0)
      fixture.app.mockInput.pressEscape()
      expect(fixture.closed()).toBe(1)
    } finally {
      fixture.app.renderer.destroy()
    }
  })

  test(`help keeps its nine-cell target and export callback runs once in ${locale}`, async () => {
    for (const kind of ["help", "export"] as const) {
      let callback = 0
      const fixture = await mount({
        locale,
        content: () =>
          kind === "help" ? <DialogHelp /> : <DialogExportResult path="literal.md" onClose={() => callback++} />,
      })
      try {
        const control = closeText(fixture.app.renderer.root)!
        expect(stringWidth("esc/enter")).toBe(9)
        expect(control.width).toBe(stringWidth(kind === "help" ? "esc/enter" : "esc"))
        await fixture.app.mockMouse.click(control.x, control.y)
        expect(fixture.closed()).toBe(1)
        expect(callback).toBe(kind === "help" ? 0 : 1)
      } finally {
        fixture.app.renderer.destroy()
      }
    }
  })
}
