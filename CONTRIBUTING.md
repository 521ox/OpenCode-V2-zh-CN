# Contributing to OpenCode

The changes most likely to be accepted are:

- Bug fixes
- Additional LSPs and formatters
- LLM performance improvements
- Environment-specific fixes
- Missing standard behavior
- Documentation improvements

This guide governs the community fork `521ox/OpenCode-V2-zh-CN`, whose default branch is `v2-custom-lite`. Major product decisions and UI/core feature designs require the owner's agreement before implementation.

Want to take on an issue? Leave a comment and a maintainer may assign it unless it is already being worked on.

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

## Adding Providers

New providers should rarely require OpenCode changes. Add the provider to [models.dev](https://github.com/anomalyco/models.dev) first.

## Development

OpenCode requires Bun 1.3 or newer. From the repository root:

```bash
bun install
bun dev [directory]
```

`bun dev` runs the V2 CLI and TUI. Pass a directory to open another project, or `.` to open this repository.

To test a development TUI against your installed OpenCode V2 background service and live sessions:

```bash
bun run dev:live [directory]
```

For web development, run the backend and app in separate terminals. Other interfaces have root scripts:

```bash
bun dev serve --port 4096
bun run dev:web
bun run dev:desktop
bun run dev:www
```

### Packages

- `packages/schema`: shared wire and storage contracts
- `packages/core`: domain behavior and persistence
- `packages/protocol`: public API definitions
- `packages/server`: HTTP server and runtime composition
- `packages/client`: generated TypeScript clients
- `packages/cli`: command-line entrypoint and service lifecycle
- `packages/tui`: terminal interface
- `packages/app`: shared web interface
- `packages/desktop`: Electron desktop application
- `packages/plugin`: plugin API

### Verification

Run typechecks, and tests where defined, from the affected package rather than the repository root:

```bash
cd packages/core
bun run test
bun typecheck
```

Follow package-specific instructions in nearby `AGENTS.md` files. After changing the public Protocol or Server `HttpApi`, run `bun run generate` from `packages/client`; never edit generated client files directly.

Follow the repository [style guide](./AGENTS.md).

## Pull Requests

### Issue → branch → PR → checks/review → merge

1. Record the problem, intended outcome and scope in an issue; reuse an existing issue when it already covers the work. A small self-contained correction such as a typo may explain the exception in its PR rather than create a redundant issue. An issue is context, not authorization for an agent to take on arbitrary work.
2. For an authorized task, create a short feature branch from current `v2-custom-lite`. Follow the branch naming rules in `AGENTS.md`; never implement directly on the default branch.
3. Open a focused PR targeting `v2-custom-lite`, initially draft while incomplete. Link the issue (`Closes #123` when this PR resolves it), explain the change, and record verification results and limitations. Every change is delivered through a PR.
4. Assign one implementation owner per PR. Agent PRs identify the responsible agent alias and its actual runtime session ID. Do not invent session IDs or change Git authorship to match an alias. The PR must stand on its own without session access. Keep corrections and review evidence in the same PR thread.
5. Pass the required checks and any additional checks/review appropriate to the change. Record independent agent review against the evaluated head SHA when required by the task or engineering policy. A comment recording independent review is not a GitHub approval; the same GitHub account cannot approve its own PR. Do not require an unavailable external approver or pretend approval occurred.
6. Once the authorized task meets these gates, the responsible agent may merge it using a **merge commit**, without asking again solely for routine merge permission. Honor any task-specific integration owner (including the parent owner of a delegated PR). Do not bypass branch protection, push directly, force-push the default branch, or delete it. Major product decisions and releases require separate owner authorization.

Use merge commits for upstream synchronization as well, preserving official merge ancestry; see `UPSTREAM_SYNC.md`. Merge does not publish a binary, deploy, or activate an installed client. `release-custom-cli.yml` remains a separately authorized, manually dispatched six-platform release.

### Required fork CI and its limits

`custom-check.yml` runs on every PR to `v2-custom-lite` (including drafts and documentation-only changes), pushes to that branch, and manual dispatch. Stable required check names are:

- **`custom-source`**: GitHub-hosted Ubuntu; actionlint for the fork check/release workflows, repository lint, and canonical `typecheck:tsc` for AI, Schema, Core, Protocol, Client, Server, Plugin, App, GUI plugins, Session UI, Codemode, TUI and CLI. Package checks run directly without Turbo or remote-cache credentials.
- **`custom-windows`**: GitHub-hosted Windows; existing CLI localization, release-manifest/artifact and smoke-helper fixtures, plus native direct-execution and environment-tool catalog fixtures. These are source tests, not a compiled service or release build.

Both use the frozen lockfile and declared Bun version. PR code receives no repository secrets, checkout credentials are not persisted, and token permissions are read-only. Dependency cache saves exclude PR events. Upstream-only check workflows remain in source but are restricted to the official repository and their upstream target branches; their check names are not required here.

This is a CLI/custom baseline, **not full-monorepo green**. The recorded Console Vite 8/7 type conflict and two Client default-condition reconnect failures remain unresolved; this workflow neither changes those tests nor reports them as passing. See the October 28 evidence in `UPSTREAM_SYNC.md`. Browser/Electron, Nix, Rust process-daemon, live providers, full Core/Client suites and six-platform builds are outside this baseline.

The implementation owner must add relevant evidence in the PR for changed behavior outside that baseline: affected-package tests/typechecks; generated Protocol/Client checks for API changes; migration/compatibility checks for persistence changes; browser/component checks for UI changes; native Rust/Nix checks for those areas; and compiled service smoke for build/service changes. Upstream syncs require checks for the actual integrated delta. Run the canonical root `bun run check` when evaluating repository-wide health and disclose failures rather than relabel a scoped pass. A baseline failure needs diagnosis and an explicit scoped acceptance decision, not test edits or silent skips to manufacture green.

Workflow changes also need actionlint and inspection of event filters, runner labels, permissions and release isolation. Keep required names stable or coordinate their branch-rule update with the maintainer. Branch protection is configured on GitHub, not enforced by this document.

### Keep It Focused

- Keep PRs small and focused.
- Explain the problem and why the change fixes it.
- Check whether the functionality already exists.
- For UI changes, include before-and-after screenshots or video.
- For logic changes, explain what you tested and how a reviewer can verify it.

### Keep It Brief

Write a short, concrete explanation that a maintainer can verify. If the change cannot be explained briefly, the PR may be too large.

### Use Conventional Titles

Use `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. The scope is optional.

Examples:

- `docs: update contributing guide`
- `fix(tui): restore scroll position`
- `feat(app): add workspace search`

## Issues

Use this fork's bug, feature or maintenance-task template. Describe the problem, desired outcome, scope and reproduction or acceptance evidence as applicable. Search existing issues before opening another. Issue creation and comments do not automatically schedule implementation or authorize a release.
