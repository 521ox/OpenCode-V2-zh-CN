import { Schema } from "effect"
import { constants } from "node:fs"
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileDigest } from "./release-artifact"
import {
  channel,
  decodeMetadata,
  releaseArgs,
  repository,
  SourceSha,
  targetInfo,
  targets,
  validateMetadata,
  validateVersion,
} from "./release-contract"

export async function assembleRelease(input: {
  version: string
  sourceSha: string
  artifacts: string
  output: string
}) {
  validateVersion(input.version)
  Schema.decodeUnknownSync(SourceSha)(input.sourceSha)
  const artifacts = path.resolve(input.artifacts)
  const output = path.resolve(input.output)
  const directories = await readdir(artifacts, { withFileTypes: true })
  const expected = targets.map((target) => `release-${target}`).sort()
  if (
    directories.some((entry) => !entry.isDirectory()) ||
    JSON.stringify(directories.map((entry) => entry.name).sort()) !== JSON.stringify(expected)
  ) {
    throw new Error("Expected exactly six release-<target> artifact directories")
  }
  const platforms = await Promise.all(
    targets.map(async (target) => {
      const info = targetInfo(target)
      const directory = path.join(artifacts, `release-${target}`)
      const files = await readdir(directory, { withFileTypes: true })
      if (
        files.some((entry) => !entry.isFile()) ||
        JSON.stringify(files.map((entry) => entry.name).sort()) !==
          JSON.stringify([info.archive, `${info.archive}.json`].sort())
      ) {
        throw new Error(`Expected only archive and sidecar for ${target}`)
      }
      const metadata = decodeMetadata(await Bun.file(path.join(directory, `${info.archive}.json`)).json())
      validateMetadata(metadata, { ...input, target })
      const digest = await fileDigest(path.join(directory, info.archive))
      if (digest.bytes !== metadata.archive.bytes || digest.sha256 !== metadata.archive.sha256) {
        throw new Error(`Archive digest/length mismatch for ${target}`)
      }
      return metadata
    }),
  )
  if (new Set(platforms.map((item) => item.bun.revision)).size !== 1)
    throw new Error("Bun revision mismatch across targets")
  const manifest = {
    schemaVersion: 1,
    repository,
    tag: `v${input.version}`,
    version: input.version,
    sourceSha: input.sourceSha,
    channel,
    prerelease: true,
    platforms,
  }
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  try {
    for (const item of platforms) {
      for (const name of [item.archive.name, `${item.archive.name}.json`]) {
        await copyFile(
          path.join(artifacts, `release-${item.target}`, name),
          path.join(output, name),
          constants.COPYFILE_EXCL,
        )
      }
    }
    await writeFile(path.join(output, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    })
    const names = (await readdir(output)).sort()
    const sums = await Promise.all(
      names.map(async (name) => `${(await fileDigest(path.join(output, name))).sha256}  ${name}\n`),
    )
    await writeFile(path.join(output, "SHA256SUMS"), sums.join(""), { flag: "wx" })
    return manifest
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  }
}

if (import.meta.main) {
  const input = releaseArgs(process.argv.slice(2), ["version", "source-sha", "artifacts", "output"])
  const manifest = await assembleRelease({ ...input, sourceSha: input["source-sha"] })
  console.log(`Prepared ${manifest.platforms.length} platforms and 14 release assets for ${manifest.tag}`)
}
