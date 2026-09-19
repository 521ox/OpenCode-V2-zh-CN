/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount } from "solid-js"
import { ConfigProvider } from "../src/config"
import { I18nProvider } from "../src/context/i18n"
import { ClientProvider } from "../src/context/client"
import { DataProvider, useData } from "../src/context/data"
import { Keymap } from "../src/context/keymap"
import { LocationProvider } from "../src/context/location"
import { RouteProvider, useRoute } from "../src/context/route"
import { ThemeProvider } from "../src/context/theme"
import { Composer } from "../src/routes/session/composer"
import { DialogProvider } from "../src/ui/dialog"
import { ToastProvider } from "../src/ui/toast"
import { createApi, createEventStream, createFetch, directory, json } from "./fixture/tui-client"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test.each(["en", "zh"] as const)(
  "subagent panel displays the canonical ID and keeps its target in %s",
  async (locale) => {
    const parentID = "ses_parent_0123456789abcdef"
    const childID = "ses_child_0123456789abcdefghijklmnopqrstuvwxyz"
    const parent = {
      id: parentID,
      title: "Parent",
      projectID: "proj_test",
      location: { directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 0, updated: 0 },
    }
    const child = { ...parent, id: childID, title: "Literal child title", agent: "general", parentID }
    const interrupted: string[] = []
    const calls = createFetch((url, request) => {
      if (url.pathname === "/api/session/active") return json({ data: { [childID]: { type: "running" } } })
      if (url.pathname === `/api/session/${parentID}`) return json({ data: parent })
      if (url.pathname === `/api/session/${childID}`) return json({ data: child })
      if (url.pathname === `/api/session/${childID}/interrupt` && request.method === "POST") {
        interrupted.push(childID)
        return json({ interrupted: true })
      }
      return undefined
    }, createEventStream())
    const ready = Promise.withResolvers<void>()
    let route!: ReturnType<typeof useRoute>
    let dispatch!: ReturnType<typeof Keymap.use>["dispatch"]
    let data!: ReturnType<typeof useData>
    function Content() {
      data = useData()
      route = useRoute()
      dispatch = Keymap.use().dispatch
      onMount(() => {
        void Promise.all([data.session.sync(parentID), data.session.sync(childID)]).then(
          () => ready.resolve(),
          ready.reject,
        )
      })
      return <Composer sessionID={parentID} open={true} defaultTab="subagents" />
    }
    const app = await testRender(
      () => (
        <TestTuiContexts directory={directory}>
          <ConfigProvider config={createTuiResolvedConfig({ locale }, { terminal: false })}>
            <I18nProvider>
              <Keymap.Provider>
                <ClientProvider api={createApi(calls.fetch)}>
                  <DataProvider directory={directory}>
                    <LocationProvider>
                      <RouteProvider initialRoute={{ type: "session", sessionID: parentID }}>
                        <ThemeProvider mode="dark" source={{ discover: async () => ({}) }}>
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
      { width: 140, height: 20, kittyKeyboard: true },
    )
    try {
      await ready.promise
      await app.waitFor(() => data.session.status(childID) === "running")
      await app.renderOnce()
      const frame = app.captureCharFrame()
      expect(frame).toContain(`General: Literal child title · ${childID}`)
      expect(frame).toContain(locale === "zh" ? "子代理" : "Subagents")
      expect(frame).toContain(locale === "zh" ? "运行中" : "Running")
      expect(route.data).toMatchObject({ type: "session", sessionID: parentID })
      dispatch("composer.subagent.interrupt")
      await app.waitFor(() => interrupted.length === 1)
      expect(interrupted).toEqual([childID])
      dispatch("composer.subagent.select")
      expect(route.data).toMatchObject({ type: "session", sessionID: childID })
    } finally {
      app.renderer.destroy()
    }
  },
)
