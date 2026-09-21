export * as ConfigPolicyPlugin from "./policy.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Document } from "@opencode/schema/config"
import { Effect } from "effect"
import { Config } from "../../config.js"
import { PluginHooks } from "../../plugin/hooks.js"
import { ManagedPolicy } from "../../managed-policy.js"
import { Wildcard } from "../../util/wildcard.js"
import { ConfigEntryObserver } from "./entry-observer.js"

export const Plugin = define({
  id: "opencode.config.policy",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const hooks = yield* PluginHooks.Service
    const managed = yield* ManagedPolicy.Service
    const loaded = yield* ConfigEntryObserver.observe(config, ctx.event, ctx.provider.reload())
    // Authored documents reverse so user-global policy outranks repository policy; organization statements
    // from the connected Console follow every authored one and have the final say.
    const policies = () => {
      const organization = managed.current()
      return [
        ...loaded.entries
          .filter((entry): entry is Document => entry.type === "document")
          .toReversed()
          .flatMap((entry) => entry.info.experimental?.policies ?? [])
          .map((policy) => ({ ...policy, message: "Blocked by configuration policy" })),
        ...organization.statements.map((policy) => ({
          ...policy,
          message: organization.organization
            ? `Blocked by ${organization.organization}'s policy`
            : "Blocked by your organization's policy",
        })),
      ]
    }
    yield* ctx.provider.transform((providers) => {
      const current = policies()
      for (const record of providers.list()) {
        const policy = current.findLast(
          (policy) => policy.action === "provider.use" && Wildcard.match(record.provider.id, policy.resource),
        )
        if (policy?.effect === "deny") providers.remove(record.provider.id)
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
                  policy.action === "permission" && Wildcard.match(`${event.action}:${resource}`, policy.resource),
              ),
            )
            .find((policy) => policy?.effect === "deny")
          if (!denied) return
          event.effect = "deny"
          event.message = denied.message
        }),
      Effect.sync(() => {
        const current = policies().filter((policy) => policy.action === "permission")
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
