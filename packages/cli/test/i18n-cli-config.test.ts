import { NodeFileSystem } from "@effect/platform-node"
import { Global } from "@opencode/util/global"
import { Effect } from "effect"
import { expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../src/config"
import { tmpdir } from "./fixture/tmpdir"

test("bootstrap locale does no file load; successful config reads and updates own its projection", async () => {
  await using directory = await tmpdir()
  const file = path.join(directory.path, "cli.json")
  const before = '{"locale":"en","animations":false}\n'
  await Bun.write(file, before)
  await Effect.runPromise(
    Effect.gen(function* () {
      const config = yield* Config.Service
      expect(config.locale()).toBe("zh")
      expect(yield* Effect.promise(() => Bun.file(file).text())).toBe(before)
      yield* config.get()
      expect(config.locale()).toBe("en")
      yield* config.update((draft) => {
        draft.locale = "zh-CN"
      })
      expect(config.locale()).toBe("zh")
      expect(yield* Effect.promise(() => Bun.file(file).json())).toMatchObject({ locale: "zh-CN", animations: false })
    }).pipe(
      Effect.provide(Config.layer),
      Effect.provide(Global.layerWith({ config: directory.path, state: directory.path })),
      Effect.provide(NodeFileSystem.layer),
    ),
  )
})

test("already-decoded inline locale is available before a disk read and retains precedence", async () => {
  await using directory = await tmpdir()
  const previous = process.env.OPENCODE_CLI_CONFIG_CONTENT
  process.env.OPENCODE_CLI_CONFIG_CONTENT = '{"locale":"en"}'
  try {
    await Bun.write(path.join(directory.path, "cli.json"), '{"locale":"zh"}')
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config.Service
        expect(config.locale()).toBe("en")
        yield* config.get()
        expect(config.locale()).toBe("en")
        yield* config.update((draft) => {
          draft.locale = "zh"
        })
        expect(config.locale()).toBe("en")
      }).pipe(
        Effect.provide(Config.layer),
        Effect.provide(Global.layerWith({ config: directory.path, state: directory.path })),
        Effect.provide(NodeFileSystem.layer),
      ),
    )
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CLI_CONFIG_CONTENT
    else process.env.OPENCODE_CLI_CONFIG_CONTENT = previous
  }
})

test("legacy tab normalization and locale projection preserve their independent precedence", async () => {
  await using directory = await tmpdir()
  const file = path.join(directory.path, "cli.json")
  const before = { locale: "zh", tabs: { mode: "on", scope: "global" } }
  const previous = process.env.OPENCODE_CLI_CONFIG_CONTENT
  await Bun.write(file, JSON.stringify(before))
  process.env.OPENCODE_CLI_CONFIG_CONTENT = JSON.stringify({ locale: "en", tabs: { enabled: false } })
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config.Service
        expect(config.locale()).toBe("en")
        const loaded = yield* config.get()
        expect(loaded.tabs).toEqual({ mode: "off", scope: "global" })
        expect(loaded.locale).toBe("en")
        expect(yield* Effect.promise(() => Bun.file(file).json())).toEqual(before)
        const updated = yield* config.update((draft) => {
          draft.locale = "zh"
          draft.animations = false
        })
        expect(updated.locale).toBe("en")
        expect(updated.tabs).toEqual({ mode: "off", scope: "global" })
        expect(config.locale()).toBe("en")
        expect(yield* Effect.promise(() => Bun.file(file).json())).toEqual({ ...before, animations: false })
      }).pipe(
        Effect.provide(Config.layer),
        Effect.provide(Global.layerWith({ config: directory.path, state: directory.path })),
        Effect.provide(NodeFileSystem.layer),
      ),
    )
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CLI_CONFIG_CONTENT
    else process.env.OPENCODE_CLI_CONFIG_CONTENT = previous
  }
})
