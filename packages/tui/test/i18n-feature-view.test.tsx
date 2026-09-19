/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Context } from "@opencode/plugin/tui/context"
import { ConfigProvider, resolve, type Info, type Interface } from "../src/config"
import { I18nProvider, useI18n } from "../src/context/i18n"
import { PromptFooter } from "../src/feature-plugins/prompt/footer"

test("mounted prompt footer reacts to locale changes without changing the official child command", async () => {
  let current: Info = {}
  const service: Interface = {
    get: async () => current,
    update: async (update) => {
      const draft = { ...current }
      update(draft)
      current = draft
      return current
    },
  }
  const dispatched: string[] = []
  const color = RGBA.fromInts(200, 200, 200)
  const plugin = {
    location: { directory: "/workspace" },
    theme: { text: { base: color, muted: color } },
    keymap: {
      shortcuts: (id: string) => (id === "session.child.first" ? ["ctrl+j"] : ["ctrl+p"]),
      dispatch: (id: string) => dispatched.push(id),
    },
    data: {
      session: {
        family: () => ["session", "child"],
        status: (id: string) => (id === "child" ? "running" : "idle"),
        get: () => ({ id: "session", location: { directory: "/workspace" } }),
        cost: () => 0,
        message: { list: () => [] },
      },
      shell: { list: () => [] },
      location: { model: { list: () => [] } },
    },
  } as unknown as Context
  let i18n: ReturnType<typeof useI18n> | undefined
  function View() {
    i18n = useI18n()
    return <PromptFooter context={plugin} sessionID="session" mode="normal" showDetails />
  }
  const app = await testRender(
    () => (
      <ConfigProvider config={resolve(current, { terminalSuspend: true })} service={service}>
        <I18nProvider>
          <View />
        </I18nProvider>
      </ConfigProvider>
    ),
    { width: 80, height: 2 },
  )
  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("1 个子代理")
    expect(app.captureCharFrame()).toContain("命令")
    if (!i18n) throw new Error("Locale context was not provided")
    await i18n.setLocale("en")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("1 subagent")
    expect(app.captureCharFrame()).toContain("commands")
    await app.mockMouse.click(2, 0)
    expect(dispatched).toEqual(["session.child.first"])
  } finally {
    app.renderer.destroy()
  }
})
