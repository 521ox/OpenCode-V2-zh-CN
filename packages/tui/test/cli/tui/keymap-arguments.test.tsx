/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { ConfigProvider } from "../../../src/config"
import { I18nProvider } from "../../../src/context/i18n"
import { Keymap } from "../../../src/context/keymap"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

test("dispatch passes slash input through the registered command", async () => {
  const received: Array<string | undefined> = []
  let dispatch: ReturnType<typeof Keymap.use>["dispatch"]

  function Commands() {
    const keymap = Keymap.use()
    dispatch = keymap.dispatch
    Keymap.createLayer(() => ({
      mode: "global",
      commands: [
        {
          id: "project.cd",
          slash: { name: "cd", arguments: true },
          run: (input) => {
            received.push(input)
          },
        },
      ],
    }))
    return <box />
  }

  const app = await testRender(() => (
    <ConfigProvider config={createTuiResolvedConfig({ locale: "en" })}>
      <I18nProvider>
        <Keymap.Provider>
          <Commands />
        </Keymap.Provider>
      </I18nProvider>
    </ConfigProvider>
  ))
  try {
    dispatch!("project.cd")
    dispatch!("project.cd", "")
    dispatch!("project.cd", "src/components with spaces")
    expect(received).toEqual([undefined, "", "src/components with spaces"])
  } finally {
    app.renderer.destroy()
  }
})
