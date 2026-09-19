import { toolEntryBody } from "./tool"
import { monoPrefix, monoToolText } from "./mono"
import type { RunEntryBody, ScrollbackOptions, StreamCommit } from "./types"
import { resolveLocale, translate, type Locale } from "../i18n"

export type EntryFlags = {
  startOnNewLine: boolean
  trailingNewline: boolean
}

const RUN_ENTRY_NONE: RunEntryBody = {
  type: "none",
}

function cleanRunText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function textBody(content: string): RunEntryBody {
  if (!content) {
    return RUN_ENTRY_NONE
  }

  return {
    type: "text",
    content,
  }
}

function codeBody(content: string, filetype?: string): RunEntryBody {
  if (!content) {
    return RUN_ENTRY_NONE
  }

  return {
    type: "code",
    content,
    filetype,
  }
}

function markdownBody(content: string): RunEntryBody {
  if (!content) {
    return RUN_ENTRY_NONE
  }

  return {
    type: "markdown",
    content,
  }
}

function userBody(raw: string, mono: boolean): RunEntryBody {
  if (!raw.trim()) {
    return RUN_ENTRY_NONE
  }

  const lead = raw.match(/^\n+/)?.[0] ?? ""
  const body = lead ? raw.slice(lead.length) : raw
  return textBody(`${lead}${mono ? ">" : "›"} ${body}`)
}

function reasoningBody(raw: string, mono: boolean, locale: Locale): RunEntryBody {
  const clean = raw.replace(/\[REDACTED\]/g, "")
  if (!clean) {
    return RUN_ENTRY_NONE
  }

  const lead = clean.match(/^\n+/)?.[0] ?? ""
  const body = lead ? clean.slice(lead.length) : clean
  const mark = "Thinking:"
  if (body.startsWith(mark)) {
    const label = translate(locale, "miniCli.thinkingPrefix")
    if (mono) return textBody(`${lead}${label} ${body.slice(mark.length).trimStart()}`)
    return codeBody(`${lead}_${label}_ ${body.slice(mark.length).trimStart()}`, "markdown")
  }

  return mono ? textBody(clean) : codeBody(clean, "markdown")
}

function systemBody(raw: string, phase: StreamCommit["phase"]): RunEntryBody {
  return textBody(phase === "progress" ? raw : raw.trim())
}

function monoBody(body: RunEntryBody, locale: Locale): RunEntryBody {
  if (body.type === "none" || body.type === "text" || body.type === "markdown") return body
  if (body.type === "code") return textBody(body.content)
  const snapshot = body.snapshot
  if (snapshot.kind === "code") return textBody(`${snapshot.title}\n${snapshot.content}`)
  if (snapshot.kind === "diff") {
    return textBody(
      snapshot.items
        .map(
          (item) =>
            `${item.title}\n${item.diff.trim() || translate(locale, "miniCli.deletedLines", { count: item.deletions ?? 0 })}`,
        )
        .join("\n\n"),
    )
  }
  if (snapshot.kind === "task") {
    return textBody([snapshot.title, ...snapshot.rows, snapshot.tail].filter(Boolean).join("\n"))
  }
  return textBody(
    [
      translate(locale, "miniCli.questions"),
      ...snapshot.items.flatMap((item) => [item.question, item.answer]),
      snapshot.tail,
    ]
      .filter(Boolean)
      .join("\n"),
  )
}

export function entryFlags(commit: StreamCommit): EntryFlags {
  if (commit.summary) {
    return {
      startOnNewLine: true,
      trailingNewline: false,
    }
  }

  if (commit.kind === "user") {
    return {
      startOnNewLine: true,
      trailingNewline: false,
    }
  }

  if (commit.kind === "tool") {
    if (commit.phase === "progress") {
      return {
        startOnNewLine: false,
        trailingNewline: false,
      }
    }

    return {
      startOnNewLine: true,
      trailingNewline: true,
    }
  }

  if (commit.kind === "assistant" || commit.kind === "reasoning") {
    if (commit.phase === "progress") {
      return {
        startOnNewLine: false,
        trailingNewline: false,
      }
    }

    return {
      startOnNewLine: true,
      trailingNewline: true,
    }
  }

  if (commit.kind === "error") {
    return {
      startOnNewLine: true,
      trailingNewline: false,
    }
  }

  return {
    startOnNewLine: true,
    trailingNewline: true,
  }
}

export function entryDone(commit: StreamCommit): boolean {
  if (commit.kind === "assistant" || commit.kind === "reasoning") {
    return commit.phase === "final"
  }

  if (commit.kind === "tool") {
    return commit.phase === "final" || (commit.phase === "progress" && commit.toolState === "completed")
  }

  return true
}

export function entryCanStream(commit: StreamCommit, body: RunEntryBody): boolean {
  if (commit.phase !== "progress") {
    return false
  }

  if (body.type === "none") {
    return false
  }

  if (commit.kind === "tool") {
    return commit.toolState !== "completed"
  }

  return commit.kind === "assistant" || commit.kind === "reasoning"
}

export function entryBody(commit: StreamCommit, options?: ScrollbackOptions): RunEntryBody {
  const locale = resolveLocale(options?.locale)
  if (commit.summary) {
    return RUN_ENTRY_NONE
  }

  const raw = cleanRunText(commit.text)
  const mono = options?.mono === true

  if (commit.image) {
    const caption = raw.trim() || translate(locale, "miniCli.image")
    return commit.kind === "user" ? userBody(caption, mono) : textBody(monoToolText(caption, mono))
  }

  if (commit.kind === "user") {
    return userBody(raw, mono)
  }

  if (commit.kind === "tool") {
    const body = toolEntryBody(commit, raw, options) ?? RUN_ENTRY_NONE
    const result = mono ? monoBody(body, locale) : body
    if (!mono || body.type !== "text" || result.type !== "text" || commit.phase === "progress") return result
    return textBody(monoToolText(result.content, true))
  }

  if (commit.kind === "assistant") {
    if (commit.phase === "start") {
      return RUN_ENTRY_NONE
    }

    if (commit.phase === "final") {
      return commit.interrupted ? textBody(translate(locale, "miniCli.assistantInterrupted")) : RUN_ENTRY_NONE
    }

    return markdownBody(raw)
  }

  if (commit.kind === "reasoning") {
    if (commit.phase === "start") {
      return RUN_ENTRY_NONE
    }

    if (commit.phase === "final") {
      return commit.interrupted ? textBody(translate(locale, "miniCli.reasoningInterrupted")) : RUN_ENTRY_NONE
    }

    return reasoningBody(raw, mono, locale)
  }

  const body = systemBody(raw, commit.phase)
  if (!mono || body.type !== "text") return body
  return textBody(monoPrefix(body.content, true))
}
