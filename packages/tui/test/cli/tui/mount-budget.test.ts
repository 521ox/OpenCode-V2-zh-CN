import { expect, test } from "bun:test"
import type { SessionMessageAssistantTool } from "@opencode/client"
import { groupID } from "../../../src/routes/session/anchors"
import {
  collapsedActivityEntries,
  executionEntries,
  executionVisible,
  partitionPending,
  partPath,
  projectEntries,
  type GroupKind,
  type PartRef,
  type SessionEntry,
  type SessionRow,
  type Verbosity,
} from "../../../src/routes/session/grouping/session"
import { groupEntries } from "../../../src/routes/session/grouping/tree"
import { rowsAfter, rowsBefore, rowWeight } from "../../../src/routes/session/mount-budget"

const read = (index: number): SessionEntry => ({
  type: "part",
  ref: { messageID: `m${index}`, partID: `read-${index}` },
})

function group(size: number, path: readonly GroupKind[] = ["exploration"]): SessionRow {
  const [node] = groupEntries(
    Array.from({ length: size }, (_, index) => read(index)),
    () => path,
  )
  if (node.type !== "group") throw new Error("Expected group")
  return node.kind === "reasoning" || node.kind === "instructions" || node.kind === "execution"
    ? { ...node, kind: node.kind, completed: true }
    : { ...node, kind: node.kind, pending: [], completed: true }
}

const collapsed = {
  expanded: () => false,
  grouped: () => true,
  activityVisible: () => true,
  tool: (ref: PartRef): SessionMessageAssistantTool => ({
    type: "tool",
    id: ref.partID,
    name: "read",
    time: { created: 0, completed: 1 },
    state: { status: "completed", input: {}, content: [{ type: "text", text: "ok" }] },
  }),
  pendingTools: [],
}

test("collapsed groups without visible exceptions retain the one-row budget", () => {
  const rows: SessionRow[] = [
    { type: "message", messageID: "u" },
    group(200),
    group(3, ["reasoning"]),
    read(1),
    { type: "assistant-footer", messageID: "a" },
  ]
  const weights = rows.map((row) => rowWeight(row, collapsed))
  expect(weights).toEqual([1, 1, 1, 1, 1])
  for (const length of [0, 1, 39, 40, 41, 150]) {
    const ones = Array.from({ length }, () => 1)
    expect(rowsBefore(ones, length, 40)).toBe(Math.max(0, length - 40))
    for (const index of [0, Math.floor(length / 2), length]) {
      expect(rowsBefore(ones, index, 60)).toBe(Math.max(0, index - 60))
      expect(rowsAfter(ones, index, 60)).toBe(Math.min(length, index + 60))
    }
  }
})

test("an expanded group costs its header plus rendered children", () => {
  const row = group(200)
  if (row.type !== "group") throw new Error("Expected group")
  const id = groupID(row, 0)
  expect(rowWeight(row, { ...collapsed, expanded: (key) => key === id })).toBe(201)
})

test("a collapsed inner group costs one even when its parent is expanded", () => {
  const row = group(50, ["exploration", "exploration"])
  if (row.type !== "group" || row.children[0].type !== "group") throw new Error("Expected nested group")
  const outer = groupID(row, 0)
  const inner = groupID(row.children[0], 1)
  expect(rowWeight(row, { ...collapsed, expanded: (key) => key === outer })).toBe(2)
  expect(rowWeight(row, { ...collapsed, expanded: (key) => key === outer || key === inner })).toBe(52)
  // A saved expanded inner group under a collapsed parent mounts nothing.
  expect(rowWeight(row, { ...collapsed, expanded: (key) => key === inner })).toBe(1)
})

test("an ungrouped kind renders every leaf", () => {
  expect(rowWeight(group(12, ["reasoning"]), { ...collapsed, grouped: (kind) => kind !== "reasoning" })).toBe(12)
})

test("a heavy tail group leaves fewer older rows mounted", () => {
  const weights = [...Array.from({ length: 100 }, () => 1), 201, 1, 1]
  // The expanded group alone exceeds the tail budget.
  expect(rowsBefore(weights, weights.length, 40)).toBe(100)
  expect(rowsAfter(weights, 90, 60)).toBe(101)
})

test("F1 pending-only exploration has no header even with saved expansion", () => {
  const row = group(1)
  if (row.type !== "group" || row.kind !== "exploration") throw new Error("Expected exploration")
  row.pending = [{ messageID: "m0", partID: "read-0" }]
  expect(rowWeight(row, collapsed)).toBe(1)
  expect(rowWeight(row, { ...collapsed, expanded: () => true })).toBe(1)
})

function executions(verbosity: Verbosity) {
  const states: SessionMessageAssistantTool["state"][] = [
    { status: "completed", input: {}, content: [{ type: "text", text: "ok" }], metadata: { exitCode: 0 } },
    { status: "running", input: {}, metadata: {} },
    { status: "streaming", input: "{" },
    { status: "error", input: {}, error: { type: "Fixture", message: "failed" } },
    { status: "completed", input: {}, content: [{ type: "text", text: "exit 7" }], metadata: { exitCode: 7 } },
    { status: "completed", input: {}, content: [{ type: "text", text: "approval" }] },
    { status: "completed", input: {}, content: [{ type: "text", text: "unknown" }], metadata: { exitCode: "unknown" } },
  ]
  const parts = states.map<SessionMessageAssistantTool>((state, index) => ({
    type: "tool",
    id: `exec-${index}`,
    name: "direct_exec",
    time: { created: 0 },
    state,
  }))
  const rows = projectEntries(
    parts.map((part) => ({
      entry: { type: "part", ref: { messageID: "assistant", partID: part.id } },
      part,
      path: partPath(part, verbosity),
    })),
  )
  partitionPending(rows, new Set(["exec-5"]))
  const row = rows[0]
  if (row.type !== "group") throw new Error("Expected execution group")
  return {
    row,
    input: {
      ...collapsed,
      tool: (ref: PartRef) => parts.find((part) => part.id === ref.partID),
      pendingTools: ["exec-5"],
    },
  }
}

test.each(["low", "medium", "high"] as const)(
  "collapsed %s counts running, streaming, errors, exits and approvals in order",
  (verbosity) => {
    const { row, input } = executions(verbosity)
    const visible =
      row.kind === "activity"
        ? collapsedActivityEntries(row, { ...input, pending: row.pending })
        : executionEntries(row, input.tool)
            .filter(({ part }) => executionVisible(part, input.pendingTools))
            .map(({ entry }) => entry)
    expect(visible.map((entry) => (entry.type === "part" ? entry.ref.partID : ""))).toEqual([
      "exec-1",
      "exec-2",
      "exec-3",
      "exec-4",
      "exec-5",
    ])
    expect(rowWeight(row, input)).toBe(6)
    expect(rowWeight(row, { ...input, pendingTools: [] })).toBe(5)
    expect(rowWeight(row, { ...input, grouped: () => false })).toBe(7)
    expect(rowWeight(row, { ...input, expanded: () => true })).toBe(verbosity === "low" ? 9 : 8)
  },
)

test("Low counts nested headers and execution exceptions only when their ancestors render", () => {
  const { row, input } = executions("low")
  const outer = groupID(row, 0)
  const inner = row.children[0]
  if (inner.type !== "group") throw new Error("Expected nested execution")
  const id = groupID(inner, 1)
  expect(rowWeight(row, { ...input, expanded: (key) => key === outer })).toBe(7)
  expect(rowWeight(row, { ...input, expanded: (key) => key === id })).toBe(6)
  expect(rowWeight(row, { ...input, expanded: () => true })).toBe(9)
})

test.each(["low", "medium", "high"] as const)("%s singleton executions never gain a collection header", (verbosity) => {
  const part: SessionMessageAssistantTool = {
    type: "tool",
    id: "single",
    name: "direct_exec",
    time: { created: 0, completed: 1 },
    state: { status: "completed", input: {}, content: [{ type: "text", text: "ok" }] },
  }
  const [row] = projectEntries([
    {
      entry: { type: "part", ref: { messageID: "a", partID: part.id } },
      part,
      path: partPath(part, verbosity),
    },
  ])
  const input = { ...collapsed, tool: () => part }
  expect(rowWeight(row, input)).toBe(verbosity === "low" ? 2 : 1)
  expect(rowWeight(row, { ...input, expanded: () => true })).toBe(verbosity === "low" ? 2 : 1)
  expect(rowWeight(row, { ...input, grouped: () => false })).toBe(1)
})

test("partitioned permissions count once outside collapsed or expanded groups", () => {
  const row = group(3)
  if (row.type !== "group" || row.kind !== "exploration") throw new Error("Expected exploration")
  row.pending = [{ messageID: "m1", partID: "read-1" }]
  expect(rowWeight(row, collapsed)).toBe(2)
  expect(rowWeight(row, { ...collapsed, expanded: () => true })).toBe(4)
  expect(rowWeight(row, { ...collapsed, grouped: () => false })).toBe(3)
})

test("Low permissions and execution exceptions are not double counted on expansion", () => {
  const { row, input } = executions("low")
  if (row.kind !== "activity") throw new Error("Expected activity")
  row.children = [...row.children, { type: "entry", size: 1, entry: read(9) }]
  row.size++
  row.pending = [{ messageID: "m9", partID: "read-9" }]
  expect(rowWeight(row, input)).toBe(7)
  expect(rowWeight(row, { ...input, expanded: (key) => key === groupID(row, 0) })).toBe(8)
  expect(rowWeight(row, { ...input, expanded: () => true })).toBe(10)
  expect(rowWeight(row, { ...input, grouped: () => false })).toBe(8)
})

test("an ungrouped Low wrapper still respects independently grouped nested kinds", () => {
  const row = group(12, ["activity", "reasoning"])
  const input = { ...collapsed, grouped: (kind: GroupKind) => kind === "reasoning" }
  expect(rowWeight(row, input)).toBe(1)
  expect(rowWeight(row, { ...input, expanded: () => true })).toBe(13)
})
