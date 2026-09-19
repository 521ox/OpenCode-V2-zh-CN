import { Effect, Schema } from "effect"
import { Protocol } from "../route/protocol.js"
import type { LLMRequest } from "../schema/index.js"
import { OpenResponses } from "./open-responses.js"
import { JsonObject, optionalArray, optionalNull, ProviderShared } from "./shared.js"
import { ResponsesHostedTools } from "./utils/responses-hosted-tools.js"
import { ResponsesCompaction } from "./utils/responses-compaction.js"

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

const XAIResponsesBody = Schema.Struct({
  ...OpenResponses.coreFields,
  tools: optionalArray(Schema.Union([OpenResponses.Tool, WebSearchTool])),
  tool_choice: Schema.optional(
    Schema.Union([
      OpenResponses.ToolChoice,
      WebSearchTool,
      Schema.Struct({
        type: Schema.Literal("allowed_tools"),
        mode: Schema.Literals(["auto", "none", "required"]),
        tools: Schema.Array(
          Schema.Union([Schema.Struct({ type: Schema.Literal("function"), name: Schema.String }), WebSearchTool]),
        ),
      }),
    ]),
  ),
  input: Schema.Array(Schema.Union([OpenResponses.InputItem, XAIResponsesHostedToolItem])),
  stream: Schema.Literal(true),
})

const adapter = {
  id: ADAPTER,
  name: NAME,
  nativeTool: (native) => decodeWebSearch(native).pipe(Effect.map((value) => value.xai)),
  restoreHostedToolItem: (item: unknown) => (Schema.is(XAIResponsesHostedToolItem)(item) ? item : undefined),
} satisfies OpenResponses.ProviderAdapter

const decodeBody = ProviderShared.validateWith(Schema.decodeUnknownEffect(XAIResponsesBody))
const fromRequest = Effect.fn("XAIResponses.fromRequest")(function* (request: LLMRequest) {
  if (request.providerOptions?.contextManagement !== undefined)
    return yield* ProviderShared.unsupportedOperation({
      operation: "in-band-compaction",
      provider: request.model.provider,
      route: request.model.route.id,
      message:
        "xAI requires explicit compaction through LLMClient.compact; automatic context management is not supported",
    })
  const tools = ProviderShared.flattenTools(request.tools)
  const searches = tools.filter((tool) => Schema.is(WebSearchTool)(tool.native?.xai))
  if (searches.length > 0 && request.model.route.provider !== "xai")
    return yield* ProviderShared.invalidRequest("Hosted web search requires the native xAI Responses provider")
  const body = yield* OpenResponses.fromRequestWithAdapter(request, adapter)
  const choice = body.tool_choice
  return yield* decodeBody({
    ...body,
    tool_choice:
      typeof choice !== "object"
        ? choice
        : choice.type === "function"
          ? searches.some((tool) => tool.name === choice.name)
            ? { type: "web_search" }
            : choice
          : {
              ...choice,
              tools: choice.tools.map((entry) =>
                searches.some((tool) => tool.name === entry.name) ? { type: "web_search" } : entry,
              ),
            },
  })
})

const HOSTED_TOOLS = {
  web_search_call: { name: "web_search", input: (item) => item.action ?? {} },
  x_search_call: { name: "x_search", input: (item) => item.action ?? {} },
  file_search_call: { name: "file_search", input: (item) => ({ queries: item.queries ?? [] }) },
  code_interpreter_call: {
    name: "code_interpreter",
    input: (item) => ({ code: item.code, container_id: item.container_id }),
  },
  image_generation_call: { name: "image_generation", input: () => ({}) },
  mcp_call: {
    name: "mcp",
    input: (item) => ({ server_label: item.server_label, name: item.name, arguments: item.arguments }),
  },
} as const satisfies ResponsesHostedTools.Definitions

// Grok speaks the standard Responses reasoning dialect (`reasoning_summary_text.*`,
// handled by the baseline); only its hosted tool vocabulary differs.
const step = (state: OpenResponses.ParserState, input: OpenResponses.Event) => {
  const event = OpenResponses.normalize(state, input)
  if (event.type === "response.output_item.done" && event.item && ResponsesHostedTools.isItem(event.item, HOSTED_TOOLS))
    return ResponsesHostedTools.onDone(state, event.item, HOSTED_TOOLS)
  return OpenResponses.step(state, event)
}

export const protocol = Protocol.make({
  id: ADAPTER,
  body: {
    schema: XAIResponsesBody,
    from: fromRequest,
  },
  stream: {
    event: OpenResponses.protocol.stream.event,
    initial: (request) => OpenResponses.initial(request, adapter),
    step,
    terminal: OpenResponses.terminal,
  },
})

export const compact = ResponsesCompaction.make(adapter)

export * as XAIResponses from "./xai-responses.js"
