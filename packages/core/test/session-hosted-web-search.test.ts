import { describe, expect } from "bun:test"
import { ToolDefinition } from "@opencode/ai"
import { Azure, OpenAI, OpenAICompatibleResponses, XAI } from "@opencode/ai/providers"
import { OpenAIChat, OpenAIResponses } from "@opencode/ai/protocols"
import { Agent } from "@opencode/schema/agent"
import { Money } from "@opencode/schema/money"
import { Session } from "@opencode/schema/session"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { Project } from "@opencode/core/project"
import { AbsolutePath } from "@opencode/core/schema"
import { HostedWebSearch } from "@opencode/core/session/hosted-web-search"
import { SessionModelRequest } from "@opencode/core/session/model-request"
import { SessionModelTransport } from "@opencode/core/session/model-transport"
import { SessionRunnerModel } from "@opencode/core/session/runner/model"
import { SessionMessage } from "@opencode/core/session/message"
import { Tool } from "@opencode/core/tool"
import { WebSearch } from "@opencode/core/websearch"
import { DateTime, Effect, Schema } from "effect"
import { testEffect } from "./lib/effect"
import { PluginTestLayer } from "./plugin/fixture"

const it = testEffect(PluginTestLayer)
const session = Session.Info.make({
  id: Session.ID.make("ses_hosted_search"),
  projectID: Project.ID.global,
  cost: Money.USD.zero,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
  location: Location.Ref.make({ directory: AbsolutePath.make("/project") }),
})
const agent = Agent.ID.make("build")
const local = ToolDefinition.make({ name: "websearch", description: "Local search", inputSchema: { type: "object" } })
const other = ToolDefinition.make({ name: "read", description: "Read", inputSchema: { type: "object" } })
const native = OpenAI.routes[0]!.model({ id: "search-model", provider: "openai" })
const tools = new Map([
  ["websearch", local],
  ["read", other],
])
const input = { kind: "primary" as const, model: native, sessionID: session.id, agent, tools }
const transport = SessionModelTransport.Service.of({
  bind: () => ({ execute: () => Effect.die("No live model calls") }),
  close: () => Effect.void,
  closeAll: Effect.void,
})
const policy = (effect: Schema.Schema.Type<typeof Permission.Effect>) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return Permission.Service.of({ ...permission, preauthorizeHostedSearch: () => Effect.succeed(effect) })
  })

describe("hosted search selection", () => {
  for (const effect of ["allow", "ask", "deny"] as const) {
    it.effect(`${effect} never leaves a duplicate local search`, () =>
      Effect.gen(function* () {
        const permission = yield* policy(effect)
        const result = yield* HostedWebSearch.select(input).pipe(Effect.provideService(Permission.Service, permission))
        expect([...result.tools.keys()]).toEqual(["read"])
        expect(result.hosted?.name).toBe(effect === "allow" ? "web_search" : undefined)
        expect(tools.has("websearch")).toBe(true)
      }),
    )
  }

  it.effect("recognizes both native suppliers without requiring local supplier configuration", () =>
    Effect.gen(function* () {
      const permission = yield* policy("allow")
      const websearch = yield* WebSearch.Service
      expect(yield* websearch.default()).toBeUndefined()
      for (const model of [native, XAI.routes[0]!.model({ id: "grok", provider: "xai" })]) {
        const result = yield* HostedWebSearch.select({ ...input, model }).pipe(
          Effect.provideService(Permission.Service, permission),
        )
        expect(result.hosted?.name).toBe("web_search")
        expect(result.tools.has("websearch")).toBe(false)
      }
    }),
  )

  it.effect("explicit disable remains authoritative even if an earlier hook renamed the tool", () =>
    Effect.gen(function* () {
      const permission = yield* policy("allow")
      const websearch = yield* WebSearch.Service
      yield* websearch.select(false)
      const result = yield* HostedWebSearch.select({ ...input, tools: new Map([["renamed", local]]) }).pipe(
        Effect.provideService(Permission.Service, permission),
      )
      expect(result.hosted).toBeUndefined()
      expect(result.tools.size).toBe(0)
    }),
  )

  it.effect("requires the canonical tool to survive, preserves aliases, and avoids native-name collisions", () =>
    Effect.gen(function* () {
      const permission = yield* policy("allow")
      const renamed = yield* HostedWebSearch.select({
        ...input,
        tools: new Map([
          ["renamed", local],
          ["alias", local],
          ["read", other],
        ]),
      }).pipe(Effect.provideService(Permission.Service, permission))
      expect(renamed.hosted?.name).toBe("web_search")
      expect([...renamed.tools.keys()]).toEqual(["read"])
      const removed = yield* HostedWebSearch.select({ ...input, tools: new Map([["read", other]]) })
      expect(removed.hosted).toBeUndefined()
      const collision = yield* HostedWebSearch.select({ ...input, tools: new Map([...tools, ["web_search", other]]) })
      expect(collision.hosted).toBeUndefined()
      expect(collision.tools.has("websearch")).toBe(false)
    }),
  )

  for (const kind of ["title", "generate", "compaction"] as const) {
    it.effect(`does not acquire hosted search for ${kind}`, () =>
      Effect.gen(function* () {
        const result = yield* HostedWebSearch.select({ ...input, kind })
        expect(result.tools).toBe(tools)
        expect(result.hosted).toBeUndefined()
      }),
    )
  }

  it.effect("leaves compatible, unknown, Chat and Azure routes on official local behavior", () =>
    Effect.gen(function* () {
      for (const model of [
        OpenAICompatibleResponses.routes[0]!.with({
          endpoint: { baseURL: "https://compatible.example.test/v1" },
        }).model({ id: "gpt-5", provider: "openai" }),
        OpenAIResponses.route.with({ provider: "unknown" }).model({ id: "gpt-5", provider: "openai" }),
        OpenAIChat.route.model({ id: "gpt-5", provider: "openai" }),
        Azure.routes[0]!.model({ id: "gpt-5", provider: "openai" }),
      ]) {
        const result = yield* HostedWebSearch.select({ ...input, model })
        expect(result.tools).toBe(tools)
        expect(result.hosted).toBeUndefined()
      }
    }),
  )

  it.effect("post-hook identity filtering and HTTP/WS requests share hosted policy and block local execution", () =>
    Effect.gen(function* () {
      const permission = yield* policy("allow")
      const registry = yield* Tool.Service
      let executions = 0
      yield* registry.transform((editor) =>
        editor.add({
          name: "websearch",
          description: "local",
          options: { codemode: false },
          input: Schema.Struct({ query: Schema.String }),
          execute: () =>
            Effect.sync(() => {
              executions++
              return { content: "local" }
            }),
        }),
      )
      const hooks = yield* PluginHooks.Service
      yield* hooks.register("session", "context", (event) =>
        Effect.sync(() => {
          event.tools.renamed = event.tools.websearch!
          delete event.tools.websearch
          event.tools.invented = { description: "invented", input: { type: "object" } }
        }),
      )
      const requests = yield* SessionModelRequest.Service.pipe(
        Effect.provide(SessionModelRequest.layer),
        Effect.provideService(Permission.Service, permission),
        Effect.provideService(SessionModelTransport.Service, transport),
      )
      for (const mode of ["http", "websocket"] as const) {
        const prepared = yield* requests.primary({
          session,
          agent,
          model: SessionRunnerModel.resolved(native, {
            capabilities: { tools: true, input: ["text"], output: ["text"] },
            cost: [],
            limit: { context: 200_000, output: 32_000 },
            transport: mode,
          }),
          tools: yield* registry.snapshot(),
          system: [],
          messages: [],
          webSocket: "session",
        })
        expect(prepared.request.tools.map((tool) => tool.name)).toContain("web_search")
        expect(prepared.request.tools.map((tool) => tool.name)).not.toContain("websearch")
        expect(prepared.request.tools.map((tool) => tool.name)).not.toContain("renamed")
        expect(prepared.request.tools.map((tool) => tool.name)).not.toContain("invented")
        expect(!!prepared.options.webSocket).toBe(mode === "websocket")
        for (const name of ["websearch", "renamed", "web_search"]) {
          const failure = yield* prepared
            .executeTool({
              sessionID: session.id,
              agent,
              messageID: SessionMessage.ID.make("msg_hosted_search"),
              call: { type: "tool-call", id: "call_hosted_search", name, input: { query: "not executed" } },
            })
            .pipe(Effect.flip)
          expect(failure).toBeInstanceOf(Tool.Error)
        }
      }
      expect(executions).toBe(0)
    }),
  )
})
