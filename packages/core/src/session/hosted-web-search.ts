export * as HostedWebSearch from "./hosted-web-search.js"

import { Message, type LanguageModel, type ToolDefinition, type ToolEntry } from "@opencode/ai/effect"
import { OpenAI, XAI } from "@opencode/ai/providers"
import type { SessionRequestKind } from "@opencode/plugin/effect/session"
import type { Agent } from "@opencode/schema/agent"
import { Effect, Predicate } from "effect"
import { Permission } from "../permission.js"
import { WebSearch } from "../websearch.js"
import type { SessionSchema } from "./schema.js"

const nativeSearch = (tool: ToolDefinition) =>
  Object.values(tool.native ?? {}).some((entry) => Predicate.hasProperty(entry, "type") && entry.type === "web_search")

/** Historical declarations describe previous requests; the current selection owns the native search slot. */
export const history = (message: Message, hosted: ToolDefinition | undefined, replaceLocal: boolean): Message => {
  if (message.role !== "system" || !message.tools) return message
  const keep = (entries: readonly ToolEntry[]): ToolEntry[] =>
    entries.flatMap((entry): ToolEntry[] => {
      if (entry.name === hosted?.name || (replaceLocal && entry.name === "websearch")) return []
      if (entry.type === "tool") return nativeSearch(entry) ? [] : [entry]
      const tools = keep(entry.tools)
      return tools.length || !entry.tools.length ? [{ ...entry, tools }] : []
    })
  return Message.make({
    ...message,
    tools: { add: keep(message.tools.add), remove: message.tools.remove.filter((name) => name !== hosted?.name) },
  })
}

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
  const entries = Array.from(input.tools).filter(([, tool]) => !nativeSearch(tool))
  const registered = entries.length === input.tools.size ? input.tools : new Map(entries)
  const replaceLocal = input.kind === "primary" && !!factory
  if (!replaceLocal) return { tools: registered, hosted: undefined, replaceLocal }
  const present = Array.from(registered.values()).some((tool) => tool.name === "websearch")
  if (!present) return { tools: registered, hosted: undefined, replaceLocal }

  // Native-supported requests never silently fall back to another search supplier,
  // including when permission is ask/deny. Remove every alias from local execution.
  const tools = new Map(Array.from(registered).filter(([, tool]) => tool.name !== "websearch"))
  const websearch = yield* WebSearch.Service
  const disabled = yield* websearch.default().pipe(
    Effect.as(false),
    Effect.catchTag("WebSearch.Disabled", () => Effect.succeed(true)),
  )
  if (disabled || tools.has("web_search")) return { tools, hosted: undefined, replaceLocal }
  const permission = yield* Permission.Service
  const effect = yield* permission.preauthorizeHostedSearch({ sessionID: input.sessionID, agent: input.agent })
  return { tools, hosted: effect === "allow" ? factory() : undefined, replaceLocal }
})
