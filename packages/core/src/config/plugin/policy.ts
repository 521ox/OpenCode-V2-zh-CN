export * as ConfigPolicyPlugin from "./policy.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect, Stream } from "effect"
import { Bus } from "../../bus.js"
import { Config } from "../../config.js"
import { PluginHooks } from "../../plugin/hooks.js"
import { Credential } from "../../credential.js"
import { ManagedPolicy } from "../../managed-policy.js"
import { State } from "../../state.js"
import { Wildcard } from "../../util/wildcard.js"
import { WebSearch } from "../../websearch.js"
import { ConfigIntegration } from "../integration.js"
import { ConfigEntryObserver } from "./entry-observer.js"

export const Plugin = define({
  id: "opencode.config.policy",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const hooks = yield* PluginHooks.Service
    const credentials = yield* Credential.Service
    const websearch = yield* WebSearch.Service
    const bus = yield* Bus.Service
    const reload = State.batch(
      Effect.all([ctx.provider.reload(), ctx.mcp.reload(), ctx.skill.reload(), websearch.reload()], {
        discard: true,
      }),
    )
    const loaded = yield* ConfigEntryObserver.observe(config, ctx.event, reload)
    // Documents reverse so earlier-loaded policy wins: managed policy, then a Console config document, then user
    // and project files.
    const policies = () => ManagedPolicy.statements(loaded.entries)
    // `integration.use` names the account behind each integration's active connection. Reading stored metadata
    // never refreshes a credential.
    const current = { accounts: ManagedPolicy.accounts(yield* credentials.all()) }
    yield* bus.subscribe([Credential.Event.Updated, Credential.Event.Switched]).pipe(
      Stream.runForEach(() =>
        Effect.gen(function* () {
          const next = ManagedPolicy.accounts(yield* credentials.all())
          if (
            next.size === current.accounts.size &&
            Array.from(next).every(([id, account]) => current.accounts.get(id) === account)
          )
            return
          current.accounts = next
          yield* State.batch(Effect.all([ctx.provider.reload(), websearch.reload()], { discard: true }))
        }),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )
    const integrationDenied = (statements: ReturnType<typeof policies>, integrationID: string) =>
      ManagedPolicy.decision(
        statements,
        "integration.use",
        ManagedPolicy.integrationResource(integrationID, current.accounts.get(integrationID)),
      ) === "deny"
    const runSync = Effect.runSyncWith(yield* Effect.context())
    yield* ctx.provider.transform((providers) => {
      const statements = policies()
      // A provider a well-known origin defines belongs to that origin; others to their own integration.
      const suppliers = ConfigIntegration.suppliers(loaded.entries)
      const denied: string[] = []
      for (const record of providers.list()) {
        const provider =
          ManagedPolicy.decision(statements, "provider.use", record.provider.id) === "deny" ||
          integrationDenied(
            statements,
            suppliers.get(record.provider.id) ?? record.provider.integrationID ?? record.provider.id,
          )
        if (!provider) continue
        providers.remove(record.provider.id)
        // Skip unconfigured catalog entries; deny-all policies would otherwise log the whole catalog.
        if (record.provider.activation === "enabled") denied.push(record.provider.id)
      }
      if (denied.length) runSync(Effect.logDebug("providers denied by policy", { providers: denied }))
    })
    // Every built-in web search provider shares its integration's ID.
    yield* websearch.transform((editor) => {
      const statements = policies()
      for (const provider of editor.list()) {
        if (
          ManagedPolicy.decision(statements, "websearch.use", provider.id) === "deny" ||
          integrationDenied(statements, provider.id)
        )
          editor.remove(provider.id)
      }
    })
    yield* ctx.mcp.transform((servers) => {
      const statements = policies()
      for (const [name] of servers.list()) {
        if (ManagedPolicy.decision(statements, "mcp.use", name) === "deny") servers.remove(name)
      }
    })
    yield* ctx.skill.transform((skills) => {
      const statements = policies()
      for (const skill of skills.list()) {
        if (ManagedPolicy.decision(statements, "skill.use", skill.id) === "deny") skills.remove(skill.id)
      }
    })
    yield* hooks.registerPermissionPolicy(
      (event) =>
        Effect.sync(() => {
          const current = policies()
          const denied = event.resources
            .map((resource) =>
              current.findLast(
                (policy) =>
                  policy.action === "tool.use" && Wildcard.match(`${event.action}:${resource}`, policy.resource),
              ),
            )
            .find((policy) => policy?.effect === "deny")
          if (!denied) return
          event.effect = "deny"
          event.message = denied.message
        }),
      Effect.sync(() => {
        const current = policies().filter((policy) => policy.action === "tool.use")
        // Only a later blanket allow can prove all earlier query restrictions obsolete.
        // Other wildcard coverage is conservatively unresolved, never an authorization.
        const blanket = current.findLastIndex(
          (policy) => policy.effect === "allow" && (policy.resource === "*" || policy.resource === "websearch:*"),
        )
        return !current.slice(blanket + 1).some((policy) => {
          if (policy.effect !== "deny") return false
          const colon = policy.resource.indexOf(":")
          if (colon < 0) return true
          const action = policy.resource.slice(0, colon)
          // Wildcards match across ':' too (e.g. '*private:*' can match a query
          // containing 'private:'). Only a literal unrelated action is disjoint.
          return action.includes("*") || action.includes("?") || Wildcard.match("websearch", action)
        })
      }),
    )
  }),
})
