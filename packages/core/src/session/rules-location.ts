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
    "Session rules context data (JSON):",
    JSON.stringify(context),
    context.status === "available"
      ? "Use this directory first for session-specific rules, plans, architecture notes, and working documents. The root session and all descendants share it. Create it lazily only when a task needs persistent documents; OpenCode has not checked whether it or any document exists."
      : "The session rules directory is unavailable. Do not guess or search another session's rules directory as a fallback.",
    "Explicit user instructions and authoritative project artifacts naming another document location take precedence.",
  ].join("\n\n")
}
