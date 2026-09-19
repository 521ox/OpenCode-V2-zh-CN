export * as DirectExecTool from "./direct-exec.js"

import { ToolFailure } from "@opencode/ai"
import type { Context } from "@opencode/plugin/effect/plugin"
import { FSUtil } from "@opencode/util/fs-util"
import { AppProcess } from "@opencode/util/process"
import { Duration, Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { EnvironmentToolsCatalog } from "../../environment-tools/catalog.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 600_000
const MAX_ARGS = 128
const MAX_ARG_LENGTH = 4_096
const MAX_ARGS_LENGTH = 32_768
const MAX_OUTPUT_BYTES = 65_536

export const Input = Schema.Struct({
  id: Schema.String,
  args: Schema.optional(Schema.Array(Schema.String)),
  cwd: Schema.optional(Schema.String),
  timeoutMs: Schema.optional(Schema.Number),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const Output = Schema.Struct({
  status: Schema.Literal("exited"),
  id: Schema.String,
  name: Schema.String,
  path: Schema.String,
  cwd: Schema.String,
  exitCode: Schema.Number,
  stdout: Schema.String,
  stderr: Schema.String,
  stdoutTruncated: Schema.Boolean,
  stderrTruncated: Schema.Boolean,
  durationMs: Schema.Number,
})
const description = [
  "Execute an active native EXE or COM entry from the environment tools catalog without a host shell.",
  "Obtain the catalog id from environment_tools search.query and never guess an id or substitute a raw path; catalog membership is not execution permission.",
  "Pass each argument as a separate args item. Never place a shell command line, pipeline, redirect, environment assignment, or quoting wrapper into one argument.",
  "Use shell when the operation requires shell syntax, a script launcher, stdin, an interactive terminal, custom environment variables, or background execution.",
].join(" ")

const validateInput = (input: typeof Input.Type) => {
  const id = input.id.trim()
  const args = [...(input.args ?? [])]
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!id || id.length > 256) return new ToolFailure({ message: "Catalog entry id must be 1 to 256 characters" })
  if (args.length > MAX_ARGS)
    return new ToolFailure({ message: `Direct execution accepts at most ${MAX_ARGS} arguments` })
  if (args.some((arg) => arg.length > MAX_ARG_LENGTH || arg.includes("\0")))
    return new ToolFailure({ message: `Each argument must be at most ${MAX_ARG_LENGTH} characters and contain no NUL` })
  if (args.reduce((total, arg) => total + arg.length, 0) > MAX_ARGS_LENGTH)
    return new ToolFailure({ message: `Direct execution arguments are limited to ${MAX_ARGS_LENGTH} characters` })
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS)
    return new ToolFailure({ message: `timeoutMs must be an integer from 100 to ${MAX_TIMEOUT_MS}` })
  if (input.cwd !== undefined && (!input.cwd.trim() || input.cwd.length > 4_096 || input.cwd.includes("\0")))
    return new ToolFailure({ message: "cwd must be 1 to 4096 characters and contain no NUL" })
  return { id, args, timeoutMs }
}
const sameExecutable = (left: EnvironmentToolsCatalog.Entry, right: EnvironmentToolsCatalog.Entry) =>
  left.id === right.id &&
  left.path === right.path &&
  left.identity.size === right.identity.size &&
  left.identity.modifiedAt === right.identity.modifiedAt

export const Plugin = {
  id: "opencode.tool.direct-exec",
  effect: Effect.fn("DirectExecTool.Plugin")(function* (ctx: Context) {
    const catalog = yield* EnvironmentToolsCatalog.make()
    const fs = yield* FSUtil.Service
    const location = yield* Location.Service
    const access = yield* FileAccess.Service
    const permission = yield* Permission.Service
    const process = yield* AppProcess.Service
    const directory = Effect.fn("DirectExecTool.directory")(function* (target: string) {
      const canonical = yield* fs.realPath(target)
      const stat = yield* fs.stat(canonical)
      if (stat.type !== "Directory")
        return yield* new ToolFailure({ message: `Working directory is not a directory: ${target}` })
      return canonical
    })
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "direct_exec",
          description,
          input: Input,
          output: Output,
          options: { codemode: false },
          execute: (input, context) =>
            Effect.gen(function* () {
              const valid = validateInput(input)
              if (valid instanceof ToolFailure) return yield* valid
              const source = { type: "tool" as const, messageID: context.messageID, id: context.id }
              const initial = yield* catalog.resolveExecutable(valid.id)
              const target = yield* access.resolve({ path: input.cwd ?? location.directory, kind: "directory" })
              const canonical = yield* directory(target.absolute)
              // FileAccess owns approval resources. Check both the requested path and its real destination.
              const destination = yield* access.resolve({ path: canonical, kind: "directory" })
              yield* access.authorizeExternal([target, destination], context, { path: target.absolute })
              yield* permission.assert({
                action: "direct_exec",
                resources: [initial.id],
                save: [initial.id],
                metadata: {
                  name: initial.name,
                  path: initial.path,
                  args: valid.args,
                  cwd: target.absolute,
                  scope: "program_all_arguments_across_updates",
                },
                sessionID: context.sessionID,
                agent: context.agent,
                source,
              })
              yield* context.progress({ title: `Running ${initial.name}` })
              const executable = yield* catalog.resolveExecutable(valid.id)
              if (!sameExecutable(initial, executable))
                return yield* new ToolFailure({
                  message: `Environment tool changed while execution permission was pending: ${initial.name}`,
                })
              if ((yield* directory(target.absolute)) !== canonical)
                return yield* new ToolFailure({
                  message: "Working directory changed while execution permission was pending",
                })
              const startedAt = Date.now()
              const result = yield* process.run(
                ChildProcess.make(executable.path, valid.args, {
                  cwd: canonical,
                  shell: false,
                  extendEnv: true,
                  stdin: "ignore",
                  stdout: "pipe",
                  stderr: "pipe",
                  forceKillAfter: Duration.seconds(2),
                }),
                {
                  timeout: Duration.millis(valid.timeoutMs),
                  maxOutputBytes: MAX_OUTPUT_BYTES,
                  maxErrorBytes: MAX_OUTPUT_BYTES,
                },
              )
              const output: typeof Output.Type = {
                status: "exited",
                id: executable.id,
                name: executable.name,
                path: executable.path,
                cwd: canonical,
                exitCode: result.exitCode,
                stdout: result.stdout.toString("utf8"),
                stderr: result.stderr.toString("utf8"),
                stdoutTruncated: result.stdoutTruncated,
                stderrTruncated: result.stderrTruncated,
                durationMs: Date.now() - startedAt,
              }
              return {
                output,
                content: [{ type: "text" as const, text: JSON.stringify(output, undefined, 2) }],
                metadata: {
                  title: `${executable.name} exited with code ${result.exitCode}`,
                  exitCode: result.exitCode,
                  stdoutTruncated: result.stdoutTruncated,
                  stderrTruncated: result.stderrTruncated,
                },
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof ToolFailure
                  ? error
                  : error instanceof EnvironmentToolsCatalog.CatalogError
                    ? new ToolFailure({ message: error.message })
                    : new ToolFailure({ message: "Unable to execute cataloged program directly", error }),
              ),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
export const constants = {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_ARGS,
  MAX_ARG_LENGTH,
  MAX_ARGS_LENGTH,
  MAX_OUTPUT_BYTES,
} as const
