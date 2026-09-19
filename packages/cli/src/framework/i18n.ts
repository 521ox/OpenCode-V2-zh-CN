import { Array, Option } from "effect"
import { CliOutput } from "effect/unstable/cli"
import { translate, type Key, type Locale } from "@opencode/tui/i18n"

// Only owned help-description fields are translated, never rendered output or
// arbitrary argument/error strings. Effect remains the parser and formatter.
const descriptions = [
  "miniCli.help.root",
  "miniCli.help.mini",
  "miniCli.help.run",
  "miniCli.help.standalone",
  "miniCli.help.server",
  "miniCli.help.auto",
  "miniCli.help.directory",
  "miniCli.help.continue",
  "miniCli.help.session",
  "miniCli.help.prompt",
  "miniCli.help.miniFork",
  "miniCli.help.fork",
  "miniCli.help.replay",
  "miniCli.help.replayLimit",
  "miniCli.help.miniModel",
  "miniCli.help.model",
  "miniCli.help.agent",
  "miniCli.help.message",
  "miniCli.help.format",
  "miniCli.help.file",
  "miniCli.help.title",
  "miniCli.help.thinking",
  "miniCli.help.logs",
] as const satisfies readonly Key[]

export function cliFormatter(locale: () => Locale, base = CliOutput.defaultFormatter()): CliOutput.Formatter {
  const keys = new Map<string, Key>(descriptions.map((key) => [translate("en", key), key]))
  const description = (value: string) => {
    const key = keys.get(value)
    return key ? translate(locale(), key) : value
  }
  const prefix = (text: string) => (locale() === "en" ? text : translate(locale(), "miniCli.error") + text)
  return {
    ...base,
    formatHelpDoc: (doc) =>
      base.formatHelpDoc({
        ...doc,
        description: description(doc.description),
        flags: doc.flags.map((flag) => ({ ...flag, description: Option.map(flag.description, description) })),
        globalFlags: doc.globalFlags?.map((flag) => ({
          ...flag,
          description: Option.map(flag.description, description),
        })),
        args: doc.args?.map((arg) => ({ ...arg, description: Option.map(arg.description, description) })),
        subcommands: doc.subcommands?.map((group) => ({
          ...group,
          commands: Array.map(group.commands, (command) => ({
            ...command,
            description: description(command.description),
          })),
        })),
      }),
    formatError: (error) => prefix(base.formatError(error)),
    formatErrors: (errors) => prefix(base.formatErrors(errors)),
  }
}
