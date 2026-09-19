import { expect, test } from "bun:test"
import {
  append,
  groupRefs,
  hasPart,
  partitionPending,
  projectEntries,
  type ProjectionEntry,
  type SessionRow,
} from "../../../src/routes/session/grouping/session"

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
      },
      { entry: { type: "part", ref: { messageID: "a", partID: "middle" } }, part: middle },
      { entry: { type: "part", ref: { messageID: "b", partID: "last" } }, part: { type: "tool", name: "direct_exec" } },
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
  }
  const footer: ProjectionEntry = { entry: { type: "assistant-footer", messageID: "a" } }
  expect(projectEntries([call, footer, call]).map((row) => row.type)).toEqual(["group", "assistant-footer", "group"])
  expect(
    projectEntries([call, { entry: { type: "message", messageID: "queued" }, closesPrevious: false }])[0],
  ).toMatchObject({ completed: false })
})
