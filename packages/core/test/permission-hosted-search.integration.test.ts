import { expect } from "bun:test"
import { Context, Effect, Layer, Schema } from "effect"
import { Document, Event, Info } from "@opencode/schema/config"
import { ConfigPolicy } from "@opencode/schema/config/policy"
import { OpenAI } from "@opencode/ai/providers"
import { ToolDefinition } from "@opencode/ai/effect"
import { Agent } from "@opencode/core/agent"
import { Bus } from "@opencode/core/bus"
import { Config } from "@opencode/core/config"
import { ConfigPolicyPlugin } from "@opencode/core/config/plugin/policy"
import { Integration } from "@opencode/core/integration"
import { Database } from "@opencode/core/database/database"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { PermissionSaved } from "@opencode/core/permission/saved"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { ProjectTable } from "@opencode/core/project/sql"
import { Session } from "@opencode/core/session"
import { HostedWebSearch } from "@opencode/core/session/hosted-web-search"
import { WebSearch } from "@opencode/core/websearch"
import { testEffect } from "./lib/effect"
import { drain } from "./lib/clock"
import { organizationPolicy } from "./fixture/policy"
import { PluginTestLayer } from "./plugin/fixture"

const it = testEffect(PluginTestLayer)
const document = (policies: ConfigPolicy.Info[]) =>
  new Document({ type: "document", info: Schema.decodeUnknownSync(Info)({ policies }) })
const setup = Effect.gen(function* () {
  const plugin = yield* Plugin.Service
  const host = yield* PluginHost.make(plugin)
  yield* ConfigPolicyPlugin.Plugin.effect(host)
  const agents = yield* Agent.Service
  const agent = Agent.ID.make("build")
  yield* agents.transform((editor) =>
    editor.update(agent, (record) => {
      record.permissions = [{ action: "websearch", resource: "*", effect: "allow" }]
    }),
  )
  const sessions = yield* Session.Service
  const location = yield* Location.Service
  const { db } = yield* Database.Service
  yield* db
    .insert(ProjectTable)
    .values({ id: location.project.id, worktree: location.directory, sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  const session = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
  const permission = Context.get(yield* Layer.build(Permission.layer), Permission.Service)
  const input = { sessionID: session.id, agent }
  const select = HostedWebSearch.select({
    ...input,
    kind: "primary",
    model: OpenAI.routes[0]!.model({ id: "fixture", provider: "openai" }),
    tools: new Map([
      ["websearch", ToolDefinition.make({ name: "websearch", description: "local", inputSchema: { type: "object" } })],
    ]),
  }).pipe(Effect.provideService(Permission.Service, permission))
  const config = yield* Config.Service
  const bus = yield* Bus.Service
  const update = (policies: ConfigPolicy.Info[] | undefined) =>
    Effect.gen(function* () {
      yield* config.integration!(Integration.ID.make("opencode"), policies && organizationPolicy(policies, "Acme"))
      yield* bus.publish(Event.Updated, {})
      yield* drain
    })
  return { input, permission, select, update }
})

for (const policies of [
  [],
  [{ action: "provider.use" as const, resource: "other", effect: "deny" as const }],
  [{ action: "tool.use" as const, resource: "read:secret*", effect: "deny" as const }],
]) {
  it.effect(`unrelated config policies retain hosted search: ${JSON.stringify(policies)}`, () =>
    Effect.gen(function* () {
      const { input, permission, select } = yield* setup
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
      expect((yield* select).hosted?.name).toBe("web_search")
      const websearch = yield* WebSearch.Service
      yield* websearch.select(false)
      expect((yield* select).hosted).toBeUndefined()
    }).pipe(Effect.provide(Config.testLayer([document(policies)]))),
  )
}

for (const resource of ["*", "websearch:*", "websearch:private*", "*private:*"]) {
  it.effect(`integration policy ${resource} overrides authored/saved allows and reloads through Config`, () =>
    Effect.gen(function* () {
      const { input, permission, select, update } = yield* setup
      const saved = yield* PermissionSaved.Service
      const location = yield* Location.Service
      yield* saved.add({ projectID: location.project.id, action: "websearch", resources: ["*"] })
      expect((yield* select).hosted?.name).toBe("web_search")
      yield* update([{ action: "tool.use", resource, effect: "deny" }])
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
      const selected = yield* select
      expect(selected.hosted).toBeUndefined()
      expect(selected.tools.size).toBe(0)
      const error = yield* permission
        .assert({ ...input, action: "websearch", resources: ["private: query"] })
        .pipe(Effect.flip)
      expect(error).toBeInstanceOf(Permission.BlockedError)
      expect(error.message).toBe("Blocked by Acme's policy")
      expect(yield* permission.list()).toEqual([])
      yield* update(undefined)
      expect((yield* select).hosted?.name).toBe("web_search")
    }).pipe(
      Effect.provide(Config.testLayer([document([{ action: "tool.use", resource: "websearch:*", effect: "allow" }])])),
    ),
  )
}

it.effect("integration exceptions need a blanket allow and unknown restrictive hooks still withhold search", () =>
  Effect.gen(function* () {
    const { input, permission, select, update } = yield* setup
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
    yield* update([{ action: "tool.use", resource: "websearch:public*", effect: "allow" }])
    yield* permission.assert({ ...input, action: "websearch", resources: ["public query"] })
    expect((yield* select).hosted).toBeUndefined()
    yield* update([{ action: "tool.use", resource: "websearch:*", effect: "allow" }])
    expect((yield* select).hosted?.name).toBe("web_search")
    const hooks = yield* PluginHooks.Service
    const registration = yield* hooks.register("permission", "evaluate", (event) =>
      Effect.sync(() => {
        event.effect = "deny"
      }),
    )
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
    expect((yield* select).hosted).toBeUndefined()
    expect(
      yield* permission.assert({ ...input, action: "websearch", resources: ["public query"] }).pipe(Effect.flip),
    ).toBeInstanceOf(Permission.BlockedError)
    yield* registration.dispose
    expect((yield* select).hosted?.name).toBe("web_search")
  }).pipe(
    Effect.provide(Config.testLayer([document([{ action: "tool.use", resource: "websearch:*", effect: "deny" }])])),
  ),
)

for (const owner of ["agent", "session"] as const) {
  for (const effect of ["ask", "deny"] as const) {
    it.effect(`integration allow cannot grant over ${owner} ${effect}`, () =>
      Effect.gen(function* () {
        const { input, permission, select, update } = yield* setup
        yield* update([{ action: "tool.use", resource: "websearch:*", effect: "allow" }])
        const rules: Permission.Ruleset = [{ action: "websearch", resource: "private*", effect }]
        if (owner === "agent") {
          const agents = yield* Agent.Service
          yield* agents.transform((editor) =>
            editor.update(input.agent, (record) => {
              record.permissions = [{ action: "websearch", resource: "*", effect: "allow" }, ...rules]
            }),
          )
        }
        if (owner === "session") {
          const sessions = yield* Session.Service
          yield* sessions.setPermissions({ sessionID: input.sessionID, permissions: rules })
        }
        expect(yield* permission.preauthorizeHostedSearch(input)).toBe(effect)
        expect((yield* select).hosted).toBeUndefined()
      }).pipe(Effect.provide(Config.testLayer([]))),
    )
  }
}
