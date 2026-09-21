import { expect } from "bun:test"
import { Context, Effect, Layer, Schema } from "effect"
import { Document, Event, Info } from "@opencode/schema/config"
import { OpenAI } from "@opencode/ai/providers"
import { ToolDefinition } from "@opencode/ai"
import { Agent } from "@opencode/core/agent"
import { Bus } from "@opencode/core/bus"
import { Config } from "@opencode/core/config"
import { ConfigPolicyPlugin } from "@opencode/core/config/plugin/policy"
import { Credential } from "@opencode/core/credential"
import { Integration } from "@opencode/core/integration"
import { OpencodePlugin } from "@opencode/core/plugin/provider/opencode"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { Database } from "@opencode/core/database/database"
import { Location } from "@opencode/core/location"
import { ManagedPolicy } from "@opencode/core/managed-policy"
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
import { PluginTestLayer, pluginTestLayer } from "./plugin/fixture"

const it = testEffect(PluginTestLayer)
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
  // The synthetic Location uses the global project; seed its saved-permission FK.
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
  return { input, permission, select }
})

for (const initialFailure of [true, false]) {
  it.effect(`shared Console policy survives Location failure without stale replay: initial=${initialFailure}`, () =>
    Effect.gen(function* () {
      const managed = yield* ManagedPolicy.Service
      const credentials = yield* Credential.Service
      const credential = yield* credentials.create({
        integrationID: Integration.ID.make("opencode"),
        value: Credential.Key.make({ type: "key", key: "fixture", metadata: { orgName: "Acme" } }),
      })
      const open = Effect.fn(function* (status: number) {
        const response = { status, deny: true }
        const context = yield* Layer.build(
          Layer.fresh(
            pluginTestLayer([
              ManagedPolicy.node.replace(Layer.succeed(ManagedPolicy.Service, managed)),
              Credential.node.replace(Layer.succeed(Credential.Service, credentials)),
            ]),
          ),
        )
        const http = HttpClient.make((request) =>
          Effect.sync(() =>
            HttpClientResponse.fromWeb(
              request,
              response.status === 200
                ? Response.json({
                    providers: {},
                    experimental: {
                      policies: response.deny
                        ? [{ action: "permission", resource: "websearch:*", effect: "deny" }]
                        : [],
                    },
                  })
                : new Response(null, { status: response.status }),
            ),
          ),
        )
        const initialize = Effect.gen(function* () {
          const plugin = yield* Plugin.Service
          const host = yield* PluginHost.make(plugin)
          yield* OpencodePlugin.effect(host).pipe(Effect.provideService(HttpClient.HttpClient, http))
          return yield* setup
        })
        const state = yield* initialize.pipe(Effect.provide(context), Effect.provide(Config.testLayer([])))
        const refresh = Effect.gen(function* () {
          const bus = yield* Bus.Service
          yield* bus.publish(Credential.Event.Switched, {
            integrationID: Integration.ID.make("opencode"),
            credentialID: credential.id,
          })
          yield* drain
        }).pipe(Effect.provide(context))
        return { ...state, response, refresh, context }
      })
      const a = yield* open(200)
      const b = yield* open(initialFailure ? 503 : 200)
      expect(Context.get(a.context, PluginHooks.Service)).not.toBe(Context.get(b.context, PluginHooks.Service))
      const check = (denied: boolean) =>
        Effect.gen(function* () {
          expect(managed.current().statements).toEqual(
            denied ? [{ action: "permission", resource: "websearch:*", effect: "deny" }] : [],
          )
          for (const location of [a, b]) {
            expect(yield* location.permission.preauthorizeHostedSearch(location.input)).toBe(denied ? "ask" : "allow")
            expect((yield* location.select.pipe(Effect.provide(location.context))).hosted?.name).toBe(
              denied ? undefined : "web_search",
            )
            const assertion = location.permission.assert({
              ...location.input,
              action: "websearch",
              resources: ["query"],
            })
            if (denied) expect(yield* assertion.pipe(Effect.flip)).toBeInstanceOf(Permission.BlockedError)
            if (!denied) yield* assertion
          }
        })
      yield* check(true)
      a.response.deny = false
      yield* a.refresh
      yield* check(false)
      b.response.status = 503
      yield* b.refresh
      yield* check(false)
      a.response.deny = true
      yield* a.refresh
      yield* b.refresh
      yield* check(true)
    }),
  )
}

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

for (const resource of ["*", "websearch:*", "websearch:private*", "*private:*"]) {
  it.effect(`live organization ${resource} deny overrides authored and saved allows`, () =>
    Effect.gen(function* () {
      const { input, permission, select } = yield* setup
      const managed = yield* ManagedPolicy.Service
      const saved = yield* PermissionSaved.Service
      const location = yield* Location.Service
      yield* saved.add({ projectID: location.project.id, action: "websearch", resources: ["*"] })
      expect((yield* select).hosted?.name).toBe("web_search")
      yield* managed.set({
        organization: "Acme",
        statements: [{ action: "permission", resource, effect: "deny" }],
      })
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
      yield* managed.set({ statements: [] })
      expect((yield* select).hosted?.name).toBe("web_search")
    }).pipe(
      Effect.provide(
        Config.testLayer([document([{ action: "permission", resource: "websearch:*", effect: "allow" }])]),
      ),
    ),
  )
}

it.effect("organization exceptions lift only proven blanket restrictions and retain restrictive hooks", () =>
  Effect.gen(function* () {
    const { input, permission, select } = yield* setup
    const managed = yield* ManagedPolicy.Service
    expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
    yield* managed.set({ statements: [{ action: "permission", resource: "websearch:public*", effect: "allow" }] })
    yield* permission.assert({ ...input, action: "websearch", resources: ["public query"] })
    expect((yield* select).hosted).toBeUndefined()
    yield* managed.set({ statements: [{ action: "permission", resource: "websearch:*", effect: "allow" }] })
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
    yield* managed.set({ statements: [] })
    expect((yield* select).hosted).toBeUndefined()
  }).pipe(
    Effect.provide(Config.testLayer([document([{ action: "permission", resource: "websearch:*", effect: "deny" }])])),
  ),
)

for (const owner of ["agent", "session"] as const) {
  for (const effect of ["ask", "deny"] as const) {
    it.effect(`organization blanket allow and saved approval cannot grant over ${owner} ${effect}`, () =>
      Effect.gen(function* () {
        const { input, permission, select } = yield* setup
        const managed = yield* ManagedPolicy.Service
        yield* managed.set({ statements: [{ action: "permission", resource: "websearch:*", effect: "allow" }] })
        const saved = yield* PermissionSaved.Service
        const location = yield* Location.Service
        yield* saved.add({ projectID: location.project.id, action: "websearch", resources: ["*"] })
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
        const selected = yield* select
        expect(selected.hosted).toBeUndefined()
        expect(selected.tools.size).toBe(0)
        expect(yield* permission.list()).toEqual([])
      }).pipe(
        Effect.provide(
          Config.testLayer([document([{ action: "permission", resource: "websearch:*", effect: "deny" }])]),
        ),
      ),
    )
  }
}
