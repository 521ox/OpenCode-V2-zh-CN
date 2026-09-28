import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { addDefaultParsers, type TextRenderable } from "@opentui/core"
import parsers from "../../../src/parsers-config"
import type { SessionMessageAssistant, SessionMessageAssistantTool, SessionMessageInfo } from "@opencode/client"
import { ConfigProvider } from "../../../src/config"
import { ThemeProvider } from "../../../src/context/theme"
import { SessionGroupView } from "../../../src/routes/session/group-view"
import { createTimelineAnchors, groupID, type AnchorTarget } from "../../../src/routes/session/anchors"
import { context } from "../../../src/routes/session/render-context"
import { rowWeight } from "../../../src/routes/session/mount-budget"
import { summarizeActivity } from "../../../src/routes/session/activity-summary"
import type { SessionEntry, SessionGroup } from "../../../src/routes/session/grouping/session"
import { emptyThemeSource } from "../../fixture/fixture"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { I18nProvider } from "../../../src/context/i18n"

test("retains nested expansion state and registers exact headers and parts", async () => {
  addDefaultParsers(parsers.parsers)
  const anchors = createTimelineAnchors()
  const [expanded, setExpanded] = createStore<Record<string, boolean>>({})
  const config = createTuiResolvedConfig({ locale: "en", animations: false })
  const messages = new Map<string, SessionMessageAssistant>(
    ["a", "b"].map((id) => [
      id,
      {
        id,
        type: "assistant",
        agent: "build",
        model: { providerID: "fixture", id: "fixture" },
        time: { created: 0, completed: 2 },
        content: [
          {
            type: "tool",
            id: `read-${id}`,
            name: "read",
            time: { created: 0, completed: 2 },
            state: { status: "completed", input: { path: id }, content: [{ type: "text", text: id }], metadata: {} },
          },
          { type: "reasoning", text: "**Reset title**\n\nReset thought body", time: { created: 0, completed: 2 } },
        ],
      },
    ]),
  )
  const [row, setRow] = createStore<SessionGroup>({
    type: "group",
    kind: "exploration",
    size: 2,
    completed: true,
    pending: [],
    children: [
      {
        type: "group",
        kind: "exploration",
        size: 2,
        children: [
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "a", partID: "read-a" } } },
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "b", partID: "read-b" } } },
        ],
      },
    ],
  })
  let target: TextRenderable | undefined
  const app = await mount({
    row,
    anchors,
    config,
    expanded: (id) => expanded[id] ?? false,
    setExpanded: (id, value) => setExpanded(id, value),
    message: (id) => messages.get(id),
    entry: (entry) =>
      entry.type === "part" && entry.ref.messageID === "b" ? (
        <text ref={(node) => (target = node)}>Target B</text>
      ) : (
        <text>A wrapped entry with enough text to occupy more than one terminal line</text>
      ),
  })
  app.renderer.start()
  const outerID = groupID(row, 0)
  const inner = row.children[0]
  if (inner.type !== "group") throw new Error("Missing nested group")
  const innerID = groupID(inner, 1)
  if (!outerID || !innerID) throw new Error("Missing group IDs")
  const outer: AnchorTarget = { type: "group", groupID: outerID }
  const nested: AnchorTarget = { type: "group", groupID: innerID }
  const a: AnchorTarget = { type: "part", ref: { messageID: "a", partID: "read-a" } }
  const b: AnchorTarget = { type: "part", ref: { messageID: "b", partID: "read-b" } }
  try {
    await app.waitForFrame((frame) => frame.includes("Explored"))
    expect(app.captureCharFrame()).not.toContain("Target B")
    expect(anchors.get(b)).toBeUndefined()
    expect(anchors.get(nested)).toBeUndefined()
    await app.mockMouse.click(4, anchors.get(outer)?.node.y ?? -1)
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Target B")
    expect(expanded[outerID]).toBe(true)
    expect(anchors.get(outer)).toBeDefined()
    await app.mockMouse.click(4, anchors.get(nested)?.node.y ?? -1)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Target B")
    expect(expanded[innerID]).toBe(true)
    expect(anchors.get(b)?.node.y).toBe(target?.y)
    expect(anchors.get(b)?.node.y).toBeGreaterThan(anchors.get(a)?.node.y ?? Infinity)
    expect(anchors.get(nested)).toBeDefined()
    expect(app.captureCharFrame().match(/Image previews/g)?.length).toBe(1)
    setExpanded(outerID, false)
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Target B")
    expect(anchors.get(b)).toBeUndefined()
    expect(anchors.get(outer)).toBeDefined()
    expect(expanded[innerID]).toBe(true)
    setExpanded(outerID, true)
    await app.renderOnce()
    setRow(
      reconcile({
        type: "group",
        kind: "exploration",
        size: 2,
        completed: true,
        pending: [],
        children: [
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "a", partID: "read-a" } } },
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "b", partID: "read-b" } } },
        ],
      }),
    )
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Target B")
    expect(anchors.get(b)?.node.y).toBe(target?.y)
    setRow(
      reconcile({
        type: "group",
        kind: "reasoning",
        size: 2,
        completed: true,
        children: [
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "a", partID: "reasoning:0" } } },
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "b", partID: "reasoning:0" } } },
        ],
      }),
    )
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Thought")
    expect(app.captureCharFrame()).not.toContain("Reset thought body")
    const thinkingID = groupID(row, 0)
    if (!thinkingID) throw new Error("Missing thinking group ID")
    setExpanded(thinkingID, true)
    await app.waitForFrame((frame) => frame.includes("Reset thought body"))
    expect(app.captureCharFrame()).toContain("Reset thought body")
    setRow(
      reconcile({
        type: "group",
        kind: "execution",
        size: 2,
        completed: true,
        children: [
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "a", partID: "read-a" } } },
          { type: "entry", size: 1, entry: { type: "part", ref: { messageID: "b", partID: "read-b" } } },
        ],
      }),
    )
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Executions finished — 2 calls")
    expect(app.captureCharFrame()).not.toContain("Target B")
    expect(app.captureCharFrame()).not.toContain("Explored")
    expect(anchors.get(b)).toBeUndefined()
    const executionID = groupID(row, 0)
    if (!executionID) throw new Error("Missing execution group ID")
    expect(anchors.get({ type: "group", groupID: executionID })).toBeDefined()
    setExpanded(executionID, true)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Target B")
    expect(anchors.get(b)?.node.y).toBe(target?.y)
    setExpanded(executionID, false)
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Target B")
    expect(anchors.get(b)).toBeUndefined()
  } finally {
    app.renderer.destroy()
  }
  expect(anchors.list()).toEqual([])
})

test("a low activity group with nothing finished stays collapsed behind a status", async () => {
  const config = createTuiResolvedConfig({ locale: "en", animations: false })
  const shell = (id: string) => ({
    type: "tool" as const,
    id,
    name: "shell",
    time: { created: 0 },
    state: { status: "running" as const, input: {}, metadata: {} },
  })
  const message: SessionMessageAssistant = {
    id: "a",
    type: "assistant",
    agent: "build",
    model: { providerID: "fixture", id: "fixture" },
    time: { created: 0 },
    content: [shell("one"), shell("two")],
  }
  const app = await mount({
    row: {
      type: "group",
      kind: "activity",
      size: 2,
      completed: false,
      pending: [],
      children: ["one", "two"].map((partID) => ({
        type: "entry" as const,
        size: 1,
        entry: { type: "part" as const, ref: { messageID: "a", partID } },
      })),
    },
    anchors: createTimelineAnchors(),
    config,
    expanded: () => false,
    setExpanded: () => {},
    message: () => message,
    entry: (entry) => <text>{entry.type === "part" ? `Shell ${entry.ref.partID}` : ""}</text>,
  })
  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes("Running command…"))
    expect(app.captureCharFrame()).not.toContain("Shell one")
    expect(app.captureCharFrame()).not.toContain("Shell two")
  } finally {
    app.renderer.destroy()
  }
})

test.each(["en", "zh"] as const)(
  "%s low activity localizes summaries and preserves nonzero visibility and mount weights",
  async (locale) => {
    const anchors = createTimelineAnchors()
    const [expanded, setExpanded] = createStore<Record<string, boolean>>({})
    const message: SessionMessageAssistant = {
      id: "a",
      type: "assistant",
      agent: "build",
      model: { providerID: "fixture", id: "fixture" },
      time: { created: 0, completed: 2 },
      content: [0, 7].map<SessionMessageAssistantTool>((exitCode, index) => ({
        type: "tool",
        id: `exec-${index}`,
        name: "direct_exec",
        time: { created: 0, completed: 2 },
        state: { status: "completed", input: {}, content: [{ type: "text", text: "output" }], metadata: { exitCode } },
      })),
    }
    const row: SessionGroup = {
      type: "group",
      kind: "activity",
      size: 2,
      completed: true,
      pending: [],
      children: [
        {
          type: "group",
          kind: "execution",
          size: 2,
          children: ["exec-0", "exec-1"].map((partID) => ({
            type: "entry",
            size: 1,
            entry: { type: "part", ref: { messageID: "a", partID } },
          })),
        },
      ],
    }
    const app = await mount({
      row,
      anchors,
      config: createTuiResolvedConfig({ locale, animations: false }),
      expanded: (id) => expanded[id] ?? false,
      setExpanded: (id, value) => setExpanded(id, value),
      message: () => message,
      entry: (entry) => <text>{entry.type === "part" ? entry.ref.partID : ""}</text>,
    })
    const outerID = groupID(row, 0)!
    const inner = row.children[0]
    if (inner.type !== "group") throw new Error("Missing execution group")
    const innerID = groupID(inner, 1)!
    const weight = () =>
      rowWeight(row, {
        expanded: (id) => expanded[id] ?? false,
        grouped: () => true,
        pendingTools: [],
        activityVisible: (node, pending) => summarizeActivity(node, () => message, pending, row.completed).label !== "",
        tool: (ref) => {
          const part = message.content.find((part) => part.type === "tool" && part.id === ref.partID)
          return part?.type === "tool" ? part : undefined
        },
      })
    try {
      app.renderer.start()
      await app.waitForFrame((frame) => frame.includes("exec-1"))
      expect(app.captureCharFrame()).toContain(locale === "zh" ? "2 次工具调用" : "2 tools")
      expect(app.captureCharFrame()).not.toContain(locale === "zh" ? "2 tools" : "2 次工具调用")
      expect(app.captureCharFrame()).toContain("✗")
      expect(app.captureCharFrame()).not.toContain("exec-0")
      expect(anchors.get({ type: "part", ref: { messageID: "a", partID: "exec-1" } })).toBeDefined()
      expect(weight()).toBe(2)
      expect(anchors.list()).toHaveLength(weight())
      setExpanded(outerID, true)
      await app.waitForFrame((frame) => frame.includes(locale === "zh" ? "执行已结束" : "Executions finished"))
      expect(app.captureCharFrame()).not.toContain("exec-0")
      expect(weight()).toBe(3)
      expect(anchors.list()).toHaveLength(weight())
      setExpanded(innerID, true)
      await app.waitForFrame((frame) => frame.includes("exec-0"))
      expect(weight()).toBe(4)
      expect(anchors.list()).toHaveLength(weight())
      setExpanded(outerID, false)
      await app.renderOnce()
      expect(app.captureCharFrame()).not.toContain("exec-0")
      expect(app.captureCharFrame()).toContain("exec-1")
      expect(expanded[innerID]).toBe(true)
      expect(weight()).toBe(2)
      expect(anchors.list()).toHaveLength(weight())
      setExpanded(outerID, true)
      await app.waitForFrame((frame) => frame.includes("exec-0"))
    } finally {
      app.renderer.destroy()
    }
  },
)

test.each([false, true])("F1 Low pending read header accounting with execution=%s", async (withExecution) => {
  const anchors = createTimelineAnchors()
  const [expanded, setExpanded] = createStore<Record<string, boolean>>({})
  const message: SessionMessageAssistant = {
    id: "f1",
    type: "assistant",
    agent: "build",
    model: { providerID: "fixture", id: "fixture" },
    time: { created: 0, completed: 2 },
    content: [
      ...(withExecution
        ? [
            {
              type: "tool" as const,
              id: "exec",
              name: "direct_exec",
              time: { created: 0, completed: 1 },
              state: {
                status: "completed" as const,
                input: {},
                content: [{ type: "text" as const, text: "ok" }] as [{ type: "text"; text: string }],
              },
            },
          ]
        : []),
      {
        type: "tool",
        id: "read",
        name: "read",
        time: { created: 1 },
        state: { status: "running", input: {}, metadata: {} },
      },
    ],
  }
  const row: SessionGroup = {
    type: "group",
    kind: "activity",
    completed: true,
    size: withExecution ? 2 : 1,
    pending: [{ messageID: "f1", partID: "read" }],
    children: [
      ...(withExecution
        ? [
            {
              type: "group" as const,
              kind: "execution" as const,
              size: 1,
              children: [
                {
                  type: "entry" as const,
                  size: 1 as const,
                  entry: { type: "part" as const, ref: { messageID: "f1", partID: "exec" } },
                },
              ],
            },
          ]
        : []),
      {
        type: "group",
        kind: "exploration",
        size: 1,
        children: [{ type: "entry", size: 1, entry: { type: "part", ref: { messageID: "f1", partID: "read" } } }],
      },
    ],
  }
  const outer = groupID(row, 0)!
  setExpanded(outer, withExecution)
  const app = await mount({
    row,
    anchors,
    config: createTuiResolvedConfig({ locale: "en", animations: false }),
    expanded: (id) => expanded[id] ?? false,
    setExpanded: (id, value) => setExpanded(id, value),
    pendingTools: ["read"],
    message: () => message,
    entry: (entry) => <text>{entry.type === "part" ? `F1 ${entry.ref.partID}` : ""}</text>,
  })
  const weight = () =>
    rowWeight(row, {
      activityVisible: (node, pending) => summarizeActivity(node, () => message, pending, row.completed).label !== "",
      expanded: (id) => expanded[id] ?? false,
      grouped: () => true,
      pendingTools: ["read"],
      tool: (ref) => {
        const part = message.content.find((part) => part.type === "tool" && part.id === ref.partID)
        return part?.type === "tool" ? part : undefined
      },
    })
  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes("F1 read"))
    for (const open of [withExecution, !withExecution, withExecution]) {
      setExpanded(outer, open)
      await app.renderOnce()
      expect(app.captureCharFrame().match(/F1 read/g)).toHaveLength(1)
      expect(app.captureCharFrame()).not.toContain("Explored")
      expect(anchors.list()).toHaveLength(withExecution ? 3 : 1)
      expect(weight()).toBe(anchors.list().length)
      if (withExecution)
        expect(app.captureCharFrame().indexOf("F1 exec")).toBeLessThan(app.captureCharFrame().indexOf("F1 read"))
    }
  } finally {
    app.renderer.destroy()
  }
})

function mount(input: {
  row: SessionGroup
  anchors: ReturnType<typeof createTimelineAnchors>
  config: ReturnType<typeof createTuiResolvedConfig>
  expanded: (id: string) => boolean
  setExpanded: (id: string, value: boolean) => void
  message: (id: string) => SessionMessageInfo | undefined
  entry: (entry: SessionEntry) => JSX.Element
  pendingTools?: readonly string[]
  grouped?: boolean
}) {
  return testRender(
    () => (
      <TestTuiContexts>
        <ConfigProvider config={input.config}>
          <I18nProvider>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <context.Provider
                value={{
                  width: 40,
                  terminal: { width: 40, height: 24 },
                  sessionID: "fixture",
                  anchors: input.anchors,
                  groupExpanded: input.expanded,
                  setGroupExpanded: input.setExpanded,
                  thinkingMode: () => "hide",
                  markdownMode: () => "rendered",
                  groupExploration: () => input.grouped ?? true,
                  legacyTurns: () => false,
                  diffWrapMode: () => "word",
                  models: () => [],
                  messageIndex: () => undefined,
                  config: input.config,
                  mutatePending: async () => true,
                  pendingDelivery: () => undefined,
                }}
              >
                <box paddingTop={2}>
                  <SessionGroupView
                    pendingTools={input.pendingTools ?? []}
                    row={input.row}
                    message={input.message}
                    images={() => <text>Image previews</text>}
                    entry={input.entry}
                  />
                </box>
              </context.Provider>
            </ThemeProvider>
          </I18nProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 40, height: 24 },
  )
}
