import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { Config } from "../../config"
import { resolveLocale } from "@opencode/tui/i18n"

export default Runtime.handler(Commands.commands.run, (input) =>
  Effect.gen(function* () {
    const { runNonInteractive } = yield* Effect.promise(() => import("../../run/run"))
    const separator = process.argv.indexOf("--", 2)
    const config = yield* Config.Service
    const server = yield* ServerConnection.resolve({
      server: Option.getOrUndefined(input.server),
      standalone: input.standalone,
    })
    const locale = resolveLocale((yield* config.get()).locale)
    yield* Effect.promise(() =>
      runNonInteractive({
        locale,
        server,
        message: [...input.message, ...(separator === -1 ? [] : process.argv.slice(separator + 1))],
        continue: input.continue,
        session: Option.getOrUndefined(input.session),
        fork: input.fork,
        model: Option.getOrUndefined(input.model),
        agent: Option.getOrUndefined(input.agent),
        format: input.format,
        file: [...input.file],
        title: Option.getOrUndefined(input.title),
        thinking: input.thinking,
        auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
      }),
    )
  }),
)
