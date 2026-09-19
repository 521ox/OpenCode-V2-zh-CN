import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect, FileSystem } from "effect"
import { Global } from "@opencode/util/global"
import { createEventStream, createFetch, directory, json } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"
import { toolDisplay } from "../src/routes/session"

const input = { search: { query: "bun", limit: 5 } }
const output = JSON.stringify(
  {
    operation: "search",
    matches: [
      { name: "bun", description: "中文测试", capabilities: ["javascript-runtime", "package-manager"], active: true },
    ],
    note: "Complete synthetic catalog output retained across expansion. ".repeat(4),
    end: "OUTPUT_END",
  },
  null,
  2,
)

async function fixture(tool = "environment_tools", width = 120, status = "completed") {
  const toolInput = tool === "direct_exec" ? { id: "synthetic-bun", args: ["--version"], cwd: "C:/synthetic" } : input
  const detail = tool === "direct_exec" ? '"--version"' : '"query"'
  const state = await tmpdir()
  const setup = await createTestRenderer({ width, height: 65, useThread: false, kittyKeyboard: true })
  setup.renderer.start()
  const session = {
    id: "ses_environment_collapse",
    title: "Tool detail fixture",
    projectID: "project",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 0, updated: 0 },
  }
  const messages = [
    { id: "user-0", type: "user", text: "Inspect synthetic tool details", time: { created: 0 } },
    {
      id: "assistant-0",
      type: "assistant",
      agent: "build",
      model: { providerID: "test", id: "test" },
      content: [
        {
          type: "tool",
          id: "tool-0",
          name: tool,
          state: {
            status,
            input: toolInput,
            content: [{ type: "text", text: output }],
            metadata: { title: "Synthetic lookup" },
            ...(status === "error" ? { error: { message: "Synthetic lookup failed", type: "ProcessError" } } : {}),
          },
          time: { created: 1, completed: 2 },
        },
      ],
      time: { created: 1, completed: 2 },
    },
  ]
  const calls = createFetch((url) => {
    if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
    if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
    if (url.pathname === `/api/session/${session.id}/message`) return json({ data: messages.toReversed(), cursor: {} })
    if (url.pathname.endsWith("/inbox") || url.pathname.endsWith("/permission")) return json({ data: [] })
    return undefined
  }, createEventStream())
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, fetch: (request) => calls.fetch(request) })
  const { run } = await import("../src/app")
  const task = Effect.runPromise(
    run({
      app: { name: "test", version: "test", channel: "test" },
      server: { endpoint: { url: server.url.toString() } },
      config: {
        get: async () => ({ locale: "en", animations: false, tabs: { enabled: false } }),
        update: async () => ({ locale: "en" }),
      },
      packages: { prepare: async () => ({ directory: "" }) },
      args: { sessionID: session.id },
      terminalHandoff: async () => ({ renderer: setup.renderer, mode: "dark", complete: () => {} }),
      log: () => {},
    }).pipe(Effect.provide(Global.layerWith({ state: state.path })), Effect.provide(FileSystem.layerNoop({}))),
  )
  const point = (text: string) => {
    const lines = setup.captureCharFrame().split("\n")
    const y = lines.findIndex((line) => line.includes(text))
    if (y < 0) throw new Error(`Missing ${text}\n${setup.captureCharFrame()}`)
    return { x: lines[y].indexOf(text) + 1, y }
  }
  return {
    setup,
    point,
    detail,
    async ready() {
      await setup.waitForFrame((frame) => frame.includes(tool))
      await setup.waitForVisualIdle()
    },
    async click(text: string, offset = 0) {
      const p = point(text)
      await setup.mockMouse.click(p.x + offset, p.y)
      await setup.waitForVisualIdle()
    },
    async [Symbol.asyncDispose]() {
      setup.renderer.destroy()
      await task
      await server.stop()
      await state[Symbol.asyncDispose]()
    },
  }
}

test("native tools have explicit displays while unknown tools retain generic display", () => {
  expect(toolDisplay("environment_tools")).toBe("environment_tools")
  expect(toolDisplay("direct_exec")).toBe("direct_exec")
  expect(toolDisplay("fixture_generic")).toBe("generic")
  expect(toolDisplay("shell")).toBe("shell")
})

test.each(["environment_tools", "direct_exec"])("%s heading toggles details", async (tool) => {
  await using f = await fixture(tool)
  await f.ready()
  expect(f.setup.captureCharFrame()).not.toContain("OUTPUT_END")
  await f.click(tool)
  expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
  await f.click(tool, 3)
  expect(f.setup.captureCharFrame()).not.toContain("OUTPUT_END")
})

test.each([
  ["environment_tools", 40],
  ["environment_tools", 120],
  ["direct_exec", 40],
  ["direct_exec", 120],
] as const)("%s nested input and output clicks collapse and preserve data at width %s", async (tool, width) => {
  await using f = await fixture(tool, width)
  await f.ready()
  await f.click(tool)
  const expanded = f.setup.captureCharFrame()
  expect(expanded).toContain(f.detail)
  expect(expanded).toContain("中文测试")
  expect(expanded).toContain("OUTPUT_END")
  for (const target of [f.detail, '"operation"']) {
    await f.click(target)
    expect(f.setup.captureCharFrame()).not.toContain("OUTPUT_END")
    await f.click(tool)
    expect(f.setup.captureCharFrame()).toBe(expanded)
  }
})

test.each(["environment_tools", "direct_exec"])(
  "drag-selecting %s input and output preserves expansion",
  async (tool) => {
    await using f = await fixture(tool)
    await f.ready()
    await f.click(tool)
    for (const target of [f.detail, '"operation"']) {
      const p = f.point(target)
      await f.setup.mockMouse.drag(p.x, p.y, p.x + 8, p.y)
      await f.setup.waitForVisualIdle()
      expect(f.setup.renderer.getSelection()?.getSelectedText()).toBeTruthy()
      expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
    }
  },
)

test.each(["fixture_generic"])("%s detail clicks retain the generic expansion contract", async (tool) => {
  await using f = await fixture(tool)
  await f.ready()
  await f.click(tool)
  for (const target of ['"query"', '"operation"']) {
    await f.click(target)
    expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
  }
})

test.each(["environment_tools", "direct_exec"])("running %s retains heading and input details", async (tool) => {
  await using f = await fixture(tool, 120, "running")
  await f.ready()
  await f.click(tool)
  expect(f.setup.captureCharFrame()).toContain(f.detail)
  await f.click(f.detail)
  expect(f.setup.captureCharFrame()).not.toContain(f.detail)
  expect(f.setup.captureCharFrame()).toContain(tool)
})

test.each(["environment_tools", "direct_exec"])("%s errors remain visible while details toggle", async (tool) => {
  await using f = await fixture(tool, 120, "error")
  await f.ready()
  expect(f.setup.captureCharFrame()).toContain("Synthetic lookup failed")
  await f.click(tool)
  expect(f.setup.captureCharFrame()).toContain(f.detail)
  await f.click(f.detail)
  expect(f.setup.captureCharFrame()).not.toContain(f.detail)
  expect(f.setup.captureCharFrame()).toContain("Synthetic lookup failed")
})
