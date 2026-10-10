export * as ConfigPolicyPlugin from "./policy.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect, Stream } from "effect"
import { Config } from "../../config.js"
import { PluginHooks } from "../../plugin/hooks.js"
import { ManagedPolicy } from "../../managed-policy.js"
import { State } from "../../state.js"
import { Wildcard } from "../../util/wildcard.js"
import { ConfigEntryObserver } from "./entry-observer.js"

export const Plugin = define({
  id: "opencode.config.policy",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const hooks = yield* PluginHooks.Service
    const managed = yield* ManagedPolicy.Service
    const reload = State.batch(
      Effect.all([ctx.provider.reload(), ctx.mcp.reload(), ctx.skill.reload()], { discard: true }),
    )
    const loaded = yield* ConfigEntryObserver.observe(config, ctx.event, reload)
    yield* managed.changes().pipe(
      Stream.runForEach(() => reload),
      Effect.forkScoped({ startImmediately: true }),
    )
    // Authored documents reverse so user-global policy outranks repository policy; organization statements
    // from the connected Console follow every authored one and have the final say.
    const policies = () => ManagedPolicy.statements(loaded.entries, managed.current())
    yield* ctx.provider.transform((providers) => {
      const current = policies()
      for (const record of providers.list()) {
        const policy = current.findLast(
          (policy) => policy.action === "provider.use" && Wildcard.match(record.provider.id, policy.resource),
        )
        if (policy?.effect === "deny") providers.remove(record.provider.id)
      }
    })
    yield* ctx.mcp.transform((servers) => {
      const current = policies()
      for (const [name] of servers.list()) {
        if (ManagedPolicy.decision(current, "integration.use", `mcp:${name}`) === "deny") servers.remove(name)
      }
    })
    yield* ctx.skill.transform((skills) => {
      const current = policies()
      for (const skill of skills.list()) {
        if (ManagedPolicy.decision(current, "integration.use", `skill:${skill.id}`) === "deny") skills.remove(skill.id)
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
