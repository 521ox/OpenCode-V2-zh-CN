import { describe, expect, test } from "bun:test"
import { Effect, Ref, Stream } from "effect"
import { LanguageModel, LLM, LLMEvent, Message, ToolChoice, ToolDefinition } from "../../src/index.js"
import { Azure, OpenAI, OpenAICompatibleResponses, XAI } from "../../src/providers.js"
import { ProviderShared } from "../../src/protocols/shared.js"
import { LLMClient, type ChannelCheckpoint } from "../../src/route.js"
import { compileRequest } from "../../src/route/client.js"
import { it } from "../lib/effect.js"
import { dynamicResponse, fixedResponse } from "../lib/http.js"
import { sseEvents } from "../lib/sse.js"

const openai = OpenAI.configure({ apiKey: "test", baseURL: "https://openai.test/v1" })
const xai = XAI.configure({ apiKey: "test", baseURL: "https://xai.test/v1" })
const providers = [
  { id: "openai", model: openai.responses("gpt-5"), tool: OpenAI.webSearch(), supports: OpenAI.supportsWebSearch },
  { id: "xai", model: xai.responses("grok-4.6"), tool: XAI.webSearch(), supports: XAI.supportsWebSearch },
] as const
const local = ToolDefinition.make({
  name: "read",
  description: "Read a file",
  inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
})

describe("native hosted web search", () => {
  test("uses canonical route provider and protocol, not display provider, URL, route ID or compaction", () => {
    expect(providers[0].model.route.id).toBe(providers[1].model.route.id)
    for (const provider of providers) {
      expect(provider.supports(provider.model)).toBe(true)
      expect(provider.supports(LanguageModel.update(provider.model, { provider: "configured-alias" }))).toBe(true)
      expect(provider.tool.name).toBe("web_search")
      expect(provider.tool.native).toEqual({ [provider.id]: { type: "web_search" } })
      expect(provider.tool.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false })
    }
    expect(OpenAI.supportsWebSearch(providers[1].model)).toBe(false)
    expect(XAI.supportsWebSearch(providers[0].model)).toBe(false)
    for (const model of [
      openai.chat("gpt-5"),
      xai.chat("grok-4.6"),
      Azure.configure({ apiKey: "test", resourceName: "test" }).responses("deployment"),
      OpenAICompatibleResponses.configure({ provider: "openai", baseURL: "https://api.openai.com/v1" }).model("gpt-5"),
      OpenAICompatibleResponses.configure({ provider: "xai", baseURL: "https://api.x.ai/v1" }).model("grok-4.6"),
    ]) {
      expect(OpenAI.supportsWebSearch(model)).toBe(false)
      expect(XAI.supportsWebSearch(model)).toBe(false)
    }
  })

  for (const provider of providers) {
    describe(provider.id, () => {
      it.effect("lowers typed search and local tools to the HTTP request without losing options", () =>
        Effect.gen(function* () {
          const calls = yield* Ref.make(0)
          yield* LLMClient.generate(
            LLM.request({
              model: provider.model,
              prompt: "Search the web",
              tools: [provider.tool, local],
              toolChoice: "auto",
              providerOptions: { parallelToolCalls: false },
            }),
          ).pipe(
            Effect.provide(
              dynamicResponse(({ text, respond }) =>
                Effect.gen(function* () {
                  yield* Ref.update(calls, (count) => count + 1)
                  expect(ProviderShared.decodeJson(text)).toMatchObject({
                    tools: [
                      { type: "web_search" },
                      { type: "function", name: "read", parameters: local.inputSchema, strict: false },
                    ],
                    tool_choice: "auto",
                    parallel_tool_calls: false,
                    stream: true,
                  })
                  return respond(sseEvents({ type: "response.completed", response: { id: "resp_1" } }), {
                    headers: { "content-type": "text/event-stream" },
                  })
                }),
              ),
            ),
          )
          expect(yield* Ref.get(calls)).toBe(1)
        }),
      )

      it.effect("preserves named, none and allowed tool choices", () =>
        Effect.gen(function* () {
          const aliased = yield* compileRequest(
            LLM.request({
              model: LanguageModel.update(provider.model, { provider: "configured-alias" }),
              prompt: "Search",
              tools: [provider.tool],
            }),
          )
          expect(aliased.body.tools).toEqual([{ type: "web_search" }])
          for (const choice of ["auto", "none", "required"] as const) {
            const prepared = yield* compileRequest(
              LLM.request({ model: provider.model, prompt: "Search", tools: [provider.tool], toolChoice: choice }),
            )
            expect(prepared.body.tools).toEqual([{ type: "web_search" }])
            expect(prepared.body.tool_choice).toBe(choice)
          }
          const named = yield* compileRequest(
            LLM.request({
              model: provider.model,
              prompt: "Search",
              tools: [provider.tool],
              toolChoice: ToolChoice.named("web_search"),
            }),
          )
          expect(named.body.tool_choice).toEqual({ type: "web_search" })
          const namedLocal = yield* compileRequest(
            LLM.request({
              model: provider.model,
              prompt: "Read",
              tools: [provider.tool, local],
              toolChoice: ToolChoice.named("read"),
            }),
          )
          expect(namedLocal.body.tool_choice).toEqual({ type: "function", name: "read" })
          const allowed = yield* compileRequest(
            LLM.request({
              model: provider.model,
              prompt: "Search",
              tools: [provider.tool, local],
              providerOptions: { allowedTools: { toolNames: ["web_search", "read"], mode: "required" } },
            }),
          )
          expect(allowed.body.tool_choice).toEqual({
            type: "allowed_tools",
            mode: "required",
            tools: [{ type: "web_search" }, { type: "function", name: "read" }],
          })
        }),
      )

      it.effect("rejects malformed and mixed-vendor native definitions rather than lowering a local function", () =>
        Effect.gen(function* () {
          for (const native of [
            { [provider.id]: {} },
            { [provider.id]: { type: "x_search" } },
            { [provider.id]: { type: "web_search", unsupported: true } },
            { [provider.id]: null },
            { openai: { type: "web_search" }, xai: { type: "web_search" } },
          ]) {
            const tool = ToolDefinition.make({ name: "web_search", description: "Search", inputSchema: {}, native })
            const error = yield* compileRequest(
              LLM.request({ model: provider.model, prompt: "Search", tools: [tool] }),
            ).pipe(Effect.flip)
            expect(error.reason._tag).toBe("InvalidRequest")
          }
        }),
      )

      it.effect("parses hosted call/result events and replays them once without a local executor", () =>
        Effect.gen(function* () {
          const item = {
            type: "web_search_call",
            id: "ws_1",
            status: "completed",
            action: { type: "search", query: "news" },
          }
          const response = yield* LLMClient.generate(
            LLM.request({ model: provider.model, prompt: "Search", tools: [provider.tool] }),
          ).pipe(
            Effect.provide(
              fixedResponse(
                sseEvents(
                  { type: "response.output_item.done", item },
                  { type: "response.completed", response: { id: "resp_1" } },
                ),
              ),
            ),
          )
          expect(response.events.filter(LLMEvent.is.toolCall)).toMatchObject([
            {
              name: "web_search",
              id: "ws_1",
              input: item.action,
              providerExecuted: true,
              providerMetadata: { [provider.id]: { itemId: "ws_1" } },
            },
          ])
          expect(response.events.filter(LLMEvent.is.toolResult)).toMatchObject([
            {
              name: "web_search",
              id: "ws_1",
              result: { type: "json", value: item },
              providerExecuted: true,
            },
          ])
          const replay = yield* compileRequest(
            LLM.request({ model: provider.model, messages: [response.message], tools: [provider.tool] }),
          )
          expect(replay.body.input).toEqual([item])
          expect(replay.body.tools).toEqual([{ type: "web_search" }])
        }),
      )

      for (const store of [true, false]) {
        it.effect(`keeps hosted search on WebSocket requests and continuations (store=${store})`, () =>
          Effect.gen(function* () {
            const checkpoint = yield* Ref.make<ChannelCheckpoint | undefined>(undefined)
            const run = (messages: Message[]) =>
              LLMClient.generate(
                LLM.request({
                  model: provider.model,
                  messages,
                  tools: [provider.tool, local],
                  providerOptions: { store },
                }),
                {
                  webSocket: {
                    execute: (exchange) =>
                      Effect.gen(function* () {
                        const previous = yield* Ref.get(checkpoint)
                        const create = yield* exchange.driver.create(previous)
                        const body = ProviderShared.decodeJson(create.message)
                        expect(body).toMatchObject({
                          type: "response.create",
                          tools: [{ type: "web_search" }, { type: "function", name: "read" }],
                        })
                        if (!ProviderShared.isRecord(body)) throw new Error("Expected a request object")
                        expect(body.stream).toBeUndefined()
                        expect(create.mode).toBe(
                          previous && (provider.id === "openai" || store) ? "incremental" : "full",
                        )
                        if (create.mode === "incremental") expect(body.previous_response_id).toBe("resp_1")
                        const id = previous ? "resp_2" : "resp_1"
                        const frames = [
                          ProviderShared.encodeJson({ type: "response.created", response: { id } }),
                          ProviderShared.encodeJson({ type: "response.completed", response: { id } }),
                        ]
                        yield* exchange.driver.observe(create, frames[0]!)
                        const observation = yield* exchange.driver.observe(create, frames[1]!)
                        if (observation.type !== "completed" || !observation.checkpoint)
                          throw new Error("Expected checkpoint")
                        yield* Ref.set(checkpoint, observation.checkpoint)
                        return { frames: Stream.fromIterable(frames), complete: Effect.void }
                      }),
                  },
                },
              ).pipe(Effect.provide(dynamicResponse(() => Effect.die("Unexpected HTTP fallback"))))
            yield* run([Message.user("First")])
            yield* run([Message.user("First"), Message.user("Second")])
          }),
        )
      }
    })
  }

  for (const [name, model] of [
    ["OpenAI", openai.chat("gpt-5")],
    ["xAI", xai.chat("grok-4.6")],
  ] as const) {
    it.effect(`${name} Chat preserves function tools and rejects other unsupported native definitions`, () =>
      Effect.gen(function* () {
        const prepared = yield* compileRequest(
          LLM.request({
            model,
            prompt: "Read",
            tools: [local],
            toolChoice: ToolChoice.named("read"),
            providerOptions: { reasoningEffort: "low" },
          }),
        )
        expect(prepared.body.tools).toMatchObject([
          {
            type: "function",
            function: { name: "read", parameters: local.inputSchema },
          },
        ])
        expect(prepared.body.tool_choice).toEqual({ type: "function", function: { name: "read" } })
        expect(prepared.body.reasoning_effort).toBe("low")
        for (const native of [{}, { openai: { type: "image_generation" } }, { xai: { type: "x_search" } }]) {
          const tool = ToolDefinition.make({
            name: "native",
            description: "Unsupported native tool",
            inputSchema: {},
            native,
          })
          const error = yield* compileRequest(LLM.request({ model, prompt: "Search", tools: [tool] })).pipe(Effect.flip)
          expect(error.reason._tag).toBe("InvalidRequest")
        }
      }),
    )
  }

  for (const [name, model, tool] of [
    ["xAI tool on OpenAI", providers[0].model, XAI.webSearch()],
    ["OpenAI tool on xAI", providers[1].model, OpenAI.webSearch()],
    ["OpenAI Chat", openai.chat("gpt-5"), OpenAI.webSearch()],
    ["xAI Chat", xai.chat("grok-4.6"), XAI.webSearch()],
    [
      "Azure Responses",
      Azure.configure({ apiKey: "test", resourceName: "test" }).responses("deployment"),
      OpenAI.webSearch(),
    ],
    [
      "OpenAI-compatible Responses",
      OpenAICompatibleResponses.configure({
        apiKey: "test",
        provider: "openai",
        baseURL: "https://api.openai.com/v1",
      }).model("gpt-5"),
      OpenAI.webSearch(),
    ],
    [
      "xAI-compatible Responses",
      OpenAICompatibleResponses.configure({ apiKey: "test", provider: "xai", baseURL: "https://api.x.ai/v1" }).model(
        "grok-4.6",
      ),
      XAI.webSearch(),
    ],
  ] as const) {
    it.effect(`rejects hosted search: ${name}`, () =>
      Effect.gen(function* () {
        const outcome = yield* compileRequest(LLM.request({ model, prompt: "Search", tools: [tool] })).pipe(
          Effect.match({ onFailure: (error) => error.reason._tag, onSuccess: () => "UnexpectedSuccess" }),
        )
        expect(outcome).toBe("InvalidRequest")
      }),
    )
  }
})
