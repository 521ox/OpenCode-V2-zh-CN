import { describe, expect, test } from "bun:test"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { EnvironmentToolsCatalog } from "../src/environment-tools/catalog.js"
import { Permission } from "../src/permission.js"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { tmpdir } from "./fixture/tmpdir"

const environmentID = "11111111-1111-4111-8111-111111111111"
const layers = (root: string) =>
  Layer.mergeAll(
    Global.layerWith({
      config: path.join(root, "config"),
      state: path.join(root, "state"),
      data: path.join(root, "data"),
      cache: path.join(root, "cache"),
      tmp: path.join(root, "tmp"),
    }),
    FSUtil.layer.pipe(Layer.provide(NodeFileSystem.layer)),
  )
const run = <A, E>(root: string, effect: Effect.Effect<A, E, FSUtil.Service | Global.Service>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layers(root))))
const executable = async (root: string, name: string, content = name) => {
  await mkdir(path.join(root, "bin"), { recursive: true })
  const file = path.join(root, "bin", name)
  await writeFile(file, content)
  return realpath(file)
}

describe("environment tools catalog v1", () => {
  test("missing catalog is empty memory and creates an opaque stable installation identity", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const result = await run(
      tmp.path,
      Effect.gen(function* () {
        const first = yield* EnvironmentToolsCatalog.make()
        const second = yield* EnvironmentToolsCatalog.make()
        return {
          search: yield* first.search("not-installed-is-not-proven"),
          a: yield* first.read(),
          b: yield* second.read(),
          file: first.file,
        }
      }),
    )
    expect(result.search.matches).toEqual([])
    expect(result.a.environment.id).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
    expect(result.a.environment.id).toBe(result.b.environment.id)
    expect(await Bun.file(result.file).exists()).toBe(false)
  })

  test("reads a preexisting v1 document and preserves stable IDs through replacement", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const first = await executable(tmp.path, "git.exe")
    const replacement = await executable(tmp.path, "git-new.exe")
    const identity = { size: 7, modifiedAt: "2026-08-17T10:00:00.000Z" }
    const entry: EnvironmentToolsCatalog.Entry = {
      id: `${environmentID}:git`,
      name: "git",
      aliases: ["git.exe"],
      path: first,
      kind: "native",
      launcher: null,
      capabilities: ["version-control"],
      directExec: true,
      source: "resolved",
      discoveredAt: identity.modifiedAt,
      lastVerifiedAt: identity.modifiedAt,
      lastUsedAt: null,
      status: "active",
      identity,
      staleReason: null,
    }
    await mkdir(path.join(tmp.path, "config"))
    await writeFile(
      path.join(tmp.path, "config", EnvironmentToolsCatalog.filename),
      JSON.stringify({
        schemaVersion: 1,
        environment: { id: environmentID, os: process.platform },
        tools: { git: entry },
      }),
    )
    const result = await run(
      tmp.path,
      Effect.gen(function* () {
        const catalog = yield* EnvironmentToolsCatalog.make({
          environmentID,
          probe: () => Effect.succeed({ kind: "file", identity }),
        })
        const loaded = yield* catalog.resolveExecutable(entry.id)
        const updated = yield* catalog.upsert({
          name: "Git.cmd.exe",
          path: replacement,
          source: "successful_execution",
        })
        return { loaded, updated, document: yield* catalog.read() }
      }),
    )
    expect(result.loaded).toEqual(entry)
    expect(result.updated.entry.id).toBe(entry.id)
    expect(result.updated.entry.path).toBe(replacement)
    expect(Object.keys(result.document.tools)).toEqual(["git"])
    const saved = [{ action: "direct_exec", resource: entry.id, effect: "allow" as const }]
    expect(Permission.evaluate("direct_exec", result.updated.entry.id, saved).effect).toBe("allow")
    expect(Permission.evaluate("direct_exec", `${environmentID}:bun`, saved).effect).toBe("ask")
  })

  test("normalizes duplicate program names, metadata and concurrent updates without lost writes", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const git = await executable(tmp.path, "git.exe")
    const bun = await executable(tmp.path, "bun.exe")
    const result = await run(
      tmp.path,
      Effect.gen(function* () {
        const a = yield* EnvironmentToolsCatalog.make({ environmentID })
        const b = yield* EnvironmentToolsCatalog.make({ environmentID })
        yield* Effect.all(
          [
            a.upsert({
              name: " Git.cmd.exe ",
              path: git,
              source: "resolved",
              capabilities: ["Version Control", "version-control"],
            }),
            b.upsert({ name: "bun", path: bun, source: "resolved" }),
            b.upsert({ name: "git", path: git, source: "resolved" }),
          ],
          { concurrency: "unbounded" },
        )
        return yield* a.read()
      }),
    )
    expect(Object.keys(result.tools)).toEqual(["bun", "git"])
    expect(result.tools.git.id).toBe(`${environmentID}:git`)
    expect(result.tools.git.capabilities).toEqual(["version-control"])
    expect(EnvironmentToolsCatalog.normalizeName("foo.cmd.exe")).toBe("foo")
  })

  test("names-only discovery is sorted and never probes binaries, including stale entries", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const zeta = await executable(tmp.path, "zeta.exe")
    const alpha = await executable(tmp.path, "alpha.exe")
    const names = await run(
      tmp.path,
      Effect.gen(function* () {
        const writer = yield* EnvironmentToolsCatalog.make({ environmentID })
        yield* writer.upsert({ name: "zeta", path: zeta, source: "resolved" })
        const entry = yield* writer.upsert({ name: "alpha", path: alpha, source: "resolved" })
        yield* writer.invalidate({ id: entry.entry.id, reason: "user_requested" })
        const reader = yield* EnvironmentToolsCatalog.make({
          environmentID,
          probe: () => Effect.die("names must not probe"),
        })
        return yield* reader.listNames()
      }),
    )
    expect(names).toEqual({ operation: "search", mode: "all", count: 2, names: ["alpha", "zeta"] })
  })

  test.each(["bad-json", "foreign-id", "foreign-os", "forged-kind", "forged-id", "wildcard", "invalid-time"])(
    "fails closed without overwriting %s",
    async (mutation) => {
      await using tmp = await tmpdir("e1-catalog-")
      const file = await executable(tmp.path, "npm.cmd")
      await run(
        tmp.path,
        Effect.gen(function* () {
          const catalog = yield* EnvironmentToolsCatalog.make({ environmentID })
          yield* catalog.upsert({ name: "npm", path: file, source: "resolved" })
        }),
      )
      const catalogFile = path.join(tmp.path, "config", EnvironmentToolsCatalog.filename)
      const document = JSON.parse(await readFile(catalogFile, "utf8"))
      if (mutation === "foreign-id") document.environment.id = "22222222-2222-4222-8222-222222222222"
      if (mutation === "foreign-os") document.environment.os = "not-this-os"
      if (mutation === "forged-kind")
        Object.assign(document.tools.npm, { kind: "native", launcher: null, directExec: true })
      if (mutation === "forged-id") document.tools.npm.id = "forged"
      if (mutation === "wildcard") document.tools["*"] = { ...document.tools.npm, name: "*", id: `${environmentID}:*` }
      if (mutation === "invalid-time") document.tools.npm.lastVerifiedAt = "invalid"
      const bytes = mutation === "bad-json" ? "{invalid" : JSON.stringify(document)
      await writeFile(catalogFile, bytes)
      const exits = await run(
        tmp.path,
        Effect.gen(function* () {
          const catalog = yield* EnvironmentToolsCatalog.make({ environmentID })
          return yield* Effect.all([
            Effect.exit(catalog.search("npm")),
            Effect.exit(catalog.listNames()),
            Effect.exit(catalog.upsert({ name: "npm", path: file, source: "resolved" })),
            Effect.exit(catalog.resolveExecutable(`${environmentID}:npm`)),
          ])
        }),
      )
      expect(exits.every((exit) => exit._tag === "Failure")).toBe(true)
      expect(await readFile(catalogFile, "utf8")).toBe(bytes)
    },
  )

  test.each(["tool.exe", "tool.com", "tool.cmd", "tool.bat", "tool.ps1", "tool"])(
    "derives direct eligibility for %s",
    async (name) => {
      await using tmp = await tmpdir("e1-catalog-")
      const file = await executable(tmp.path, name)
      const result = await run(
        tmp.path,
        Effect.gen(function* () {
          const catalog = yield* EnvironmentToolsCatalog.make({ environmentID })
          const entry = yield* catalog.upsert({ name: "tool", path: file, source: "resolved" })
          return { entry: entry.entry, exit: yield* Effect.exit(catalog.resolveExecutable(entry.entry.id)) }
        }),
      )
      const native = name.endsWith(".exe") || name.endsWith(".com")
      expect(result.entry.directExec).toBe(native)
      expect(result.exit._tag).toBe(native ? "Success" : "Failure")
    },
  )

  test("revalidates changed, missing, non-file and invalidated entries without query mutation", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const file = await executable(tmp.path, "runner.exe")
    await run(
      tmp.path,
      Effect.gen(function* () {
        const catalog = yield* EnvironmentToolsCatalog.make({ environmentID })
        const entry = (yield* catalog.upsert({ name: "runner", path: file, source: "resolved" })).entry
        const before = yield* Effect.promise(() => readFile(catalog.file, "utf8"))
        yield* Effect.promise(() => writeFile(file, "replacement-different-size"))
        expect((yield* catalog.search("runner")).matches[0].status).toBe("stale")
        expect((yield* Effect.exit(catalog.resolveExecutable(entry.id)))._tag).toBe("Failure")
        yield* Effect.promise(() => rm(file))
        expect((yield* catalog.search("runner")).matches[0]).toMatchObject({ exists: false, status: "stale" })
        expect((yield* Effect.exit(catalog.resolveExecutable(entry.id)))._tag).toBe("Failure")
        yield* Effect.promise(() => mkdir(file))
        expect((yield* catalog.search("runner")).matches[0]).toMatchObject({ exists: true, status: "stale" })
        expect((yield* Effect.exit(catalog.resolveExecutable(entry.id)))._tag).toBe("Failure")
        expect(yield* Effect.promise(() => readFile(catalog.file, "utf8"))).toBe(before)
        yield* catalog.invalidate({ id: entry.id, reason: "user_requested" })
        expect((yield* Effect.exit(catalog.resolveExecutable(entry.id)))._tag).toBe("Failure")
      }),
    )
  })

  test("invalid inputs and probe errors fail closed", async () => {
    await using tmp = await tmpdir("e1-catalog-")
    const file = await executable(tmp.path, "tool.exe")
    await run(
      tmp.path,
      Effect.gen(function* () {
        const catalog = yield* EnvironmentToolsCatalog.make({ environmentID })
        for (const name of ["*", "?", "tool*", "../tool", ""])
          expect((yield* Effect.exit(catalog.upsert({ name, path: file, source: "resolved" })))._tag).toBe("Failure")
        expect(
          (yield* Effect.exit(catalog.upsert({ name: "tool", path: "relative.exe", source: "resolved" })))._tag,
        ).toBe("Failure")
        yield* catalog.upsert({ name: "tool", path: file, source: "resolved" })
        const denied = yield* EnvironmentToolsCatalog.make({
          environmentID,
          probe: () => Effect.fail(new EnvironmentToolsCatalog.CatalogError({ message: "access denied" })),
        })
        expect((yield* Effect.exit(denied.search("tool")))._tag).toBe("Failure")
        expect((yield* Effect.exit(denied.resolveExecutable(`${environmentID}:tool`)))._tag).toBe("Failure")
      }),
    )
  })
})
