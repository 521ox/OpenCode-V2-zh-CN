export * as ManagedPolicy from "./managed-policy.js"

import { ConfigPolicy } from "@opencode/schema/config/policy"
import { Context, Effect, Layer } from "effect"
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
  /** A failed fetch retains only the current connection's last successful policy. */
  readonly retain: (connection: string | undefined) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ManagedPolicy") {}

const layer = Layer.sync(Service, () => {
  const state: { current: State; connection?: string } = { current: { statements: [] } }
  return Service.of({
    current: () => state.current,
    set: (next, connection) =>
      Effect.sync(() => {
        state.current = next
        state.connection = connection
      }),
    retain: (connection) =>
      Effect.sync(() => {
        if (state.connection === connection) return
        state.current = { statements: [] }
        state.connection = connection
      }),
  })
})

export const node = makeGlobalNode({ service: Service, layer, deps: [] })
