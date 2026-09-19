import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect, FileSystem } from "effect"
import { Global } from "@opencode/util/global"
import { Agent } from "@opencode/schema/agent"
import { createEventStream, createFetch, directory, json, worktree } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"

test.each([
  ["en", 120],
  ["zh", 120],
  ["en", 48],
  ["zh", 48],
] as const)("synced mention kinds render in %s at %i columns", async (locale, width) => {
  await using state = await tmpdir()
  const setup = await createTestRenderer({ width, height: 40, useThread: false, kittyKeyboard: true })
  setup.renderer.start()
  const location = { directory, project: { id: "proj_test", directory: worktree, canonical: worktree } }
  const session = {
    id: `ses_sync_mentions_${locale}_${width}`,
    title: "Sync mentions",
    projectID: "proj_test",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 0, updated: 0 },
  }
  const calls = createFetch((url) => {
    if (url.pathname === "/api/fs/find") return json({ location, data: [] })
    if (url.pathname === "/api/agent")
      return json({
        location,
        data: [{ ...Agent.Info.default(Agent.ID.make("sync-agent")), mode: "subagent" }],
      })
    if (url.pathname === "/api/skill")
      return json({
        location,
        data: [
          {
            id: "sync-skill",
            name: "sync-skill",
            path: `${directory}/SKILL.md`,
            content: "Fixture skill",
            description: "Literal {{description}} with a deliberately long description to exercise row shrinking",
          },
        ],
      })
    if (url.pathname === "/api/reference")
      return json({
        location,
        data: [
          {
            name: "sync-reference",
            path: directory,
            source: { type: "local", path: `${directory}/long-reference-description` },
          },
        ],
      })
    if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
    if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
    if (url.pathname === `/api/session/${session.id}/message`)
      return json({
        data: [{ id: "user-sync", type: "user", text: "Mention fixture ready", time: { created: 0 } }],
        cursor: {},
      })
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
      args: { sessionID: session.id },
      terminalHandoff: async () => ({ renderer: setup.renderer, mode: "dark", complete: () => {} }),
      log: () => {},
    }).pipe(Effect.provide(Global.layerWith({ state: state.path })), Effect.provide(FileSystem.layerNoop({}))),
  )
  try {
    await setup.waitForFrame((frame) => frame.includes("Mention fixture ready"))
    await setup.mockInput.typeText("@sync")
    const frame = await setup.waitForFrame((frame) =>
      ["sync-agent", "sync-skill", "sync-reference"].every((name) => frame.includes(`@${name}`)),
    )
    const labels = locale === "zh" ? ["智能体", "技能", "引用"] : ["agent", "skill", "reference"]
    for (const [index, kind] of ["agent", "skill", "reference"].entries()) {
      const line = frame.split("\n").find((line) => line.includes(`@sync-${kind}`))
      expect(line).toMatch(new RegExp(`@sync-${kind}.*\\s${labels[index]}\\s*┃`))
    }
    setup.mockInput.pressEscape()
    await setup.waitForFrame((frame) => !frame.includes("@sync-reference"))
  } finally {
    setup.renderer.destroy()
    await task
    await server.stop()
  }
})
