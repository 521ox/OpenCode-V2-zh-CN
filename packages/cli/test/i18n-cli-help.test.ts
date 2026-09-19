import { expect, test } from "bun:test"
import { Context, Option } from "effect"
import { CliError, CliOutput, type HelpDoc } from "effect/unstable/cli"
import { cliFormatter } from "../src/framework/i18n"

const doc: HelpDoc.HelpDoc = {
  description: "Run OpenCode with a message",
  usage: "opencode run [--format default|json] RAW_{{name}}",
  annotations: Context.empty(),
  flags: [
    {
      name: "model",
      aliases: ["m"],
      type: "string",
      description: Option.some("Model to use in the format provider/model#variant"),
      required: false,
    },
  ],
  args: [
    { name: "message", type: "string", description: Option.some("Message to send"), required: false, variadic: true },
  ],
}

test("help translates only owned descriptions and reads locale at render time", () => {
  let locale: "zh" | "en" = "zh"
  const base = CliOutput.defaultFormatter({ colors: false })
  const formatter = cliFormatter(() => locale, base)
  const chinese = formatter.formatHelpDoc(doc)
  expect(chinese).toContain("向 OpenCode 发送消息并运行")
  expect(chinese).toContain("使用 provider/model#variant 格式指定模型")
  expect(chinese).toContain(doc.usage)
  expect(chinese).toContain("--model")
  locale = "en"
  expect(formatter.formatHelpDoc(doc)).toBe(base.formatHelpDoc(doc))
})

test("unknown help text is not passed through a sentence replacement engine", () => {
  const raw = "RAW {{name}} $& --flag C:\\file Run OpenCode with a message"
  const formatter = cliFormatter(() => "zh", CliOutput.defaultFormatter({ colors: false }))
  expect(formatter.formatHelpDoc({ ...doc, description: raw })).toContain(raw)
})

test("parser error prefix leaves the native error and argument values intact", () => {
  const base = CliOutput.defaultFormatter({ colors: false })
  const error = new CliError.UnrecognizedOption({
    option: "--RAW_{{name}}_$&",
    suggestions: [],
    command: ["opencode", "run"],
  })
  expect(cliFormatter(() => "zh", base).formatError(error)).toBe("错误：" + base.formatError(error))
  expect(cliFormatter(() => "en", base).formatError(error)).toBe(base.formatError(error))
})
