export * as ManagedPolicy from "./managed-policy.js"

import { ConfigPolicy } from "@opencode/schema/config/policy"
import { Context, Effect, Layer, Semaphore } from "effect"
import { makeGlobalNode } from "@opencode/util/effect/app-node"

/** Policy statements the connected OpenCode Console compiled for whoever it authenticated. */
export interface State {
  readonly statements: ReadonlyArray<ConfigPolicy.Info>
  /** Organization name for denial messages, when the connection knows it. */
  readonly organization?: string
}

export interface Interface {
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

const layer = Layer.sync(Service, () => {
  const state: { current: State; connection?: string } = { current: { statements: [] } }
  const committing = Semaphore.makeUnsafe(1)
  return Service.of({
    current: () => state.current,
    set: (next, connection) =>
      Effect.sync(() => {
        state.current = next
        state.connection = connection
      }),
    commit: (input) =>
      committing.withPermit(
        Effect.gen(function* () {
          // Serialize the asynchronous authority read with publication across Locations.
          // A late old-connection result cannot overwrite an already accepted new policy.
          if ((yield* input.active) !== input.connection) return
          if (!input.policy && state.connection === input.connection) return
          state.current = input.policy ?? { statements: [] }
          state.connection = input.connection
        }),
      ),
  })
})

export const node = makeGlobalNode({ service: Service, layer, deps: [] })
