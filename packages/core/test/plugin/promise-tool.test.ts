import { expect } from "bun:test"
import { Agent } from "@opencode/core/agent"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginPromise } from "@opencode/core/plugin/promise"
import { Tool } from "@opencode/core/tool"
import { Session } from "@opencode/schema/session"
import { SessionMessage } from "@opencode/schema/session-message"
import { Cause, Deferred, Effect, Exit, Fiber, Schema } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

for (const source of ["update", "list", "get"] as const) {
  it.live(`Promise editor ${source} roundtrip interrupts the original Effect tool`, () =>
    Effect.gen(function* () {
      const plugins = yield* Plugin.Service
      const tools = yield* Tool.Service
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const finalized = yield* Deferred.make<void>()
      const progress: Tool.Metadata[] = []
      yield* tools.transform((editor) =>
        editor.add({
          name: "wait",
          description: "Effect tool wrapped by a Promise plugin",
          input: Schema.Struct({}),
          options: { codemode: false },
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* context.progress({ title: "started" })
              yield* Deferred.succeed(started, undefined)
              yield* Deferred.await(release)
              yield* context.progress({ title: "continued" })
              return { content: "completed" }
            }).pipe(Effect.ensuring(Deferred.succeed(finalized, undefined))),
        }),
      )
      yield* PluginPromise.fromPromise({
        id: `roundtrip-${source}`,
        async setup(context) {
          await context.tool.transform((editor) => {
            const existing = source === "list" ? editor.list().find((tool) => tool.id === "wait") : editor.get("wait")
            if (!existing) throw new Error("Missing Effect tool")
            editor.update("wait", (tool) => {
              const execute = source === "update" ? tool.execute : existing.execute
              tool.execute = (input, context) => execute(input, context)
            })
          })
        },
      }).effect(yield* PluginHost.make(plugins))

      const snapshot = yield* tools.snapshot()
      const fiber = yield* snapshot
        .execute({
          sessionID: Session.ID.make("ses_promise_tool_roundtrip"),
          agent: Agent.ID.make("build"),
          messageID: SessionMessage.ID.make("msg_promise_tool_roundtrip"),
          call: { type: "tool-call", id: "call_promise_tool_roundtrip", name: "wait", input: {} },
          progress: (update) =>
            Effect.sync(() => {
              progress.push(update)
            }),
        })
        .pipe(Effect.forkScoped)
      yield* Deferred.await(started)
      expect(progress).toEqual([{ title: "started" }])
      yield* Fiber.interrupt(fiber)
      yield* Deferred.await(finalized).pipe(Effect.timeout("1 second"))
      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
      yield* Deferred.succeed(release, undefined)
      yield* Effect.yieldNow
      expect(progress).toEqual([{ title: "started" }])
    }),
  )
}

it.live("Promise tool executors receive interruption through their AbortSignal", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const tools = yield* Tool.Service
    const started = yield* Deferred.make<AbortSignal>()
    yield* PluginPromise.fromPromise({
      id: "cancel-tool",
      async setup(context) {
        await context.tool.transform((editor) =>
          editor.add({
            name: "wait",
            description: "Wait until cancelled",
            input: { type: "object", properties: {}, additionalProperties: false },
            options: { codemode: false },
            execute: (_input, context) =>
              new Promise<never>((_resolve, reject) => {
                context.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
                Effect.runSync(Deferred.succeed(started, context.signal))
              }),
          }),
        )
      },
    }).effect(yield* PluginHost.make(plugins))

    const snapshot = yield* tools.snapshot()
    const fiber = yield* snapshot
      .execute({
        sessionID: Session.ID.make("ses_promise_tool_cancel"),
        agent: Agent.ID.make("build"),
        messageID: SessionMessage.ID.make("msg_promise_tool_cancel"),
        call: { type: "tool-call", id: "call_promise_tool_cancel", name: "wait", input: {} },
      })
      .pipe(Effect.forkScoped)
    const signal = yield* Deferred.await(started)
    expect(signal.aborted).toBe(false)
    yield* Fiber.interrupt(fiber)
    const exit = yield* Fiber.await(fiber)
    expect(signal.aborted).toBe(true)
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
  }),
)
