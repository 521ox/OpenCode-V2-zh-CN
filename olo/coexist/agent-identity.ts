// W-35/W-51 + W-36 + W-10(M-B1 本地形态) + R-CC-1/2 · 本地身份接线入口（[CONTRACT] → 本地身份可运行接线）
// 诚实边界：本件只把"本地 agent_uid（W-35/W-51 裁定格式 agent-{role}-{machine}-{ULID}）"组合进
//           W-36 Registry.spawn + R-CC-1/2 authorizeWrite，**不依赖任何外部信任根（SPIRE/Vault/G-CV-1）**。
//           aib 卡 spiffe_id 恒 null（禁冒充已签发）；SVID 外部锚（W-43）仍 [CONTRACT]，属阶段 3。
//           本件使 R-CC-1/2 机制在"本地身份"下可运行 + 可实证，但完整规格（SVID 密码学锚）仍待 G-CV-1 解除。
// 纯函数 + 文件/内存存储适配，零 OpenCode 运行时依赖；可由 node/bun --experimental-strip-types 直接验证。
import { buildAgentUid, newUlid, type AgentKey, type AgentUidContext } from "./agent-uid.ts"
import { Registry, type RegistryStore } from "./registry.ts"
import {
  authorizeWrite,
  OLO_WRITE_GUARD_CONTRACT,
  type WriteAuthorizationResult,
} from "./write-guard.ts"
import { canonical, bindingId, loadCard, type BindingSeed, type BindingCard } from "./aib.ts"
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { LeaseEventSink } from "./lease.ts"

export interface LocalAgentConfig {
  /** W-35 role 段：agent-{role} 中 {role}（不含前缀），如 codecustom / build-ops */
  role: string
  /** W-35 machine 段：承载 T37 跨机互斥（归一化主机名，如 GTX75060） */
  machine: string
  /** 安装实例坐标（W-10 种子字段） */
  install_id: string
  install_family: string
  instance_nonce: string
  permission_domain: string
}

export interface LocalAgent {
  agent_uid: string
  ctx: AgentUidContext
  key: AgentKey
  config: LocalAgentConfig
}

/** 由本地 config 生成真实 agent_uid（W-35/W-51 裁定格式）；ULID 段内可证唯一。 */
export function makeLocalAgent(cfg: LocalAgentConfig): LocalAgent {
  const ulid = newUlid()
  const ctx: AgentUidContext = { role: cfg.role, machine: cfg.machine, ulid }
  return {
    agent_uid: buildAgentUid(ctx),
    ctx,
    key: { install_family: cfg.install_family, agent_id: cfg.role },
    config: cfg,
  }
}

/** 从环境变量 / 默认值加载本地身份配置（dev 接线用；生产由安装器注入）。 */
export function loadLocalAgentConfig(partial?: Partial<LocalAgentConfig>): LocalAgentConfig {
  const role = partial?.role ?? process.env.OLO_AGENT_ROLE ?? "codecustom"
  const machine = partial?.machine ?? process.env.OLO_AGENT_MACHINE ?? defaultMachine()
  const install_family =
    partial?.install_family ?? process.env.OLO_AGENT_INSTALL_FAMILY ?? "v2-custom-lite"
  const install_id = partial?.install_id ?? process.env.OLO_AGENT_INSTALL_ID ?? "dev-install"
  const instance_nonce =
    partial?.instance_nonce ?? process.env.OLO_AGENT_INSTANCE_NONCE ?? newUlid()
  const permission_domain =
    partial?.permission_domain ?? process.env.OLO_AGENT_PERMISSION_DOMAIN ?? "repository-local"
  return { role, machine, install_id, install_family, instance_nonce, permission_domain }
}

function defaultMachine(): string {
  const h = (process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "dev-host").toLowerCase()
  return h.replace(/[^a-z0-9]/g, "")
}

/** W-36：本地身份接线 spawn —— 把真实本地 agent_uid 写入 Registry（agents.jsonl / MemoryStore）。 */
export function spawnLocalAgent(
  agent: LocalAgent,
  store: RegistryStore,
  opts: { ts: string; source_sha: string },
): string {
  const reg = new Registry(store)
  return reg.spawn(agent.key, agent.ctx, { ts: opts.ts, source_sha: opts.source_sha })
}

/** R-CC-1/2：本地身份接线 authorizeWrite —— agent_uid 透传进单写者租约 + 写工具门 + 暂存集断言。 */
export function authorizeLocalWrite(
  agent: LocalAgent,
  input: {
    commandId: string
    leasePath: string
    worktree: string
    staged: string[]
    declared: string[]
    ttlMs?: number
    now?: () => number
    emit?: LeaseEventSink
  },
): WriteAuthorizationResult {
  return authorizeWrite({
    contract: OLO_WRITE_GUARD_CONTRACT,
    commandId: input.commandId,
    agentUid: agent.agent_uid,
    worktree: input.worktree,
    leasePath: input.leasePath,
    staged: input.staged,
    declared: input.declared,
    ttlMs: input.ttlMs,
    now: input.now,
    emit: input.emit,
  })
}

/** W-10 (M-B1 本地形态)：构造一张 spiffe_id=null 的本地身份卡（诚实：[CONTRACT]，不作 SVID 锚）。 */
export function buildLocalCard(agent: LocalAgent, opts: { issued_at: string }): BindingCard {
  const seed: BindingSeed = {
    agent_id: agent.key.agent_id,
    permission_domain: agent.config.permission_domain,
    install_id: agent.config.install_id,
    install_family: agent.config.install_family,
    instance_nonce: agent.config.instance_nonce,
    issued_at: opts.issued_at,
  }
  const card: BindingCard = {
    ...seed,
    binding_id: bindingId(seed),
    spiffe_id: null,
    scope: "repository-local",
    risk_tier: "T3",
    runtime: {},
    status: "registered",
    key_id: null,
    signature: null,
  }
  return card
}

/** 写本地身份卡到文件，并回读校验（W-10 本地卡形态可加载性实证）。 */
export function writeLocalCard(
  agent: LocalAgent,
  path: string,
  opts: { issued_at: string },
): BindingCard {
  const card = buildLocalCard(agent, opts)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(card, null, 2), "utf8")
  // 回读校验：证明本地卡满足 aib.ts loadCard 全部约束（含 binding_id 一致性、spiffe_id 恒 null）。
  loadCard(path)
  return card
}

// ---- 运行时稳定身份解析（上游接线用）----
// R-CC-1/2 上游接线要求 agent_uid 在 agent 生命周期内稳定（租约归属不可每次调用漂移）。
// 稳定 instance_nonce 来源优先级：① 显式 partial.instance_nonce ② env OLO_AGENT_INSTANCE（须合法 ULID）
// ③ 持久化文件 .olo-agent-identity.json（首次生成后落盘，后续复用）④ 以上皆无 ⇒ 生成并持久化。
const AGENT_IDENTITY_FILE = ".olo-agent-identity.json"
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

function readPersistedNonce(): string | null {
  const p = join(process.cwd(), AGENT_IDENTITY_FILE)
  if (existsSync(p)) {
    try {
      const v = JSON.parse(readFileSync(p, "utf8"))
      if (typeof v?.instance_nonce === "string") return v.instance_nonce
    } catch {
      /* 忽略损坏文件 */
    }
  }
  return null
}
function persistNonce(nonce: string): void {
  const p = join(process.cwd(), AGENT_IDENTITY_FILE)
  try {
    writeFileSync(p, JSON.stringify({ instance_nonce: nonce }, null, 2), "utf8")
  } catch {
    /* 写失败不阻断（如只读目录），下次仍重新生成 */
  }
}

/** 解析运行时稳定本地 agent_uid（W-35/W-51 格式）；显式 instance_nonce / env 注入时不落盘。 */
export function resolveRuntimeAgentUid(partial?: Partial<LocalAgentConfig>): string {
  const role = partial?.role ?? process.env.OLO_AGENT_ROLE ?? "codecustom"
  const machine = partial?.machine ?? process.env.OLO_AGENT_MACHINE ?? defaultMachine()
  const envNonce = partial?.instance_nonce ?? process.env.OLO_AGENT_INSTANCE
  let nonce: string | null = envNonce && ULID_RE.test(envNonce) ? envNonce : readPersistedNonce()
  if (!nonce) {
    nonce = newUlid()
    if (!envNonce) persistNonce(nonce) // 仅未显式提供 nonce 时持久化（config 注入场景不落盘）
  }
  return buildAgentUid({ role, machine, ulid: nonce })
}

export { join }
