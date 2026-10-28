import { expect } from "bun:test"
import { Effect } from "effect"
import { LanguageModel, LLM, ToolDefinition } from "../../src/effect.js"
import { Azure, OpenAI, XAI } from "../../src/providers.js"
import { ProviderShared } from "../../src/protocols/shared.js"
import { LLMClient } from "../../src/route/client.js"
import { testEffect } from "../lib/effect.js"
import { dynamicResponse } from "../lib/http.js"

const openai = OpenAI.configure({ apiKey: "test", baseURL: "https://openai.test/v1" })
const xai = XAI.configure({ apiKey: "test", baseURL: "https://xai.test/v1" })
const providers = [
  { id: "openai", model: openai.responses("gpt-5"), tool: OpenAI.webSearch() },
  { id: "xai", model: xai.responses("grok-4.6"), tool: XAI.webSearch() },
] as const
const local = ToolDefinition.make({
  name: "read",
  description: "Read a file",
  inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
})

for (const provider of providers) {
  testEffect(
    dynamicResponse(({ request, text, respond }) =>
      Effect.sync(() => {
        expect(new URL(request.url).pathname).toBe("/v1/responses/compact")
        expect(ProviderShared.decodeJson(text)).toMatchObject({
          tools: [
            { type: "web_search" },
            { type: "function", name: "read", parameters: local.inputSchema, strict: false },
          ],
          parallel_tool_calls: false,
        })
        return respond(
          ProviderShared.encodeJson({
            object: "response.compaction",
            output: [{ type: "compaction", id: "cmp_sync", encrypted_content: "opaque" }],
          }),
        )
      }),
    ),
  ).effect(`sync ${provider.id} compaction retains typed hosted search with a display-provider alias`, () =>
    Effect.gen(function* () {
      const result = yield* LLMClient.compact(
        LLM.request({
          model: LanguageModel.update(provider.model, { provider: "configured-alias" }),
          prompt: "Keep the context",
          tools: [provider.tool, local],
          providerOptions: { parallelToolCalls: false },
        }),
      )
      expect(result.replacement[0]?.content[0]?.type).toBe("compaction")
    }),
  )
}

for (const [name, model, tool] of [
  [
    "Azure rejects OpenAI search",
    Azure.configure({ apiKey: "test", resourceName: "test" }).responses("deployment"),
    OpenAI.webSearch(),
  ],
  ["OpenAI rejects xAI search", providers[0].model, XAI.webSearch()],
  ["xAI rejects OpenAI search", providers[1].model, OpenAI.webSearch()],
  ...providers.map(
    (provider) =>
      [
        `${provider.id} rejects extra search options`,
        provider.model,
        ToolDefinition.make({
          name: "web_search",
          description: "Search",
          inputSchema: {},
          native: { [provider.id]: { type: "web_search", unsupported: true } },
        }),
      ] as const,
  ),
] as const) {
  testEffect(dynamicResponse(() => Effect.die("Invalid native tool reached the transport"))).effect(
    `sync compaction ${name}`,
    () =>
      Effect.gen(function* () {
        const error = yield* LLMClient.compact(LLM.request({ model, prompt: "Keep the context", tools: [tool] })).pipe(
          Effect.flip,
        )
        expect(error.reason._tag).toBe("InvalidRequest")
      }),
  )
}
