export * as EnvironmentToolsTool from "./environment-tools.js"

import { ToolFailure } from "@opencode/ai"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { EnvironmentToolsCatalog } from "../../environment-tools/catalog.js"
import { Permission } from "../../permission.js"

export const Input = Schema.Struct({
  search: Schema.optional(
    Schema.Union([
      Schema.Struct({
        query: Schema.String.annotate({ description: "Program name, alias, path basename, or capability" }),
        limit: Schema.optional(Schema.Number.annotate({ description: "Maximum matches (1-20, default 5)" })),
      }).annotate({ parseOptions: { onExcessProperty: "error" } }),
      Schema.Struct({
        all: Schema.Literal(true).annotate({ description: "List every cataloged program name without details" }),
      }).annotate({ parseOptions: { onExcessProperty: "error" } }),
    ]),
  ),
  update: Schema.optional(
    Schema.Union([
      Schema.Struct({
        mode: Schema.Literal("upsert"),
        name: Schema.String,
        path: Schema.String,
        aliases: Schema.optional(Schema.Array(Schema.String)),
        capabilities: Schema.optional(Schema.Array(Schema.String)),
        source: EnvironmentToolsCatalog.Source,
      }).annotate({ parseOptions: { onExcessProperty: "error" } }),
      Schema.Struct({
        mode: Schema.Literal("invalidate"),
        id: Schema.String,
        reason: Schema.Literals(["path_missing", "replaced", "user_requested", "other"]),
      }).annotate({ parseOptions: { onExcessProperty: "error" } }),
    ]),
  ),
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export const Output = Schema.Union([
  Schema.Struct({
    operation: Schema.Literal("search"),
    query: Schema.String,
    matches: Schema.Array(Schema.Struct({ ...EnvironmentToolsCatalog.Entry.fields, exists: Schema.Boolean })),
    truncated: Schema.Boolean,
  }),
  Schema.Struct({
    operation: Schema.Literal("search"),
    mode: Schema.Literal("all"),
    count: Schema.Number,
    names: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    operation: Schema.Literal("update"),
    result: Schema.Literals(["created", "refreshed", "invalidated"]),
    entry: EnvironmentToolsCatalog.Entry,
  }),
])

const description = [
  "Search or update the persistent catalog of external programs verified in the current local environment.",
  "When no concrete program name is known, use search.all at most once to list cataloged names without details; otherwise use search.query for revalidated details about one program.",
  "The catalog is memory, not an installed-software inventory: a missing name does not mean the program is not installed.",
  "On a miss, continue with normal discovery and update only after a path was successfully resolved, successfully executed, or explicitly provided by the user.",
  "When a query returns an active direct-exec-eligible entry and direct_exec is available, invoke it by catalog id for foreground native argv execution; use shell for shell syntax, scripts, stdin, custom environment, or background jobs.",
  "This tool records environment facts; it does not execute programs or grant execution permission.",
].join(" ")

export const Plugin = {
  id: "opencode.tool.environment-tools",
  effect: Effect.fn("EnvironmentToolsTool.Plugin")(function* (ctx: Context) {
    const catalog = yield* EnvironmentToolsCatalog.make()
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "environment_tools",
          description,
          input: Input,
          output: Output,
          options: { codemode: false },
          execute: (input, context) =>
            Effect.gen(function* () {
              const source = { type: "tool" as const, messageID: context.messageID, id: context.id }
              if (Number(input.search !== undefined) + Number(input.update !== undefined) !== 1)
                return yield* new ToolFailure({ message: "Provide exactly one of search or update" })
              if (input.search !== undefined) {
                const listAll = "all" in input.search
                yield* permission.assert({
                  action: "environment_tools",
                  resources: [listAll ? "search:all" : `search:${input.search.query}`],
                  save: ["*"],
                  metadata: listAll ? { all: true } : { query: input.search.query },
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source,
                })
                if (listAll) {
                  const result = yield* catalog.listNames()
                  return {
                    output: result,
                    content: [
                      {
                        type: "text" as const,
                        text:
                          result.count === 0
                            ? "No environment tools are cataloged."
                            : JSON.stringify(result, undefined, 2),
                      },
                    ],
                    metadata: { title: `Environment tools catalog: ${result.count} names` },
                  }
                }
                const result = yield* catalog.search(input.search.query, input.search.limit)
                return {
                  output: result,
                  content: [
                    {
                      type: "text" as const,
                      text:
                        result.matches.length === 0
                          ? `No environment tools matched ${JSON.stringify(result.query)}. This does not mean the program is not installed; continue with normal discovery.`
                          : JSON.stringify(result, undefined, 2),
                    },
                  ],
                  metadata: { title: `Environment tools: ${result.query}` },
                }
              }
              const update = input.update!
              yield* permission.assert({
                action: "environment_tools_update",
                resources: [
                  update.mode === "upsert" ? `upsert:${update.name}:${update.path}` : `invalidate:${update.id}`,
                ],
                save: ["*"],
                metadata:
                  update.mode === "upsert"
                    ? { mode: update.mode, name: update.name, path: update.path }
                    : { mode: update.mode, id: update.id },
                sessionID: context.sessionID,
                agent: context.agent,
                source,
              })
              const result = yield* update.mode === "upsert" ? catalog.upsert(update) : catalog.invalidate(update)
              return {
                output: result,
                content: [{ type: "text" as const, text: JSON.stringify(result, undefined, 2) }],
                metadata: {
                  title: `Environment tool ${update.mode === "upsert" ? "updated" : "invalidated"}: ${result.entry.name}`,
                },
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof ToolFailure
                  ? error
                  : error instanceof EnvironmentToolsCatalog.CatalogError
                    ? new ToolFailure({ message: error.message })
                    : new ToolFailure({ message: "Unable to use the environment tools catalog", error }),
              ),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
