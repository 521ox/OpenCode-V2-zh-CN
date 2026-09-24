/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount } from "solid-js"
import { DialogPair } from "../../src/component/dialog-pair"
import { ConfigProvider } from "../../src/config"
import { I18nProvider } from "../../src/context/i18n"
import { ClientProvider } from "../../src/context/client"
import { DataProvider } from "../../src/context/data"
import { Keymap } from "../../src/context/keymap"
import { LocationProvider } from "../../src/context/location"
import { ThemeProvider } from "../../src/context/theme"
import { DialogProvider, useDialog } from "../../src/ui/dialog"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource } from "../fixture/fixture"
import { createApi, createEventStream, createFetch, json } from "../fixture/tui-client"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

function PairHost(props: { error?: boolean }) {
  const dialog = useDialog()
  onMount(() => dialog.replace(() => <DialogPair />))
  return null
}

async function renderPair(locale: "en" | "zh", error = false) {
  const root = process.env.OPENCODE_TEST_HOME!
  const api = createApi(
    createFetch((url) => {
      if (url.pathname === "/api/info") {
        if (error) return new Response("pair unavailable", { status: 503 })
        return json({ urls: ["http://127.0.0.1:4096"], version: "fixture", pid: 1, paths: {} })
      }
      if (url.pathname === "/api/pair") return json({ code: "fixture", expires_in: 300 })
      return undefined
    }, createEventStream()).fetch,
  )
  const app = await testRender(
    () => (
      <TestTuiContexts directory={root} paths={{ home: root, state: root, worktree: root }}>
        <ConfigProvider config={createTuiResolvedConfig({ locale })}>
          <I18nProvider>
            <Keymap.Provider>
              <ClientProvider api={api}>
                <DataProvider directory={root}>
                  <LocationProvider>
                    <ThemeProvider mode="dark" source={emptyThemeSource}>
                      <ToastProvider>
                        <DialogProvider>
                          <PairHost error={error} />
                        </DialogProvider>
                      </ToastProvider>
                    </ThemeProvider>
                  </LocationProvider>
                </DataProvider>
              </ClientProvider>
            </Keymap.Provider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 100, height: 30, kittyKeyboard: true },
  )
  app.renderer.start()
  return app
}

for (const locale of ["en", "zh"] as const) {
  test(`pair dialog renders one-time links without stored credentials in ${locale}`, async () => {
    const app = await renderPair(locale)
    try {
      await app.waitForFrame((frame) => frame.includes("fixture"))
      const frame = app.captureCharFrame()
      const compact = frame.replace(/\s+/g, " ")
      expect(compact).toContain("auth/")
      expect(compact).toContain("connect/fixture")
      expect(compact).toContain("5")
      expect(compact).toContain(locale === "en" ? "minutes" : "分钟")
      expect(frame).not.toContain("Username")
      expect(frame).not.toContain("用户名")
      expect(frame).not.toContain("Password")
      expect(frame).not.toContain("密码")
      expect(frame).toContain("×")
    } finally {
      app.renderer.destroy()
    }
  })

  test(`pair dialog renders localized failure guidance in ${locale}`, async () => {
    const app = await renderPair(locale, true)
    try {
      await app.waitForFrame((frame) =>
        frame.includes(locale === "en" ? "Could not load server information" : "无法加载服务器信息"),
      )
      expect(app.captureCharFrame()).toContain(locale === "en" ? "Close and reopen Pair" : "关闭并重新打开配对")
    } finally {
      app.renderer.destroy()
    }
  })
}
