#!/usr/bin/env bun

import { NodeFileSystem } from "@effect/platform-node"
import { Service } from "@opencode/client/effect/service"
import { ServerInfo } from "@opencode/protocol/groups/server"
import { Effect, Schema } from "effect"
import fs from "node:fs/promises"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"

async function main() {
  const nodeBuild = process.argv.includes("--node")
  const target = `cli${nodeBuild ? "-node" : ""}-${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
  const directory = path.join(import.meta.dir, "..", "dist", ...(nodeBuild ? ["node"] : []), target, "bin")
  const binary = path.join(
    directory,
    `${nodeBuild ? "opencode2-node" : "opencode"}${process.platform === "win32" ? ".exe" : ""}`,
  )
  if (!(await Bun.file(binary).exists())) throw new Error(`Missing compiled CLI in ${directory}`)

  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "opencode-service-smoke-")))
  const env = smokeEnv(root, process.env)
  const processes: Array<ReturnType<typeof Bun.spawn>> = []
  const diagnostics: Array<{ pid: number; tail: Promise<string> }> = []
  const passwords = new Set<string>()
  const started = Date.now()
  let failure: unknown
  let stage = "private directories"
  try {
    await fs.mkdir(path.join(root, ".opencode", "plugins"), { recursive: true })
    await fs.mkdir(path.join(root, "cwd"))
    await fs.mkdir(path.join(root, "tmp"))
    stage = "private shared loopback port allocation"
    const port = await allocateSmokePort()
    stage = "contender election and default registration"
    // Both contenders must compete for one listener, as in the official service command.
    // Separate --port 0 listeners would also race application bootstrap over the same DB.
    spawnService(port)
    spawnService(port)
    console.log(`Private contenders started: pids=${processes.map((child) => child.pid).join(",")}`)
    const elected = await waitForRegistration()
    const registration = elected.file
    const info = elected.info
    stage = "registered owned identity validation"
    assertIdentity(
      info,
      processes.map((child) => child.pid),
    )
    if (new URL(info.url).port !== String(port)) throw new Error("Registered service did not bind the selected port")
    const credential = btoa(`opencode:${info.password}`)
    const headers = { authorization: "Basic " + credential }
    const token = encodeURIComponent(credential)
    const serverInfo = await waitForReady(info, headers)
    stage = "ready HTTP identity validation"
    console.log(
      `Ready identity: pidMatches=${serverInfo.pid === info.pid}, versionMatches=${serverInfo.version === info.version}, expectedVersionMatches=${process.env.RELEASE_VERSION === undefined || serverInfo.version === process.env.RELEASE_VERSION}`,
    )
    assertIdentity(
      info,
      processes.map((child) => child.pid),
      serverInfo,
      process.env.RELEASE_VERSION,
    )
    stage = "query-authenticated GET /api/info"
    const tokenInfo = await fetch(new URL(`/api/info?auth_token=${token}`, info.url), {
      signal: AbortSignal.timeout(5_000),
    })
    console.log(`${stage}: expected 200, actual ${tokenInfo.status}`)
    if (tokenInfo.status !== 200) throw new Error("Compiled service rejected query authentication")
    stage = "query info JSON read"
    const queryBody: unknown = await tokenInfo.json()
    stage = "query info ServerInfo schema"
    const queryInfo = await Schema.decodeUnknownPromise(ServerInfo)(queryBody)
    stage = "query info identity validation"
    console.log(
      `Query identity: pidMatches=${queryInfo.pid === info.pid}, versionMatches=${queryInfo.version === info.version}`,
    )
    assertIdentity(
      info,
      processes.map((child) => child.pid),
      queryInfo,
      process.env.RELEASE_VERSION,
    )
    stage = "query-authenticated GET /openapi.json"
    const tokenOpenApi = await fetch(new URL(`/openapi.json?auth_token=${token}`, info.url), {
      signal: AbortSignal.timeout(5_000),
    })
    console.log(`${stage}: expected 200, actual ${tokenOpenApi.status}`)
    if (tokenOpenApi.status !== 200) throw new Error("Compiled application rejected query authentication")
    if (!(await tokenOpenApi.json()).openapi) throw new Error("Invalid OpenAPI document")
    stage = "embedded WebUI HTML"
    const html = await fetch(new URL("/", info.url), { headers, signal: AbortSignal.timeout(5_000) })
    console.log(`${stage}: expected 200, actual ${html.status}`)
    if (html.status !== 200 || !html.headers.get("content-type")?.includes("text/html"))
      throw new Error("Missing embedded WebUI HTML")
    const body = await html.text()
    const tags = body.match(/<script\b[^>]*>/gi) ?? []
    const module = tags
      .find((tag) => /\btype\s*=\s*["']module["']/i.test(tag))
      ?.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!body.trim() || !module) throw new Error("Missing embedded WebUI module reference")
    const url = new URL(module, info.url)
    if (url.origin !== new URL(info.url).origin) throw new Error("WebUI module is not embedded")
    stage = "embedded WebUI module"
    const asset = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) })
    console.log(`${stage}: expected 200, actual ${asset.status}`)
    if (
      asset.status !== 200 ||
      !/(javascript|ecmascript)/i.test(asset.headers.get("content-type") ?? "") ||
      !(await asset.text()).trim()
    )
      throw new Error("Missing embedded WebUI module")
    stage = "dynamic plugin discovery"
    if ((await pluginIDs(info.url, headers)).includes("smoke")) throw new Error("Smoke plugin existed before creation")
    const plugin = path.join(root, ".opencode", "plugins", "smoke.ts")
    await fs.writeFile(plugin, pluginSource())
    await waitForPlugin(info.url, headers)

    stage = "unauthenticated GET /api/info"
    const unauthorizedInfo = await fetch(new URL("/api/info", info.url), {
      signal: AbortSignal.timeout(5_000),
    })
    console.log(`${stage}: expected 401, actual ${unauthorizedInfo.status}`)
    if (unauthorizedInfo.status !== 401) throw new Error("Compiled service exposed info without authentication")
    stage = "unauthenticated GET /openapi.json"
    const unauthorizedOpenApi = await fetch(new URL("/openapi.json", info.url), {
      signal: AbortSignal.timeout(5_000),
    })
    console.log(`${stage}: expected 401, actual ${unauthorizedOpenApi.status}`)
    if (unauthorizedOpenApi.status !== 401)
      throw new Error("Compiled service exposed application routes without authentication")
    stage = "authenticated POST /api/service/stop"
    const stopRoute = await fetch(new URL("/api/service/stop", info.url), {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ instanceID: info.id }),
      signal: AbortSignal.timeout(5_000),
    })
    console.log(`${stage}: expected 404, actual ${stopRoute.status}`)
    if (stopRoute.status !== 404) throw new Error("Compiled service exposed the removed HTTP stop route")

    stage = "elected contender identity"
    const winner = processes.find((process) => process.pid === info.pid)
    const loser = processes.find((process) => process.pid !== info.pid)
    if (!winner || !loser) throw new Error("Compiled contenders did not elect one registered owner")
    if (winner.exitCode !== null) throw new Error("Elected owner exited before lifecycle checks")
    stage = "elected loser terminal state"
    // Like Service.ensure, an authenticated, compatible ready winner establishes election success.
    // A competing cold instance can fail; it must terminate without harness intervention.
    const loserCode = await cleanExit(loser, 10_000, "elected-loser")
    if (loserCode === 0) console.log("Elected loser terminated with actual code 0")
    if (loserCode !== 0) {
      console.warn(`WARNING: elected loser terminated with actual code ${loserCode}; healthy owned winner verified`)
      const tail = await diagnostics.find((child) => child.pid === loser.pid)?.tail
      const text = redactSmokeDiagnostic(tail ?? "", [...passwords])
      console.warn(`Elected loser stderr: pid=${loser.pid}, sanitizedChars=${text.length}`)
      console.warn(text || "[no stderr diagnostic]")
    }
    stage = "default database and stable ownership"
    if (!(await Bun.file(path.join(root, "data", "opencode", "opencode.db")).exists()))
      throw new Error("Missing default database")
    if (await Bun.file(path.join(root, "data", "opencode", "opencode-local.db")).exists())
      throw new Error("Unexpected local-channel database")
    console.log("Default database: opencode.db exists; opencode-local.db absent")
    const current = await Schema.decodeUnknownPromise(Service.Info)(await Bun.file(registration).json())
    if (
      current.id !== info.id ||
      current.pid !== info.pid ||
      current.password !== info.password ||
      current.url !== info.url ||
      current.version !== info.version
    )
      throw new Error("Registration owner changed")

    stage = "official Service.stop for live owned winner"
    if (winner.exitCode !== null) throw new Error("Owned winner exited before Service.stop")
    await Effect.runPromise(Service.stop({ file: registration }).pipe(Effect.provide(NodeFileSystem.layer)))
    // Service.stop owns SIGTERM / possible SIGKILL escalation, not a zero-exit guarantee.
    stage = "owned stop termination"
    const winnerCode = await cleanExit(winner, 10_000, "owned-stop")
    console.log(`Owned stop terminated with actual code ${winnerCode}`)
    stage = "owned stop registration removal"
    for (let attempt = 0; attempt < 200 && (await Bun.file(registration).exists()); attempt++) await Bun.sleep(25)
    if (await Bun.file(registration).exists()) throw new Error("Compiled service registration was not removed")
    console.log("Owned stop registration removed")
  } catch {
    // Schema failures and raw server logs can include the private credential.
    failure = new Error(`Compiled service smoke failed at ${stage}`)
    console.error(`Smoke failure elapsedMs=${Date.now() - started}`)
    console.error(
      `Contenders before cleanup: ${processes.map((child) => `pid=${child.pid} exit=${child.exitCode ?? "running"}`).join(", ")}`,
    )
  } finally {
    processes.forEach((child) => {
      if (child.exitCode !== null) return
      failure ??= new Error("Compiled service required forced cleanup")
      child.kill()
    })
    await Promise.all(processes.map((process) => process.exited))
    const stderr = await Promise.all(diagnostics.map(async (child) => ({ pid: child.pid, tail: await child.tail })))
    if (failure) {
      for (const child of stderr) {
        const text = redactSmokeDiagnostic(child.tail, [...passwords])
        console.error(`Owned child stderr: pid=${child.pid}, sanitizedChars=${text.length}`)
        console.error(text || "[no stderr diagnostic]")
      }
      // Only fixed diagnostic markers leave this private, bounded log tail.
      const log = Bun.file(path.join(root, "data", "opencode", "log", "opencode.log"))
      const tail = await log
        .slice(-65_536)
        .text()
        .catch(() => undefined)
      console.error(
        `Private log diagnostic: available=${tail !== undefined}, markers=${smokeLogMarkers(tail ?? "").join(",") || "none"}`,
      )
      // Logging.fileLogger uses batched key=value lines, with a JSON-quoted cause.
      // stderr's synchronous ERROR mirror below also covers errors not yet flushed here.
      const complete =
        tail !== undefined && log.size > 65_536 ? (tail.includes("\n") ? tail.slice(tail.indexOf("\n") + 1) : "") : tail
      const errors = (complete ?? "")
        .split("\n")
        .filter((line) => /\blevel=ERROR\b/i.test(line))
        .join("\n")
      const text = redactSmokeDiagnostic(errors, [...passwords])
      console.error(`Private application errors: sanitizedChars=${text.length}`)
      console.error(text || "[no flushed application error in bounded log tail]")
    }
  }

  // Windows can retain directory handles briefly after the service processes exit.
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch((cause: unknown) => {
    console.error("Failed to remove service smoke-test directory", cause)
    failure ??= cause
  })
  if (failure) throw failure
  console.log(`Compiled service smoke passed (${target})`)

  function spawnService(port: number) {
    const process = Bun.spawn([binary, "serve", "--service", "--hostname", "127.0.0.1", "--port", String(port)], {
      env,
      cwd: path.join(root, "cwd"),
      stdout: "ignore",
      stderr: "pipe",
    })
    processes.push(process)
    diagnostics.push({ pid: process.pid, tail: smokeStderrTail(process.stderr) })
    return process
  }

  async function waitForRegistration() {
    const directory = path.join(root, "state", "opencode")
    let stale = false
    for (let attempt = 0; attempt < 400; attempt++) {
      stage = "waiting for default registration and one running contender"
      const file = path.join(directory, "service.json")
      // The registered owner and the other contender's termination establish election convergence.
      if ((await Bun.file(file).exists()) && processes.filter((child) => child.exitCode === null).length === 1) {
        stage = "registration JSON read"
        const body: unknown = await Bun.file(file).json()
        stage = "registration Service.Info schema"
        const info = await Schema.decodeUnknownPromise(Service.Info)(body)
        if (info.password) passwords.add(info.password)
        stage = "registration live owner selection"
        const live = registeredOwnerIsLive(info, processes)
        if (live || !stale)
          console.log(`Registration candidate: pid=${info.pid}, ownedLive=${live}, elapsedMs=${Date.now() - started}`)
        if (live) return { file, info }
        stale = true
      }
      if (processes.every((child) => child.exitCode !== null)) break
      await Bun.sleep(25)
    }
    throw new Error("Compiled service did not publish registration")
  }

  async function waitForReady(info: typeof Service.Info.Type, headers: HeadersInit) {
    const began = Date.now()
    const deadline = began + 20_000
    let last: number | "transport-error" | undefined
    while (Date.now() < deadline) {
      stage = "readiness registered owner liveness"
      if (!registeredOwnerIsLive(info, processes)) throw new Error("Registered owner exited before readiness")
      stage = "authenticated info HTTP readiness"
      const response = await fetch(new URL("/api/info", info.url), {
        headers,
        signal: AbortSignal.timeout(1_000),
      }).catch(() => undefined)
      const status = response?.status ?? "transport-error"
      if (status !== last)
        console.log(
          `Readiness GET /api/info: status=${status}, ownedPid=${info.pid}, ownedLive=${registeredOwnerIsLive(info, processes)}, elapsedMs=${Date.now() - began}`,
        )
      last = status
      if (response?.status === 200) {
        stage = "ready info JSON read"
        const body: unknown = await response.json()
        stage = "ready info ServerInfo schema"
        return Schema.decodeUnknownPromise(ServerInfo)(body)
      }
      // The server owner defines 503 as starting/stopping, and 500 as failed.
      // Other HTTP failures (including 401) are not readiness to retry away.
      if (response && response.status !== 503) {
        stage =
          response.status === 500 ? "server reported startup failed (HTTP 500)" : "unexpected readiness HTTP status"
        if (response.status === 500) {
          // /api/info's failed response contains identity, not the application failure cause.
          const body: unknown = await response.json()
          const failed = await Schema.decodeUnknownPromise(ServerInfo)(body)
          console.error(
            `Failed service identity: pidMatches=${failed.pid === info.pid}, versionMatches=${failed.version === info.version}`,
          )
          const application = await fetch(new URL("/openapi.json", info.url), {
            headers,
            signal: AbortSignal.timeout(1_000),
          })
          console.error(`Failed application probe: status=${application.status}`)
          const unavailable = await Schema.decodeUnknownPromise(Schema.Struct({ code: Schema.String }))(
            await application.json(),
          )
          console.error(`Failed application body: serviceFailed=${unavailable.code === "service_failed"}`)
        }
        throw new Error("Compiled service rejected readiness")
      }
      await response?.body?.cancel()
      await Bun.sleep(25)
    }
    stage = "authenticated info readiness deadline"
    console.error(
      `Readiness deadline: lastStatus=${last}, ownedPid=${info.pid}, ownedLive=${registeredOwnerIsLive(info, processes)}, elapsedMs=${Date.now() - began}`,
    )
    throw new Error("Compiled service did not become ready")
  }

  function pluginSource() {
    return 'export default { id: "smoke", setup: async () => {} }\n'
  }

  async function pluginIDs(url: string, headers: HeadersInit) {
    const endpoint = new URL("/api/plugin", url)
    endpoint.searchParams.set("location[directory]", root)
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(5_000) })
    if (response.status !== 200) throw new Error("Compiled service rejected plugin list")
    const body: unknown = await response.json()
    if (typeof body !== "object" || body === null || !("data" in body) || !Array.isArray(body.data)) {
      throw new Error("Compiled service returned an invalid plugin list")
    }
    return body.data.flatMap((plugin) =>
      typeof plugin === "object" && plugin !== null && "id" in plugin && typeof plugin.id === "string"
        ? [plugin.id]
        : [],
    )
  }

  async function waitForPlugin(url: string, headers: HeadersInit) {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if ((await pluginIDs(url, headers)).includes("smoke")) return
      await Bun.sleep(25)
    }
    throw new Error("Compiled service did not discover the created plugin")
  }
}

export async function allocateSmokePort() {
  const reservation = createServer()
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject)
    reservation.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve)
  })
  try {
    const address = reservation.address()
    if (!address || typeof address === "string" || address.port === 0)
      throw new Error("Failed to allocate a private loopback port")
    return address.port
  } finally {
    await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())))
  }
}

export async function smokeStderrTail(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let tail = ""
  let truncated = false
  try {
    while (true) {
      const chunk = await reader.read()
      tail += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true })
      if (tail.length > 16_384) {
        tail = tail.slice(-16_384)
        truncated = true
      }
      if (chunk.done) break
    }
    // Never emit a credential-bearing fragment whose field label was truncated away.
    if (!truncated) return tail
    const newline = tail.indexOf("\n")
    return newline === -1 ? "" : tail.slice(newline + 1)
  } catch {
    return "[stderr capture failed]"
  } finally {
    reader.releaseLock()
  }
}

export function redactSmokeDiagnostic(text: string, passwords: readonly string[]) {
  // File logger quotes structured causes; normalize escaped quotes before removing fields.
  let safe = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\\+(["'])/g, "$1")
  for (const password of passwords.filter(Boolean)) {
    const basic = btoa(`opencode:${password}`)
    for (const secret of [password, encodeURIComponent(password), basic, encodeURIComponent(basic)])
      safe = safe.replaceAll(secret, "[redacted]")
  }
  safe = safe
    .replace(/\bBasic\s+[A-Za-z0-9+/=_%-]+/gi, "Basic [redacted]")
    .replace(
      /(["']?(?:password|auth_token|authorization|token)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
      "$1[redacted]",
    )
    .replace(/https?:\/\/[^\s<>"']+/gi, "[url redacted]")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
  return (
    safe
      .split("\n")
      // Preserve Node's [cause] diagnostics, but omit source JSON and registration fields.
      .filter(
        (line) =>
          !/^\s*(?:[{}\]]|\[(?!cause\]\s*:))/.test(line) &&
          !/^\s*["']?(?:id|pid|url|password|version)["']?\s*:/.test(line),
      )
      .join("\n")
      .trim()
      .slice(-8_192)
  )
}

export function registeredOwnerIsLive(
  info: typeof Service.Info.Type,
  contenders: ReadonlyArray<Pick<Bun.Subprocess, "pid" | "exitCode">>,
) {
  return (
    contenders.filter((child) => child.exitCode === null).length === 1 &&
    contenders.some((child) => child.pid === info.pid && child.exitCode === null)
  )
}

export function smokeLogMarkers(text: string) {
  return [
    "background service boot failed",
    "managed service registration replaced",
    "registration check failed",
    "SQLITE_BUSY",
    "SQLITE_LOCKED",
    "database is locked",
    "SqlError",
    "MigrationError",
    "EADDRINUSE",
    "EACCES",
    "EPERM",
    "ENOENT",
    "ERR_DLOPEN_FAILED",
  ].filter((marker) => text.includes(marker))
}

export function smokeEnv(root: string, inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Keep only OS executable lookup essentials, never provider/proxy/GitHub settings.
  const env = Object.fromEntries(
    Object.entries(inherited).filter(([key]) =>
      ["path", "systemroot", "windir", "comspec", "pathext"].includes(key.toLowerCase()),
    ),
  )
  return {
    ...env,
    HOME: root,
    USERPROFILE: root,
    APPDATA: path.join(root, "config"),
    LOCALAPPDATA: path.join(root, "data"),
    TMP: path.join(root, "tmp"),
    TEMP: path.join(root, "tmp"),
    TMPDIR: path.join(root, "tmp"),
    OPENCODE_TEST_HOME: root,
    XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_STATE_HOME: path.join(root, "state"),
    // Original plugin fixture remains discoverable as the sole global config root.
    OPENCODE_CONFIG_DIR: path.join(root, ".opencode"),
    OPENCODE_CONFIG_PROJECT_DISABLE: "true",
    OPENCODE_DISABLE_MODELS_FETCH: "true",
    OPENCODE_DISABLE_AUTOUPDATE: "true",
    OPENCODE_PRINT_LOGS: "1",
    OPENCODE_LOG_LEVEL: "ERROR",
  }
}

export function assertIdentity(info: typeof Service.Info.Type, pids: number[], server?: ServerInfo, expected?: string) {
  if (
    !info.id ||
    !info.password ||
    !info.version ||
    pids.length !== 2 ||
    new Set(pids).size !== 2 ||
    !pids.includes(info.pid)
  )
    throw new Error("Registration is missing an owned service identity")
  const url = new URL(info.url)
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.port === "0" ||
    url.username ||
    url.password
  )
    throw new Error("Registration is not an owned loopback endpoint")
  if (server && (server.pid !== info.pid || server.version !== info.version))
    throw new Error("Server info does not match registration")
  if (expected !== undefined && (info.version !== expected || (server && server.version !== expected)))
    throw new Error("Compiled release version does not match RELEASE_VERSION")
}

export async function cleanExit(
  child: Pick<Bun.Subprocess, "exited">,
  milliseconds: number,
  reason: "normal" | "elected-loser" | "owned-stop" = "normal",
) {
  const code = await Promise.race([child.exited, Bun.sleep(milliseconds).then(() => undefined)])
  const expected = reason === "normal" ? "0" : "terminated"
  if (code === undefined || (reason === "normal" && code !== 0))
    throw new Error(`Compiled contender did not exit cleanly: expected ${expected}, actual ${code ?? "timeout"}`)
  return code
}

if (import.meta.main) await main()
