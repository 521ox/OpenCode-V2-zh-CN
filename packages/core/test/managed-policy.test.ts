import { expect } from "bun:test"
import { ManagedPolicy } from "@opencode/core/managed-policy"
import { Deferred, Effect, Fiber, Stream } from "effect"
import { drain } from "./lib/clock"
import { testEffect } from "./lib/effect"

const it = testEffect(ManagedPolicy.layer)

it.effect("accepted Console commits notify once while stale results and same-connection failures stay silent", () =>
  Effect.gen(function* () {
    const managed = yield* ManagedPolicy.Service
    const changes: ManagedPolicy.State[] = []
    yield* managed.changes().pipe(
      Stream.runForEach(() => Effect.sync(() => changes.push(managed.current()))),
      Effect.forkScoped({ startImmediately: true }),
    )
    const policy: ManagedPolicy.State = {
      organization: "Acme",
      statements: [{ action: "tool.use", resource: "websearch:*", effect: "deny" }],
    }
    const active = Effect.succeed("current")
    yield* managed.commit({ connection: "current", active, policy })
    yield* drain
    expect(changes).toEqual([policy])
    yield* managed.commit({ connection: "current", active, policy: { ...policy, statements: [...policy.statements] } })
    yield* managed.commit({ connection: "current", active })
    yield* managed.commit({ connection: "old", active, policy: { statements: [] } })
    yield* drain
    expect(managed.current()).toEqual(policy)
    expect(changes).toEqual([policy])
    yield* managed.commit({ connection: undefined, active: Effect.undefined, policy: { statements: [] } })
    yield* drain
    expect(managed.current()).toEqual({ statements: [] })
    expect(changes).toEqual([policy, { statements: [] }])
  }),
)

it.effect("serializes an asynchronous authority read with publication across Locations", () =>
  Effect.gen(function* () {
    const managed = yield* ManagedPolicy.Service
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const old = yield* managed
      .commit({
        connection: "old",
        active: Effect.gen(function* () {
          yield* Deferred.succeed(entered, undefined)
          yield* Deferred.await(release)
          return "old"
        }),
        policy: { organization: "Old", statements: [] },
      })
      .pipe(Effect.forkScoped)
    yield* Deferred.await(entered)
    const next = yield* managed
      .commit({
        connection: "new",
        active: Effect.succeed("new"),
        policy: { organization: "New", statements: [] },
      })
      .pipe(Effect.forkScoped)
    yield* drain
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(old)
    yield* Fiber.join(next)
    expect(managed.current()).toEqual({ organization: "New", statements: [] })
  }),
)
