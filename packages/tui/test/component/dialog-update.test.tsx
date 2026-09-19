/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { createSignal, onMount } from "solid-js"
import { DialogUpdate } from "../../src/component/dialog-update"
import { ConfigProvider, useConfig, type Info, type Interface } from "../../src/config"
import { I18nProvider } from "../../src/context/i18n"
import type { UpdateState } from "../../src/context/update-notification"
import { Keymap } from "../../src/context/keymap"
import { ThemeProvider } from "../../src/context/theme"
import { DialogProvider, useDialog } from "../../src/ui/dialog"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

for (const initial of ["available", "installed"] as const) {
  for (const change of ["locale", "state"] as const) {
    test(`${initial}: ${change === "locale" ? "locale reload preserves Skip selection" : "update state change resets the selected action"}`, async () => {
      await using temporary = await tmpdir()
      let current: Info = { locale: "en" }
      const service: Interface = {
        get: async () => current,
        update: async (update) => {
          const draft = { ...current }
          update(draft)
          current = draft
          return current
        },
      }
      let config: ReturnType<typeof useConfig> | undefined
      const [state, setState] = createSignal<UpdateState>({ type: initial, version: "2.0.0" })
      const [actions, setActions] = createSignal<string[]>([])
      function Host() {
        config = useConfig()
        const dialog = useDialog()
        onMount(() =>
          dialog.replace(() => (
            <DialogUpdate
              state={state}
              skip={() => setActions((items) => [...items, "skip"])}
              install={async () => {
                setActions((items) => [...items, "install"])
              }}
              restart={() => setActions((items) => [...items, "restart"])}
            />
          )),
        )
        return <text>{actions().join(",")}</text>
      }
      const app = await testRender(
        () => (
          <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
            <ConfigProvider config={createTuiResolvedConfig(current)} service={service}>
              <I18nProvider>
                <ThemeProvider mode="dark" source={emptyThemeSource}>
                  <Keymap.Provider>
                    <ToastProvider>
                      <DialogProvider>
                        <Host />
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
      try {
        app.renderer.start()
        await app.waitForFrame((frame) => frame.includes("Skip"))
        app.mockInput.pressArrow("left")
        await app.renderOnce()
        expect(actions()).toEqual([])
        if (change === "locale") {
          if (!config) throw new Error("Missing config fixture")
          await config.update((draft) => {
            draft.locale = "zh"
          })
          await app.waitForFrame((frame) => frame.includes("跳过") && !frame.includes("Skip"))
        } else {
          setState({ type: initial === "available" ? "installed" : "available", version: "2.0.0" })
          await app.waitForFrame((frame) => frame.includes(initial === "available" ? "Restart" : "Update available"))
        }
        app.mockInput.pressEnter()
        await app.waitForFrame(() => actions().length > 0)
        expect(actions()).toEqual([change === "locale" ? "skip" : initial === "available" ? "restart" : "install"])
      } finally {
        app.renderer.destroy()
      }
    })
  }
}

test("installation progress replaces checking while the update job is still pending", async () => {
  await using temporary = await tmpdir()
  const [state, setState] = createSignal<UpdateState>()
  const pending = Promise.withResolvers<string | undefined>()
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig({ locale: "en" })}>
          <I18nProvider>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <Keymap.Provider>
                <ToastProvider>
                  <DialogProvider>
                    <DialogUpdate
                      check={() => pending.promise}
                      state={state}
                      skip={() => {}}
                      install={() => Promise.resolve()}
                      restart={() => {}}
                    />
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

  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes("Checking for updates"))
    setState({ type: "installing", version: "2.0.0" })
    await app.waitForFrame(
      (frame) =>
        frame.includes("Updating OpenCode") &&
        frame.includes("Installing OpenCode 2.0.0") &&
        !frame.includes("Checking"),
    )
    expect(app.captureCharFrame()).not.toContain("Skip")
    pending.reject(new Error("Update service unavailable"))
    await app.waitForFrame((frame) => frame.includes("Update service unavailable") && !frame.includes("Installing"))
  } finally {
    pending.resolve(undefined)
    app.renderer.destroy()
  }
})
