import { describe, expect } from "bun:test"
import { Cause, Effect, Layer } from "effect"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { EnvironmentToolsTool } from "@opencode/core/tool/plugin/environment-tools"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { withTempDir } from "./fixture/tmpdir"
import { location } from "./fixture/location"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolDefinitions, toolIdentity } from "./lib/tool"

const node = makeLocationNode({
  name: "test/e1-environment-tools",
  layer: Layer.effectDiscard(registerToolPlugin(EnvironmentToolsTool.Plugin)),
  deps: [Tool.node, FSUtil.node, Global.node, Permission.node],
})
const layer = (root: string, permission: Layer.Layer<Permission.Service>) =>
  AppNodeBuilder.build(LayerNode.group([Tool.node, node]), [
    Permission.node.replace(permission),
    Location.node.replace(Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(root) }))),
    Global.node.replace(
      Global.layerWith({
        config: path.join(root, "config"),
        state: path.join(root, "state"),
        data: path.join(root, "data"),
        cache: path.join(root, "cache"),
        tmp: path.join(root, "tmp"),
      }),
    ),
  ])
const call = (id: string, input: unknown) => ({
  sessionID: Session.ID.make("ses_e1_environment"),
  ...toolIdentity,
  call: { type: "tool-call" as const, id, name: "environment_tools", input },
})

describe("EnvironmentToolsTool", () => {
  it.live("registers the discovery/fallback contract and independently authorizes query and update", () =>
    withTempDir((tmp) => {
      const requests: Permission.AssertInput[] = []
      const file = path.join(tmp.path, "tool.exe")
      return Effect.gen(function* () {
        yield* Effect.promise(() => writeFile(file, "synthetic executable"))
        const registry = yield* Tool.Service
        const definitions = yield* toolDefinitions(registry)
        const matching = definitions.filter((tool) => tool.name === "environment_tools")
        expect(matching).toHaveLength(1)
        for (const phrase of [
          "search.all",
          "search.query",
          "normal discovery",
          "missing name does not mean the program is not installed",
          "direct_exec",
          "use shell",
        ])
          expect(matching[0].description).toContain(phrase)
        const empty = yield* executeTool(registry, call("empty", { search: { query: "tool" } }))
        expect(empty).toMatchObject({ status: "completed", output: { matches: [], truncated: false } })
        expect(JSON.stringify(empty.content)).toContain("normal discovery")
        const updated = yield* executeTool(
          registry,
          call("update", { update: { mode: "upsert", name: "tool", path: file, source: "resolved" } }),
        )
        expect(updated).toMatchObject({
          status: "completed",
          output: { result: "created", entry: { name: "tool", directExec: true } },
        })
        const all = yield* executeTool(registry, call("names", { search: { all: true } }))
        expect(all.output).toEqual({ operation: "search", mode: "all", count: 1, names: ["tool"] })
        const found = yield* executeTool(registry, call("query", { search: { query: "tool.exe" } }))
        expect(found).toMatchObject({
          status: "completed",
          output: { matches: [{ name: "tool", status: "active", exists: true }] },
        })
        expect(requests.map((request) => request.action)).toEqual([
          "environment_tools",
          "environment_tools_update",
          "environment_tools",
          "environment_tools",
        ])
        for (const [index, id] of ["empty", "update", "names", "query"].entries())
          expect(requests[index]).toMatchObject({
            sessionID: call(id, {}).sessionID,
            agent: toolIdentity.agent,
            source: { type: "tool", messageID: toolIdentity.messageID, id },
          })
      }).pipe(
        Effect.provide(
          layer(
            tmp.path,
            permissionLayer({
              assert: (request) =>
                Effect.sync(() => {
                  requests.push(request)
                }),
            }),
          ),
        ),
      )
    }),
  )

  it.live("rejects ambiguous operations and tool-owned fields before permission or persistence", () =>
    withTempDir((tmp) => {
      const requests: Permission.AssertInput[] = []
      return Effect.gen(function* () {
        const registry = yield* Tool.Service
        for (const input of [
          {},
          { search: { all: true, query: "tool" } },
          { search: { all: true }, update: { mode: "invalidate", id: "id", reason: "other" } },
          {
            update: {
              mode: "upsert",
              name: "tool",
              path: path.join(tmp.path, "tool.exe"),
              source: "resolved",
              directExec: true,
            },
          },
          { update: { mode: "invalidate", id: "id", reason: "other", path: "forged" } },
        ])
          expect((yield* executeTool(registry, call("invalid", input))).status).toBe("error")
        expect(requests).toEqual([])
        expect(
          yield* Effect.promise(() => Bun.file(path.join(tmp.path, "config", "environment-tools.json")).exists()),
        ).toBe(false)
      }).pipe(
        Effect.provide(
          layer(
            tmp.path,
            permissionLayer({
              assert: (request) =>
                Effect.sync(() => {
                  requests.push(request)
                }),
            }),
          ),
        ),
      )
    }),
  )

  for (const action of ["environment_tools", "environment_tools_update"]) {
    it.live(`keeps ${action} denial independent and does not write a catalog`, () =>
      withTempDir((tmp) =>
        Effect.gen(function* () {
          const registry = yield* Tool.Service
          const input =
            action === "environment_tools"
              ? { search: { all: true } }
              : { update: { mode: "invalidate", id: "id", reason: "other" } }
          expect((yield* executeTool(registry, call("deny", input))).status).toBe("error")
          expect(
            yield* Effect.promise(() => Bun.file(path.join(tmp.path, "config", "environment-tools.json")).exists()),
          ).toBe(false)
        }).pipe(
          Effect.provide(
            layer(
              tmp.path,
              permissionLayer({
                assert: (request) => {
                  expect(request.action).toBe(action)
                  return Effect.fail(
                    new Permission.BlockedError({ rules: [], permission: action, resources: request.resources }),
                  )
                },
              }),
            ),
          ),
        ),
      ),
    )
  }

  it.live("does not catch user-decline defects", () =>
    withTempDir((tmp) =>
      Effect.gen(function* () {
        const registry = yield* Tool.Service
        const exit = yield* Effect.exit(executeTool(registry, call("decline", { search: { all: true } })))
        expect(exit._tag).toBe("Failure")
        if (exit._tag === "Failure") expect(Cause.hasDies(exit.cause)).toBe(true)
        expect(
          yield* Effect.promise(() =>
            Bun.file(path.join(tmp.path, "data", "environment-tools", "environment-id")).exists(),
          ),
        ).toBe(false)
      }).pipe(
        Effect.provide(layer(tmp.path, permissionLayer({ assert: () => Effect.die(new Permission.DeclinedError()) }))),
      ),
    ),
  )
})
