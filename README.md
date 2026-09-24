# OpenCode V2 zh-CN — community-enhanced edition

[English](README.md) | [简体中文](README.zh.md)

A community-maintained fork of [OpenCode](https://github.com/anomalyco/opencode), the open-source AI coding agent. This project is not developed by, affiliated with, or endorsed by the OpenCode team.

## Source and release status

The maintained default branch is **`v2-custom-lite`** in the existing [521ox/opencode2-zh-CN repository](https://github.com/521ox/opencode2-zh-CN).

- The former `main` branch, old tags and `v1.18.4-zhcn.*` releases remain legacy history. Those binaries are **not** packages of the current enhanced V2 branch.
- Native binary releases are produced by the manually triggered **Release enhanced V2 CLI** workflow on `v2-custom-lite`. It builds Windows, Linux glibc and macOS for x64 and ARM64, and publishes an unsigned prerelease only after all six targets and the downloaded draft assets pass verification. The current enhanced V2 prerelease, [**`v2.0.15-zhcn.1`**](https://github.com/521ox/opencode2-zh-CN/releases/tag/v2.0.15-zhcn.1), was published on September 24, 2026 with all six packages; [release CI run `35971350731`](https://github.com/521ox/opencode2-zh-CN/actions/runs/35971350731) passed all eight jobs. Earlier releases remain available. Use the matching `2.x-zhcn.N` release assets, not the legacy `1.18.4-zhcn.*` packages.
- Official installers, npm packages and the official updater deliver official builds, not this custom distribution. Accepting an official update can replace the custom additions; the upstream updater policy is unchanged.

This branch follows official V2 while adding substantial enhancements across localization, native tools, Session and subagent interaction, search authorization and execution reliability. Its maintenance approach keeps changes clearly bounded and aligned with upstream owners rather than restoring the former complex fork wholesale. The internal `v2-custom-lite` name describes that maintenance approach, not a localization-only build or a claim that the feature set is small.

The legacy binary-release workflow remains retired. The new release workflow reuses the current official build entry, pinned setup/artifact actions and GitHub CLI; it does not restore upstream deployment or community-maintenance automation. Four other upstream validation workflows remain as source references; their branch filters, runners and allowed actions have not been adapted or certified as this fork's CI.

### Native downloads and verification

Each new release contains `opencode-windows-{x64,arm64}.zip`, `opencode-linux-{x64,arm64}.tar.gz` and `opencode-darwin-{x64,arm64}.tar.gz`, six JSON sidecars, `release-manifest.json` and `SHA256SUMS`. Extract the complete archive and use `cli-<platform>-<arch>/bin/opencode` (`opencode.exe` on Windows). Linux packages target glibc, not musl. These are CLI bundles with an embedded WebUI, not Electron Desktop installers.

Compare the downloaded archive with `SHA256SUMS` before running it: use `Get-FileHash -Algorithm SHA256 <archive>` on Windows, `sha256sum <archive>` on Linux, or `shasum -a 256 <archive>` on macOS. The manifest identifies the exact source commit, Bun runtime, native target and actual file digests. Binaries are unsigned and macOS packages are not notarized; operating-system security prompts may appear. Native release checks are not full feature-suite or real-user-data migration certification.

## What is customized

- **Simplified Chinese / English interface chrome.** TUI, Mini and CLI-run presentation defaults to Simplified Chinese, with English selection and fallback. Use the existing settings dialog to choose the language. Model/tool output, identifiers and protocol data are not translated; Mini reads its language at startup. Early help/bootstrap and native parser output have the narrower scope documented below.
- **Environment catalog and native execution.** `environment_tools` records and revalidates known programs; a missing entry does not prove a program is absent. `direct_exec` runs verified native EXE/COM entries by catalog ID and argument array, subject to execution permission. Shell syntax, custom environment, stdin and background execution remain shell operations. Both tools reuse official collapsible blocks; adjacent `direct_exec` calls form an execution collection under automatic grouping while preserving approvals and visible failures.
- **Subagent results and navigation.** Completed trusted results retain the complete final assistant text and official child identity envelope, within provider context limits. The management list shows the child Session ID, and completion titles open the existing child Session. Visible `×` close controls reuse official actions. These are not child-followup recovery repairs.
- **Protected Session rules context.** Normal Agent requests receive the root Session's rules location; descendants share it through persisted lineage. Resolution does not create files, and user instructions or authoritative project locations take priority.
- **Permission-gated native hosted search.** Supported native OpenAI and xAI Responses routes can advertise hosted search only with unrestricted effective authorization. Restrictive or unknown permission policies withhold it; disabled search is not reintroduced. This is not enabled for every provider or guaranteed by model/account entitlement. Official native compaction and recovery remain upstream-owned, with no custom override or claim that every provider supports native compaction.
- **Task-owned temporary cleanup guidance.** Agents are instructed to remove their own no-longer-needed temporary artifacts within existing permissions and explain retained evidence. This is prompt guidance, not an automatic cleanup service or compliance guarantee.
- **Bounded upstream repairs.** Stream capture settlement, stale client publication, background-tab Location admission and Console policy failure/publication handling are repaired in their existing owners, without a second policy or lifecycle system.

See [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) for exact behavior, search authorization, exclusions and operational boundaries. See [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md) for source provenance and maintenance history.

## Build from source (Windows x64)

Use **Bun 1.4.2** and Git. Run the following in PowerShell from your chosen development directory:

```powershell
git clone --branch v2-custom-lite https://github.com/521ox/opencode2-zh-CN.git
cd opencode2-zh-CN
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.0.15-custom-lite.20260924.1"
$env:OPENCODE_CHANNEL = "latest"
bun script/build.ts --target=opencode-windows-x64 --skip-install
```

The example version identifies the accepted source baseline; use a distinct custom version for changed builds. This command builds the Windows x64 CLI with bytecode and embedded WebUI, using the existing build script. Its executable output is `packages/cli/dist/cli-windows-x64/bin/opencode.exe` relative to the repository root. The build recreates the CLI `dist` directory. `--skip-install` skips the build script's extra dependency installation, so complete the root install first.

Keep an explicit custom `OPENCODE_VERSION` and **`OPENCODE_CHANNEL=latest`**. The channel controls database, service and TUI storage identity: `local` selects different state and is not a drop-in replacement. `latest` here is not a claim of a public release or a custom updater feed. Building does not install, activate or validate a new binary against your own data.

## Verification and known limits

The September 24, 2026 local Windows x64 candidate `2.0.15-custom-lite.20260924.1` uses official V2 baseline `dca73ba9e3782e2b41983faca5854a9d56a3c482`. Recorded acceptance covers 4,353 passing focused cases (72 conditional/platform skips), sixteen affected package typechecks, the full Windows bytecode/WebUI build and isolated service and populated old-format synthetic-database smokes. These are bounded local results, separate from native release CI—not new runtime verification performed by this README update, a full-monorepo check pass, or Electron Desktop validation. The Stats App typecheck limitation and one unresolved TUI layout-persistence warning remain recorded in [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md).

- Startup-delay changes and changes to the default shared-service exit/lifetime remain deferred.
- Later parent notifications after a child is reactivated by background Shell work remain unresolved.
- Known upstream test limitations and narrower verification scopes remain recorded in the maintenance documents.
- Completed materialized history does not establish full compatibility with unfinished legacy sidecar state, retired execution state or rollback after migration.

Before replacing an installed executable or activating it on real data, retain a consistent backup of the old executable and user state. Keep personal configuration, credentials and live databases out of source commits and verification fixtures. No migration or conversion tool is provided by this source transition.

## Documentation and attribution

- [Official OpenCode V2 documentation](https://opencode.ai/v2/docs/) describes upstream usage; this branch's differences are defined in [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md).
- [Upstream synchronization notes](UPSTREAM_SYNC.md) explain how to maintain the bounded customization set.
- English and Simplified Chinese are the custom branch's README entry points. Other language READMEs are retained upstream material, not specifications of this custom distribution.

Based on OpenCode and its contributors' work. The existing [MIT license](LICENSE) and upstream copyright attribution are retained.
