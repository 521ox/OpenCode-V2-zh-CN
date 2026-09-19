import { expect } from "bun:test"
import { Context, Effect, Layer, Schema } from "effect"
import { Document, Event, Info } from "@opencode/schema/config"
import { OpenAI } from "@opencode/ai/providers"
import { ToolDefinition } from "@opencode/ai"
import { Agent } from "@opencode/core/agent"
import { Bus } from "@opencode/core/bus"
import { Config } from "@opencode/core/config"
import { ConfigPolicyPlugin } from "@opencode/core/config/plugin/policy"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { PermissionSaved } from "@opencode/core/permission/saved"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { Session } from "@opencode/core/session"
import { HostedWebSearch } from "@opencode/core/session/hosted-web-search"
import { WebSearch } from "@opencode/core/websearch"
import { testEffect } from "./lib/effect"
import { PluginTestLayer } from "./plugin/fixture"

const it = testEffect(Layer.merge(PluginTestLayer, AppNodeBuilder.build(PermissionSaved.node)))
const document = (policies: { action: "permission" | "provider.use"; resource: string; effect: "allow" | "deny" }[]) =>
  new Document({ type: "document", info: Schema.decodeUnknownSync(Info)({ experimental: { policies } }) })
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
  return { input, permission, select }
})

for (const policies of [
  [],
  [{ action: "provider.use" as const, resource: "other", effect: "deny" as const }],
  [{ action: "permission" as const, resource: "read:secret*", effect: "deny" as const }],
]) {
  it.effect(`real config policy allows hosted search with unrelated policies: ${JSON.stringify(policies)}`, () =>
    Effect.gen(function* () {
      const { input, permission, select } = yield* setup
      const hooks = yield* PluginHooks.Service
      expect(yield* hooks.has("permission", "evaluate")).toBe(true)
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
      expect((yield* select).hosted?.name).toBe("web_search")
      expect(yield* permission.list()).toEqual([])
      const websearch = yield* WebSearch.Service
      yield* websearch.select(false)
      expect((yield* select).hosted).toBeUndefined()
    }).pipe(Effect.provide(Config.testLayer([document(policies)]))),
  )
}

for (const resource of ["*", "websearch:*", "websearch:private*", "*private:*"]) {
  it.effect(`real config ${resource} deny blocks hosted and preserves concrete assertions`, () =>
    Effect.gen(function* () {
      const { input, permission, select } = yield* setup
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
      const selected = yield* select
      expect(selected.hosted).toBeUndefined()
      expect(selected.tools.size).toBe(0)
      const error = yield* permission
        .assert({
          ...input,
          action: "websearch",
          resources: ["private: query"],
          metadata: { query: "private: query" },
          source: { type: "tool", id: "real-call", messageID: "real-message" },
        })
        .pipe(Effect.flip)
      expect(error).toBeInstanceOf(Permission.BlockedError)
      expect(yield* permission.list()).toEqual([])
    }).pipe(Effect.provide(Config.testLayer([document([{ action: "permission", resource, effect: "deny" }])]))),
  )
}

it.live("real config policy reload changes blanket authorization without replacing the hook", () =>
  Effect.gen(function* () {
    const { input, permission, select } = yield* setup
    const config = yield* Config.Test
    const bus = yield* Bus.Service
    expect((yield* select).hosted?.name).toBe("web_search")
    for (const effect of ["deny", "allow"] as const) {
      yield* config.setEntries([document([{ action: "permission", resource: "websearch:*", effect }])])
      yield* bus.publish(Event.Updated, {})
      const expected = effect === "deny" ? "ask" : "allow"
      for (let attempt = 0; attempt < 200; attempt++) {
        if ((yield* permission.preauthorizeHostedSearch(input)) === expected) break
        yield* Effect.sleep("10 millis")
      }
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe(expected)
      expect((yield* select).hosted?.name).toBe(effect === "allow" ? "web_search" : undefined)
    }
    const hooks = yield* PluginHooks.Service
    const registration = yield* hooks.register("permission", "evaluate", () => Effect.void)
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
    yield* registration.dispose
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
  }).pipe(Effect.provide(Config.testLayer([document([])]))),
)

it.effect("ordered blanket allow can supersede a deny, but global deny overrides repository allow", () =>
  Effect.gen(function* () {
    const { input, permission, select } = yield* setup
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
    expect((yield* select).hosted?.name).toBe("web_search")
    yield* permission.assert({ ...input, action: "websearch", resources: ["private query"] })
  }).pipe(
    Effect.provide(
      Config.testLayer([
        document([
          { action: "permission", resource: "websearch:private*", effect: "deny" },
          { action: "permission", resource: "websearch:*", effect: "allow" },
        ]),
      ]),
    ),
  ),
)

it.effect("user-global query deny cannot be superseded by repository blanket allow", () =>
  Effect.gen(function* () {
    const { input, permission, select } = yield* setup
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
    expect((yield* select).hosted).toBeUndefined()
  }).pipe(
    Effect.provide(
      Config.testLayer([
        document([{ action: "permission", resource: "websearch:private*", effect: "deny" }]),
        document([{ action: "permission", resource: "websearch:*", effect: "allow" }]),
      ]),
    ),
  ),
)
