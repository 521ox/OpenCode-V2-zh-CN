import { Effect, Schema } from "effect"
import { Protocol } from "../route/protocol.js"
import type { LLMRequest } from "../schema/index.js"
import { OpenResponses } from "./open-responses.js"
import { JsonObject, optionalNull, ProviderShared } from "./shared.js"
import { ResponsesHostedTools } from "./utils/responses-hosted-tools.js"
import { ResponsesCompaction } from "./utils/responses-compaction.js"
import { OpenAIFreeform } from "./openai-freeform.js"

const ADAPTER = "xai-responses"
const NAME = "xAI Responses"

const WebSearchTool = Schema.Struct({ type: Schema.Literal("web_search") })
const decodeWebSearch = ProviderShared.validateWith(
  Schema.decodeUnknownEffect(Schema.Struct({ xai: WebSearchTool }), { onExcessProperty: "error" }),
)

const XAIResponsesHostedToolItem = Schema.Union([
  Schema.StructWithRest(
    Schema.Struct({
      type: Schema.tag("x_search_call"),
      id: Schema.String,
      status: Schema.optional(Schema.String),
      action: optionalNull(JsonObject),
    }),
    [JsonObject],
  ),
  Schema.StructWithRest(
    Schema.Struct({
      type: Schema.tag("image_generation_call"),
      id: Schema.String,
      status: Schema.optional(Schema.String),
      result: Schema.optional(Schema.Unknown),
      error: Schema.optional(Schema.Unknown),
    }),
    [JsonObject],
  ),
])

const Options = Schema.Struct({
  minP: Schema.optional(Schema.Number),
})
export type OptionsInput = typeof Options.Type

const Body = Schema.Struct({
  ...OpenResponses.OpenResponsesBody.fields,
  tool_choice: Schema.optional(
    Schema.Union([
      OpenResponses.ToolChoice,
      WebSearchTool,
      Schema.Struct({
        type: Schema.Literal("allowed_tools"),
        mode: Schema.Literals(["auto", "none", "required"]),
        tools: Schema.Array(Schema.Union([OpenResponses.NamedTool, WebSearchTool])),
      }),
    ]),
  ),
  top_k: Schema.optional(Schema.Number),
  min_p: Schema.optional(Schema.Number),
})

const adapter = {
  id: ADAPTER,
  name: NAME,
  nativeTool: (native) => decodeWebSearch(native).pipe(Effect.map((value) => value.xai)),
  lowerMedia: ({ part, media }) => {
    if (part.media.kind !== "video") return undefined
    const filename = part.filename ?? "file"
    const url = ProviderShared.mediaUrl(part.media)
    if (url) return { type: "input_file", filename, file_url: url }
    return media && { type: "input_file", filename, file_data: media.dataUrl }
  },
  restoreHostedToolItem: (item: unknown) => (Schema.is(XAIResponsesHostedToolItem)(item) ? item : undefined),
} satisfies OpenResponses.ProviderAdapter

const fromRequest = Effect.fn("XAIResponses.fromRequest")(function* (request: LLMRequest) {
  if (request.providerOptions?.contextManagement !== undefined)
    return yield* ProviderShared.unsupportedOperation({
      operation: "in-band-compaction",
      provider: request.model.provider,
      route: request.model.route.id,
      message: "xAI requires explicit compaction through ai.compact; automatic context management is not supported",
    })
  const options = yield* ProviderShared.validateWith(Schema.decodeUnknownEffect(Options))(request.providerOptions ?? {})
  const tools = ProviderShared.flattenTools(request.tools)
  const body = yield* OpenResponses.fromRequestWithAdapter(request, adapter)
  const searches = tools.filter((_, index) => body.tools?.[index]?.type === "web_search")
  if (searches.length > 0 && request.model.route.provider !== "xai")
    return yield* ProviderShared.invalidRequest("Hosted web search requires the native xAI Responses provider")
  const choice = body.tool_choice
  return {
    ...body,
    presence_penalty: undefined,
    frequency_penalty: undefined,
    top_k: request.topK,
    min_p: options.minP,
    tool_choice:
      typeof choice !== "object"
        ? choice
        : choice.type !== "allowed_tools"
          ? searches.some((tool) => tool.name === choice.name)
            ? { type: "web_search" as const }
            : choice
          : {
              ...choice,
              tools: choice.tools.map((entry) =>
                searches.some((tool) => tool.name === entry.name) ? { type: "web_search" as const } : entry,
              ),
            },
  }
})

// Grok speaks the standard Responses reasoning dialect (`reasoning_summary_text.*`,
// handled by the baseline); only its hosted tool vocabulary differs.
const HOSTED_TOOLS = {
  ...ResponsesHostedTools.common,
  x_search_call: { name: "x_search", input: (item) => item.action ?? {} },
  image_generation_call: { name: "image_generation", input: () => ({}) },
} as const satisfies ResponsesHostedTools.Definitions

export const protocol = Protocol.make({
  id: ADAPTER,
  body: {
    schema: Body,
    from: fromRequest,
  },
  stream: ResponsesHostedTools.stream(adapter, HOSTED_TOOLS),
})

export const compact = ResponsesCompaction.make(adapter, (request) =>
  OpenResponses.lowerTools(ProviderShared.flattenTools(request.tools), adapter, OpenAIFreeform.tools(request)),
)

export * as XAIResponses from "./xai-responses.js"
