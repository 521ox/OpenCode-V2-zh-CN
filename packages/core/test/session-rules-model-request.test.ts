import { expect } from "bun:test"
import path from "node:path"
import { OpenAI } from "@opencode/ai/providers"
import { SystemPart } from "@opencode/ai/effect"
import { Agent } from "@opencode/core/agent"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { Flag } from "@opencode/core/flag"
import { Permission } from "@opencode/core/permission"
import { Tool } from "@opencode/core/tool"
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
import { Workspace } from "@opencode/core/workspace"
import { Context, Effect, Layer, Schema } from "effect"
import { testEffect } from "./lib/effect"
import { makePluginTestLayer } from "./plugin/fixture"

const it = testEffect(
  makePluginTestLayer(undefined, undefined, [Flag.node.replace(Flag.testLayer([], { overrides: "-machines" }))]),
)
const machines = testEffect(
  makePluginTestLayer(undefined, undefined, [Flag.node.replace(Flag.testLayer([], { overrides: "machines" }))]),
)
const transport = SessionModelTransport.Service.of({
  bind: () => ({ execute: () => Effect.die("No model calls in rules tests") }),
  close: () => Effect.void,
  closeAll: Effect.void,
})
const model = SessionRunnerModel.resolved(OpenAI.responses("gpt-5.5"), {
  capabilities: { tools: true, input: ["text"], output: ["text"] },
  cost: [],
  limit: { context: 200_000, output: 32_000 },
})

it.effect("combines parent cache affinity, hosted search and protected root rules after hooks and movement", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const store = yield* SessionStore.Service
    const location = yield* Location.Service
    const hooks = yield* PluginHooks.Service
    const bus = yield* Bus.Service
    const agents = yield* Agent.Service
    yield* agents.transform((editor) =>
      editor.update(Agent.ID.make("build"), (agent) => {
        agent.permissions = [{ action: "websearch", resource: "*", effect: "allow" }]
      }),
    )
    const tools = yield* Tool.Service
    yield* tools.transform((editor) =>
      editor.add({
        name: "websearch",
        description: "Local search",
        options: { codemode: false },
        input: Schema.Struct({ query: Schema.String }),
        execute: () => Effect.die("Hosted search must not invoke local search"),
      }),
    )
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
    const permission = Context.get(yield* Layer.build(Permission.layer), Permission.Service)
    const requests = yield* SessionModelRequest.Service.pipe(
      Effect.provide(SessionModelRequest.layer),
      Effect.provideService(Permission.Service, permission),
    )
    const input: SessionModelRequest.Input = {
      session: nested,
      agent: Agent.ID.make("build"),
      system: [SystemPart.make("ordinary")],
      messages: [],
      tools: yield* tools.snapshot(),
      model,
    }
    const primary = yield* requests.primary(input)
    expect(primary.request.promptCacheKey).toBe(child.id)
    expect(primary.request.headers?.["x-opencode-session-id"]).toBe(nested.id)
    expect(primary.request.headers?.["x-opencode-parent-session-id"]).toBe(child.id)
    expect(primary.request.headers?.["x-session-affinity"]).toBe(child.id)
    expect(primary.request.headers?.["x-parent-session-id"]).toBe(child.id)
    expect(primary.request.tools.map((tool) => tool.name)).toContain("web_search")
    expect(primary.request.tools.map((tool) => tool.name)).not.toContain("websearch")
    expect(primary.request.system).toEqual([
      SystemPart.make("plugin replacement"),
      SystemPart.make(SessionRulesLocation.render(before)),
    ])
    for (const kind of ["compaction", "generate", "title"] as const) {
      const auxiliary = yield* requests[kind](input)
      expect(JSON.stringify(auxiliary.request.system)).not.toContain("Session working-memory context")
      expect(auxiliary.request.tools.map((tool) => tool.name)).not.toContain("web_search")
    }
  }).pipe(Effect.provideService(SessionModelTransport.Service, transport)),
)

machines.effect(
  "the primary tool path addresses the local root from a paired-machine cwd without escaping a sandbox",
  () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const location = yield* Location.Service
      const access = yield* FileAccess.Service
      const root = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
      const child = yield* sessions.create({ parentID: root.id })
      const remote = Environment.make(Environment.ID.make("review-machine"), Environment.makeMemoryDriver())
      const cwd = { absolute: AbsolutePath.make("/remote-project"), environment: remote }
      const requests = yield* Effect.provide(SessionModelRequest.Service, SessionModelRequest.layer)
      const input = { session: root, agent: Agent.ID.make("build"), system: [], messages: [], model }
      const expected = {
        absolute: AbsolutePath.make(path.join(location.directory, ".opencode", "rules", root.id)),
        environment: { id: Environment.localID },
      }

      for (const session of [root, child]) {
        const local = yield* requests.primary({ ...input, session })
        const moved = yield* requests
          .primary({ ...input, session })
          .pipe(Effect.provideService(Environment.CurrentWorkingDirectory, cwd))
        expect(moved.request.system).toEqual(local.request.system)
        const text = moved.request.system.at(-1)!.text
        const context = JSON.parse(text.split("\n\n")[1])
        const bare = context.rules_directory
        expect(context.root_session_id).toBe(root.id)
        expect(yield* access.locate(bare)).toEqual(expected)
        const wrongTarget = yield* access
          .locate(bare)
          .pipe(Effect.provideService(Environment.CurrentWorkingDirectory, cwd))
        expect(wrongTarget.environment.id).toBe(remote.id)
        const target = text.match(/use ("(?:[^"\\]|\\.)*") as the directory for machine-aware file tools/)?.[1]
        if (target === undefined) throw new Error("No machine-aware tool path in the primary working-memory guidance")
        const remoteTarget = yield* access
          .locate(JSON.parse(target))
          .pipe(Effect.provideService(Environment.CurrentWorkingDirectory, cwd))
        expect(remoteTarget).toEqual(expected)
      }
      yield* Effect.gen(function* () {
        for (const kind of ["compaction", "generate", "title"] as const) {
          const auxiliary = yield* requests[kind]({ ...input, session: child })
          expect(auxiliary.request.system).toEqual([])
        }
      }).pipe(Effect.provideService(Environment.CurrentWorkingDirectory, cwd))
      const sandbox = Environment.workspace(Workspace.ID.make("wrk_rules_test"), Environment.makeMemoryDriver())
      const confined = yield* Effect.provide(SessionModelRequest.Service, SessionModelRequest.layer).pipe(
        Effect.provideService(Environment.Service, sandbox),
      )
      const primary = yield* confined.primary({ ...input, session: child })
      const store = yield* SessionStore.Service
      expect(primary.request.system).toEqual([
        SystemPart.make(SessionRulesLocation.render(yield* store.rulesLocation(child.id))),
      ])
    }).pipe(Effect.provideService(SessionModelTransport.Service, transport)),
)
