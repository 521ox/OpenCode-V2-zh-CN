import type {
  SessionMessageAssistant,
  SessionMessageAssistantReasoning,
  SessionMessageAssistantTool,
  SessionMessageInfo,
} from "@opencode/client"
import { canonicalToolName, executeCalls } from "../../util/tool-display"
import { translate, type Key, type Translator } from "../../i18n"
import { visitEntries } from "./anchor-view"
import { instructionPaths, type PartRef, type SessionEntry, type SessionNode } from "./grouping/session"
import { reasoningContent } from "./message-parts"
import { resolvePart } from "./rows"

type Item = {
  message: SessionMessageAssistant
  part: SessionMessageAssistantReasoning | SessionMessageAssistantTool
}

/**
 * Summary for an activity group's subtree; permission-blocked tools are left out.
 * Until something finishes, the label is the first running item's status, e.g. "Running command…".
 */
export function summarizeActivity(
  node: Extract<SessionNode, { type: "group" }>,
  message: (messageID: string) => SessionMessageInfo | undefined,
  pending: readonly PartRef[],
  closed: boolean,
  t: Translator<Key> = (key, params) => translate("en", key, params),
) {
  const entries: SessionEntry[] = []
  visitEntries(node.children, (entry) => entries.push(entry))
  const items = entries.flatMap((entry) => {
    if (entry.type !== "part") return []
    if (pending.some((ref) => ref.messageID === entry.ref.messageID && ref.partID === entry.ref.partID)) return []
    const item = message(entry.ref.messageID)
    if (item?.type !== "assistant") return []
    const part = resolvePart(item, entry.ref.partID)
    return part?.type === "reasoning" || part?.type === "tool" ? [{ entry, message: item, part }] : []
  })
  const files = new Set(
    entries.flatMap((entry) => (entry.type === "message" ? instructionPaths(message(entry.messageID)) : [])),
  )
  const summary = activitySummary(items, files.size, closed, t)
  const current = items.find((item) => isActive(item, closed))
  return { ...summary, label: summary.label || (current ? busyLabel(current.part, t) : "") }
}

/** Status for a running item, independent of its details, so it doesn't flicker as they arrive. */
export function busyLabel(part: Item["part"], t: Translator<Key> = (key, params) => translate("en", key, params)) {
  if (part.type === "reasoning") return t("session.activity.thinking")
  const name = canonicalToolName(part.name)
  const noun = name === "shell" ? t("session.activity.command") : name === "execute" ? t("session.activity.code") : name
  return t(part.state.status === "streaming" ? "session.activity.preparing" : "session.activity.running", {
    name: noun,
  })
}

/**
 * Low verbosity's activity summary, e.g. "3 commands, 1 edit, 2 thoughts, 4 reads".
 * The label counts only finished work; running items are reported through `active`.
 * Code-mode `execute` counts its finished nested calls rather than itself.
 * Instructions count distinct loaded files, matching the instruction subgroup.
 * Once a later row closes the group, its thoughts count as finished, as in Medium.
 */
export function activitySummary(
  items: readonly Item[],
  instructions: number,
  closed = false,
  t: Translator<Key> = (key, params) => translate("en", key, params),
) {
  const counts = { command: 0, edit: 0, thought: 0, read: 0, tool: 0, instruction: instructions }
  items.forEach((item) => {
    if (item.part.type === "reasoning") {
      // Redacted-only reasoning renders nothing, so it isn't a visible thought.
      if (!isActive(item, closed) && reasoningContent(item.part)) counts.thought++
      return
    }
    const name = canonicalToolName(item.part.name)
    if (name === "execute") {
      const calls = executeCalls(
        item.part.state.status === "streaming" ? undefined : item.part.state.metadata?.toolCalls,
      ).filter((call) => call.status !== "running")
      calls.forEach((call) => {
        if (canonicalToolName(call.tool) === "read") counts.read++
        else counts.tool++
      })
      // With no finished nested calls to count, a finished execute counts as itself.
      if (calls.length === 0 && !isActive(item, closed)) counts.tool++
      return
    }
    if (isActive(item, closed)) return
    if (name === "shell") counts.command++
    else if (name === "read") counts.read++
    else if (name === "edit" || name === "write" || name === "patch") counts.edit++
    else counts.tool++
  })
  const labels: Record<string, readonly [Key, Key]> = {
    command: ["session.activity.commandOne", "session.activity.commandCount"],
    edit: ["session.activity.editOne", "session.activity.editCount"],
    thought: ["session.activity.thoughtOne", "session.activity.thoughtCount"],
    read: ["session.activity.readOne", "session.activity.readCount"],
    tool: ["session.activity.toolOne", "session.activity.toolCount"],
    instruction: ["session.activity.instructionOne", "session.activity.instructionCount"],
  }
  return {
    label: Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => t(labels[name][count === 1 ? 0 : 1], { count }))
      .join(", "),
    active: items.some((item) => isActive(item, closed)),
  }
}

function isActive(item: Item, closed: boolean) {
  if (item.part.type === "reasoning")
    return !closed && item.part.time?.completed === undefined && item.message.time.completed === undefined
  return item.part.state.status === "streaming" || item.part.state.status === "running"
}
