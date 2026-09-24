import { expect } from "bun:test"
import { Effect } from "effect"
import { TestClock } from "effect/testing"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "../../core/test/lib/effect"
import { ServerPairing } from "../src/pairing"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([ServerPairing.node])))

it.effect("pairing codes expire at the advertised five-minute boundary", () =>
  Effect.gen(function* () {
    const pairing = yield* ServerPairing.Service
    const before = yield* pairing.issue()
    const expired = yield* pairing.issue()
    expect(before.expires_in).toBe(300)
    expect(expired.expires_in).toBe(300)
    yield* TestClock.adjust("299999 millis")
    expect(yield* pairing.consume(before.code)).toBe(true)
    yield* TestClock.adjust("1 millis")
    expect(yield* pairing.consume(expired.code)).toBe(false)
    expect(yield* pairing.consume(before.code)).toBe(false)
  }),
)

it.effect("concurrent pairing redemption consumes a code only once", () =>
  Effect.gen(function* () {
    const pairing = yield* ServerPairing.Service
    const issued = yield* pairing.issue()
    const outcomes = yield* Effect.all(
      Array.from({ length: 16 }, () => pairing.consume(issued.code)),
      { concurrency: "unbounded" },
    )
    expect(outcomes.filter(Boolean)).toHaveLength(1)
    expect(yield* pairing.consume(issued.code)).toBe(false)
    expect(yield* pairing.consume("unknown-fixture-code")).toBe(false)
  }),
)
