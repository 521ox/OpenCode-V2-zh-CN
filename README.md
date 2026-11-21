# OpenCode V2 zh-CN · OpenCode 汉化版

**[简体中文使用指南](README.zh.md) · [中文下载与校验说明](README.zh.md#下载)**

This community-maintained edition of [OpenCode](https://github.com/anomalyco/opencode) starts the terminal interface in Simplified Chinese. Switch to English, run a verified local program without a shell wrapper, or click a subagent's task title to open its conversation. This fork is independent of the official OpenCode team and is not endorsed by it.

[Features](#features) · [Download and verify](#downloads) · [Build from source](#build-from-source) · [Contribute](CONTRIBUTING.md)

**[Download the CLI for Windows, macOS or Linux: v2.3.0-zhcn.2](https://github.com/521ox/OpenCode-V2-zh-CN/releases/tag/v2.3.0-zhcn.2)** (unsigned prerelease). Both x64 and ARM64 packages are available for each system, built from [this fork’s 2.3.0 source](https://github.com/521ox/OpenCode-V2-zh-CN/commit/46ff955de969d0825683c3022268772832837228).

## Features

These features describe `v2-custom-lite`. For an older binary, check the notes for its release tag.

| Feature | What you can do |
| --- | --- |
| Chinese / English UI | Use the TUI, Mini and `opencode run` in Simplified Chinese, or choose English. Only interface text is translated; model replies, tool output and protocol data stay unchanged. |
| Native tools | `environment_tools` records and revalidates programs. `direct_exec` runs a verified native EXE/COM by its catalog entry ID and argument array, subject to execution permission. With automatic grouping, consecutive calls fold into one expandable group in the TUI. |
| Session working memory | A root session and its descendants share one protected location for compact notes. Agents use the conversation first and consult notes when needed; unrelated sessions do not share this memory. |
| Subagent navigation | Click the task title after `·` in a completion notice to open that exact child session. The parent can receive the child's full final reply within provider limits; follow-up reports use the upstream notification mechanism. |
| Hosted search | Use native search on supported OpenAI or xAI Responses routes when effective permissions, model capabilities and account access allow it. |
| Temporary files | Agents are instructed to remove their own temporary files when no longer needed. This is guidance, not an automatic cleanup service. |

Exact behavior, retained repairs and exclusions live in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md). Maintenance evidence and known failures live in [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md).

## Downloads

Choose the matching asset from a **`2.x-zhcn.N` [release](https://github.com/521ox/OpenCode-V2-zh-CN/releases)**:

| System        | Architectures | Archive                         |
| ------------- | ------------- | ------------------------------- |
| Windows       | x64, ARM64    | `opencode-windows-<arch>.zip`   |
| Linux (glibc) | x64, ARM64    | `opencode-linux-<arch>.tar.gz`  |
| macOS         | x64, ARM64    | `opencode-darwin-<arch>.tar.gz` |

Extract the **complete archive** and run `cli-<platform>-<arch>/bin/opencode` (`opencode.exe` on Windows). These are CLI bundles with an embedded WebUI, **not Electron Desktop installers**; Linux musl is not included. Binaries are unsigned and macOS bundles are not notarized.

Compare the archive digest with the release's `SHA256SUMS`: `Get-FileHash -Algorithm SHA256 <archive>` on Windows, `sha256sum <archive>` on Linux, or `shasum -a 256 <archive>` on macOS. `release-manifest.json` and per-target sidecars identify the source, runtime and digests.

### Source and published binaries

`v2-custom-lite` tracks official `dev`. “Lite” means we keep the patches small, not that this is a translation-only fork. See the [upstream sync record](UPSTREAM_SYNC.md) for accepted source revisions and their checks. The legacy `main` branch and `v1.18.4-zhcn.*` releases are not this V2 edition. Official installers, npm packages and updates deliver official builds and may replace this fork's additions.

## Build from source

Windows x64 example using **Bun 1.4.4**, **Node 24** and Git with symlink support, in PowerShell:

```powershell
git clone -c core.symlinks=true --branch v2-custom-lite https://github.com/521ox/OpenCode-V2-zh-CN.git
cd OpenCode-V2-zh-CN
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
$env:HUSKY = "0"
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.3.0-custom-local.1"
$env:OPENCODE_CHANNEL = "latest"
$env:OPENCODE_TARGET = "windows-x64"
bun script/build.ts --skip-install
```

Use a distinct version for your source revision; this example does not reproduce an accepted artifact merely by using its version number. The official build entry recreates CLI `dist` and writes `packages/cli/dist/cli-windows-x64/bin/opencode.exe`, including bytecode and the complete embedded WebUI. Complete the root install before `--skip-install`; target selection uses `OPENCODE_TARGET`.

`OPENCODE_CHANNEL=latest` retains the normal database, service and TUI storage identity; `local` selects different state. It does not select a custom update feed. Building does not install or activate the executable. Keep a consistent backup of the previous executable and user state before replacing an installation.

## Contributing and maintenance

**Issue → feature branch → PR → required checks and applicable review → merge commit.**

Use `v2-custom-lite` as the PR base. Upstream syncs preserve official merge ancestry. After a sync passes its checks and review and is merged, its maintainer publishes a six-platform CLI prerelease. A new sync is available to download once its packages appear in [Releases](https://github.com/521ox/OpenCode-V2-zh-CN/releases). Ordinary PRs do not publish binaries.

- [CONTRIBUTING.md](CONTRIBUTING.md): task ownership, PR requirements, CI coverage and merge authority.
- [AGENTS.md](AGENTS.md): repository engineering conventions.
- [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md): synchronization procedure and accepted evidence.

## Verification limits

- Required CI covers scoped CLI/custom source checks and Windows fixtures, not the entire monorepo, browser/Electron or six-platform release validation. Current Windows root lint, Site typecheck and Client reconnect failures are documented in the maintenance record.
- Local synthetic-history checks do not certify real-user migration, unfinished legacy state or rollback. The historical `v2.0.15-zhcn.1` assets retain an old image-checkpoint compatibility issue; see the maintenance record rather than deleting conversation history.
- Service lifetime and repeated subagent reports follow the current upstream owners; this fork adds no separate scheduler or notification policy.

## Documentation and license

[Official V2 documentation](https://opencode.ai/v2/docs/) covers upstream usage; [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) defines this fork's differences. English and Simplified Chinese are the maintained fork README entry points; other language READMEs retain upstream material.

Based on the work of OpenCode and its contributors. The [MIT license](LICENSE) and upstream copyright attribution are retained.
