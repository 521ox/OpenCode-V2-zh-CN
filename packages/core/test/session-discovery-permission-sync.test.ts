import path from "path"
import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Agent } from "@opencode/core/agent"
import { Config } from "@opencode/core/config"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { InstructionDiscovery } from "@opencode/core/instruction-discovery"
import { Instructions } from "@opencode/core/instructions/index"
import { Location } from "@opencode/core/location"
import { Mcp } from "@opencode/core/mcp/index"
import { PluginSupervisor } from "@opencode/core/plugin/supervisor"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionContext } from "@opencode/core/session/context"
import { Skill } from "@opencode/core/skill"
import { McpTool } from "@opencode/core/tool/mcp"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tempLocationLayer } from "./fixture/location"
import { readInitial } from "./lib/instructions"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Agent.node, Location.node, Session.node, SessionContext.node]), [
    Location.node.replace(tempLocationLayer),
    Config.node.replace(Config.testLayer()),
    PluginSupervisor.node.replace(Layer.empty),
    InstructionDiscovery.node.replace(
      Layer.mock(InstructionDiscovery.Service, {
        project: false,
        global: false,
        load: () => Effect.succeed(Instructions.empty),
      }),
    ),
    Skill.node.replace(
      Layer.mock(Skill.Service, {
        list: () =>
          Effect.succeed(
            ["visible", "restricted"].map((id) =>
              Skill.Info.make({
                id: Skill.ID.make(id),
                name: Skill.Name.make(id),
                description: `${id} skill guidance`,
                path: AbsolutePath.make(path.resolve("skills", id, "SKILL.md")),
                content: `${id} content`,
              }),
            ),
          ),
      }),
    ),
    Mcp.node.replace(
      Layer.mock(Mcp.Service, {
        tools: () =>
          Effect.succeed(
            ["visible", "restricted"].map((server) => ({
              server: Mcp.ServerName.make(server),
              name: "lookup",
              inputSchema: { type: "object" as const },
            })),
          ),
        instructions: () =>
          Effect.succeed(
            ["visible", "restricted"].map((server) => ({
              server: Mcp.ServerName.make(server),
              instructions: `${server} MCP guidance`,
            })),
          ),
      }),
    ),
  ]),
)

it.effect("Session denial narrows real skill, MCP and Code Mode discovery despite agent allow", () =>
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    const sessions = yield* Session.Service
    const context = yield* SessionContext.Service
    const location = yield* Location.Service
    yield* agents.transform((editor) =>
      editor.update(Agent.ID.make("build"), (agent) => {
        agent.permissions = [{ action: "*", resource: "*", effect: "allow" }]
      }),
    )
    const allowed = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
    const denied = yield* sessions.create({
      location: Location.Ref.make({ directory: location.directory }),
      permissions: [
        { action: "skill", resource: "restricted", effect: "deny" },
        { action: McpTool.name("restricted", "lookup"), resource: "*", effect: "deny" },
      ],
    })
    const before = yield* context.select(allowed.id)
    const beforeText = (yield* readInitial(before.instructions)).text
    expect(beforeText).toContain("restricted skill guidance")
    expect(beforeText).toContain("restricted MCP guidance")
    expect(JSON.stringify(before.tools.codeModeCatalog)).toContain("restricted")

    const after = yield* context.select(denied.id)
    const afterText = (yield* readInitial(after.instructions)).text
    expect(afterText).toContain("visible skill guidance")
    expect(afterText).toContain("visible MCP guidance")
    expect(afterText).not.toContain("restricted skill guidance")
    expect(afterText).not.toContain("restricted MCP guidance")
    expect(JSON.stringify(after.tools.codeModeCatalog)).toContain("visible")
    expect(JSON.stringify(after.tools.codeModeCatalog)).not.toContain("restricted")
  }),
)
