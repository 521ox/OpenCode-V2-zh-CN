import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "./fixture/tmpdir"

test.each([
  ["zh", "OpenCode 运行失败："],
  ["en", "OpenCode failed: "],
])(
  "fatal startup reports its cause once on stderr with the %s banner",
  async (locale, banner) => {
    await using root = await tmpdir()
    await Promise.all(
      ["cwd", "home", "temp", "config", "cache", "data", "state", "appdata", "localappdata"].map((name) =>
        mkdir(path.join(root.path, name)),
      ),
    )

    // The port validator fails before service discovery, Service.stop, or config writes.
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        "run",
        path.join(import.meta.dir, "../src/index.ts"),
        "service",
        "set",
        "port",
        "0",
      ],
      {
        cwd: path.join(root.path, "cwd"),
        // Do not inherit credentials, service selectors, telemetry endpoints, or Bun options.
        env: {
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
          HOME: path.join(root.path, "home"),
          USERPROFILE: path.join(root.path, "home"),
          APPDATA: path.join(root.path, "appdata"),
          LOCALAPPDATA: path.join(root.path, "localappdata"),
          TEMP: path.join(root.path, "temp"),
          TMP: path.join(root.path, "temp"),
          TMPDIR: path.join(root.path, "temp"),
          XDG_CONFIG_HOME: path.join(root.path, "config"),
          XDG_CACHE_HOME: path.join(root.path, "cache"),
          XDG_DATA_HOME: path.join(root.path, "data"),
          XDG_STATE_HOME: path.join(root.path, "state"),
          OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ locale }),
          NO_COLOR: "1",
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        timeout: 20_000,
      },
    )
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])

    expect(child.signalCode).toBeNull()
    expect(exitCode).toBe(1)
    expect(stdout).toBe("")
    expect(stderr.startsWith(`${banner}\nError: Port must be between 1 and 65535\n`)).toBe(true)
    expect(stderr.match(/Port must be between 1 and 65535/g)).toHaveLength(1)
    expect(stderr.split(banner)).toHaveLength(2)
  },
  30_000,
)
