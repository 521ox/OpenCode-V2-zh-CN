import { expect, test } from "bun:test"
import {
  append,
  executionFailed,
  groupRefs,
  hasPart,
  partitionPending,
  partPath,
  projectEntries,
  type ProjectionEntry,
  type SessionRow,
} from "../../../src/routes/session/grouping/session"

test.each([
  [0, false],
  [7, true],
  [-1, true],
  ["7", false],
  [undefined, false],
  [Number.NaN, false],
  [Number.POSITIVE_INFINITY, false],
] as const)("execution exit metadata %s has failure classification %s", (exitCode, failed) => {
  expect(
    executionFailed({
      type: "tool",
      id: "execution",
      name: "direct_exec",
      time: { created: 0, completed: 1 },
      state: {
        status: "completed",
        input: {},
        content: [{ type: "text", text: "output" }],
        metadata: exitCode === undefined ? {} : { exitCode },
      },
    }),
  ).toBe(failed)
})

test("a pending tool does not hide a later tool reusing its call ID in another message", () => {
  const rows: SessionRow[] = []
  const blocked = { messageID: "assistant-a", partID: "call-reused" }
  const later = { messageID: "assistant-b", partID: "call-reused" }
  append(rows, blocked, { type: "tool", name: "read" })
  partitionPending(rows, new Set([blocked.partID]))
  append(rows, later, { type: "tool", name: "read" })

  const group = rows[0]
  if (group.type !== "group" || group.kind !== "exploration") throw new Error("Expected exploration group")
  expect(groupRefs(group)).toEqual([later])
  expect(group.pending).toEqual([blocked])
  expect(groupRefs(group, true)).toEqual([later, blocked])

  partitionPending(rows, new Set())
  expect(groupRefs(group)).toEqual([later, blocked])
  expect(group.pending).toEqual([])
})

test("execution history and incremental groups retain cross-message identity and permission order", () => {
  const refs = Array.from({ length: 6 }, (_, index) => ({ messageID: `assistant-${index}`, partID: "reused" }))
  const entries: ProjectionEntry[] = refs.map((ref) => ({
    entry: { type: "part", ref },
    part: { type: "tool", name: "direct_exec" },
    path: ["execution"],
  }))
  const rows: SessionRow[] = []
  refs.forEach((ref) => {
    append(rows, ref, { type: "tool", name: "direct_exec" })
    partitionPending(rows, new Set([ref.partID]))
  })
  expect(rows).toEqual(projectEntries(entries))
  expect(rows).toHaveLength(1)
  const group = rows[0]
  if (group.type !== "group") throw new Error("Expected execution group")
  expect(group.kind).toBe("execution")
  expect(groupRefs(group)).toEqual(refs)
  refs.forEach((ref) => expect(hasPart(rows, ref)).toBe(true))
  expect(hasPart(rows, { messageID: "absent", partID: "reused" })).toBe(false)
  partitionPending(rows, new Set())
  expect(groupRefs(group)).toEqual(refs)
})

test.each(["text", "reasoning", "read", "shell", "environment_tools", "functions.direct_exec", "DIRECT_EXEC"])(
  "%s separates execution collections without broad tool aliases",
  (name) => {
    const rows: SessionRow[] = []
    const middle =
      name === "text" || name === "reasoning" ? ({ type: name } as const) : ({ type: "tool", name } as const)
    const entries: ProjectionEntry[] = [
      {
        entry: { type: "part", ref: { messageID: "a", partID: "first" } },
        part: { type: "tool", name: "direct_exec" },
        path: ["execution"],
      },
      {
        entry: { type: "part", ref: { messageID: "a", partID: "middle" } },
        part: middle,
        path: partPath(middle, "medium"),
      },
      {
        entry: { type: "part", ref: { messageID: "b", partID: "last" } },
        part: { type: "tool", name: "direct_exec" },
        path: ["execution"],
      },
    ]
    entries.forEach((item) => {
      if (item.entry.type === "part" && item.part) append(rows, item.entry.ref, item.part)
    })
    expect(rows).toEqual(projectEntries(entries))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ kind: "execution", size: 1 })
    expect(rows[2]).toMatchObject({ kind: "execution", size: 1 })
  },
)

test("visible footers split execution groups while pending rows retain boundary semantics", () => {
  const call: ProjectionEntry = {
    entry: { type: "part", ref: { messageID: "a", partID: "call" } },
    part: { type: "tool", name: "direct_exec" },
    path: ["execution"],
  }
  const footer: ProjectionEntry = { entry: { type: "assistant-footer", messageID: "a" } }
  expect(projectEntries([call, footer, call]).map((row) => row.type)).toEqual(["group", "assistant-footer", "group"])
  expect(
    projectEntries([call, { entry: { type: "message", messageID: "queued" }, closesPrevious: false }])[0],
  ).toMatchObject({ completed: false })
})

test.each(["low", "medium", "high"] as const)(
  "%s retains a separate execution path and approval order",
  (verbosity) => {
    const rows: SessionRow[] = []
    const refs = ["first", "approval", "last"].map((partID) => ({ messageID: "assistant", partID }))
    const part = { type: "tool", name: "direct_exec" } as const
    const path = verbosity === "low" ? (["activity", "execution"] as const) : (["execution"] as const)
    expect(partPath(part, verbosity)).toEqual(path)
    refs.forEach((ref) => {
      append(rows, ref, part, rows.length, verbosity)
      partitionPending(rows, new Set(["approval"]))
    })
    expect(rows).toEqual(
      projectEntries(refs.map((ref) => ({ entry: { type: "part", ref }, part, path: partPath(part, verbosity) }))),
    )
    const group = rows[0]
    if (group.type !== "group") throw new Error("Expected execution collection")
    expect(groupRefs(group)).toEqual(refs)
    expect(groupRefs(group, true)).toEqual(refs)
    if (group.kind === "activity") {
      expect(group.pending).toEqual([])
      expect(group.children[0]).toMatchObject({ type: "group", kind: "execution", size: 3 })
    }
  },
)

test("low execution boundaries survive the outer activity wrapper", () => {
  const rows: SessionRow[] = []
  const parts = [
    { type: "tool", name: "direct_exec" },
    { type: "reasoning" },
    { type: "tool", name: "direct_exec" },
    { type: "tool", name: "read" },
    { type: "tool", name: "direct_exec" },
    { type: "tool", name: "environment_tools" },
    { type: "tool", name: "direct_exec" },
  ] as const
  parts.forEach((part, index) => append(rows, { messageID: "a", partID: String(index) }, part, rows.length, "low"))
  const group = rows[0]
  if (group.type !== "group" || group.kind !== "activity") throw new Error("Expected activity group")
  expect(group.children.map((child) => (child.type === "group" ? child.kind : "entry"))).toEqual([
    "execution",
    "reasoning",
    "execution",
    "exploration",
    "execution",
    "entry",
    "execution",
  ])
  expect(
    group.children.filter((child) => child.type === "group" && child.kind === "execution").map((child) => child.size),
  ).toEqual([1, 1, 1, 1])
})
