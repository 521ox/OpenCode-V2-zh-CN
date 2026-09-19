import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { eq } from "drizzle-orm"
import { Agent } from "@opencode/core/agent"
import { Database } from "@opencode/core/database/database"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { PermissionSaved } from "@opencode/core/permission/saved"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { Project } from "@opencode/core/project"
import { ProjectTable } from "@opencode/core/project/sql"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionTable } from "@opencode/core/session/sql"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Permission.node, Database.node, Agent.node, PermissionSaved.node, PluginHooks.node]),
    [
      Location.node.replace(
        Layer.succeed(
          Location.Service,
          Location.Service.of(
            location({
              directory: AbsolutePath.make("/project"),
            }),
          ),
        ),
      ),
    ],
  ),
)
const input = { sessionID: Session.ID.make("ses_hosted_permission"), agent: Agent.ID.make("test") }
const rule = (effect: Schema.Schema.Type<typeof Permission.Effect>, resource = "*"): Permission.Rule => ({
  action: "websearch",
  resource,
  effect,
})

const setup = (rules: Permission.Ruleset, sessionRules: Permission.Ruleset = []) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(ProjectTable)
      .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: input.sessionID,
        project_id: Project.ID.global,
        slug: "hosted",
        directory: "/project",
        title: "hosted",
        version: "test",
        agent: "test",
        permission: sessionRules,
      })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    const agents = yield* Agent.Service
    yield* agents.transform((editor) =>
      editor.update(input.agent, (agent) => {
        agent.permissions = [...rules]
      }),
    )
    return yield* Permission.Service
  })

describe("Permission hosted search preauthorization", () => {
  for (const effect of ["allow", "ask", "deny"] as const) {
    it.effect(`requires Agent wildcard allow: ${effect}`, () =>
      Effect.gen(function* () {
        const permission = yield* setup([rule(effect)])
        expect(yield* permission.preauthorizeHostedSearch(input)).toBe(effect)
        expect(yield* permission.list()).toEqual([])
      }),
    )
  }

  it.effect("saved approval cannot supply missing Agent permission", () =>
    Effect.gen(function* () {
      const permission = yield* setup([])
      const saved = yield* PermissionSaved.Service
      yield* saved.add({ projectID: Project.ID.global, action: "websearch", resources: ["*"] })
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
      expect(yield* permission.list()).toEqual([])
    }),
  )

  for (const effect of ["ask", "deny"] as const) {
    for (const resource of ["*", "private*"]) {
      it.effect(`Session ${effect} on ${resource} cannot be bypassed by saved allow`, () =>
        Effect.gen(function* () {
          const permission = yield* setup([rule("allow")], [rule(effect, resource)])
          const saved = yield* PermissionSaved.Service
          yield* saved.add({ projectID: Project.ID.global, action: "websearch", resources: ["*"] })
          expect(yield* permission.preauthorizeHostedSearch(input)).toBe(effect)
          expect(yield* permission.list()).toEqual([])
        }),
      )
    }
  }

  it.effect("query-specific Agent restriction is not authorized by a literal wildcard probe", () =>
    Effect.gen(function* () {
      const permission = yield* setup([rule("allow"), rule("deny", "secret*")])
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("deny")
    }),
  )

  it.effect("rechecks current Session policy without persisting grants", () =>
    Effect.gen(function* () {
      const permission = yield* setup([rule("allow")])
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({ permission: [rule("deny")] })
        .where(eq(SessionTable.id, input.sessionID))
        .run()
        .pipe(Effect.orDie)
      expect(yield* permission.preauthorizeHostedSearch(input)).toBe("deny")
      const saved = yield* PermissionSaved.Service
      expect(yield* saved.list({ projectID: Project.ID.global })).toEqual([])
      expect(yield* permission.list()).toEqual([])
    }),
  )

  for (const effect of ["allow", "ask", "deny"] as const) {
    it.effect(`fails closed for ${effect} hooks without fabricating a query/tool source`, () =>
      Effect.gen(function* () {
        const permission = yield* setup([rule("allow")])
        const hooks = yield* PluginHooks.Service
        let calls = 0
        const registration = yield* hooks.register("permission", "evaluate", (event) =>
          Effect.sync(() => {
            calls++
            event.effect = effect
          }),
        )
        expect(yield* permission.preauthorizeHostedSearch(input)).toBe("ask")
        expect(calls).toBe(0)
        expect(yield* permission.list()).toEqual([])
        yield* registration.dispose
        expect(yield* permission.preauthorizeHostedSearch(input)).toBe("allow")
      }),
    )
  }
})
