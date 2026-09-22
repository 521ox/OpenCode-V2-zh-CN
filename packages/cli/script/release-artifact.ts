import { Schema } from "effect"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, mkdir, mkdtemp, open, readdir, rm, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { pipeline } from "node:stream/promises"
import path from "node:path"
import {
  channel,
  decodeMetadata,
  releaseArgs,
  releaseRef,
  repository,
  SourceSha,
  TargetSchema,
  targetInfo,
  validateNative,
  validateVersion,
  type Target,
} from "./release-contract"

const execute = promisify(execFile)
const root = path.resolve(import.meta.dirname, "../../..")

export async function validateSource(sourceSha: string, cwd = root) {
  Schema.decodeUnknownSync(SourceSha)(sourceSha)
  const head = (await execute("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim()
  if (head !== sourceSha) throw new Error(`Source SHA does not match current HEAD: ${head}`)
  const status = await execute("git", ["status", "--porcelain", "--untracked-files=no"], { cwd })
  if (status.stdout.trim()) throw new Error("Release requires clean tracked source files")
}

export async function validateRelease(input: {
  version: string
  repository: string
  ref: string
  sourceSha: string
  target: Target
}) {
  validateVersion(input.version)
  if (input.repository !== repository) throw new Error(`Release repository must be ${repository}`)
  if (input.ref !== releaseRef) throw new Error(`Release ref must be ${releaseRef}`)
  validateNative(input.target, { platform: process.platform, arch: process.arch, bun: Bun.version })
  await validateSource(input.sourceSha)
}

export async function fileDigest(file: string) {
  const hash = createHash("sha256")
  const info = await lstat(file)
  if (!info.isFile()) throw new Error(`Expected a regular file: ${file}`)
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return { bytes: info.size, sha256: hash.digest("hex") }
}

async function inventory(
  root: string,
  current = "",
): Promise<
  {
    name: string
    directory: boolean
    mode: number
    bytes?: number
    sha256?: string
  }[]
> {
  const entries = await readdir(path.join(root, current), { withFileTypes: true })
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const name = current ? `${current}/${entry.name}` : entry.name
        const file = path.join(root, name)
        const info = await lstat(file)
        if (!info.isDirectory() && !info.isFile()) throw new Error(`Unsupported distribution entry: ${name}`)
        const item = { name, directory: info.isDirectory(), mode: info.mode & 0o777 }
        if (info.isDirectory()) return [item, ...(await inventory(root, name))]
        return [{ ...item, ...(await fileDigest(file)) }]
      }),
    )
  )
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function archiveExtraction(
  format: "zip" | "tar.gz",
  archive: string,
  destination: string,
  platform: NodeJS.Platform = process.platform,
  systemRoot = process.env.SystemRoot,
) {
  // Git Bash can put GNU tar first on PATH; Windows archives require the system bsdtar.
  if (platform === "win32") {
    if (!systemRoot || !path.win32.isAbsolute(systemRoot)) {
      throw new Error("Windows archive extraction requires an absolute SystemRoot")
    }
    return {
      command: path.win32.join(systemRoot, "System32", "tar.exe"),
      args: ["-xf", path.resolve(archive), "-C", path.resolve(destination)],
    }
  }
  // Unix tar implementations do not uniformly support ZIP.
  if (format === "zip") {
    return { command: "unzip", args: ["-q", path.resolve(archive), "-d", path.resolve(destination)] }
  }
  return { command: "tar", args: ["-xf", path.resolve(archive), "-C", path.resolve(destination)] }
}

// Archive only the complete, inspected target tree. Archiver owns both file formats.
export async function createArchive(dist: string, target: Target, output: string) {
  const { default: archiver } = await import("archiver")
  const info = targetInfo(target)
  if (path.basename(dist) !== info.dist || !(await lstat(dist)).isDirectory()) {
    throw new Error(`Distribution directory must be ${info.dist}`)
  }
  const entries = await inventory(dist)
  const executable = entries.find((entry) => `${info.dist}/${entry.name}` === info.executable)
  if (
    !executable ||
    executable.directory ||
    !entries.some((entry) => entry.name === "package.json" && !entry.directory)
  ) {
    throw new Error("Distribution must contain package.json and the target executable")
  }
  if (process.platform !== "win32" && info.platform !== "win32" && !(executable.mode & 0o111)) {
    throw new Error("Distribution executable is missing POSIX execute permission")
  }
  const destination = await open(output, "wx")
  const archive = info.platform === "win32" ? archiver("zip") : archiver("tar", { gzip: true })
  archive.on("warning", (error) => archive.destroy(error))
  const written = pipeline(archive, destination.createWriteStream())
  archive.append(Buffer.alloc(0), { name: `${info.dist}/`, mode: 0o755 })
  for (const entry of entries) {
    const name = `${info.dist}/${entry.name}`
    if (entry.directory) {
      archive.append(Buffer.alloc(0), { name: `${name}/`, mode: entry.mode })
      continue
    }
    archive.file(path.join(dist, entry.name), { name, mode: entry.mode })
  }
  await Promise.all([written, archive.finalize()])

  const extracted = await mkdtemp(path.join(path.dirname(output), ".verify-"))
  try {
    const extraction = archiveExtraction(info.platform === "win32" ? "zip" : "tar.gz", output, extracted)
    await execute(extraction.command, extraction.args, { timeout: 120_000 })
    const roots = await readdir(extracted)
    if (roots.length !== 1 || roots[0] !== info.dist) throw new Error("Archive root layout mismatch")
    const actual = await inventory(path.join(extracted, info.dist))
    const contents = (items: typeof entries) =>
      items.map(({ name, directory, bytes, sha256 }) => ({ name, directory, bytes, sha256 }))
    if (JSON.stringify(contents(entries)) !== JSON.stringify(contents(actual))) {
      throw new Error("Archive roundtrip file list/content mismatch")
    }
    if (process.platform !== "win32" && info.platform !== "win32") {
      const restored = actual.find((entry) => `${info.dist}/${entry.name}` === info.executable)
      if (!restored || !(restored.mode & 0o111)) throw new Error("Archive lost POSIX execute permission")
    }
  } finally {
    await rm(extracted, { recursive: true, force: true })
  }
}

export async function probeExecutable(
  executable: string,
  version: string,
  output: string,
  run: (
    file: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number; maxBuffer: number },
  ) => Promise<{ stdout: string }> = execute,
) {
  const home = await mkdtemp(path.join(output, ".probe-"))
  try {
    const env = {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      HOME: home,
      USERPROFILE: home,
      APPDATA: home,
      LOCALAPPDATA: home,
      XDG_CONFIG_HOME: home,
      XDG_DATA_HOME: home,
      XDG_CACHE_HOME: home,
      XDG_STATE_HOME: home,
      TMPDIR: home,
      TMP: home,
      TEMP: home,
      OPENCODE_DISABLE_MODELS_FETCH: "1",
      OPENCODE_DISABLE_AUTOUPDATE: "1",
    }
    const options = { cwd: home, env, timeout: 30_000, maxBuffer: 1024 * 1024 }
    const actual = (await run(executable, ["--version"], options)).stdout.trim()
    if (actual !== `opencode v${version}`) throw new Error(`Executable version mismatch: ${actual}`)
    const help = await run(executable, ["--help"], options)
    if (!help.stdout.includes("opencode")) throw new Error("Executable help probe returned no opencode usage")
    const revision = (
      await run(executable, ["--revision"], {
        ...options,
        env: { ...env, BUN_BE_BUN: "1" },
      })
    ).stdout.trim()
    if (revision !== `${Bun.version}+${Bun.revision.slice(0, 9)}`) {
      throw new Error(`Executable Bun revision mismatch: ${revision}`)
    }
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

export async function packageRelease(input: {
  version: string
  sourceSha: string
  target: Target
  dist: string
  output: string
}) {
  validateVersion(input.version)
  validateNative(input.target, { platform: process.platform, arch: process.arch, bun: Bun.version })
  await validateSource(input.sourceSha)
  const info = targetInfo(input.target)
  const dist = path.resolve(input.dist)
  const output = path.resolve(input.output)
  if (output === dist || output.startsWith(`${dist}${path.sep}`))
    throw new Error("Output must be outside the distribution")
  const pkg = Schema.decodeUnknownSync(
    Schema.Struct({
      name: Schema.String,
      version: Schema.String,
      os: Schema.Array(Schema.String),
      cpu: Schema.Array(Schema.String),
    }),
  )(await Bun.file(path.join(dist, "package.json")).json())
  if (
    pkg.name !== `@opencode/${info.dist}` ||
    pkg.version !== input.version ||
    pkg.os.length !== 1 ||
    pkg.os[0] !== info.platform ||
    pkg.cpu.length !== 1 ||
    pkg.cpu[0] !== info.arch
  ) {
    throw new Error("Distribution package.json does not match the release target/version")
  }
  await mkdir(path.dirname(output), { recursive: true })
  // Exclusive ownership: an existing output is never overwritten, even after a failed prior run.
  await mkdir(output)
  try {
    const executable = path.join(dist, "bin", path.basename(info.executable))
    await probeExecutable(executable, input.version, output)
    await createArchive(dist, input.target, path.join(output, info.archive))
    const metadata = decodeMetadata({
      schemaVersion: 1,
      version: input.version,
      sourceSha: input.sourceSha,
      channel,
      target: input.target,
      bun: { version: Bun.version, revision: Bun.revision },
      native: { platform: process.platform, arch: process.arch },
      // build.ts fixes bytecode; the workflow gates its embedded UI with service-smoke before packaging.
      bytecode: true,
      embeddedWebUI: true,
      unsigned: true,
      archive: { name: info.archive, ...(await fileDigest(path.join(output, info.archive))) },
      executable: { path: info.executable, ...(await fileDigest(executable)) },
    })
    await writeFile(path.join(output, `${info.archive}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" })
    return metadata
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  }
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  if (command === "validate") {
    const input = releaseArgs(args, ["version", "repository", "ref", "source-sha", "target"])
    await validateRelease({
      ...input,
      sourceSha: input["source-sha"],
      target: Schema.decodeUnknownSync(TargetSchema)(input.target),
    })
    console.log("Release source and native runner validated")
  } else if (command === "package") {
    const input = releaseArgs(args, ["version", "source-sha", "target", "dist", "output"])
    console.log(
      JSON.stringify(
        await packageRelease({
          ...input,
          sourceSha: input["source-sha"],
          target: Schema.decodeUnknownSync(TargetSchema)(input.target),
        }),
      ),
    )
  } else {
    throw new Error("Usage: release-artifact.ts <validate|package> --version ... --source-sha ... --target ...")
  }
}
