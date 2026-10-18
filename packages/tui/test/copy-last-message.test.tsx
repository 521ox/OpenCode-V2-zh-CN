import type { SessionMessageInfo } from "@opencode/client"
import { InputRenderable, TextareaRenderable } from "@opentui/core"
import { expect, spyOn, test } from "bun:test"
import { createAppFixture } from "./fixture/app"
import { waitForHighlightedFrame } from "./fixture/frame"
import { directory, json } from "./fixture/tui-client"

test.each(["assistant", "summary", "empty", "transcript"] as const)(
  "copy actions retain their separate message/transcript semantics (%s)",
  async (mode) => {
    const session = {
      id: "ses_copy_last",
      title: "Copy fixture",
      projectID: "project",
      location: { directory },
      agent: "build",
      model: { providerID: "provider", id: "model" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 0, updated: 0 },
    }
    const summary: SessionMessageInfo = {
      id: "summary",
      type: "compaction",
      status: "completed",
      reason: "manual",
      summary: "  Raw summary $t(other) {{literal}}  ",
      recent: "",
      time: { created: mode === "summary" ? 2 : 0 },
    }
    const assistant: SessionMessageInfo = {
      id: "assistant",
      type: "assistant",
      agent: session.agent,
      model: session.model,
      finish: "stop",
      time: { created: 1, completed: 2 },
      content:
        mode === "empty"
          ? []
          : [
              { type: "text", text: "  First" },
              { type: "text", text: "last  " },
            ],
    }
    const messages = mode === "summary" ? [assistant, summary] : [summary, assistant]
    const copies: string[] = []
    let exports = 0
    const clipboard = await import("../src/clipboard")
    const copy = spyOn(clipboard, "createTuiClipboard").mockReturnValue({
      read: async () => undefined,
      write: async (text) => {
        copies.push(text)
      },
      dispose: async () => {},
    })
    try {
      await using setup = await createAppFixture({
        width: 120,
        height: 36,
        args: { sessionID: session.id },
        config: { locale: "en", animations: false, tabs: { mode: "off" }, session: { sidebar: "hide" } },
        fetch: (url) => {
          if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
          if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
          if (url.pathname === `/api/session/${session.id}/message`)
            return json({ data: messages.toReversed(), cursor: {} })
          if (
            url.pathname === `/api/session/${session.id}/inbox` ||
            url.pathname === `/api/session/${session.id}/permission`
          )
            return json({ data: [] })
          if (url.pathname === `/api/experimental/session/${session.id}/export`) {
            exports++
            return json({
              data: {
                info: session,
                messages: [{ id: "user", type: "user", text: "Transcript user", time: { created: 0 } }, assistant],
              },
            })
          }
          return undefined
        },
      })
      await setup.ready
      await waitForHighlightedFrame(setup, (frame) => frame.includes("Raw summary"))
      await setup.waitFor(() => setup.renderer.currentFocusedEditor instanceof TextareaRenderable)
      if (mode === "transcript") {
        setup.mockInput.pressKey("p", { ctrl: true })
        await setup.waitFor(() => setup.renderer.currentFocusedEditor instanceof InputRenderable)
        await setup.mockInput.typeText("Copy session transcript")
        await setup.waitForFrame((frame) => frame.includes("Copy session transcript"))
      } else {
        await setup.mockInput.typeText("/copy")
        await setup.waitForFrame((frame) => frame.includes("Copy last assistant message"))
      }
      setup.mockInput.pressEnter()
      await setup.waitForFrame((frame) =>
        frame.includes(
          mode === "empty"
            ? "No text content found"
            : mode === "transcript"
              ? "Session transcript copied"
              : "Message copied to clipboard!",
        ),
      )
      if (mode === "empty") {
        expect(copies).toEqual([])
        expect(exports).toBe(0)
        return
      }
      expect(copies).toHaveLength(1)
      if (mode === "transcript") {
        expect(exports).toBe(1)
        expect(copies[0]).toContain("# Copy fixture")
        expect(copies[0]).toContain("Transcript user")
        expect(copies[0]).toContain("First")
        expect(copies[0]).toContain("last")
        return
      }
      expect(exports).toBe(0)
      expect(copies[0]).toBe(mode === "assistant" ? "First\nlast" : "Raw summary $t(other) {{literal}}")
    } finally {
      copy.mockRestore()
    }
  },
)
