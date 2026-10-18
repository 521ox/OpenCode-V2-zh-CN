import { expect } from "bun:test"
import { Deferred, Effect, Fiber, Layer, Queue, Scope, Sink, Stream } from "effect"
import { ChildProcessSpawner } from "effect/process"
import { ExitCode, makeHandle, ProcessId } from "effect/process/ChildProcessSpawner"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Bus } from "@opencode/core/bus"
import { Config } from "@opencode/core/config"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { AbsolutePath } from "@opencode/core/schema"
import { Shell } from "@opencode/core/shell"
import { Workspace } from "@opencode/core/workspace"
import { Event } from "@opencode/schema/shell"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { hostEnvironmentLayer } from "./fixture/environment"
import { tempGlobalLayer } from "./fixture/global"
import { location, tempLocationLayer } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { it } from "./lib/effect"

it.live("eviction makes progress past an already-removed shell", () =>
  Effect.gen(function* () {
    const completions = yield* Queue.unbounded<Effect.Effect<void>>()
    const environment = Layer.effect(
      Environment.Service,
      Effect.gen(function* () {
        const host = yield* Environment.Service
        const scope = yield* Scope.Scope
        return Environment.Service.of({
          ...host,
          spawner: ChildProcessSpawner.make(() =>
            Effect.gen(function* () {
              const exited = yield* Deferred.make<ExitCode>()
              const observer = yield* Deferred.make<Fiber.Fiber<unknown, unknown>>()
              yield* Queue.offer(
                completions,
                Effect.gen(function* () {
                  yield* Deferred.succeed(exited, ExitCode(0))
                  // Shell.wait resolves before retention runs; join the whole exit handler instead.
                  const fiber = yield* Deferred.await(observer)
                  yield* Fiber.join(fiber).pipe(Effect.orDie)
                }),
              )
              const output = Stream.succeed(Buffer.from("hello"))
              return makeHandle({
                pid: ProcessId(1),
                exitCode: Effect.withFiber((fiber) =>
                  Scope.addFinalizer(scope, Fiber.interrupt(fiber)).pipe(
                    Effect.andThen(Deferred.succeed(observer, fiber)),
                    Effect.andThen(Deferred.await(exited)),
                  ),
                ),
                isRunning: Deferred.isDone(exited).pipe(Effect.map((done) => !done)),
                kill: () => Deferred.succeed(exited, ExitCode(0)).pipe(Effect.asVoid),
                stdin: Sink.drain,
                stdout: output,
                stderr: Stream.empty,
                all: output,
                getInputFd: () => Sink.drain,
                getOutputFd: () => Stream.empty,
                unref: Effect.succeed(Effect.void),
              })
            }),
          ),
        })
      }),
    ).pipe(Layer.provide(hostEnvironmentLayer))

    yield* Effect.gen(function* () {
      const shell = yield* Shell.Service
      const removed = yield* shell.create({ shell: "sh", command: "removed", timeout: 0 })
      const finishRemoved = yield* Queue.take(completions)
      yield* shell.remove(removed.id)
      expect((yield* shell.result(removed)).capture).toBeUndefined()
      yield* finishRemoved

      const complete = Effect.gen(function* () {
        const info = yield* shell.create({ shell: "sh", command: "hello", timeout: 0 })
        const finish = yield* Queue.take(completions)
        yield* finish
        return info
      })
      const oldest = yield* complete
      // Exceed the 25-entry retention cap with the removed ID at the head of exitOrder.
      yield* Effect.forEach(Array.from({ length: 25 }), () => complete, { discard: true })
      expect(yield* shell.get(oldest.id).pipe(Effect.flip)).toBeInstanceOf(Shell.NotFoundError)

      const survivor = yield* complete
      expect(yield* shell.result(survivor)).toMatchObject({
        info: { status: "exited", exit: 0 },
        capture: { output: "hello", truncated: false },
      })
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(Shell.node, [
          Location.node.replace(tempLocationLayer),
          Global.node.replace(tempGlobalLayer),
          Config.node.replace(Config.testLayer()),
          Environment.node.replace(environment),
        ]),
      ),
    )
  }),
)

it.live("publishes shell completion only after captured output is complete", () =>
  Effect.gen(function* () {
    const exited = yield* Deferred.make<ExitCode>()
    const observed = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const output = Stream.concat(
      Stream.succeed(Buffer.from("first\n")),
      Stream.fromEffect(Deferred.await(release).pipe(Effect.as(Buffer.from("last\n")))),
    )
    const environment = Layer.effect(
      Environment.Service,
      Effect.gen(function* () {
        const host = yield* Environment.Service
        return Environment.Service.of({
          ...host,
          spawner: ChildProcessSpawner.make(() =>
            Effect.succeed(
              makeHandle({
                pid: ProcessId(1),
                exitCode: Deferred.await(exited).pipe(Effect.tap(() => Deferred.succeed(observed, undefined))),
                isRunning: Deferred.isDone(exited).pipe(Effect.map((done) => !done)),
                kill: () => Deferred.succeed(exited, ExitCode(7)).pipe(Effect.asVoid),
                stdin: Sink.drain,
                stdout: output,
                stderr: Stream.empty,
                all: output,
                getInputFd: () => Sink.drain,
                getOutputFd: () => Stream.empty,
                unref: Effect.succeed(Effect.void),
              }),
            ),
          ),
        })
      }),
    ).pipe(Layer.provide(hostEnvironmentLayer))
    yield* Effect.gen(function* () {
      const shell = yield* Shell.Service
      const bus = yield* Bus.Service
      const notified = yield* Deferred.make<void>()
      const statuses: string[] = []
      yield* bus.subscribe(Event.Exited).pipe(
        Stream.runForEach((event) =>
          Effect.sync(() => statuses.push(event.data.status)).pipe(
            Effect.andThen(Deferred.succeed(notified, undefined)),
          ),
        ),
        Effect.forkScoped({ startImmediately: true }),
      )
      const started = yield* shell.create({ shell: "sh", command: "controlled capture", timeout: 0 })
      const waiting = yield* shell.wait(started.id).pipe(Effect.forkScoped({ startImmediately: true }))
      yield* Deferred.succeed(exited, ExitCode(7))
      yield* Deferred.await(observed)
      yield* Effect.yieldNow
      expect((yield* shell.get(started.id)).status).toBe("running")
      expect(waiting.pollUnsafe()).toBeUndefined()
      expect(statuses).toEqual([])
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(waiting)).toMatchObject({ status: "exited", exit: 7 })
      yield* Deferred.await(notified)
      expect(statuses).toEqual(["exited"])
      expect(yield* shell.result(started)).toMatchObject({
        info: { status: "exited", exit: 7 },
        capture: { output: "first\nlast\n", truncated: false },
      })
    }).pipe(
      Effect.ensuring(Deferred.succeed(exited, ExitCode(7)).pipe(Effect.andThen(Deferred.succeed(release, undefined)))),
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Shell.node, Bus.node]), [
          Location.node.replace(tempLocationLayer),
          Global.node.replace(tempGlobalLayer),
          Config.node.replace(Config.testLayer()),
          Environment.node.replace(environment),
        ]),
      ),
    )
  }),
)

it.live("does not inherit host process.env when creating a shell in a workspace-backed location", () =>
  Effect.gen(function* () {
    const tmp = yield* tmpdirScoped()
    let capturedEnv: Record<string, string | undefined> | undefined
    yield* Effect.gen(function* () {
      const shell = yield* Shell.Service
      const info = yield* shell.create({ shell: "/bin/sh", command: "printf ok", timeout: 0 }, (invocation) =>
        Effect.sync(() => {
          capturedEnv = { ...invocation.env }
        }),
      )
      expect(yield* shell.result(info)).toMatchObject({
        info: { status: "exited" },
      })
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(Shell.node, [
          Location.node.replace(
            Layer.succeed(
              Location.Service,
              Location.Service.of(
                location(
                  Location.Ref.make({
                    directory: AbsolutePath.make(tmp.path),
                    workspaceID: Workspace.ID.make("wrk_workspace"),
                  }),
                ),
              ),
            ),
          ),
          Global.node.replace(tempGlobalLayer),
          Config.node.replace(Config.testLayer()),
          Environment.node.replace(hostEnvironmentLayer),
        ]),
      ),
    )

    expect(process.env.PATH).toBeDefined()
    expect(capturedEnv).toEqual({
      TERM: "xterm-256color",
      OPENCODE_TERMINAL: "1",
    })
  }),
)
