import { mock } from "bun:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { Cause, Effect, Exit, PlatformError, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"

const mode = process.argv[2]
const combined = process.argv[3] === "true"
const stdout = new PassThrough()
const stderr = new PassThrough()
const child = Object.assign(new EventEmitter(), {
  pid: 987654321,
  stdin: null,
  stdout,
  stderr,
  stdio: [],
  kill: () => true,
})

// Only native launch is synthetic; production capture, streams and scopes are real.
mock.module("cross-spawn", () => ({
  default: () => {
    setTimeout(() => {
      child.emit("spawn")
      setTimeout(() => {
        stdout.write("stdout-before-close")
        stderr.write("stderr-before-close")
        child.emit("exit", 0, null)
        if (mode === "end") {
          stdout.end()
          stderr.end()
        } else {
          stdout.destroy(mode === "error" ? new Error("source failure") : undefined)
          stderr.destroy()
        }
        setTimeout(() => child.emit("close", 0, null), 10)
      }, 20)
    }, 0)
    return child
  },
}))

const { CrossSpawnSpawner } = await import("@opencode/util/cross-spawn-spawner")
const { LayerNode } = await import("@opencode/util/effect/layer-node")
const watchdog = setTimeout(() => process.exit(124), 7_000)
try {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("synthetic-capture-source")
      if (mode !== "error") assert.equal(yield* handle.exitCode, 0)
      const output: Effect.Effect<string | [string, string], PlatformError.PlatformError> = combined
        ? Stream.mkString(Stream.decodeText(handle.all))
        : Effect.all(
            [Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr))],
            { concurrency: "unbounded" },
          )
      return yield* output.pipe(Effect.timeout("1800 millis"), Effect.exit)
    }).pipe(Effect.scoped, Effect.provide(LayerNode.compile(CrossSpawnSpawner.node))),
  )
  if (mode === "error") {
    assert(Exit.isFailure(result))
    const error = Cause.squash(result.cause)
    assert(error instanceof PlatformError.PlatformError)
    assert.equal(error.reason.method, "fromReadable(stdout)")
  } else {
    assert(Exit.isSuccess(result), "capture must finish without the diagnostic timeout")
    if (combined) {
      assert.equal(typeof result.value, "string")
      assert(result.value.includes("stdout-before-close"))
      assert(result.value.includes("stderr-before-close"))
      assert.equal(result.value.length, "stdout-before-closestderr-before-close".length)
    } else {
      assert.deepEqual(result.value, ["stdout-before-close", "stderr-before-close"])
    }
  }
  assert(stdout.destroyed && stderr.destroyed)
  console.log("capture settled")
} finally {
  clearTimeout(watchdog)
  stdout.destroy()
  stderr.destroy()
  mock.restore()
}
