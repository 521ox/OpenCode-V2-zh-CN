import { expect } from "bun:test"
import { OpenAIChat } from "@opencode/ai/protocols"
import { SystemPart } from "@opencode/ai"
import { Agent } from "@opencode/schema/agent"
import { Session } from "@opencode/core/session"
import { SessionStore } from "@opencode/core/session/store"
import { SessionEvent } from "@opencode/core/session/event"
import { SessionRulesLocation } from "@opencode/core/session/rules-location"
import { SessionModelRequest } from "@opencode/core/session/model-request"
import { SessionModelTransport } from "@opencode/core/session/model-transport"
import { SessionRunnerModel } from "@opencode/core/session/runner/model"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { Location } from "@opencode/core/location"
import { AbsolutePath } from "@opencode/core/schema"
import { Bus } from "@opencode/core/bus"
import { Effect } from "effect"
import { testEffect } from "./lib/effect"
import { PluginTestLayer } from "./plugin/fixture"

const it = testEffect(PluginTestLayer)
const transport = SessionModelTransport.Service.of({
  bind: () => ({ execute: () => Effect.die("No model calls in rules tests") }),
  close: () => Effect.void,
  closeAll: Effect.void,
})

it.effect(
  "appends protected context after the hook, excludes auxiliaries, and retains creation lineage after move",
  () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const store = yield* SessionStore.Service
      const location = yield* Location.Service
      const hooks = yield* PluginHooks.Service
      const bus = yield* Bus.Service
      const root = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
      const child = yield* sessions.create({ parentID: root.id })
      const nested = yield* sessions.create({ parentID: child.id })
      const before = yield* store.rulesLocation(nested.id)
      expect(before.status).toBe("available")
      expect(before.root_session_id).toBe(root.id)
      yield* bus.publish(SessionEvent.Moved, {
        sessionID: root.id,
        projectID: root.projectID,
        location: Location.Ref.make({ directory: AbsolutePath.make("/synthetic-moved-location") }),
      })
      expect(yield* store.rulesLocation(nested.id)).toEqual(before)
      const fork = yield* sessions.fork({ sessionID: root.id })
      expect(yield* store.rulesLocation(fork.id)).toMatchObject({
        status: "unavailable",
        root_session_id: null,
        rules_directory: null,
        reason: "root_start_directory_invalid",
      })
      yield* hooks.register("session", "context", (event) =>
        Effect.sync(() => {
          event.system = [SystemPart.make("plugin replacement")]
        }),
      )
      const requests = yield* SessionModelRequest.Service.pipe(Effect.provide(SessionModelRequest.layer))
      const input: SessionModelRequest.Input = {
        session: nested,
        agent: Agent.ID.make("build"),
        system: [SystemPart.make("ordinary")],
        messages: [],
        model: SessionRunnerModel.resolved(OpenAIChat.route.model({ id: "gpt-5.5", provider: "test" }), {
          capabilities: { tools: true, input: ["text"], output: ["text"] },
          cost: [],
          limit: { context: 200_000, output: 32_000 },
        }),
      }
      const primary = yield* requests.primary(input)
      expect(primary.request.system).toEqual([
        SystemPart.make("plugin replacement"),
        SystemPart.make(SessionRulesLocation.render(before)),
      ])
      for (const kind of ["compaction", "generate", "title"] as const) {
        const auxiliary = yield* requests[kind](input)
        expect(JSON.stringify(auxiliary.request.system)).not.toContain("Session rules context data")
      }
    }).pipe(Effect.provideService(SessionModelTransport.Service, transport)),
)
