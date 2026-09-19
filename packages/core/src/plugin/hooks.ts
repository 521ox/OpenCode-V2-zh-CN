export * as PluginHooks from "./hooks.js"

import type { AISDKHooks } from "@opencode/plugin/effect/aisdk"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import type { ShellHooks } from "@opencode/plugin/effect/shell"
import type { ToolFailures, ToolHooks } from "@opencode/plugin/effect/tool"
import type { ModelHookOptions } from "@opencode/plugin/effect/registration"
import type { PermissionHooks } from "@opencode/plugin/effect/permission"
import { Context, Effect, Layer, Scope } from "effect"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { State } from "../state.js"

export interface Domains {
  readonly aisdk: AISDKHooks
  readonly session: SessionHooks
  readonly permission: PermissionHooks
  readonly shell: ShellHooks
  readonly tool: ToolHooks
}

type NoFailures<Spec> = { readonly [Name in keyof Spec]: never }

// Failure channel for each hook event. Only tool execute.before may fail: a Tool.Error rejects the call before it runs.
interface Failures extends Record<keyof Domains, unknown> {
  readonly aisdk: NoFailures<AISDKHooks>
  readonly session: NoFailures<SessionHooks>
  readonly permission: NoFailures<PermissionHooks>
  readonly shell: NoFailures<ShellHooks>
  readonly tool: ToolFailures
}

type Callback<Event, Error> = (event: Event) => Effect.Effect<void, Error>
type Entry = {
  readonly callback: Function
  readonly options?: ModelHookOptions
  readonly hostedSearch?: Effect.Effect<boolean>
}

const eventProviderID = (event: unknown) => {
  if (typeof event !== "object" || event === null || !("model" in event)) return undefined
  const model = event.model
  if (typeof model !== "object" || model === null || !("providerID" in model)) return undefined
  return typeof model.providerID === "string" ? model.providerID : undefined
}

export interface Interface {
  /** Core-only adapter for configuration policy; not exposed through the public plugin host. */
  readonly registerPermissionPolicy: (
    callback: Callback<PermissionHooks["evaluate"], never>,
    hostedSearch: Effect.Effect<boolean>,
  ) => Effect.Effect<State.Registration, never, Scope.Scope>
  readonly allowsHostedSearch: Effect.Effect<boolean>
  readonly has: <Domain extends keyof Domains>(
    domain: Domain,
    name: keyof Domains[Domain] & keyof Failures[Domain],
    providerID?: string,
  ) => Effect.Effect<boolean>
  readonly register: <Domain extends keyof Domains, Name extends keyof Domains[Domain] & keyof Failures[Domain]>(
    domain: Domain,
    name: Name,
    callback: Callback<Domains[Domain][Name], Failures[Domain][Name]>,
    options?: ModelHookOptions,
  ) => Effect.Effect<State.Registration, never, Scope.Scope>
  readonly trigger: <Domain extends keyof Domains, Name extends keyof Domains[Domain] & keyof Failures[Domain]>(
    domain: Domain,
    name: Name,
    event: Domains[Domain][Name],
  ) => Effect.Effect<Domains[Domain][Name], Failures[Domain][Name]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/PluginHooks") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const callbacks = new Map<string, Entry[]>()
    const key = (domain: keyof Domains, name: PropertyKey) => `${domain}.${String(name)}`

    const registerEntry = Effect.fn("PluginHooks.register")(function* (
      domain: keyof Domains,
      name: PropertyKey,
      entry: Entry,
    ) {
      const scope = yield* Scope.Scope
      const id = key(domain, name)
      let active = true
      callbacks.set(id, [...(callbacks.get(id) ?? []), entry])
      const dispose = Effect.sync(() => {
        if (!active) return
        active = false
        const next = (callbacks.get(id) ?? []).filter((item) => item !== entry)
        if (next.length === 0) callbacks.delete(id)
        else callbacks.set(id, next)
      })
      yield* Scope.addFinalizer(scope, dispose)
      return { dispose }
    })
    const register: Interface["register"] = (domain, name, callback, options) =>
      registerEntry(domain, name, { callback, options })

    const trigger: Interface["trigger"] = Effect.fnUntraced(function* (domain, name, event) {
      for (const entry of callbacks.get(key(domain, name)) ?? []) {
        if (entry.options?.providerID !== undefined && entry.options.providerID !== eventProviderID(event)) continue
        const result: Effect.Effect<void, Failures[typeof domain][typeof name]> = entry.callback(event)
        yield* result
      }
      return event
    })

    const has: Interface["has"] = (domain, name, providerID) =>
      Effect.sync(() =>
        (callbacks.get(key(domain, name)) ?? []).some(
          (entry) => entry.options?.providerID === undefined || entry.options.providerID === providerID,
        ),
      )

    const registerPermissionPolicy: Interface["registerPermissionPolicy"] = (callback, hostedSearch) =>
      registerEntry("permission", "evaluate", { callback, hostedSearch })
    const allowsHostedSearch = Effect.gen(function* () {
      for (const entry of callbacks.get(key("permission", "evaluate")) ?? []) {
        // Permission events have no model/provider discriminator.
        if (entry.options?.providerID !== undefined) continue
        if (!entry.hostedSearch || !(yield* entry.hostedSearch)) return false
      }
      return true
    })

    return Service.of({ has, register, trigger, registerPermissionPolicy, allowsHostedSearch })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [] })
