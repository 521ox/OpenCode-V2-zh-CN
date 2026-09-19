import { describe, expect } from "bun:test"
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Cause, Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { EnvironmentToolsCatalog } from "@opencode/core/environment-tools/catalog"
import { FileAccess } from "@opencode/core/file-access"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { DirectExecTool } from "@opencode/core/tool/plugin/direct-exec"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { location } from "./fixture/location"
import { withTempDir } from "./fixture/tmpdir"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolDefinitions, toolIdentity } from "./lib/tool"

const node = makeLocationNode({
  name: "test/e1-direct-exec",
  layer: Layer.effectDiscard(registerToolPlugin(DirectExecTool.Plugin)),
  deps: [Tool.node, FSUtil.node, Global.node, Location.node, FileAccess.node, Permission.node, AppProcess.node],
})
const layer = (root: string, assert: Permission.Interface["assert"], run?: AppProcess.Interface["run"]) =>
  AppNodeBuilder.build(LayerNode.group([Tool.node, FSUtil.node, Global.node, node]), [
    Location.node.replace(
      Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(path.join(root, "project")) })),
    ),
    Permission.node.replace(permissionLayer({ assert })),
    Global.node.replace(
      Global.layerWith({
        config: path.join(root, "config"),
        state: path.join(root, "state"),
        data: path.join(root, "data"),
        cache: path.join(root, "cache"),
        tmp: path.join(root, "tmp"),
      }),
    ),
    ...(run ? [AppProcess.node.replace(Layer.mock(AppProcess.Service, { run }))] : []),
  ])
const call = (id: string, input: unknown) => ({
  sessionID: Session.ID.make("ses_e1_direct"),
  ...toolIdentity,
  call: { type: "tool-call" as const, id, name: "direct_exec", input },
})
const prepare = (root: string) =>
  Effect.promise(async () => {
    await mkdir(path.join(root, "project"))
    await mkdir(path.join(root, "external"))
    const file = path.join(root, "runner.exe")
    await writeFile(file, "synthetic native entry")
    return file
  })
const native = (file: string) =>
  Effect.gen(function* () {
    const catalog = yield* EnvironmentToolsCatalog.make()
    return (yield* catalog.upsert({ name: "runner", path: file, source: "resolved" })).entry
  })
const noSpawn: AppProcess.Interface["run"] = () => Effect.die("must not spawn")

describe("DirectExecTool authorization", () => {
  it.live("registers argv-only schema and sends literal argv with shell:false and no caller environment", () =>
    withTempDir((tmp) => {
      const assertions: Permission.AssertInput[] = []
      const runs: Parameters<AppProcess.Interface["run"]>[] = []
      const run: AppProcess.Interface["run"] = (command, options) =>
        Effect.sync(() => {
          runs.push([command, options])
          return {
            command: "synthetic",
            exitCode: 7,
            stdout: Buffer.from("out"),
            stderr: Buffer.from("err"),
            stdoutTruncated: false,
            stderrTruncated: false,
          }
        })
      return Effect.gen(function* () {
        const file = yield* prepare(tmp.path)
        const entry = yield* native(file)
        const registry = yield* Tool.Service
        const definitions = yield* toolDefinitions(registry)
        const definition = definitions.find((tool) => tool.name === "direct_exec")
        expect(definitions.filter((tool) => tool.name === "direct_exec")).toHaveLength(1)
        expect(definition?.description).toContain("environment_tools search.query")
        expect(definition?.description).toContain("catalog membership is not execution permission")
        expect(definition?.description).toContain("Use shell")
        const args = ["a&b", "x y", "*.txt", "$(not-evaluated)", ">file"]
        const result = yield* executeTool(registry, call("literal", { id: entry.id, args }))
        expect(result).toMatchObject({ status: "completed", output: { exitCode: 7, stdout: "out", stderr: "err" } })
        expect(runs).toHaveLength(1)
        const command = runs[0][0]
        expect(command._tag).toBe("StandardCommand")
        if (command._tag === "StandardCommand") {
          expect(command.command).toBe(entry.path)
          expect(command.args).toEqual(args)
          expect(command.options).toMatchObject({
            cwd: path.join(tmp.path, "project"),
            shell: false,
            stdin: "ignore",
            extendEnv: true,
          })
          expect(command.options.env).toBeUndefined()
        }
        expect(runs[0][1]).toMatchObject({ maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
        expect(assertions).toHaveLength(1)
        expect(assertions[0]).toMatchObject({
          action: "direct_exec",
          resources: [entry.id],
          save: [entry.id],
          source: { type: "tool", messageID: toolIdentity.messageID, id: "literal" },
          metadata: { scope: "program_all_arguments_across_updates", args },
        })
      }).pipe(
        Effect.provide(
          layer(
            tmp.path,
            (request) =>
              Effect.sync(() => {
                assertions.push(request)
              }),
            run,
          ),
        ),
      )
    }),
  )

  it.live("rejects unsupported inputs, missing IDs, scripts and stale entries before permission", () =>
    withTempDir((tmp) => {
      const assertions: Permission.AssertInput[] = []
      return Effect.gen(function* () {
        const file = yield* prepare(tmp.path)
        const entry = yield* native(file)
        const registry = yield* Tool.Service
        const catalog = yield* EnvironmentToolsCatalog.make()
        for (const extra of [
          { command: "echo unsafe" },
          { env: { X: "1" } },
          { stdin: "data" },
          { background: true },
          { path: file },
          { cwd: "" },
          { timeoutMs: 99 },
          { timeoutMs: 600_001 },
          { timeoutMs: 100.5 },
          { args: ["\0"] },
          { args: ["x".repeat(4097)] },
          { args: Array(9).fill("x".repeat(4096)) },
          { args: Array(129).fill("x") },
        ]) {
          expect((yield* executeTool(registry, call("invalid", { id: entry.id, ...extra }))).status).toBe("error")
        }
        expect((yield* executeTool(registry, call("raw", { id: file }))).status).toBe("error")
        expect((yield* executeTool(registry, call("unknown", { id: "unknown" }))).status).toBe("error")
        const script = path.join(tmp.path, "script.cmd")
        yield* Effect.promise(() => writeFile(script, "@echo off"))
        const cmd = yield* catalog.upsert({ name: "script", path: script, source: "resolved" })
        expect((yield* executeTool(registry, call("script", { id: cmd.entry.id }))).status).toBe("error")
        yield* catalog.invalidate({ id: entry.id, reason: "user_requested" })
        expect((yield* executeTool(registry, call("stale", { id: entry.id }))).status).toBe("error")
        expect(assertions).toEqual([])
      }).pipe(
        Effect.provide(
          layer(
            tmp.path,
            (request) =>
              Effect.sync(() => {
                assertions.push(request)
              }),
            noSpawn,
          ),
        ),
      )
    }),
  )

  for (const change of ["replace-executable", "replace-catalog-path", "remove-cwd", "cwd-becomes-file"]) {
    it.live(`revalidates after approval: ${change}`, () =>
      withTempDir((tmp) => {
        const file = path.join(tmp.path, "runner.exe")
        const assert: Permission.Interface["assert"] = (request) =>
          Effect.gen(function* () {
            expect(request.action).toBe("direct_exec")
            if (change === "replace-executable")
              yield* Effect.promise(() => writeFile(file, "changed executable of another size"))
            if (change === "replace-catalog-path") {
              const replacement = path.join(tmp.path, "replacement.exe")
              yield* Effect.promise(async () => {
                await writeFile(replacement, "replacement")
                const file = path.join(tmp.path, "config", EnvironmentToolsCatalog.filename)
                const document = JSON.parse(await readFile(file, "utf8"))
                const identity = await stat(replacement)
                document.tools.runner.path = replacement
                document.tools.runner.identity = { size: identity.size, modifiedAt: identity.mtime.toISOString() }
                await writeFile(file, JSON.stringify(document))
              })
            }
            if (change === "remove-cwd" || change === "cwd-becomes-file")
              yield* Effect.promise(() => rm(path.join(tmp.path, "project"), { recursive: true }))
            if (change === "cwd-becomes-file")
              yield* Effect.promise(() => writeFile(path.join(tmp.path, "project"), "not a directory"))
          })
        return Effect.gen(function* () {
          yield* prepare(tmp.path)
          const entry = yield* native(file)
          const registry = yield* Tool.Service
          expect((yield* executeTool(registry, call("race", { id: entry.id }))).status).toBe("error")
        }).pipe(Effect.provide(layer(tmp.path, assert, noSpawn)))
      }),
    )
  }

  for (const denied of ["external_directory", "direct_exec"]) {
    it.live(`keeps foreign cwd grants independent: denying ${denied} prevents execution`, () =>
      withTempDir((tmp) => {
        const assertions: Permission.AssertInput[] = []
        return Effect.gen(function* () {
          const entry = yield* native(yield* prepare(tmp.path))
          const registry = yield* Tool.Service
          expect(
            (yield* executeTool(registry, call("external", { id: entry.id, cwd: path.join(tmp.path, "external") })))
              .status,
          ).toBe("error")
          expect(assertions.map((request) => request.action)).toEqual(
            denied === "external_directory" ? ["external_directory"] : ["external_directory", "direct_exec"],
          )
          expect(assertions[0].resources).toEqual([path.join(tmp.path, "external", "*").replaceAll("\\", "/")])
          for (const request of assertions)
            expect(request.source).toEqual({ type: "tool", messageID: toolIdentity.messageID, id: "external" })
        }).pipe(
          Effect.provide(
            layer(
              tmp.path,
              (request) =>
                Effect.gen(function* () {
                  assertions.push(request)
                  if (request.action === denied)
                    return yield* new Permission.BlockedError({
                      rules: [],
                      permission: denied,
                      resources: request.resources,
                    })
                }),
              noSpawn,
            ),
          ),
        )
      }),
    )
  }

  it.live("user declines remain defects, never tool-success or spawn", () =>
    withTempDir((tmp) =>
      Effect.gen(function* () {
        const entry = yield* native(yield* prepare(tmp.path))
        const registry = yield* Tool.Service
        const exit = yield* Effect.exit(executeTool(registry, call("decline", { id: entry.id })))
        expect(exit._tag).toBe("Failure")
        if (exit._tag === "Failure") expect(Cause.hasDies(exit.cause)).toBe(true)
      }).pipe(Effect.provide(layer(tmp.path, () => Effect.die(new Permission.DeclinedError()), noSpawn))),
    ),
  )

  const windows = process.platform === "win32" ? it.live : it.live.skip
  windows("executes a synthetic copied native binary with argv unchanged and a program-wide stable ID", () =>
    withTempDir((tmp) => {
      const assertions: Permission.AssertInput[] = []
      return Effect.gen(function* () {
        yield* prepare(tmp.path)
        const file = path.join(tmp.path, "bun.exe")
        const replacement = path.join(tmp.path, "bun-new.exe")
        const script = path.join(tmp.path, "project", "argv.js")
        yield* Effect.promise(async () => {
          await copyFile(process.execPath, file)
          await copyFile(process.execPath, replacement)
          await writeFile(script, "process.stdout.write(JSON.stringify(process.argv.slice(2)))")
        })
        const catalog = yield* EnvironmentToolsCatalog.make()
        const registry = yield* Tool.Service
        const first = yield* catalog.upsert({ name: "bun", path: file, source: "resolved" })
        const result = yield* executeTool(
          registry,
          call("native-1", { id: first.entry.id, args: [script, "a&b", "x y", "*.txt"] }),
        )
        expect(result.status).toBe("completed")
        expect(JSON.parse(result.output.stdout)).toEqual(["a&b", "x y", "*.txt"])
        const second = yield* catalog.upsert({ name: "bun", path: replacement, source: "resolved" })
        expect(second.entry.id).toBe(first.entry.id)
        expect(
          (yield* executeTool(
            registry,
            call("native-2", { id: second.entry.id, args: [script, "second"], cwd: path.join(tmp.path, "external") }),
          )).status,
        ).toBe("completed")
        const direct = assertions.filter((request) => request.action === "direct_exec")
        expect(direct.map((request) => request.save)).toEqual([[first.entry.id], [first.entry.id]])
        expect(assertions.filter((request) => request.action === "external_directory")).toHaveLength(1)
      }).pipe(
        Effect.provide(
          layer(tmp.path, (request) =>
            Effect.sync(() => {
              assertions.push(request)
            }),
          ),
        ),
      )
    }),
  )
})
