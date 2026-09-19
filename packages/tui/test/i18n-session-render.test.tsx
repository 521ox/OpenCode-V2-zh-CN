import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect, FileSystem } from "effect"
import { Global } from "@opencode/util/global"
import { createEventStream, createFetch, directory, json } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"

test.each(["zh", "en"] as const)("real session chrome and child navigation in %s", async (locale) => {
  await using state = await tmpdir()
  const setup = await createTestRenderer({ width: 120, height: 40, useThread: false, kittyKeyboard: true })
  setup.renderer.start()
  const parent = {
    id: "ses_i18n_parent",
    title: "Literal session title",
    projectID: "project",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 0, updated: 0 },
  }
  const child = { ...parent, id: "ses_i18n_child", title: "Literal child title", parentID: parent.id }
  const raw = "Raw user $& {{title}} <literal>"
  const summary = "Raw compaction summary $t(other)"
  const description = "Raw child completion {{name}}"
  const messages = [
    { id: "user-0", type: "user", text: raw, time: { created: 0 } },
    {
      id: "compaction-0",
      type: "compaction",
      status: "completed",
      reason: "auto",
      summary,
      recent: "",
      time: { created: 1 },
    },
    {
      id: "notice-0",
      type: "synthetic",
      text: "Raw subagent result",
      description,
      metadata: { source: "subagent", childID: child.id, agent: "general", state: "completed" },
      time: { created: 2 },
    },
  ]
  const childMessages = [{ id: "child-user", type: "user", text: "Raw child body", time: { created: 0 } }]
  const calls = createFetch((url) => {
    if (url.pathname === "/api/session") return json({ data: [parent, child], cursor: {} })
    if (url.pathname === `/api/session/${parent.id}`) return json({ data: parent })
    if (url.pathname === `/api/session/${child.id}`) return json({ data: child })
    if (url.pathname === `/api/session/${parent.id}/message`) return json({ data: messages.toReversed(), cursor: {} })
    if (url.pathname === `/api/session/${child.id}/message`) return json({ data: childMessages, cursor: {} })
    if (url.pathname.endsWith("/inbox") || url.pathname.endsWith("/permission")) return json({ data: [] })
    return undefined
  }, createEventStream())
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", idleTimeout: 0, fetch: (request) => calls.fetch(request) })
  const { run } = await import("../src/app")
  const task = Effect.runPromise(
    run({
      app: { name: "test", version: "test", channel: "test" },
      server: { endpoint: { url: server.url.toString() } },
      config: { get: async () => ({ locale, animations: false, tabs: { enabled: false } }), update: async () => ({}) },
      packages: { prepare: async () => ({ directory: "" }) },
      args: { sessionID: parent.id },
      terminalHandoff: async () => ({ renderer: setup.renderer, mode: "dark", complete: () => {} }),
      log: () => {},
    }).pipe(Effect.provide(Global.layerWith({ state: state.path })), Effect.provide(FileSystem.layerNoop({}))),
  )
  try {
    const heading = locale === "zh" ? "General 已完成" : "General finished"
    const frame = await setup.waitForFrame((frame) => frame.includes(heading))
    expect(frame).toContain(locale === "zh" ? "压缩" : "Compaction")
    expect(frame).toContain(raw)
    expect(frame).toContain(summary)
    expect(frame).toContain(description)
    expect(frame).not.toContain(parent.id)
    expect(frame).not.toContain(child.id)
    expect(frame.split(heading)).toHaveLength(2)
    await setup.waitForVisualIdle()
    const lines = setup.captureCharFrame().split("\n")
    const y = lines.findIndex((line) => line.includes(heading))
    const x = lines[y].indexOf(heading)
    await setup.mockMouse.click(x + 1, y)
    await setup.waitForFrame((frame) => frame.includes("Raw child body"))
  } finally {
    setup.renderer.destroy()
    await task
    await server.stop()
  }
})
