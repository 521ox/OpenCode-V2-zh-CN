/** @jsxImportSource @opentui/solid */
import { InputRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount, type JSX } from "solid-js"
import { DialogExperiments } from "../src/component/dialog-experiments"
import { ConfigProvider, resolve, useNewDesigns, type Info, type Interface } from "../src/config"
import { I18nProvider, useI18n } from "../src/context/i18n"
import { Keymap } from "../src/context/keymap"
import { ThemeProvider } from "../src/context/theme"
import { DialogProvider, useDialog } from "../src/ui/dialog"
import { DialogSelect } from "../src/ui/dialog-select"
import { ToastProvider } from "../src/ui/toast"
import { emptyThemeSource, tmpdir } from "./fixture/fixture"
import { TestTuiContexts } from "./fixture/tui-environment"

async function mount(root: string, content: () => JSX.Element, initial: Info, width: number) {
  let current = initial
  const service: Interface = {
    get: async () => current,
    update: async (mutate) => {
      const next = structuredClone(current)
      mutate(next)
      current = next
      return next
    },
  }
  let i18n!: ReturnType<typeof useI18n>
  let enabled!: ReturnType<typeof useNewDesigns>
  function Content() {
    i18n = useI18n()
    enabled = useNewDesigns()
    const dialog = useDialog()
    onMount(() => dialog.replace(content))
    return null
  }
  const app = await testRender(
    () => (
      <TestTuiContexts directory={root} paths={{ home: root, state: root, worktree: root }}>
        <ConfigProvider config={resolve(current, { terminalSuspend: true })} service={service}>
          <I18nProvider>
            <Keymap.Provider>
              <ThemeProvider mode="dark" source={emptyThemeSource}>
                <ToastProvider>
                  <DialogProvider>
                    <Content />
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </Keymap.Provider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width, height: 24, kittyKeyboard: true },
  )
  app.renderer.start()
  return { app, current: () => current, i18n: () => i18n, enabled: () => enabled() }
}

test.each([
  ["default", undefined],
  ["explicit false", false],
] as const)(
  "the real experiment dialog is opt-in from %s, persists its toggle and reacts to locale",
  async (_label, initial) => {
    await using root = await tmpdir()
    const fixture = await mount(
      root.path,
      () => <DialogExperiments />,
      {
        locale: "zh",
        animations: false,
        ...(initial === undefined ? {} : { experimental: { "new-designs": initial } }),
      },
      44,
    )
    const { app } = fixture
    try {
      await app.waitForFrame((frame) => frame.includes("新版设计"))
      await app.waitFor(() => app.renderer.currentFocusedEditor instanceof InputRenderable)
      expect(fixture.enabled()).toBe(false)
      expect(fixture.current().experimental?.["new-designs"]).toBe(initial)
      app.mockInput.pressEnter()
      await app.waitFor(() => fixture.enabled())
      expect(fixture.current().experimental?.["new-designs"]).toBe(true)
      await fixture.i18n().setLocale("en")
      await app.waitForFrame((frame) => frame.includes("New designs"))
      expect(fixture.enabled()).toBe(true)
      await app.waitFor(() => app.renderer.currentFocusedEditor instanceof InputRenderable)
      app.mockInput.pressEnter()
      await app.waitFor(() => !fixture.enabled())
      expect(fixture.current().experimental?.["new-designs"]).toBe(false)
    } finally {
      app.renderer.destroy()
    }
  },
)

test("opted-in title search keeps translated placeholders and the existing close control", async () => {
  await using root = await tmpdir()
  function Select() {
    const { t } = useI18n()
    return (
      <DialogSelect
        title={t("main.commands")}
        searchInTitle
        titlePlaceholder={t("main.search.commands")}
        options={[{ title: "literal command", value: "literal" }]}
      />
    )
  }
  const fixture = await mount(
    root.path,
    () => <Select />,
    { locale: "en", animations: false, experimental: { "new-designs": true } },
    100,
  )
  const { app } = fixture
  try {
    await app.waitForFrame((frame) => frame.includes("Search commands"))
    await app.waitFor(() => app.renderer.currentFocusedEditor instanceof InputRenderable)
    expect(app.captureCharFrame()).toContain("×")
    await fixture.i18n().setLocale("zh")
    await app.waitForFrame((frame) => frame.includes("搜索命令"))
    expect(app.captureCharFrame()).toContain("literal command")
    await app.mockInput.typeText("missing")
    await app.waitForFrame((frame) => frame.includes("未找到结果"))
    app.mockInput.pressEscape()
    await app.waitForFrame((frame) => !frame.includes("×"))
  } finally {
    app.renderer.destroy()
  }
})
