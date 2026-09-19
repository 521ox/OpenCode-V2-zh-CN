import { canonicalToolName, finiteNumber, webSearchProviderLabel } from "./tool-display"
import { type Key, type Translator } from "../i18n"

type Dict = Record<string, unknown>

export type PermissionPresentation = {
  icon: string
  title: string
  lines: string[]
  diff?: string
  patch?: string
  file?: string
}

export type PermissionPresentationInput = {
  action: string
  resources: ReadonlyArray<unknown>
  metadata?: unknown
  input?: unknown
  toolMetadata?: unknown
}

export function permissionPresentation(
  source: PermissionPresentationInput,
  t: Translator<Key>,
  formatPath: (value: string) => string = (value) => value,
): PermissionPresentation {
  const action = canonicalToolName(source.action)
  const input = normalizeInput(action, source.input)
  const metadata = { ...dict(source.toolMetadata), ...dict(source.metadata) }
  const resources = source.resources.filter((item): item is string => typeof item === "string")

  if (action === "edit") {
    const file = text(input.path) || resources[0] || ""
    const first = dict(Array.isArray(metadata.files) ? metadata.files[0] : undefined)
    const diff = text(first.patch) || text(first.diff) || text(metadata.diff) || undefined
    return {
      icon: "→",
      title: t("main.permission.edit", { path: formatPath(file) }),
      lines: [],
      diff,
      patch: diff ? undefined : text(input.patchText) || undefined,
      file,
    }
  }

  if (action === "read" || action === "list") {
    const value = text(input.path) || resources[0] || ""
    return {
      icon: "→",
      title: t(action === "read" ? "main.permission.read" : "main.permission.list", { path: formatPath(value) }),
      lines: value ? [t("main.permission.path", { path: formatPath(value) })] : [],
    }
  }

  if (action === "glob" || action === "grep") {
    const pattern = text(input.pattern) || resources[0] || ""
    const title = action === "glob" ? "Glob" : "Grep"
    return {
      icon: "✱",
      title: `${title} "${pattern}"`,
      lines: pattern ? [t("main.permission.pattern", { pattern })] : [],
    }
  }

  if (action === "shell") {
    const command = text(input.command)
    return {
      icon: "#",
      title: t("main.permission.shell"),
      lines: command ? [`$ ${command}`] : resources.map((item) => `- ${item}`),
    }
  }

  if (action === "subagent") {
    const agent = text(input.agent) || "general"
    const description = text(input.description)
    return {
      icon: "#",
      title: t("main.permission.subagent", { agent }),
      lines: description ? [`◉ ${description}`] : [],
    }
  }

  if (action === "webfetch") {
    const url = text(input.url) || text(metadata.url)
    return {
      icon: "%",
      title: `WebFetch ${url}`,
      lines: url ? [`URL: ${url}`] : [],
    }
  }

  if (action === "websearch") {
    const query = text(input.query) || text(metadata.query)
    const title = webSearchProviderLabel(metadata.provider)
    return {
      icon: "◈",
      title: query ? `${title} "${query}"` : title,
      lines: query ? [t("main.permission.query", { query })] : [],
    }
  }

  if (action === "lsp") {
    const file = text(input.path)
    const operation = text(input.operation) || "request"
    const line = finiteNumber(input.line)
    const character = finiteNumber(input.character)
    const position = line !== undefined && character !== undefined ? `${line}:${character}` : undefined
    return {
      icon: "→",
      title: `LSP ${operation}${file ? ` ${formatPath(file)}${position ? `:${position}` : ""}` : ""}`,
      lines: [
        ...(input.operation ? [t("main.permission.operation", { operation })] : []),
        ...(file ? [t("main.permission.path", { path: formatPath(file) })] : []),
        ...(position ? [t("main.permission.position", { position })] : []),
      ],
    }
  }

  if (action === "external_directory") {
    const raw = text(metadata.parentDir) || text(metadata.filepath) || resources[0] || ""
    const directory = wildcardDirectory(raw)
    return {
      icon: "←",
      title: t("main.permission.external", { path: formatPath(directory) }),
      lines: resources.map((item) => `- ${item}`),
    }
  }

  if (action === "doom_loop") {
    return {
      icon: "⟳",
      title: t("main.permission.doomLoop"),
      lines: [t("main.permission.doomLoopHint")],
    }
  }

  return {
    icon: "⚙",
    title: t("main.permission.call", { tool: source.action }),
    lines: [t("main.permission.tool", { tool: source.action })],
  }
}

function wildcardDirectory(value: string) {
  const wildcard = value.indexOf("*")
  if (wildcard === -1) return value
  const prefix = value.slice(0, wildcard)
  if (/^[\\/]+$/.test(prefix) || /^[A-Za-z]:[\\/]$/.test(prefix)) return prefix
  return prefix.replace(/[\\/]+$/, "")
}

export function permissionAlwaysLines(
  input: { action: string; save?: ReadonlyArray<string> },
  t: Translator<Key>,
): string[] {
  const save = input.save ?? []
  if (save.length === 1 && save[0] === "*") {
    return [t("main.permission.alwaysAction", { action: input.action })]
  }
  return [t("main.permission.alwaysPatterns"), ...save.map((item) => `- ${item}`)]
}

export function permissionOptionLabel(option: "once" | "always" | "reject" | "confirm" | "cancel", t: Translator<Key>) {
  if (option === "once") return t("main.permission.once")
  if (option === "always") return t("main.permission.always")
  if (option === "reject") return t("main.permission.reject")
  if (option === "confirm") return t("main.confirm")
  return t("main.cancel")
}

function normalizeInput(action: string, value: unknown): Dict {
  const input = dict(value)
  const path = text(input.path) || text(input.filePath) || text(input.filepath)
  const agent = text(input.agent) || text(input.subagent_type)
  return {
    ...input,
    ...(["read", "edit", "list", "lsp"].includes(action) && path ? { path } : {}),
    ...(action === "subagent" && agent ? { agent } : {}),
  }
}

function dict(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Dict
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}
