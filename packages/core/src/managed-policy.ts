export * as ManagedPolicy from "./managed-policy.js"

import { Document, type Entry } from "@opencode/schema/config"
import { isDeepStrictEqual } from "node:util"
import { Wildcard } from "./util/wildcard.js"
import { ConfigPolicy } from "@opencode/schema/config/policy"
import { Context, Effect, Layer, PubSub, Semaphore, Stream } from "effect"
import { makeGlobalNode } from "@opencode/util/effect/app-node"

/** Policy statements the connected OpenCode Console compiled for whoever it authenticated. */
export interface State {
  readonly statements: ReadonlyArray<ConfigPolicy.Info>
  /** Organization name for denial messages, when the connection knows it. */
  readonly organization?: string
}

export interface Interface {
  readonly changes: () => Stream.Stream<void>
  /** Synchronous so catalog transforms can consult the statements while they run. */
  readonly current: () => State
  /** Replaces the whole state; statements never merge across connections. */
  readonly set: (state: State, connection?: string) => Effect.Effect<void>
  /** Revalidate the authoritative connection and publish under one process-global permit. */
  readonly commit: (input: {
    readonly connection: string | undefined
    readonly active: Effect.Effect<string | undefined>
    /** Omitted on fetch failure: retain only this connection's last successful policy. */
    readonly policy?: State
  }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ManagedPolicy") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const changes = yield* PubSub.unbounded<void>()
    const state: { current: State; connection?: string } = { current: { statements: [] } }
    const committing = Semaphore.makeUnsafe(1)
    const publish = (next: State, connection?: string) =>
      Effect.gen(function* () {
        const changed =
          state.current.organization !== next.organization ||
          !isDeepStrictEqual(state.current.statements, next.statements)
        state.current = next
        state.connection = connection
        if (changed) yield* PubSub.publish(changes, undefined)
      })
    return Service.of({
      changes: () => Stream.fromPubSub(changes),
      current: () => state.current,
      set: (next, connection) => committing.withPermit(publish(next, connection)),
      commit: (input) =>
        committing.withPermit(
          Effect.gen(function* () {
            // The authority read and publication must serialize across Locations.
            if ((yield* input.active) !== input.connection) return
            if (!input.policy && state.connection === input.connection) return
            yield* publish(input.policy ?? { statements: [] }, input.connection)
          }),
        ),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })

export function statements(entries: readonly Entry[], organization: State) {
  return [
    ...entries
      .filter((entry): entry is Document => entry.type === "document")
      .toReversed()
      .flatMap((entry) => entry.info.policies ?? [])
      .map((policy) => ({ ...policy, message: "Blocked by configuration policy" })),
    ...organization.statements.map((policy) => ({
      ...policy,
      message: organization.organization
        ? `Blocked by ${organization.organization}'s policy`
        : "Blocked by your organization's policy",
    })),
  ]
}

export function decision(
  policies: readonly ConfigPolicy.Info[],
  action: ConfigPolicy.Info["action"],
  resource: string,
) {
  return (
    policies.findLast((policy) => policy.action === action && Wildcard.match(resource, policy.resource))?.effect ??
    "allow"
  )
}
