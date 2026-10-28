# OpenCode V2 zh-CN

**A community-maintained OpenCode V2 fork with Chinese/English interfaces and native-tool enhancements.**

[English](README.md) · [简体中文](README.zh.md)

[Features](#features) · [Downloads](#downloads) · [Build](#build-from-source) · [Contribute](CONTRIBUTING.md) · [Maintenance](UPSTREAM_SYNC.md)

Based on [OpenCode](https://github.com/anomalyco/opencode), the open-source AI coding agent. This project is independent of, and is not endorsed by, the official OpenCode team. The maintained branch is **`v2-custom-lite`**, tracking official **`dev`**; “lite” describes a bounded maintenance approach, not a localization-only feature set.

## Source and published binaries

| Track | Status as of October 28, 2026 |
| --- | --- |
| Maintained source | Official V2 **2.2.0** integrated; the local Windows x64 build `2.2.0-custom-lite.20261028.1` is accepted. See [source and acceptance evidence](UPSTREAM_SYNC.md). |
| Public binaries | [**v2.0.22-zhcn.1**](https://github.com/521ox/OpenCode-V2-zh-CN/releases/tag/v2.0.22-zhcn.1), an unsigned prerelease published October 4, 2026. The 2.2.0 source/local build is **not a published six-platform release**. |

Browse [all releases](https://github.com/521ox/OpenCode-V2-zh-CN/releases) for published assets. Legacy `main` and `v1.18.4-zhcn.*` releases do not represent this V2 branch. Official installers, npm packages and updates provide official builds and may replace the custom additions; this fork does not change that updater policy.

## Features

| Area | Custom behavior |
| --- | --- |
| Chinese / English | Simplified Chinese interface defaults with English selection/fallback across TUI, Mini and CLI-run presentation. Model/tool output and protocol data stay unchanged. |
| Native tools | `environment_tools` remembers and revalidates programs; `direct_exec` runs verified native EXE/COM entries by catalog ID and argument array, subject to execution permission. |
| Session memory | Root and child Sessions share a protected location for compact continuation memory, with conversation-first reads and current-state guidance. |
| Subagent navigation | Trusted completed results retain full final text within provider limits; visible Session identity and links open existing child Sessions. |
| Hosted search | Supported native OpenAI/xAI Responses routes expose search only when effective permissions allow it; model and account availability still apply. |
| Temporary artifacts | Agents receive task-owned cleanup guidance; it is not an automatic cleanup service. |

Exact behavior, retained repairs and exclusions live in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md). Maintenance evidence and known failures live in [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md).

## Downloads

Choose the matching asset from a **`2.x-zhcn.N` [release](https://github.com/521ox/OpenCode-V2-zh-CN/releases)**:

| System | Architectures | Archive |
| --- | --- | --- |
| Windows | x64, ARM64 | `opencode-windows-<arch>.zip` |
| Linux (glibc) | x64, ARM64 | `opencode-linux-<arch>.tar.gz` |
| macOS | x64, ARM64 | `opencode-darwin-<arch>.tar.gz` |

Extract the **complete archive** and run `cli-<platform>-<arch>/bin/opencode` (`opencode.exe` on Windows). These are CLI bundles with an embedded WebUI, **not Electron Desktop installers**; Linux musl is not included. Binaries are unsigned and macOS bundles are not notarized.

Compare the archive digest with the release's `SHA256SUMS`: `Get-FileHash -Algorithm SHA256 <archive>` on Windows, `sha256sum <archive>` on Linux, or `shasum -a 256 <archive>` on macOS. `release-manifest.json` and per-target sidecars identify the source, runtime and digests.

## Build from source

Windows x64 example using **Bun 1.4.4**, **Node 24** and Git with symlink support, in PowerShell:

```powershell
git clone -c core.symlinks=true --branch v2-custom-lite https://github.com/521ox/OpenCode-V2-zh-CN.git
cd OpenCode-V2-zh-CN
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
$env:HUSKY = "0"
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.2.0-custom-local.1"
$env:OPENCODE_CHANNEL = "latest"
$env:OPENCODE_TARGET = "windows-x64"
bun script/build.ts --skip-install
```

Use a distinct version for your source revision; this example does not reproduce an accepted artifact merely by using its version number. The official build entry recreates CLI `dist` and writes `packages/cli/dist/cli-windows-x64/bin/opencode.exe`, including bytecode and the complete embedded WebUI. Complete the root install before `--skip-install`; target selection uses `OPENCODE_TARGET`.

`OPENCODE_CHANNEL=latest` retains the normal database, service and TUI storage identity; `local` selects different state. It does not select a custom update feed. Building does not install or activate the executable. Keep a consistent backup of the previous executable and user state before replacing an installation.

## Contributing and maintenance

**Issue → feature branch → PR → required checks and applicable review → merge commit.**

Use `v2-custom-lite` as the PR base. For authorized tasks, agents may merge after the necessary checks and review, subject to the task's integration owner. Major product decisions and release publication require separate authorization. Upstream synchronization also goes through a PR and preserves official merge ancestry. Six-platform releases remain **manual**, not a side effect of merging.

- [CONTRIBUTING.md](CONTRIBUTING.md): task ownership, PR requirements, CI coverage and merge authority.
- [AGENTS.md](AGENTS.md): repository engineering conventions.
- [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md): synchronization procedure and accepted evidence.

## Verification limits

- Required CI covers scoped CLI/custom source checks and Windows fixtures, not the entire monorepo, browser/Electron or six-platform release validation. Known Console typecheck and Client reconnect failures remain documented in the maintenance record.
- Local synthetic-history checks do not certify real-user migration, unfinished legacy state or rollback. The historical `v2.0.15-zhcn.1` assets retain an old image-checkpoint compatibility issue; see the maintenance record rather than deleting conversation history.
- Startup/service-lifetime changes and later parent notifications after background work reactivates a child remain outside the retained enhancements.

## Documentation and license

[Official V2 documentation](https://opencode.ai/v2/docs/) covers upstream usage; [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) defines this fork's differences. English and Simplified Chinese are the maintained fork README entry points; other language READMEs retain upstream material.

Based on the work of OpenCode and its contributors. The [MIT license](LICENSE) and upstream copyright attribution are retained.
