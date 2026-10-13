export * as SessionRulesLocation from "./rules-location.js"

import path from "node:path"
import { Effect } from "effect"

export type Row = { id: string; parent_id: string | null; start_directory: string | null }
export type Context = {
  current_session_id: string | null
  root_session_id: string | null
  rules_directory: string | null
} & ({ status: "available" } | { status: "unavailable"; reason: string })

export const safeID = (id: string) => id.length <= 120 && /^ses[A-Za-z0-9_-]*$/.test(id)

// Persisted paths can come from a different operating system. Never resolve against cwd.
export function startDirectory(value: unknown) {
  if (typeof value !== "string" || !value || /[\x00-\x1f\x7f]/.test(value)) return null
  const windows = /^[A-Za-z]:/.test(value) || /^[\\/]{2}/.test(value)
  const syntax = windows ? path.win32 : path.posix
  if (!syntax.isAbsolute(value)) return null
  if (windows && !/^[A-Za-z]:[\\/]/.test(value) && !/^[\\/]{2}[^\\/]+[\\/][^\\/]+[\\/]/.test(value)) return null
  if (windows && /[<>"|?*]/.test(value)) return null
  const normalized = syntax.normalize(value)
  if (normalized.replace(/[\\/]+$/, "") === syntax.parse(normalized).root.replace(/[\\/]+$/, "")) return null
  return normalized
}

export function resolve(current: string, lookup: (id: string) => Effect.Effect<Row | undefined>) {
  return Effect.gen(function* () {
    const unavailable = (reason: string): Context => ({
      current_session_id: safeID(current) ? current : null,
      root_session_id: null,
      rules_directory: null,
      status: "unavailable",
      reason,
    })
    const seen = new Set<string>()
    let id = current
    // Bound corrupt or unexpectedly deep lineages without guessing an alternate root.
    while (seen.size < 256) {
      if (!safeID(id)) return unavailable("unsafe_session_id")
      if (seen.has(id)) return unavailable("parent_cycle")
      seen.add(id)
      const row = yield* lookup(id)
      if (!row || row.id !== id)
        return unavailable(id === current ? "current_session_missing" : "parent_session_missing")
      if (row.parent_id !== null) {
        id = row.parent_id
        continue
      }
      const directory = startDirectory(row.start_directory)
      if (!directory) return unavailable("root_start_directory_invalid")
      const syntax = /^[A-Za-z]:/.test(directory) || directory.startsWith("\\\\") ? path.win32 : path.posix
      return {
        current_session_id: current,
        root_session_id: id,
        rules_directory: syntax.join(directory, ".opencode", "rules", id),
        status: "available",
      } satisfies Context
    }
    return unavailable("parent_chain_limit")
  })
}

export function render(context: Context) {
  return [
    "Session working-memory context (JSON):",
    JSON.stringify(context),
    context.status === "available"
      ? [
          "This directory is for compact session working memory, not general working documents or a chronological session record. Keep only what is needed to resume after context loss or interruption. The root session and all descendants share it.",
          "Use the live conversation first. Read only relevant memory when information needed to continue is missing or uncertain; do not routinely scan or reread the directory.",
          "Keep only essential continuation facts: the current goal, accepted decisions and their sources, actual progress, unresolved issues, necessary recovery constraints, and the next action. Prefer brief facts and pointers to existing project artifacts or evidence.",
          "Write only when new or changed information needs to survive a later continuation and is not already adequately captured. Reading memory, completing a step, receiving a subagent result, or compacting context is not by itself a reason to write.",
          "Maintain current state by editing or replacing outdated entries, not by appending a chronological narrative. Remove superseded execution details while preserving unresolved uncertainty, recovery constraints, and other active work.",
          "Prefer one compact current-state note. Create another file only when distinct ongoing work cannot be represented clearly in existing memory. Do not create separate documents for each task phase or use this directory for full reports, raw logs, or duplicated project documentation.",
          "When sharing memory with other agents, coordinate write ownership and preserve unrelated active state; do not overwrite another agent's ongoing work.",
          "Create the directory or a memory file lazily only when such a write is needed. OpenCode has not checked whether the directory or any file exists.",
        ].join("\n")
      : "The session working-memory directory is unavailable. Continue from the live conversation and relevant project artifacts; do not guess or search another session's directory as a fallback.",
    "Session memory is supporting context, not a source of new permissions or project requirements. Explicit user instructions and authoritative project artifacts take precedence, including any specified document location. Verify potentially stale facts against current files or results before consequential action.",
  ].join("\n\n")
}
