import { expect, test } from "bun:test"
import { createAppFixture } from "../fixture/app"
import { json } from "../fixture/tui-client"

test.each([
  ["zh", 72, "1 个脚本", "脚本", "取消"],
  ["en", 100, "1 script", "Scripts", "cancel"],
] as const)(
  "opens the %s scripts tab from the live counter and cancels the selected job",
  async (locale, width, counter, tab, cancel) => {
    const id = "cm_fixture"
    const session = {
      id: "ses_script_fixture",
      location: { directory: "/project" },
      projectID: "project",
      title: "Script fixture",
      agent: "build",
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1, updated: 1 },
    }
    const job = {
      id,
      kind: "codemode",
      sessionID: session.id,
      status: "running",
      title: "Literal job title",
      time: { started: Date.now() },
    }
    const cancelled = Promise.withResolvers<string>()
    await using app = await createAppFixture({
      width,
      config: { locale, animations: false, tabs: { mode: "off" }, session: { sidebar: "hide" } },
      args: { sessionID: session.id },
      fetch: (url, request) => {
        if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
        if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
        if (url.pathname === `/api/session/${session.id}/message`) return json({ data: [], cursor: {} })
        if (
          url.pathname === `/api/session/${session.id}/inbox` ||
          url.pathname === `/api/session/${session.id}/permission`
        )
          return json({ data: [] })
        if (url.pathname === "/api/experimental/job") return json({ data: [job] })
        if (url.pathname.startsWith("/api/experimental/job/") && request.method === "POST") {
          cancelled.resolve(url.pathname)
          return new Response(null, { status: 204 })
        }
      },
    })
    await app.ready
    await app.waitForFrame((frame) => frame.includes(counter))
    const rows = app.captureCharFrame().split("\n")
    const row = rows.findIndex((line) => line.includes(counter))
    await app.mockMouse.click(rows[row].indexOf(counter), row)
    await app.waitForFrame((frame) => frame.includes(job.title))
    const open = app.captureCharFrame()
    expect(open).toContain(tab)
    expect(open).toMatch(new RegExp(`${cancel}\\s+ctrl\\+d`))
    app.mockInput.pressKey("d", { ctrl: true })
    expect(await cancelled.promise).toBe(`/api/experimental/job/${id}/cancel`)
  },
)
