#!/usr/bin/env bun

import { ensurePluginRuntime } from "@opencode/plugin/runtime"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Cause, Effect } from "effect"
import { defaultTeardown, getErrorReported } from "effect/Runtime"
import { Commands } from "./commands/commands"
import { Runtime } from "./framework/runtime"
import { Observability } from "@opencode/util/observability"
import { Updater } from "./services/updater"
import { OPENCODE_ARTIFACT, OPENCODE_CHANNEL, OPENCODE_LOCAL, OPENCODE_VERSION } from "./version"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { Config } from "./config"
import { Npm } from "@opencode/util/npm"
import { EffectFlock } from "@opencode/util/effect-flock"
import { Heap } from "./heap"
import { CpuProfile } from "./cpu-profile"
import { translate } from "@opencode/tui/i18n"
import { ShutdownDeadline } from "./shutdown-deadline"
import { readFileSync, existsSync } from "node:fs"

// Keep requests to the local service off any proxy. Bun reads lowercase `no_proxy` alone whenever it is set, so both
// spellings get the same merged list.
const noProxy = [
  ...new Set(
    [process.env.NO_PROXY, process.env.no_proxy, "127.0.0.1,localhost,::1"].flatMap((value) =>
      (value ?? "").split(",").flatMap((entry) => entry.trim() || []),
    ),
  ),
].join(",")

process.env.NO_PROXY = noProxy
process.env.no_proxy = noProxy

ensurePluginRuntime()

if (process.env.OPENCODE_SSH_ASKPASS_PORT) {
  const { askpass } = await import("./ssh-askpass")
  process.exit(await Effect.runPromise(askpass.pipe(Effect.provide(NodeServices.layer))))
}

// §11.8-15 (WP-5 / W5-c) fail-closed 启动闸：未入册 Agent 不得运行（仅定制版侧）。
// 本代码仅存在于定制版 d:\code-custom ⇒ 官方构建天然不含此闸，满足「仅定制版侧」。
// 自举白名单（§4.4）：version / identity / install / uninstall / help 等自管理命令豁免，避免自锁。
function oloCoexistIsAgentEnrolled(
  registryPath: string,
  agentId: string,
  permissionDomain: string,
): boolean {
  if (!existsSync(registryPath)) return false
  let raw: string
  try {
    raw = readFileSync(registryPath, "utf8")
  } catch {
    return false
  }
  // 最小 YAML 解析：仅抽取 agents[] 中 (agent_id, permission_domain) 复合键（与 validate_registry.py 同源字段；v3 复合唯一）。
  const lines = raw.split("\n")
  let inAgents = false
  let curId: string | null = null
  let curDomain: string | null = null
  const enrolled = new Set<string>()
  const flush = () => {
    if (curId !== null && curDomain !== null) enrolled.add(`${curId}|${curDomain}`)
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
    if (/^-\s*agent_id:\s*/.test(content)) {
      flush()
      curId = content.replace(/^-\s*agent_id:\s*/, "").trim()
      curDomain = null
    } else if (/^permission_domain:\s*/.test(content)) {
      curDomain = content.replace(/^permission_domain:\s*/, "").replace(/^["']|["']$/g, "").trim()
    }
  }
  flush()
  return enrolled.has(`${agentId}|${permissionDomain}`)
}

const OLO_COEXIST_BOOTSTRAP_CMDS = new Set([
  "--version", "-v", "--help", "-h", "version", "identity", "install", "uninstall", "help",
])

function oloCoexistBootstrapGate(): void {
  // 编译二进制经 bun 重_exec：argv = ["bun", "<bundled-root>", ...userArgs]；
  // 脚本态 argv = ["bun", "index.ts", ...userArgs]。剥离前两个非用户段，取纯用户输入。
  const raw = process.argv.slice(1)
  const argv = raw[0] && /\.(ts|js|mjs|cjs)$/.test(raw[0]) ? raw.slice(1) : raw
  // 自举白名单（§4.4）：version/identity/install/uninstall/help 等自管理命令豁免，避免自锁。
  const isBootstrap = argv.some((a) => OLO_COEXIST_BOOTSTRAP_CMDS.has(a))
  if (isBootstrap) return

  const agentId = process.env.OLO_AGENT_ID ?? "codecustom"
  const permissionDomain = process.env.OLO_PERMISSION_DOMAIN ?? "repository-local"
  const registryPath =
    process.env.OLO_AGENT_REGISTRY ?? "D:\\Agent\\configs\\agent-registry.yaml"

  if (!oloCoexistIsAgentEnrolled(registryPath, agentId, permissionDomain)) {
    process.stderr.write(
      `OLO_AGENT_NOT_ENROLLED: agent_id=${agentId} permission_domain=${permissionDomain} ` +
        `not found in registry ${registryPath} — startup rejected (fail-closed, §11.8-15 / WP-5 W5-c)\n`,
    )
    process.exit(1)
  }
}

oloCoexistBootstrapGate()

let terminated = false

const Handlers = Runtime.handlers(Commands, {
  $: () => import("./commands/handlers/default"),
  upgrade: () => import("./commands/handlers/upgrade"),
  uninstall: () => import("./commands/handlers/uninstall"),
  acp: () => import("./commands/handlers/acp"),
  api: () => import("./commands/handlers/api"),
  identity: {
    show: () => import("./commands/handlers/identity/show"),
    verify: () => import("./commands/handlers/identity/verify"),
    list: () => import("./commands/handlers/identity/list"),
  },
  auth: {
    list: () => import("./commands/handlers/auth/list"),
    login: () => import("./commands/handlers/auth/login"),
    logout: () => import("./commands/handlers/auth/logout"),
    export: () => import("./commands/handlers/auth/export"),
    import: () => import("./commands/handlers/auth/import"),
    switch: () => import("./commands/handlers/auth/switch"),
  },
  debug: {
    agents: () => import("./commands/handlers/debug/agents"),
    config: () => import("./commands/handlers/debug/config"),
    "heap-dump": () => import("./commands/handlers/debug/heap-dump"),
    paths: () => import("./commands/handlers/debug/paths"),
  },
  mcp: {
    list: () => import("./commands/handlers/mcp/list"),
    add: () => import("./commands/handlers/mcp/add"),
    auth: () => import("./commands/handlers/mcp/auth"),
    logout: () => import("./commands/handlers/mcp/logout"),
  },
  plugin: {
    list: () => import("./commands/handlers/plugin/list"),
    add: () => import("./commands/handlers/plugin/add"),
    check: () => import("./commands/handlers/plugin/check"),
    update: () => import("./commands/handlers/plugin/update"),
    remove: () => import("./commands/handlers/plugin/remove"),
  },
  models: () => import("./commands/handlers/models"),
  stats: () => import("./commands/handlers/stats"),
  mini: () => import("./commands/handlers/mini"),
  run: () => import("./commands/handlers/run"),
  pair: () => import("./commands/handlers/pair"),
  reload: () => import("./commands/handlers/reload"),
  session: {
    list: () => import("./commands/handlers/session/list"),
    delete: () => import("./commands/handlers/session/delete"),
    export: () => import("./commands/handlers/session/export"),
    import: () => import("./commands/handlers/session/import"),
  },
  service: {
    start: () => import("./commands/handlers/service/start"),
    restart: () => import("./commands/handlers/service/restart"),
    status: () => import("./commands/handlers/service/status"),
    stop: () => import("./commands/handlers/service/stop"),
    get: () => import("./commands/handlers/service/get"),
    set: () => import("./commands/handlers/service/set"),
    unset: () => import("./commands/handlers/service/unset"),
  },
  serve: () => import("./commands/handlers/serve"),
})

Effect.gen(function* () {
  yield* Heap.listen
  yield* CpuProfile.listen
  yield* ShutdownDeadline.install()
  // runMain reports every signal interruption as 130; remember a SIGTERM so the exit code is 143.
  process.once("SIGTERM", () => {
    terminated = true
  })
  const runFork = Effect.runForkWith(yield* Effect.context<never>())
  const uncaughtException = (cause: Error, origin: "uncaughtException" | "unhandledRejection") => {
    runFork(Effect.logError("uncaught exception", { cause, origin }))
  }
  const unhandledRejection = (cause: unknown) => {
    runFork(Effect.logError("unhandled rejection", { cause }))
  }
  process.on("uncaughtException", uncaughtException)
  process.on("unhandledRejection", unhandledRejection)
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      process.off("uncaughtException", uncaughtException)
      process.off("unhandledRejection", unhandledRejection)
    }),
  )
  yield* Effect.logInfo("cli starting", {
    version: OPENCODE_VERSION,
    channel: OPENCODE_CHANNEL,
    local: OPENCODE_LOCAL,
    args: process.argv.slice(2),
  })
  return yield* Runtime.run(Commands, Handlers, { version: OPENCODE_VERSION })
}).pipe(
  Effect.catchCause((cause) =>
    Effect.gen(function* () {
      const config = yield* Config.Service
      yield* Effect.sync(() => process.stderr.write(translate(config.locale(), "miniCli.startup.failed") + "\n"))
      yield* Effect.logError("cli process failed", { cause, args: process.argv.slice(2) })
      return yield* Effect.failCause(cause)
    }),
  ),
  Effect.annotateLogs({ role: "cli" }),
  Effect.provide(Config.layer),
  Effect.provide(Updater.layer),
  Effect.provide(
    LayerNode.compile(LayerNode.group([Global.node, AppProcess.node, Npm.node, EffectFlock.node]), {
      replacements: [
        Global.node.replace(
          Global.layerWith(process.env.OPENCODE_CONFIG_DIR ? { config: process.env.OPENCODE_CONFIG_DIR } : {}),
        ),
      ],
    }),
  ),
  Effect.provide(
    Observability.layer({
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS,
      client: process.env.OPENCODE_CLIENT ?? OPENCODE_ARTIFACT,
      version: OPENCODE_VERSION,
      channel: OPENCODE_CHANNEL,
    }),
  ),
  Effect.provide(NodeServices.layer),
  Effect.scoped,
  // runMain's default reporter logs the fatal cause to stdout. Write it to stderr instead: the
  // desktop and `Service.ensure` only capture stderr from `serve --service`, so this is the only
  // channel through which a startup failure's reason reaches the user.
  Effect.tapCause((cause) =>
    Effect.sync(() => {
      if (Cause.hasInterruptsOnly(cause)) return
      if (!getErrorReported(Cause.squash(cause))) return
      process.stderr.write(Cause.pretty(cause) + "\n")
    }),
  ),
  NodeRuntime.runMain({
    disableErrorReporting: true,
    teardown: (exit) =>
      defaultTeardown(exit, (code) => {
        // Commands report failures through process.exitCode.
        const status = code === 0 ? (process.exitCode ?? 0) : code === 130 && terminated ? 143 : code
        // process.exit drops output still queued for a pipe; ending the streams waits for it.
        void Promise.all(
          [process.stdout, process.stderr].map((stream) => new Promise<void>((resolve) => stream.end(() => resolve()))),
        ).then(() => process.exit(status))
      }),
  }),
)
