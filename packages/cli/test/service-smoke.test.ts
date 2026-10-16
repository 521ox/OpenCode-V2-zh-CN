import { describe, expect, test } from "bun:test"
import path from "node:path"
import { ConfigDiscovery } from "../../core/src/config/discovery"
import { isolatedEnv } from "./fixture/environment"
import {
  allocateSmokePort,
  assertIdentity,
  assertServerIdentity,
  cleanExit,
  redactSmokeDiagnostic,
  registeredOwnerIsLive,
  smokeEnv,
  smokeLogMarkers,
  smokeStderrTail,
  verifyWebUi,
} from "../script/service-smoke"

describe("compiled service smoke contract", () => {
  test("shared smoke port is nonzero and its temporary reservation is released", async () => {
    const port = await allocateSmokePort()
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThanOrEqual(65_535)
    const listener = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } })
    try {
      expect(listener.port).toBe(port)
      expect(listener.hostname).toBe("127.0.0.1")
    } finally {
      listener.stop(true)
    }
  })
  test("stderr diagnostics redact credentials and source JSON while retaining actionable errors", () => {
    const password = "fixture/private+password"
    const basic = btoa(`opencode:${password}`)
    const text = redactSmokeDiagnostic(
      [
        `Error: SQLITE_BUSY database is locked; password=${password}`,
        `Authorization: Basic ${basic}`,
        `GET http://127.0.0.1:12345/api/info?auth_token=${encodeURIComponent(basic)}`,
        'password="unknown-child-password" token=unknown-token',
        "auth_token=unknown-query-token",
        '{"pid":101,"password":"unknown-json-password","url":"http://127.0.0.1:12345"}',
        '  "password": "unknown-multiline-password",',
        `Error: Bun dlopen EPERM EACCES EADDRINUSE ENOENT ${encodeURIComponent(password)}`,
        '  [cause]: Error: UNKNOWN rename; password="nested-private-password"',
      ].join("\n"),
      [password],
    )
    for (const secret of [
      password,
      encodeURIComponent(password),
      basic,
      encodeURIComponent(basic),
      "unknown-child-password",
      "unknown-token",
      "unknown-query-token",
      "unknown-json-password",
      "unknown-multiline-password",
      "nested-private-password",
      "http://",
      '"pid"',
    ])
      expect(text).not.toContain(secret)
    expect(text).toContain("SQLITE_BUSY database is locked")
    expect(text).toContain("Bun dlopen EPERM EACCES EADDRINUSE ENOENT")
    expect(text).toContain("[cause]: Error: UNKNOWN rename")
    expect(text).toContain("[redacted]")
  })
  test("stderr is consumed across chunks with bounded retention and no truncated first-line fragment", async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("Authorization: Bas"))
        controller.enqueue(encoder.encode("ic c2VjcmV0\nError: SQLITE_LOCKED\n"))
        controller.close()
      },
    })
    const text = redactSmokeDiagnostic(await smokeStderrTail(stream), [])
    expect(text).not.toContain("c2VjcmV0")
    expect(text).toContain("Error: SQLITE_LOCKED")
    const long = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("password=" + "x".repeat(20_000) + "\nError: EPERM native extraction"))
        controller.close()
      },
    })
    expect(await smokeStderrTail(long)).toBe("Error: EPERM native extraction")
    expect(redactSmokeDiagnostic("Error: " + "x".repeat(20_000), []).length).toBeLessThanOrEqual(8_192)
  })
  test("file logger quoted causes retain errors while escaped credential fields are removed", () => {
    const cause = JSON.stringify(
      'SqlError: SQLITE_BUSY; password="private-log-password" auth_token="private-log-token"',
    )
    const text = redactSmokeDiagnostic(`level=ERROR message="background service boot failed" cause=${cause}`, [])
    expect(text).toContain("SqlError: SQLITE_BUSY")
    expect(text).toContain("background service boot failed")
    expect(text).not.toContain("private-log-password")
    expect(text).not.toContain("private-log-token")
  })
  test("isolates environment while preserving cross-platform executable lookup", () => {
    const root = path.resolve("private-smoke")
    const env = smokeEnv(root, {
      Path: "fixture-path",
      SystemRoot: "fixture-windows",
      COMSPEC: "fixture-shell",
      ProgramData: "host-machine-config",
      PROGRAMDATA: "host-machine-config-uppercase",
      GH_TOKEN: "secret",
      ANTHROPIC_API_KEY: "secret",
      HTTP_PROXY: "secret",
      OPENCODE_DB: "live.db",
      OPENCODE_CHANNEL: "local",
      OPENCODE_CONFIG: "live.json",
      OPENCODE_CONFIG_CONTENT: "secret",
      NODE_OPTIONS: "--require=live",
      BUN_OPTIONS: "live",
      RELEASE_VERSION: "2.0.12-zhcn.1",
      HOME: "live-home",
      TEMP: "live-temp",
    })
    expect(env.Path).toBe("fixture-path")
    expect(env.SystemRoot).toBe("fixture-windows")
    expect(env.COMSPEC).toBe("fixture-shell")
    expect(env.ProgramData).toBe(path.join(root, "program-data"))
    expect(env.PROGRAMDATA).toBeUndefined()
    expect(ConfigDiscovery.systemDirectory("win32", env).toString()).toBe(path.join(root, "program-data", "opencode"))
    for (const key of [
      "GH_TOKEN",
      "ANTHROPIC_API_KEY",
      "HTTP_PROXY",
      "OPENCODE_DB",
      "OPENCODE_CHANNEL",
      "OPENCODE_CONFIG",
      "OPENCODE_CONFIG_CONTENT",
      "NODE_OPTIONS",
      "BUN_OPTIONS",
      "RELEASE_VERSION",
    ])
      expect(env[key]).toBeUndefined()
    for (const key of ["HOME", "USERPROFILE", "OPENCODE_TEST_HOME"]) expect(env[key]).toBe(root)
    for (const key of ["TMP", "TEMP", "TMPDIR"]) expect(env[key]).toBe(path.join(root, "tmp"))
    for (const key of [
      "XDG_CACHE_HOME",
      "XDG_CONFIG_HOME",
      "XDG_DATA_HOME",
      "XDG_STATE_HOME",
      "APPDATA",
      "LOCALAPPDATA",
    ])
      expect(env[key]?.startsWith(root + path.sep)).toBe(true)
    expect(env.OPENCODE_CONFIG_DIR).toBe(path.join(root, ".opencode"))
    expect(env.OPENCODE_CONFIG_PROJECT_DISABLE).toBe("true")
    expect(env.OPENCODE_DISABLE_MODELS_FETCH).toBe("true")
    expect(env.OPENCODE_DISABLE_AUTOUPDATE).toBe("true")
    expect(env.OPENCODE_PRINT_LOGS).toBe("1")
    expect(env.OPENCODE_LOG_LEVEL).toBe("ERROR")
  })

  test("CLI fixture isolates machine and explicit config while preserving test overrides", () => {
    const root = path.resolve("private-cli")
    const previous = { ProgramData: process.env.ProgramData, OPENCODE_CONFIG: process.env.OPENCODE_CONFIG }
    process.env.ProgramData = "host-machine-config"
    process.env.OPENCODE_CONFIG = "host-explicit-config.json"
    try {
      const env: NodeJS.ProcessEnv = isolatedEnv(root)
      expect(env.ProgramData).toBe(path.join(root, "program-data"))
      expect(env.OPENCODE_CONFIG).toBeUndefined()
      expect(ConfigDiscovery.systemDirectory("win32", env).toString()).toBe(path.join(root, "program-data", "opencode"))
      expect(env.OPENCODE_CONFIG_PROJECT_DISABLE).toBe(process.env.OPENCODE_CONFIG_PROJECT_DISABLE)
      const explicit = path.join(root, "explicit.json")
      expect(isolatedEnv(root, { OPENCODE_CONFIG: explicit }).OPENCODE_CONFIG).toBe(explicit)
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  const info = {
    id: "fixture",
    password: "fixture-private",
    version: "2.0.12-zhcn.1",
    pid: 101,
    url: "http://127.0.0.1:12345",
  }
  const server = { pid: 101, version: info.version, urls: [info.url], paths: { tmp: "fixture" } }
  test("registration must name the sole live owned contender, not the exited contender", () => {
    expect(
      registeredOwnerIsLive(info, [
        { pid: 101, exitCode: null },
        { pid: 102, exitCode: 130 },
      ]),
    ).toBe(true)
    expect(
      registeredOwnerIsLive(info, [
        { pid: 101, exitCode: 130 },
        { pid: 102, exitCode: null },
      ]),
    ).toBe(false)
    expect(
      registeredOwnerIsLive(info, [
        { pid: 101, exitCode: null },
        { pid: 102, exitCode: null },
      ]),
    ).toBe(false)
    expect(
      registeredOwnerIsLive(info, [
        { pid: 101, exitCode: 0 },
        { pid: 102, exitCode: 130 },
      ]),
    ).toBe(false)
    expect(
      registeredOwnerIsLive(info, [
        { pid: 999, exitCode: null },
        { pid: 102, exitCode: 130 },
      ]),
    ).toBe(false)
  })
  test("private log evidence emits only fixed markers, never raw credential-bearing content", () => {
    expect(
      smokeLogMarkers('password=fixture-private auth_token=fixture-token cause="SQLITE_BUSY: database is locked"'),
    ).toEqual(["SQLITE_BUSY", "database is locked"])
    expect(smokeLogMarkers("password=fixture-private unknown cause with private path")).toEqual([])
    expect(smokeLogMarkers("background service boot failed SqlError")).toEqual([
      "background service boot failed",
      "SqlError",
    ])
  })
  test("accepts the elected native release identity", () => {
    expect(() => assertIdentity(info, [101, 102], info.version)).not.toThrow()
    expect(() => assertServerIdentity(info, server)).not.toThrow()
  })
  test("rejects unowned, incomplete, non-loopback and mismatched identities", () => {
    for (const patch of [
      { id: undefined },
      { password: undefined },
      { version: undefined },
      { pid: 999 },
      { url: "http://example.com:12345" },
      { url: "http://127.0.0.1:0" },
      { url: "http://user:secret@127.0.0.1:12345" },
    ])
      expect(() => assertIdentity({ ...info, ...patch }, [101, 102])).toThrow()
    expect(() => assertIdentity(info, [101, 101])).toThrow()
    expect(() => assertServerIdentity(info, { ...server, pid: 102 })).toThrow()
    expect(() => assertServerIdentity(info, { ...server, version: "local" })).toThrow()
    expect(() => assertIdentity(info, [101, 102], "2.0.12")).toThrow()
  })
  test("WebUI smoke reads the anonymous shell and its embedded module, rejecting an HTML asset fallback", async () => {
    const requests: Array<{ path: string; authorization: string | null }> = []
    let fallback = false
    using listener = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname
        requests.push({ path: pathname, authorization: request.headers.get("authorization") })
        if (pathname === "/" || fallback)
          return new Response('<html><script type="module" src="/_assets/app.js"></script></html>', {
            headers: { "content-type": "text/html" },
          })
        return new Response('console.log("embedded")', { headers: { "content-type": "text/javascript" } })
      },
    })
    await verifyWebUi(listener.url.toString())
    expect(requests).toEqual([
      { path: "/", authorization: null },
      { path: "/_assets/app.js", authorization: null },
    ])
    fallback = true
    await expect(verifyWebUi(listener.url.toString())).rejects.toThrow("Missing embedded WebUI module")
  })
  test("WebUI smoke rejects an external module before fetching it", async () => {
    using listener = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        new Response('<html><script type="module" src="https://example.invalid/app.js"></script></html>', {
          headers: { "content-type": "text/html" },
        }),
    })
    await expect(verifyWebUi(listener.url.toString())).rejects.toThrow("WebUI module is not embedded")
  })
  test("only a normal zero exit passes, never nonzero or timeout cleanup", async () => {
    await expect(cleanExit({ exited: Promise.resolve(0) }, 10)).resolves.toBe(0)
    await expect(cleanExit({ exited: Promise.resolve(1) }, 10)).rejects.toThrow("did not exit cleanly")
    await expect(cleanExit({ exited: Promise.resolve(130) }, 10)).rejects.toThrow(
      "Compiled contender did not exit cleanly: expected 0, actual 130",
    )
    await expect(cleanExit({ exited: Promise.resolve(137) }, 10)).rejects.toThrow("did not exit cleanly")
    await expect(cleanExit({ exited: new Promise<number>(() => {}) }, 1)).rejects.toThrow(
      "Compiled contender did not exit cleanly: expected 0, actual timeout",
    )
  })
  test("verified healthy winner permits terminated losers, never timeout or failures outside election context", async () => {
    for (const code of [0, 1, 130, 137, 143])
      await expect(cleanExit({ exited: Promise.resolve(code) }, 10, "elected-loser")).resolves.toBe(code)
    for (const code of [1, 130, 137, 143])
      await expect(cleanExit({ exited: Promise.resolve(code) }, 10)).rejects.toThrow(`expected 0, actual ${code}`)
    await expect(cleanExit({ exited: new Promise<number>(() => {}) }, 1, "elected-loser")).rejects.toThrow(
      "expected terminated, actual timeout",
    )
  })
  test("successful owned Service.stop requires termination, not a portable exit code", async () => {
    for (const code of [0, 1, 130, 137, 143])
      await expect(cleanExit({ exited: Promise.resolve(code) }, 10, "owned-stop")).resolves.toBe(code)
    await expect(cleanExit({ exited: new Promise<number>(() => {}) }, 1, "owned-stop")).rejects.toThrow(
      "expected terminated, actual timeout",
    )
  })
})
