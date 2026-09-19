export * as HostedWebSearch from "./hosted-web-search.js"

import type { LanguageModel, ToolDefinition } from "@opencode/ai"
import { OpenAI, XAI } from "@opencode/ai/providers"
import type { SessionRequestKind } from "@opencode/plugin/effect/session"
import type { Agent } from "@opencode/schema/agent"
import { Effect } from "effect"
import { Permission } from "../permission.js"
import { WebSearch } from "../websearch.js"
import type { SessionSchema } from "./schema.js"

/** Runs after context hooks have been mapped back to real registry identities. */
export const select = Effect.fn("HostedWebSearch.select")(function* (input: {
  readonly kind: SessionRequestKind
  readonly model: LanguageModel
  readonly sessionID: SessionSchema.ID
  readonly agent: Agent.ID
  readonly tools: ReadonlyMap<string, ToolDefinition>
}) {
  const factory = OpenAI.supportsWebSearch(input.model)
    ? OpenAI.webSearch
    : XAI.supportsWebSearch(input.model)
      ? XAI.webSearch
      : undefined
  if (input.kind !== "primary" || !factory) return { tools: input.tools, hosted: undefined }
  const present = Array.from(input.tools.values()).some((tool) => tool.name === "websearch")
  if (!present) return { tools: input.tools, hosted: undefined }

  // Native-supported requests never silently fall back to another search supplier,
  // including when permission is ask/deny. Remove every alias from local execution.
  const tools = new Map(Array.from(input.tools).filter(([, tool]) => tool.name !== "websearch"))
  const websearch = yield* WebSearch.Service
  const disabled = yield* websearch.default().pipe(
    Effect.as(false),
    Effect.catchTag("WebSearch.Disabled", () => Effect.succeed(true)),
  )
  if (disabled || tools.has("web_search")) return { tools, hosted: undefined }
  const permission = yield* Permission.Service
  const effect = yield* permission.preauthorizeHostedSearch({ sessionID: input.sessionID, agent: input.agent })
  return { tools, hosted: effect === "allow" ? factory() : undefined }
})
