import { Schema } from "effect"
import { parseArgs } from "node:util"
import root from "../../../package.json"

export const repository = "521ox/opencode2-zh-CN"
export const releaseRef = "refs/heads/v2-custom-lite"
export const channel = "latest"
export const bunVersion = "1.4.2"
export const targets = [
  "opencode-windows-x64",
  "opencode-windows-arm64",
  "opencode-linux-x64",
  "opencode-linux-arm64",
  "opencode-darwin-x64",
  "opencode-darwin-arm64",
] as const
export type Target = (typeof targets)[number]

const platforms = {
  "opencode-windows-x64": { platform: "win32", arch: "x64", runner: "windows-2025" },
  "opencode-windows-arm64": { platform: "win32", arch: "arm64", runner: "windows-11-arm" },
  "opencode-linux-x64": { platform: "linux", arch: "x64", runner: "ubuntu-24.04" },
  "opencode-linux-arm64": { platform: "linux", arch: "arm64", runner: "ubuntu-24.04-arm" },
  "opencode-darwin-x64": { platform: "darwin", arch: "x64", runner: "macos-15-intel" },
  "opencode-darwin-arm64": { platform: "darwin", arch: "arm64", runner: "macos-15" },
} as const

export function targetInfo(target: Target) {
  const native = platforms[target]
  const dist = target.replace("opencode-", "cli-")
  return {
    ...native,
    dist,
    executable: `${dist}/bin/opencode${native.platform === "win32" ? ".exe" : ""}`,
    archive: `${target}${native.platform === "win32" ? ".zip" : ".tar.gz"}`,
  }
}

export const TargetSchema = Schema.Literals(targets)
export const SourceSha = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/))
const Digest = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
const Bytes = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0))
export const Metadata = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  version: Schema.String,
  sourceSha: SourceSha,
  channel: Schema.Literal(channel),
  target: TargetSchema,
  bun: Schema.Struct({ version: Schema.Literal(bunVersion), revision: SourceSha }),
  native: Schema.Struct({
    platform: Schema.Literals(["win32", "linux", "darwin"]),
    arch: Schema.Literals(["x64", "arm64"]),
  }),
  bytecode: Schema.Literal(true),
  embeddedWebUI: Schema.Literal(true),
  unsigned: Schema.Literal(true),
  archive: Schema.Struct({ name: Schema.String, bytes: Bytes, sha256: Digest }),
  executable: Schema.Struct({ path: Schema.String, bytes: Bytes, sha256: Digest }),
})
export type Metadata = typeof Metadata.Type
export const decodeMetadata = Schema.decodeUnknownSync(Metadata, { onExcessProperty: "error" })

export function validateVersion(version: string) {
  const prefix = `${root.version}-zhcn.`
  if (!version.startsWith(prefix) || !/^[1-9][0-9]*$/.test(version.slice(prefix.length))) {
    throw new Error(`Release version must be ${root.version}-zhcn.<positive integer>: ${version}`)
  }
  return version
}

export function validateNative(target: Target, native: { platform: string; arch: string; bun: string }) {
  const expected = targetInfo(target)
  if (native.platform !== expected.platform || native.arch !== expected.arch) {
    throw new Error(`Native runner mismatch for ${target}: ${native.platform}/${native.arch}`)
  }
  if (native.bun !== bunVersion) throw new Error(`Bun must be exactly ${bunVersion}, received ${native.bun}`)
}

export function validateMetadata(metadata: Metadata, expected: { version: string; sourceSha: string; target: Target }) {
  const info = targetInfo(expected.target)
  if (metadata.version !== expected.version) throw new Error(`Version mismatch for ${expected.target}`)
  if (metadata.sourceSha !== expected.sourceSha) throw new Error(`Source SHA mismatch for ${expected.target}`)
  if (metadata.target !== expected.target) throw new Error(`Target mismatch for ${expected.target}`)
  if (metadata.archive.name !== info.archive) throw new Error(`Archive name mismatch for ${expected.target}`)
  if (metadata.executable.path !== info.executable) throw new Error(`Executable path mismatch for ${expected.target}`)
  validateNative(expected.target, { ...metadata.native, bun: metadata.bun.version })
}

// These release commands accept each required option once; parseArgs owns CLI syntax.
export function releaseArgs<const T extends string>(args: string[], names: readonly T[]): Record<T, string> {
  const parsed = parseArgs({
    args,
    options: Object.fromEntries(names.map((name) => [name, { type: "string" as const }])),
    strict: true,
    allowPositionals: false,
    tokens: true,
  })
  for (const name of names) {
    if (parsed.tokens.filter((token) => token.kind === "option" && token.name === name).length !== 1) {
      throw new Error(`Expected exactly one --${name}`)
    }
    if (!parsed.values[name]) throw new Error(`--${name} must not be empty`)
  }
  return parsed.values as Record<T, string>
}
