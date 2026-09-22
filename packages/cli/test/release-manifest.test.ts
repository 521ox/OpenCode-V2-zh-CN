import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { chmod, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createArchive, fileDigest } from "../script/release-artifact"
import { bunVersion, channel, decodeMetadata, targetInfo, targets, type Metadata } from "../script/release-contract"
import { assembleRelease } from "../script/release-manifest"

const version = "2.0.12-zhcn.1"
const sourceSha = "a".repeat(40)
const temporary = process.env.RELEASE_TEST_TEMP ?? path.join(tmpdir(), "opencode-release-tests")
let fixture: string

beforeAll(async () => {
  await mkdir(temporary, { recursive: true })
  fixture = await mkdtemp(path.join(temporary, "manifest-fixture-"))
  for (const target of targets) {
    const info = targetInfo(target)
    const dist = path.join(fixture, "dist", info.dist)
    await mkdir(path.join(dist, "bin"), { recursive: true })
    await writeFile(path.join(dist, "package.json"), JSON.stringify({ version }))
    await writeFile(path.join(fixture, "dist", info.executable), `synthetic executable for ${target}`)
    await chmod(path.join(fixture, "dist", info.executable), 0o755)
    const directory = path.join(fixture, "artifacts", `release-${target}`)
    await mkdir(directory, { recursive: true })
    await createArchive(dist, target, path.join(directory, info.archive))
    const metadata: Metadata = {
      schemaVersion: 1,
      version,
      sourceSha,
      channel,
      target,
      bun: { version: bunVersion, revision: "b".repeat(40) },
      native: { platform: info.platform, arch: info.arch },
      bytecode: true,
      embeddedWebUI: true,
      unsigned: true,
      archive: { name: info.archive, ...(await fileDigest(path.join(directory, info.archive))) },
      executable: { path: info.executable, ...(await fileDigest(path.join(fixture, "dist", info.executable))) },
    }
    await writeFile(path.join(directory, `${info.archive}.json`), JSON.stringify(metadata))
  }
})

afterAll(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true })
})

async function scenario(
  run: (input: { version: string; sourceSha: string; artifacts: string; output: string }) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(temporary, "manifest-case-"))
  try {
    const artifacts = path.join(directory, "artifacts")
    await cp(path.join(fixture, "artifacts"), artifacts, { recursive: true })
    await run({ version, sourceSha, artifacts, output: path.join(directory, "assets") })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const first = targetInfo(targets[0])
const sidecar = (artifacts: string) => path.join(artifacts, `release-${targets[0]}`, `${first.archive}.json`)

describe("six-platform manifest", () => {
  test("produces exactly 14 assets and checksums every archive, sidecar and manifest", async () => {
    await scenario(async (input) => {
      const manifest = await assembleRelease(input)
      expect(manifest.tag).toBe(`v${version}`)
      expect(manifest.prerelease).toBe(true)
      expect(manifest.platforms.map((item) => item.target)).toEqual([...targets])
      expect(await readdir(input.output)).toHaveLength(14)
      const sums = (await Bun.file(path.join(input.output, "SHA256SUMS")).text()).trim().split("\n")
      expect(sums).toHaveLength(13)
      for (const line of sums) {
        const [sha256, name] = line.split("  ")
        expect((await fileDigest(path.join(input.output, name!))).sha256).toBe(sha256)
      }
      await expect(assembleRelease(input)).rejects.toThrow()
      expect(await readdir(input.output)).toHaveLength(14)
    })
  })

  test("rejects missing, extra and duplicate target directories", async () => {
    for (const mode of ["missing", "extra", "duplicate"]) {
      await scenario(async (input) => {
        const original = path.join(input.artifacts, `release-${targets[0]}`)
        if (mode === "missing") await rm(original, { recursive: true })
        if (mode === "extra") await mkdir(path.join(input.artifacts, "unrelated"))
        if (mode === "duplicate") await cp(original, `${original}-copy`, { recursive: true })
        await expect(assembleRelease(input)).rejects.toThrow("exactly six")
        expect(await Bun.file(path.join(input.output, "release-manifest.json")).exists()).toBe(false)
      })
    }
  })

  test("rejects unexpected files inside an artifact", async () => {
    await scenario(async (input) => {
      await writeFile(path.join(input.artifacts, `release-${targets[0]}`, "extra"), "extra")
      await expect(assembleRelease(input)).rejects.toThrow("only archive and sidecar")
    })
  })

  const mutations: { name: string; change: (metadata: Metadata) => unknown }[] = [
    { name: "source SHA", change: (m) => ({ ...m, sourceSha: "c".repeat(40) }) },
    { name: "version", change: (m) => ({ ...m, version: "2.0.12-zhcn.2" }) },
    { name: "channel", change: (m) => ({ ...m, channel: "dev" }) },
    { name: "Bun version", change: (m) => ({ ...m, bun: { ...m.bun, version: "1.4.3" } }) },
    { name: "Bun revision", change: (m) => ({ ...m, bun: { ...m.bun, revision: "c".repeat(40) } }) },
    { name: "duplicate target metadata", change: (m) => ({ ...m, target: targets[1] }) },
    { name: "native identity", change: (m) => ({ ...m, native: { platform: "linux", arch: "x64" } }) },
    { name: "archive name", change: (m) => ({ ...m, archive: { ...m.archive, name: "wrong.zip" } }) },
    { name: "executable path", change: (m) => ({ ...m, executable: { ...m.executable, path: "opencode.exe" } }) },
    { name: "archive SHA", change: (m) => ({ ...m, archive: { ...m.archive, sha256: "0".repeat(64) } }) },
    { name: "archive length", change: (m) => ({ ...m, archive: { ...m.archive, bytes: m.archive.bytes + 1 } }) },
    { name: "unknown field", change: (m) => ({ ...m, surprise: true }) },
    { name: "unknown nested field", change: (m) => ({ ...m, bun: { ...m.bun, surprise: true } }) },
    {
      name: "missing field",
      change: (m) => {
        const { unsigned, ...rest } = m
        return rest
      },
    },
    { name: "array instead of object", change: (m) => [m] },
    { name: "false embedded WebUI", change: (m) => ({ ...m, embeddedWebUI: false }) },
  ]
  for (const mutation of mutations) {
    test(`rejects ${mutation.name}`, async () => {
      await scenario(async (input) => {
        const metadata = decodeMetadata(await Bun.file(sidecar(input.artifacts)).json())
        await writeFile(sidecar(input.artifacts), JSON.stringify(mutation.change(metadata)))
        await expect(assembleRelease(input)).rejects.toThrow()
      })
    })
  }

  test("rejects modified archive bytes", async () => {
    await scenario(async (input) => {
      const archive = path.join(input.artifacts, `release-${targets[0]}`, first.archive)
      const data = await Bun.file(archive).bytes()
      data[0] = data[0]! ^ 0xff
      await writeFile(archive, data)
      await expect(assembleRelease(input)).rejects.toThrow("digest/length mismatch")
    })
  })
})
