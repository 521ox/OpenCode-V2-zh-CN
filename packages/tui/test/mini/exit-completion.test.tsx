/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { Keymap } from "../../src/context/keymap"
import { createPromptState, type PromptState } from "../../src/mini/footer.prompt"
import { RUN_THEME_FALLBACK } from "../../src/mini/theme"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

test.each(["en", "zh"] as const)("Mini exit completion and submissions (%s)", async (locale) => {
  const config = createTuiResolvedConfig({ locale })
  let prompt!: PromptState
  let exits = 0
  const submitted: string[] = []
  function Composer() {
    prompt = createPromptState({
      locale: () => locale,
      directory: () => process.cwd(),
      findFiles: async () => [],
      agents: () => [],
      references: () => [],
      commands: () => ["exit", "quit", "q"].map((name) => ({ name, description: "external duplicate" })),
      state: () => ({
        phase: "idle",
        status: "",
        notice: "",
        model: "",
        usage: undefined,
        first: false,
        interrupt: 0,
        exit: 0,
      }),
      view: () => "prompt",
      prompt: () => true,
      width: () => 80,
      statusRows: () => 1,
      theme: () => RUN_THEME_FALLBACK.footer,
      mono: () => false,
      queuedPrompts: () => [],
      onQueuedPromptSteer: async () => false,
      onSubmit: (value) => {
        submitted.push(value.text)
        return true
      },
      onCycle: () => {},
      onInterrupt: () => false,
      onEditorOpen: async () => undefined,
      onInputClear: () => {},
      onExit: () => {
        exits += 1
      },
      onSettings: () => {},
      onRows: () => {},
      onStatus: () => {},
    })
    return <textarea ref={prompt.bind} onContentChange={prompt.onContentChange} onSubmit={prompt.onSubmit} />
  }
  const app = await testRender(
    () => (
      <Keymap.Provider config={config}>
        <Composer />
      </Keymap.Provider>
    ),
    {
      width: 80,
      height: 12,
      kittyKeyboard: true,
    },
  )
  try {
    await app.renderOnce()
    await app.mockInput.typeText("/")
    await app.renderOnce()
    const options = prompt.options().filter((item) => ["/exit", "/quit", "/q"].includes(item.display))
    expect(options.map((item) => item.display).sort()).toEqual(["/exit", "/q", "/quit"])
    expect(options.map((item) => item.description)).toEqual(
      Array(3).fill(locale === "en" ? "close OpenCode" : "关闭 OpenCode"),
    )
    for (const text of ["/exit", "/quit", "/q", ":q"]) {
      prompt.replacePrompt({ text: "", parts: [] })
      prompt.submitText(text)
    }
    expect(exits).toBe(4)
    expect(submitted).toEqual([])
    for (const text of ["/exit", "/quit", "/q"]) {
      prompt.replacePrompt({ text: "", parts: [] })
      await app.mockInput.typeText(text)
      await app.renderOnce()
      expect(prompt.options()[0]?.display).toBe(text)
      app.mockInput.pressEnter()
      await app.renderOnce()
    }
    expect(exits).toBe(7)
    expect(submitted).toEqual([])
  } finally {
    app.renderer.destroy()
  }
})
