// WP-5 / W5-c · identity 子命令共享工具（自包含，不跨包依赖 olo/coexist）。
// 与 packages/cli/src/index.ts 的 oloCoexistIsAgentEnrolled 同源口径：最小 YAML 解析抽取
// agents[] 中 (agent_id, permission_domain) 复合键（方案 v3 复合唯一）。
import { readFileSync, existsSync } from "node:fs"

export interface EnrolledAgent {
  agent_id: string
  permission_domain: string
}

const AGENT_RE = /^-\s*agent_id:\s*/
const DOMAIN_RE = /^permission_domain:\s*/

function homeBase(): string {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "."
  return home.replace(/[\\/]$/, "")
}

export function defaultCardPath(): string {
  const base = process.env.OLO_AIB_CARD_PATH
  if (base) return base
  return `${homeBase()}/.olo/aib/card.json`
}

export function defaultRegistryPath(): string {
  const base = process.env.OLO_AGENT_REGISTRY
  if (base) return base
  return `${homeBase()}/configs/agent-registry.yaml`
}

export function readEnrolledAgents(registryPath: string): EnrolledAgent[] {
  if (!existsSync(registryPath)) return []
  let raw = ""
  try {
    raw = readFileSync(registryPath, "utf8")
  } catch {
    return []
  }
  const lines = raw.split("\n")
  let inAgents = false
  let curId: string | null = null
  let curDomain: string | null = null
  const out: EnrolledAgent[] = []
  const flush = () => {
    if (curId !== null && curDomain !== null) out.push({ agent_id: curId, permission_domain: curDomain })
  }
  for (const line of lines) {
    const indent = line.length - line.trimStart().length
    const content = line.trim()
    if (!inAgents) {
      if (/^agents:\s*$/.test(content)) inAgents = true
      continue
    }
    if (indent === 0 && !content.startsWith("-") && content.length > 0) {
      flush()
      inAgents = false
      curId = null
      curDomain = null
      continue
    }
    if (AGENT_RE.test(content)) {
      flush()
      curId = content.replace(AGENT_RE, "").trim()
      curDomain = null
    } else if (DOMAIN_RE.test(content)) {
      curDomain = content.replace(DOMAIN_RE, "").replace(/^["']|["']$/g, "").trim()
    }
  }
  flush()
  return out
}

export interface LoadCardResult {
  ok: boolean
  card?: unknown
  error?: string
}

export function loadCard(cardPath: string): LoadCardResult {
  let raw: string
  try {
    raw = readFileSync(cardPath, "utf8")
  } catch (e) {
    return { ok: false, error: `OLO_BINDING_MISSING: no AIB card at ${cardPath} — ${(e as Error).message}` }
  }
  try {
    return { ok: true, card: JSON.parse(raw) }
  } catch (e) {
    return { ok: false, error: `OLO_CARD_INVALID: malformed card JSON at ${cardPath} — ${(e as Error).message}` }
  }
}
