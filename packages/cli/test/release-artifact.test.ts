import { describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"
import path from "node:path"
import root from "../../../package.json"
import {
  archiveExtraction,
  createArchive,
  probeExecutable,
  validateRelease,
  validateSource,
} from "../script/release-artifact"
import {
  releaseArgs,
  releaseRef,
  repository,
  targetInfo,
  validateNative,
  validateVersion,
  type Target,
} from "../script/release-contract"

const temporary = process.env.RELEASE_TEST_TEMP ?? path.join(tmpdir(), "opencode-release-tests")
const version = `${root.version}-zhcn.1`

describe("release validation", () => {
  test("accepts only the root base version and positive zhcn release ordinal", () => {
    expect(validateVersion(version)).toBe(version)
    expect(validateVersion(`${root.version}-zhcn.123`)).toBe(`${root.version}-zhcn.123`)
    for (const invalid of [
      root.version,
      "0.0.0-zhcn.1",
      `${root.version}-zhcn.0`,
      `${root.version}-zhcn.01`,
      `${root.version}-zhcn.-1`,
      `${version}+test`,
      `${version}\n`,
    ]) {
      expect(() => validateVersion(invalid)).toThrow()
    }
  })

  test("native identity and exact Bun cannot be substituted by a target flag", () => {
    expect(() =>
      validateNative("opencode-linux-arm64", { platform: "linux", arch: "arm64", bun: "1.4.2" }),
    ).not.toThrow()
    expect(() => validateNative("opencode-linux-arm64", { platform: "linux", arch: "x64", bun: "1.4.2" })).toThrow(
      "Native runner mismatch",
    )
    expect(() => validateNative("opencode-linux-arm64", { platform: "darwin", arch: "arm64", bun: "1.4.2" })).toThrow(
      "Native runner mismatch",
    )
    expect(() => validateNative("opencode-linux-arm64", { platform: "linux", arch: "arm64", bun: "1.4.3" })).toThrow(
      "Bun must be exactly",
    )
  })

  test("rejects another repository/ref and a source that is not HEAD", async () => {
    const input = {
      version,
      repository,
      ref: releaseRef,
      sourceSha: "0".repeat(40),
      target: "opencode-windows-x64" as const,
    }
    await expect(validateRelease({ ...input, repository: "someone/fork" })).rejects.toThrow("repository must be")
    await expect(validateRelease({ ...input, ref: "refs/heads/main" })).rejects.toThrow("ref must be")
    await expect(validateSource(input.sourceSha)).rejects.toThrow("does not match current HEAD")
    await expect(validateSource("not-a-sha")).rejects.toThrow()
  })

  test("rejects repeated, missing, positional and unknown CLI arguments", () => {
    expect(releaseArgs([`--version=${version}`], ["version"])).toEqual({ version })
    for (const args of [[], ["--version", "a", "--version", "b"], ["--unknown", "a"], ["position"], ["--version="]]) {
      expect(() => releaseArgs(args, ["version"])).toThrow()
    }
  })
})

describe("executable release probes", () => {
  const stdout = {
    "--version": `opencode v${version}\n`,
    "--help": "opencode [command]\n",
    "--revision": `${Bun.version}+${Bun.revision.slice(0, 9)}\n`,
  }
  const cases: {
    name: string
    override: Record<string, string>
    error?: string
    calls: string[]
  }[] = [
    {
      name: "accepts exact CLI version and completes help/revision probes",
      override: {},
      calls: ["--version", "--help", "--revision"],
    },
    {
      name: "rejects bare version",
      override: { "--version": version },
      error: "Executable version mismatch",
      calls: ["--version"],
    },
    {
      name: "rejects wrong prefix",
      override: { "--version": `other v${version}` },
      error: "Executable version mismatch",
      calls: ["--version"],
    },
    {
      name: "rejects missing v prefix",
      override: { "--version": `opencode ${version}` },
      error: "Executable version mismatch",
      calls: ["--version"],
    },
    {
      name: "rejects wrong release version",
      override: { "--version": `opencode v${root.version}-zhcn.2` },
      error: "Executable version mismatch",
      calls: ["--version"],
    },
    {
      name: "rejects invalid help after valid version",
      override: { "--help": "unexpected usage" },
      error: "Executable help probe",
      calls: ["--version", "--help"],
    },
    {
      name: "rejects wrong embedded Bun revision",
      override: { "--revision": "1.4.2+000000000" },
      error: "Executable Bun revision mismatch",
      calls: ["--version", "--help", "--revision"],
    },
  ]
  for (const fixture of cases) {
    test(fixture.name, async () => {
      await mkdir(temporary, { recursive: true })
      const output = await mkdtemp(path.join(temporary, "probe-regression-"))
      try {
        const calls: string[] = []
        const executable = path.join(output, "controlled-executable")
        const responses: Record<string, string> = { ...stdout, ...fixture.override }
        const result = probeExecutable(executable, version, output, async (file, args, options) => {
          expect(file).toBe(executable)
          expect(args).toHaveLength(1)
          const argument = args[0]!
          calls.push(argument)
          expect(path.dirname(options.cwd)).toBe(output)
          expect(options.env.HOME).toBe(options.cwd)
          expect(options.env.XDG_CONFIG_HOME).toBe(options.cwd)
          expect(options.env.OPENCODE_DISABLE_MODELS_FETCH).toBe("1")
          expect(options.env.OPENCODE_DISABLE_AUTOUPDATE).toBe("1")
          expect(options.env.BUN_BE_BUN).toBe(argument === "--revision" ? "1" : undefined)
          expect(options.env.OPENAI_API_KEY).toBeUndefined()
          return { stdout: responses[argument]! }
        })
        if (fixture.error) await expect(result).rejects.toThrow(fixture.error)
        if (!fixture.error) await result
        expect(calls).toEqual(fixture.calls)
        expect(await readdir(output)).toEqual([])
      } finally {
        await rm(output, { recursive: true, force: true })
      }
    })
  }
})

describe("real archive roundtrip", () => {
  for (const platform of ["win32", "linux", "darwin"] as const) {
    test(`${platform}: selects a format-capable extraction tool with separate path arguments`, () => {
      const archive = path.join(temporary, "archive with spaces.zip")
      const destination = path.join(temporary, "extracted with spaces")
      const systemRoot = "E:\\OS fixture\\Windows"
      expect(archiveExtraction("zip", archive, destination, platform, systemRoot)).toEqual({
        command: platform === "win32" ? "E:\\OS fixture\\Windows\\System32\\tar.exe" : "unzip",
        args:
          platform === "win32"
            ? ["-xf", path.resolve(archive), "-C", path.resolve(destination)]
            : ["-q", path.resolve(archive), "-d", path.resolve(destination)],
      })
      expect(archiveExtraction("tar.gz", `${archive}.tar.gz`, destination, platform, systemRoot)).toEqual({
        command: platform === "win32" ? "E:\\OS fixture\\Windows\\System32\\tar.exe" : "tar",
        args: ["-xf", path.resolve(`${archive}.tar.gz`), "-C", path.resolve(destination)],
      })
    })
  }

  test("Windows extraction rejects missing or relative SystemRoot instead of searching PATH", () => {
    for (const systemRoot of ["", "Windows"]) {
      expect(() => archiveExtraction("zip", "archive.zip", "destination", "win32", systemRoot)).toThrow(
        "requires an absolute SystemRoot",
      )
    }
  })

  test.skipIf(process.platform !== "win32")(
    "system bsdtar roundtrip survives Git GNU tar first on child PATH",
    async () => {
      await mkdir(temporary, { recursive: true })
      const directory = await mkdtemp(path.join(temporary, "git-tar-path-"))
      try {
        const git = Bun.which("git")
        if (!git) throw new Error("This Windows regression requires Git for Windows")
        const gitExecPath = execFileSync(git, ["--exec-path"], { encoding: "utf8" }).trim()
        const gitTools = path.resolve(gitExecPath, "../../../usr/bin")
        const dist = path.join(directory, "cli-windows-x64")
        await mkdir(path.join(dist, "bin"), { recursive: true })
        await writeFile(path.join(dist, "package.json"), JSON.stringify({ name: "@opencode/cli-windows-x64" }))
        await writeFile(path.join(dist, "bin", "opencode.exe"), "synthetic archive payload")
        const archive = path.join(directory, "opencode-windows-x64.zip")
        const legacyDestination = path.join(directory, "legacy-extraction")
        await mkdir(legacyDestination)
        const module = pathToFileURL(path.resolve(import.meta.dirname, "../script/release-artifact.ts")).href
        const result = execFileSync(
          process.execPath,
          [
            "--no-env-file",
            "--eval",
            `
        import { execFileSync, spawnSync } from "node:child_process"
        import { createArchive } from ${JSON.stringify(module)}
        const tarVersion = execFileSync("tar", ["--version"], { encoding: "utf8" }).trim()
        await createArchive(${JSON.stringify(dist)}, "opencode-windows-x64", ${JSON.stringify(archive)})
        const legacy = spawnSync("tar", ["-xf", ${JSON.stringify(archive)}, "-C", ${JSON.stringify(legacyDestination)}], { encoding: "utf8" })
        console.log(JSON.stringify({ tarVersion, legacyExit: legacy.status, legacyError: legacy.stderr }))
      `,
          ],
          {
            cwd: directory,
            env: {
              SystemRoot: process.env.SystemRoot,
              PATH: `${gitTools}${path.delimiter}${process.env.PATH ?? ""}`,
              HOME: directory,
              TEMP: directory,
              TMP: directory,
            },
            encoding: "utf8",
            timeout: 30_000,
          },
        )
        const evidence = JSON.parse(result)
        expect(evidence.tarVersion).toContain("GNU tar")
        expect(evidence.legacyExit).toBe(128)
        expect(evidence.legacyError).toContain("Cannot connect to")
        expect(evidence.legacyError).toContain("resolve failed")
        expect((await Bun.file(archive).bytes()).length).toBeGreaterThan(0)
        expect(await readdir(legacyDestination)).toEqual([])
        expect((await readdir(directory)).some((name) => name.startsWith(".verify-"))).toBe(false)
        console.log(
          `PATH regression: ${evidence.tarVersion.split("\n")[0]}; legacy exit ${evidence.legacyExit}; system bsdtar roundtrip passed`,
        )
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
  )

  for (const target of ["opencode-windows-x64", "opencode-linux-x64"] satisfies Target[]) {
    test(`${target}: full tree, empty directories, content and exclusive output`, async () => {
      await mkdir(temporary, { recursive: true })
      const directory = await mkdtemp(path.join(temporary, "artifact-"))
      try {
        const info = targetInfo(target)
        const dist = path.join(directory, info.dist)
        await mkdir(path.join(dist, "bin"), { recursive: true })
        await mkdir(path.join(dist, "empty"))
        await mkdir(path.join(dist, "assets", "nested"), { recursive: true })
        await writeFile(path.join(dist, "package.json"), JSON.stringify({ name: info.dist }))
        const executable = path.join(directory, info.executable)
        await writeFile(executable, Buffer.from([0, 1, 2, 255, 128, 0]))
        await chmod(executable, 0o755)
        await writeFile(path.join(dist, "assets", "nested", "你好.txt"), "complete target payload\n")
        const output = path.join(directory, info.archive)
        await createArchive(dist, target, output)
        const original = await Bun.file(output).bytes()
        expect(original.length).toBeGreaterThan(0)
        expect((await readdir(directory)).some((name) => name.startsWith(".verify-"))).toBe(false)
        await expect(createArchive(dist, target, output)).rejects.toThrow()
        expect(await Bun.file(output).bytes()).toEqual(original)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    })
  }

  test.skipIf(process.platform === "win32")("rejects a Unix distribution without executable permission", async () => {
    await mkdir(temporary, { recursive: true })
    const directory = await mkdtemp(path.join(temporary, "permissions-"))
    try {
      const dist = path.join(directory, "cli-linux-x64")
      await mkdir(path.join(dist, "bin"), { recursive: true })
      await writeFile(path.join(dist, "package.json"), "{}")
      await writeFile(path.join(dist, "bin", "opencode"), "not executable", { mode: 0o644 })
      await expect(createArchive(dist, "opencode-linux-x64", path.join(directory, "test.tar.gz"))).rejects.toThrow(
        "execute permission",
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
