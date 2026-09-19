import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SessionRulesLocation } from "@opencode/core/session/rules-location"

const resolve = (id: string, rows: SessionRulesLocation.Row[]) =>
  Effect.runPromise(SessionRulesLocation.resolve(id, (key) => Effect.succeed(rows.find((row) => row.id === key))))

describe("Session rules location", () => {
  test.each([
    "/",
    "C:\\",
    "C:relative",
    "relative",
    "\\repo",
    "\\\\server",
    "\\\\server\\share",
    "/repo/..",
    "/repo\nunsafe",
  ])("rejects invalid start directory %s", (directory) =>
    expect(SessionRulesLocation.startDirectory(directory)).toBeNull(),
  )
  test.each([
    ["/repo", "/repo/.opencode/rules/ses_root"],
    ["C:\\repo", "C:\\repo\\.opencode\\rules\\ses_root"],
    ["\\\\server\\share\\repo", "\\\\server\\share\\repo\\.opencode\\rules\\ses_root"],
  ])("shares the root's persisted %s across nested descendants", async (directory, expected) => {
    const rows = [
      { id: "ses_root", parent_id: null, start_directory: directory },
      { id: "ses_child", parent_id: "ses_root", start_directory: "/different" },
      { id: "ses_nested", parent_id: "ses_child", start_directory: "/elsewhere" },
    ]
    expect(await resolve("ses_nested", rows)).toEqual({
      current_session_id: "ses_nested",
      root_session_id: "ses_root",
      rules_directory: expected,
      status: "available",
    })
  })
  test("fails closed for missing sessions, missing parents, cycles, unsafe IDs and fork facts", async () => {
    for (const rows of [
      [],
      [{ id: "ses_current", parent_id: "ses_missing", start_directory: "/child" }],
      [{ id: "ses_current", parent_id: "ses_current", start_directory: "/child" }],
      [{ id: "ses_current", parent_id: "../unsafe", start_directory: "/child" }],
      [{ id: "ses_current", parent_id: null, start_directory: null }],
    ]) {
      expect(await resolve("ses_current", rows)).toMatchObject({
        status: "unavailable",
        rules_directory: null,
        root_session_id: null,
      })
    }
    expect(await resolve("unsafe\nSYSTEM", [])).toMatchObject({ current_session_id: null, status: "unavailable" })
  })
  test("rejects mismatched lookup results without accepting a guessed root", async () => {
    const context = await Effect.runPromise(
      SessionRulesLocation.resolve("ses_current", () =>
        Effect.succeed({ id: "ses_other", parent_id: null, start_directory: "/repo" }),
      ),
    )
    expect(context.status).toBe("unavailable")
    expect(SessionRulesLocation.render(context)).toContain("Do not guess")
  })
  test("accepts legacy readable IDs but never an overlong directory name", async () => {
    expect((await resolve("sesLegacy", [{ id: "sesLegacy", parent_id: null, start_directory: "/repo" }])).status).toBe(
      "available",
    )
    expect((await resolve(`ses${"a".repeat(118)}`, [])).current_session_id).toBeNull()
  })
  test("bounds lineage lookup without falling back to a descendant", async () => {
    let calls = 0
    const context = await Effect.runPromise(
      SessionRulesLocation.resolve("ses_0", (id) => {
        calls++
        return Effect.succeed({ id, parent_id: `ses_${calls}`, start_directory: "/child" })
      }),
    )
    expect(calls).toBe(256)
    expect(context).toMatchObject({ status: "unavailable", reason: "parent_chain_limit", rules_directory: null })
  })
})
