import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect, FileSystem } from "effect"
import { Global } from "@opencode/util/global"
import { createEventStream, createFetch, directory, json } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"
import { toolDisplay } from "../src/routes/session"
import type { OpenCodeEvent, PermissionRequest, SessionMessageAssistantTool } from "@opencode/client"

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

async function fixture(
  tool = "environment_tools",
  width = 120,
  status = "completed",
  options: {
    count?: number
    locale?: "en" | "zh"
    grouping?: "auto" | "none"
    states?: SessionMessageAssistantTool["state"][]
    followingText?: boolean
    permissions?: PermissionRequest[]
    realtime?: boolean
  } = {},
) {
  const toolInput = tool === "direct_exec" ? { id: "synthetic-bun", args: ["--version"], cwd: "C:/synthetic" } : input
  const detail = tool === "direct_exec" ? '"--version"' : '"query"'
  const state = await tmpdir()
  const setup = await createTestRenderer({
    width,
    height: options.count ? 90 : 65,
    useThread: false,
    kittyKeyboard: true,
  })
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
        ...Array.from({ length: options.states?.length ?? options.count ?? 1 }, (_, index) => ({
          type: "tool",
          id: `tool-${index}`,
          name: tool,
          state: options.states?.[index] ?? {
            status,
            input: options.count ? { ...toolInput, id: `synthetic-${index}` } : toolInput,
            content: [{ type: "text", text: output }],
            metadata: { title: "Synthetic lookup" },
            ...(status === "error" ? { error: { message: "Synthetic lookup failed", type: "ProcessError" } } : {}),
          },
          time: { created: 1, completed: 2 },
        })),
        ...(options.followingText
          ? [{ type: "text", text: "Following text boundary", time: { created: 3, completed: 4 } }]
          : []),
      ],
      time: { created: 1, completed: 2 },
    },
  ]
  const events = createEventStream()
  const calls = createFetch((url) => {
    if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
    if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
    if (url.pathname === `/api/session/${session.id}/message`)
      return json({ data: (options.realtime ? messages.slice(0, 1) : messages).toReversed(), cursor: {} })
    if (url.pathname.endsWith("/permission")) return json({ data: options.permissions ?? [] })
    if (url.pathname.endsWith("/inbox")) return json({ data: [] })
    return undefined
  }, events)
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, fetch: (request) => calls.fetch(request) })
  const { run } = await import("../src/app")
  const task = Effect.runPromise(
    run({
      app: { name: "test", version: "test", channel: "test" },
      server: { endpoint: { url: server.url.toString() } },
      config: {
        get: async () => ({
          locale: options.locale ?? "en",
          animations: false,
          tabs: { enabled: false },
          session: { grouping: options.grouping ?? "auto" },
        }),
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
    events,
    async ready() {
      await setup.waitForFrame((frame) =>
        options.realtime
          ? frame.includes("Inspect synthetic tool details")
          : frame.includes(tool) || frame.includes("calls") || frame.includes("次调用"),
      )
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

test.each([
  [2, "en", 40],
  [2, "en", 120],
  [2, "zh", 40],
  [2, "zh", 120],
  [6, "en", 40],
  [6, "en", 120],
  [6, "zh", 40],
  [6, "zh", 120],
] as const)("%s executions collapse and expand in %s at %s columns", async (count, locale, width) => {
  await using f = await fixture("direct_exec", width, "completed", { count, locale })
  await f.ready()
  const header = locale === "zh" ? "执行已结束" : "Executions finished"
  const collapsed = f.setup.captureCharFrame()
  expect(collapsed).toContain(locale === "zh" ? `${count} 次调用` : `${count} calls`)
  expect(collapsed).not.toContain("direct_exec")
  expect(collapsed).not.toContain("Explored")
  console.info(`FRAME execution-${count}-${locale}-${width}-collapsed\n${collapsed}`)
  await f.click(header)
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(count)
  await f.click("direct_exec")
  const expanded = f.setup.captureCharFrame()
  expect(expanded).toContain('"--version"')
  expect(expanded).toContain("C:/synthetic")
  expect(expanded).toContain("中文测试")
  expect(expanded).toContain("OUTPUT_END")
  expect(expanded).toContain(header)
  console.info(`FRAME execution-${count}-${locale}-${width}-expanded\n${expanded}`)
  await f.click('"--version"')
  expect(f.setup.captureCharFrame()).not.toContain("OUTPUT_END")
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(count)
  await f.click("direct_exec")
  expect(f.setup.captureCharFrame()).toBe(expanded)
  await f.click('"operation"')
  expect(f.setup.captureCharFrame()).not.toContain("OUTPUT_END")
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(count)
  await f.click(header)
  expect(f.setup.captureCharFrame()).toBe(collapsed)
  // Move the second header click away from the first: a double click selects
  // text, which intentionally prevents the production disclosure from toggling.
  await f.click(header, 8)
  await f.click("direct_exec")
  expect(f.setup.captureCharFrame()).toBe(expanded)
})

test("execution header and child selection preserve expansion", async () => {
  await using f = await fixture("direct_exec", 120, "completed", { count: 2 })
  await f.ready()
  await f.click("Executions finished")
  await f.click("direct_exec")
  for (const target of ["Executions finished", '"--version"', '"operation"']) {
    const p = f.point(target)
    await f.setup.mockMouse.drag(p.x, p.y, p.x + 8, p.y)
    await f.setup.waitForVisualIdle()
    expect(f.setup.renderer.getSelection()?.getSelectedText()).toBeTruthy()
    expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
    expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(2)
    f.setup.renderer.clearSelection()
  }
})

test("grouping none keeps every execution as a native block", async () => {
  await using f = await fixture("direct_exec", 120, "completed", { count: 6, grouping: "none" })
  await f.ready()
  expect(f.setup.captureCharFrame()).not.toContain("Executions finished")
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(6)
  await f.click("direct_exec")
  expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
})

test("collapsed execution groups retain active, failed, nonzero and permission calls in order", async () => {
  const states: SessionMessageAssistantTool["state"][] = [
    {
      status: "completed",
      input: { id: "hidden-ok" },
      content: [{ type: "text", text: "ok" }],
      metadata: { exitCode: 0 },
    },
    { status: "running", input: { id: "visible-running" }, metadata: {} },
    { status: "streaming", input: '{"id":"streaming"' },
    {
      status: "error",
      input: { id: "visible-error" },
      error: { type: "ProcessError", message: "Execution fixture error" },
    },
    {
      status: "completed",
      input: { id: "visible-exit" },
      content: [{ type: "text", text: "EXIT_OUTPUT_END" }],
      metadata: { exitCode: 7 },
    },
    { status: "completed", input: { id: "visible-permission" }, content: [{ type: "text", text: "ok" }], metadata: {} },
    {
      status: "completed",
      input: { id: "hidden-unknown" },
      content: [{ type: "text", text: "ok" }],
      metadata: { exitCode: "unknown" },
    },
    { status: "completed", input: { id: "hidden-missing" }, content: [{ type: "text", text: "ok" }] },
  ]
  await using f = await fixture("direct_exec", 120, "completed", {
    states,
    followingText: true,
    permissions: [
      {
        id: "permission-fixture",
        sessionID: "ses_environment_collapse",
        action: "direct_exec",
        resources: ["synthetic"],
        source: { type: "tool", messageID: "assistant-0", id: "tool-5" },
      },
    ],
  })
  await f.ready()
  // Tool rows can be visually idle while the following Markdown is still highlighting.
  const frame = await f.setup.waitForFrame(
    (frame) => frame.includes("visible-permission") && frame.includes("Following text boundary"),
  )
  expect(frame).toContain("Executing — 8 calls")
  expect(frame).not.toContain("Executions finished")
  expect(frame).toContain("Following text boundary")
  expect(frame).toContain("Execution fixture error")
  expect(frame).not.toContain("hidden-ok")
  expect(frame).not.toContain("hidden-unknown")
  expect(frame).not.toContain("hidden-missing")
  console.info(`FRAME execution-mixed-collapsed\n${frame}`)
  expect(frame.match(/direct_exec \[/g)).toHaveLength(4)
  const positions = ["visible-running", "Execution fixture error", "visible-exit", "visible-permission"].map((text) =>
    frame.indexOf(text),
  )
  expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  await f.click("visible-exit")
  expect(f.setup.captureCharFrame()).toContain("EXIT_OUTPUT_END")
  expect(f.setup.captureCharFrame()).not.toContain("hidden-ok")
  f.events.emit({
    id: "evt_permission_replied",
    created: 10,
    type: "permission.replied",
    data: { sessionID: "ses_environment_collapse", requestID: "permission-fixture", reply: "once" },
  })
  await f.setup.waitForFrame((frame) => !frame.includes("visible-permission"))
  expect(f.setup.captureCharFrame()).toContain("visible-exit")
  await f.click("Executing")
  const all = f.setup.captureCharFrame()
  expect(all).toContain("hidden-ok")
  expect(all).toContain("hidden-unknown")
  expect(all).toContain("hidden-missing")
  expect(all.match(/visible-permission/g)).toHaveLength(1)
})

test("finished execution labels remain neutral for nonzero exits and tool errors", async () => {
  await using f = await fixture("direct_exec", 120, "completed", {
    states: [
      {
        status: "completed",
        input: { id: "nonzero" },
        content: [{ type: "text", text: "exit 2" }],
        metadata: { exitCode: 2 },
      },
      {
        status: "error",
        input: { id: "failed" },
        error: { type: "ProcessError", message: "Synthetic execution failed" },
      },
    ],
  })
  await f.ready()
  const frame = f.setup.captureCharFrame()
  expect(frame).toContain("Executions finished — 2 calls")
  expect(frame).toContain("nonzero")
  expect(frame).toContain("Synthetic execution failed")
  expect(frame).not.toContain("success")
})

test("live cross-message execution collection matches history and follows real tool completion", async () => {
  const history = await (async () => {
    await using f = await fixture("direct_exec", 120, "completed", { count: 2 })
    await f.ready()
    return f.setup.captureCharFrame()
  })()
  await using f = await fixture("direct_exec", 120, "completed", { count: 2, realtime: true })
  await f.ready()
  const sessionID = "ses_environment_collapse"
  const sequence = { value: 0 }
  const emit = (event: OpenCodeEvent) => f.events.emit({ ...event, location: { directory } })
  for (const index of [0, 1]) {
    const assistantMessageID = `assistant-${index}`
    emit({
      id: `evt_step_${index}`,
      created: 1,
      type: "session.step.started",
      durable: { aggregateID: sessionID, seq: sequence.value++, version: 1 },
      data: { sessionID, assistantMessageID, agent: "build", model: { providerID: "test", id: "test" }, started: 1 },
    })
    emit({
      id: `evt_tool_${index}`,
      created: 1,
      type: "session.tool.input.started",
      durable: { aggregateID: sessionID, seq: sequence.value++, version: 1 },
      data: { sessionID, assistantMessageID, id: `tool-${index}`, name: "direct_exec" },
    })
    emit({
      id: `evt_input_${index}`,
      created: 1,
      type: "session.tool.input.ended",
      durable: { aggregateID: sessionID, seq: sequence.value++, version: 1 },
      data: {
        sessionID,
        assistantMessageID,
        id: `tool-${index}`,
        text: JSON.stringify({ id: `synthetic-${index}`, args: ["--version"], cwd: "C:/synthetic" }),
      },
    })
    emit({
      id: `evt_called_${index}`,
      created: 1,
      type: "session.tool.called",
      durable: { aggregateID: sessionID, seq: sequence.value++, version: 1 },
      data: {
        sessionID,
        assistantMessageID,
        id: `tool-${index}`,
        input: { id: `synthetic-${index}`, args: ["--version"], cwd: "C:/synthetic" },
        executed: true,
      },
    })
  }
  await f.setup.waitForFrame((frame) => frame.includes("Executing — 2 calls"))
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(2)
  for (const index of [0, 1]) {
    emit({
      id: `evt_success_${index}`,
      created: 2,
      type: "session.tool.success",
      durable: { aggregateID: sessionID, seq: sequence.value++, version: 2 },
      data: {
        sessionID,
        assistantMessageID: `assistant-${index}`,
        id: `tool-${index}`,
        content: [{ type: "text", text: output }],
        metadata: { exitCode: 0 },
        executed: true,
      },
    })
  }
  await f.setup.waitForFrame((frame) => frame.includes("Executions finished — 2 calls"))
  await f.setup.waitForVisualIdle()
  expect(f.setup.captureCharFrame()).toBe(history)
  await f.click("Executions finished")
  expect(f.setup.captureCharFrame().match(/direct_exec/g)).toHaveLength(2)
  await f.click("direct_exec")
  expect(f.setup.captureCharFrame()).toContain("OUTPUT_END")
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
