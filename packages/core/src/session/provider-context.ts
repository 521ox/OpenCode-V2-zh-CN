export * as SessionProviderContext from "./provider-context.js"

import { Media, Message } from "@opencode/ai"
import { SessionProviderContext } from "@opencode/schema/session-provider-context"
import { Schema } from "effect"
import { isDeepStrictEqual } from "node:util"
import { Hash } from "@opencode/util/hash"
import type { SessionMessage } from "./message.js"
import type { SessionRunnerModel } from "./runner/model.js"

export type Provenance = SessionProviderContext.Provenance
export const Info = SessionProviderContext.Info
export type Info = SessionProviderContext.Info

const messages = Schema.toCodecJson(Schema.Array(Message))

/** No guessed endpoints. Dynamic URL builders cannot establish a durable deployment identity here. */
export function provenance(resolved: Pick<SessionRunnerModel.Resolved, "model" | "ref">): Provenance | undefined {
  const model = resolved.model
  const endpoint = model.route.endpoint
  if (!endpoint.baseURL || typeof endpoint.path !== "string") return undefined
  return {
    providerID: resolved.ref.providerID,
    provider: model.provider,
    modelID: model.id,
    route: model.route.id,
    protocol: model.route.protocol,
    endpoint: Hash.sha256(
      JSON.stringify([
        endpoint.baseURL,
        endpoint.path,
        Object.entries(endpoint.query ?? {}).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
      ]),
    ),
  }
}

export const compatible = (source: Provenance, target: Provenance | undefined) =>
  target !== undefined && isDeepStrictEqual(source, target)

/** A completed compaction that installed a native replacement window instead of a local summary. */
export const isCheckpoint = (
  message: SessionMessage.Info,
): message is SessionMessage.CompactionCompleted & { readonly providerContext: Info } =>
  message.type === "compaction" && message.status === "completed" && message.providerContext !== undefined

/** Stores the canonical replacement, not a local summary or transport continuation.
 * Provider and attachment metadata can contain optional undefined entries, which the Schema JSON
 * codec rejects, so use JSON's omission semantics; `Media.Asset.toJSON` keeps binary media as base64.
 */
export const encode = (provenance: Provenance, replacement: ReadonlyArray<Message>): Info => ({
  version: 1,
  provenance,
  messages: Schema.decodeSync(Schema.fromJsonString(Schema.Json))(JSON.stringify(replacement)),
})

const normalizeLegacyMedia = (input: unknown): unknown => {
  if (!Array.isArray(input)) return input
  return input.map((message) => {
    if (typeof message !== "object" || message === null || Array.isArray(message)) return message
    const content = message.content
    if (!Array.isArray(content)) return message
    return {
      ...message,
      content: content.map((part) => {
        if (typeof part !== "object" || part === null || Array.isArray(part)) return part
        if (
          part.type !== "media" ||
          Object.hasOwn(part, "media") ||
          typeof part.data !== "string" ||
          typeof part.mediaType !== "string"
        )
          return part
        const normalized = Object.fromEntries(
          Object.entries(part).filter(([key]) => key !== "data" && key !== "mediaType"),
        )
        const media =
          Media.parseDataUrl(part.data) ??
          (/^https?:\/\//.test(part.data)
            ? Media.url(part.data, { mediaType: part.mediaType })
            : Media.base64(part.data, part.mediaType))
        return {
          ...normalized,
          media: Schema.decodeSync(Schema.fromJsonString(Schema.Json))(JSON.stringify(media)),
        }
      }),
    }
  })
}

export const decode = (context: Info) => Schema.decodeUnknownSync(messages)(normalizeLegacyMedia(context.messages))
export const validate = (context: Info) => Schema.decodeUnknownEffect(messages)(normalizeLegacyMedia(context.messages))
