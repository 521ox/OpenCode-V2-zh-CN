# Maintaining the Minimal Custom V2 Branch

## September 21 synchronization

The integration branch `sync-v2-20260921` merges fixed official V2 target
`cbdd1f66da3a50e02d40a3198a6bc270d651327b` into custom checkpoint
`965b7fd9ae843eef47894a12009287d44a1eccb5`. The official increment from
`dfa44e94e8ed55a394c3f64eb9a7da56e69f2f3c` contains 39 commits, including 19 model
snapshot refreshes and the 2.0.11 version update. The final two commits since the
previous inspection add CLI fatal-cause stderr reporting and Code Mode submitted-
source error locations. This freezes the fetched target rather than following a
moving branch during verification.

Integration preserves the accepted direct-execution collection and all selected
custom behavior. The only textual conflicts were the TUI tab-menu component and
its test: the official Copy session ID action now uses the existing reactive
English/Chinese resources, clipboard and toast owners. No second clipboard or
navigation mechanism was introduced. CLI startup reporting auto-merged with the
existing localized failure banner; it does not change shared-service exit policy.

The upstream transport now pins subsequent exchanges to HTTP after five counted
consecutive socket losses, with a clean terminal resetting the counter. It does
not replay an ambiguously delivered failed exchange immediately over HTTP. The
counter is process-local, not a persisted transport preference. Promise plugin
tools receive cancellation through AbortSignal; cancellation remains cooperative
for arbitrary Promise implementations. Anthropic budget variants and the Code
Mode iterator, standard-library and diagnostic updates retain their upstream owners.

Desktop bootstrap/IPC changes are integrated as source. The Windows CLI embeds
the App WebUI, not the Electron Desktop application; a CLI build does not certify
Desktop startup performance or its native browser runtime. No new migration,
compaction policy, provider protocol routing or child-followup notification repair
is introduced by this synchronization. Startup-delay and default-exit changes
remain deferred.

The planned candidate is `2.0.11-custom-lite.20260921.1`, channel `latest`, built
with the unchanged Bun 1.4.2 toolchain. Verification, exact artifact identity and
local export are separate from source integration and must be recorded before
delivery. The original accepted worktree and installed executable remain protected
until the applicable acceptance/promotion boundary; installed activation is still
user-managed.

Focused verification passed 626 distinct cases: 132 Core, 376 Code Mode (including
21 additional isolated fixtures), 112 TUI, two CLI startup-reporting and four
Desktop bootstrap/IPC cases. Nine affected package typechecks and scoped style
checks passed. Added boundary regressions cover the transport failure-counter
reset, Promise update/list/get cancellation round trips and actual localized CLI
fatal stderr output. An existing TUI fixture was corrected to wait for both its
permission row and asynchronously rendered following Markdown in the same frame;
its original visibility and ordering assertions remain intact. No execution-group
production repair was needed. These checks do not claim full browser E2E,
Desktop runtime/performance or complete Test262/WPT certification.

## September 20 synchronization

The integration branch `sync-v2-20260920` merges official V2 commit
`dfa44e94e8ed55a394c3f64eb9a7da56e69f2f3c` into the accepted custom checkpoint
`f3482291c4b0828ee4debbbf9d32f76afbfce1bd`. The upstream increment contains
17 commits from the original baseline below and moves source manifests to2.0.10.
The existing13 functional-history commits and immutable .4 checkpoint remain in
ancestry. The clean integration/build commit is
`0713018a2da5bc7d0b2a239209eb951d19923a15`, with those exact two parents.

Candidate `2.0.10-custom-lite.20260920.1`, channel `latest`, passed its full Windows
bytecode/WebUI build and isolated default-old-database/API/WebUI/owned-service
shutdown smoke. It is 205,134,848 bytes, SHA256
`4160b8eb740989d3a3cd2b82fe62a18c51398cb2989906ebfb9a8ad08c2eff1f`, with embedded
Bun `1.4.2+744846f84`. Independent integrated review approved the exact source and
artifact with the scoped residuals below. No source repair or rebuild was required
by the review.

Local acceptance tag `custom-lite-2.0.10-20260920.1` identifies the integrated
source plus documentation-only acceptance updates. Adjacent export metadata records
the build commit separately from that final documentation tip. Timestamped export
and matching root mirror follow `CUSTOMIZATIONS.md`; the installed fixed-name
executable, existing backup and live state are not replaced by this workflow.

The only textual merge conflict was the notification listener. Its resolution
keeps runtime Chinese/English translation and adopts the official session-scoped
toast route. New mention-kind labels and the toast Open action are localized using
the existing dictionaries. Official mention layout, removal of MCP-resource
autocomplete candidates, and the question-form focused-action token are retained.
No separate routing or translation framework was introduced.

The upstream Responses error extraction, skill/MCP Session-permission discovery,
model-catalog refresh and Code Mode Headers changes are integrated. WebSocket
inbound queues now follow upstream's unbounded buffering: burst regressions cover
ordered delivery but do not establish a long-running memory bound or backpressure.
Two additional regressions cover the actual AI WebSocket adapter's1500-frame burst
and Session permission narrowing through the real SessionContext owner.

Focused source verification passed715 distinct cases across46 files. Affected
AI, CodeMode, Core, Plugin, TUI, CLI, Session UI and App typechecks passed. The new
Core test's required discovery flags were corrected after its initial typecheck
failure. Windows' text-form checkout of the App type-declaration symlink was
restored as a real symlink for verification; this is not a product source patch.
All integration-owned files passed scoped format/lint checks. Full repository
checks and browser end-to-end suites are not claimed by those scoped results.

Startup-delay repair, changing the default shared-service lifetime, and continuing
parent notifications after a child is reactivated by a later background Shell
remain explicitly deferred. This sync does not claim to fix the intermittent
invalid-URI underline or certify old unfinished sidecar state.

## Original baseline and delivery

- Custom branch: `v2-custom-lite`.
- Official source baseline: `417f6d234d8d3e810c0bd72cd2ef52ad95fe2413`.
- Local baseline tag: `custom-lite-base-20260919`.
- Local accepted checkpoint tag: `custom-lite-2.0.9-20260919.4`.
- Official remote: `origin` (`anomalyco/opencode`), branch `v2`.
- Existing publication remote: `fork` (`521ox/opencode2-zh-CN`). No push is part
  of this local checkpoint.
- Product behavior and non-goals: `CUSTOMIZATIONS.md`.

The original accepted Windows artifact is `2.0.9-custom-lite.20260919.4`, channel `latest`,
203,094,528 bytes, SHA256
`6a8123b5962633f138b5e9e0615d309e8544731649f7f94d3f5784dee652294b`.
Its runtime is Bun `1.4.2+744846f84`; the full build includes bytecode and WebUI.

That artifact was built from the accepted dirty working tree **before** the local
commits below were created. This checkpoint records the same implementation and
tests, plus maintenance documentation; it does not claim that the old artifact
was built from a newly created commit ID or that a rebuild is byte-reproducible.
Keep the original adjacent `.exe.build.json` provenance intact. This history-only
checkpoint does not require users to replace or restart their installed program.

## Functional commit map

The hashes below identify the initial local organization. Later upstream syncs
should preserve the behavior, not blindly retain every hunk after upstream adopts
an equivalent fix. Inspect each commit with `git show <hash>` for its exact files.

| Commit       | Concern                                         | Main ownership and focused verification                                                                                                                                |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9fb448d667` | Capture settlement on source close              | Util cross-spawn owner; Core spawner, capture-close fixture and Ripgrep tests. Preserve the existing late-output grace period.                                         |
| `1cba74c3f2` | Prevent stale publication after eviction        | Client Solid data owner; eviction/inbox/refresh/paging controls and TUI retention test. Do not change the recent-family policy.                                        |
| `e38f9a2f3b` | Root Session rules-directory context            | Core Session/store/request owner, additive migration, database snapshot and generated registry/schema; `session-rules-*` tests.                                        |
| `380382b2db` | Environment catalog and native direct execution | Core catalog, two built-in plugins and `environment-tools-catalog`, `tool-environment-tools`, `tool-direct-exec` tests. Keep catalog and execution authority separate. |
| `526fbfb77d` | Complete subagent final conclusions             | Core subagent tool and oversized foreground/background result tests. Do not exempt ordinary tool outputs.                                                              |
| `605708ad79` | Permission-gated hosted search                  | AI native Responses routes and Core effective authorization/selection; provider hosted-search and Core permission/request tests.                                       |
| `7b70a45aab` | Simplified Chinese/English presentation         | Shared locale resources, TUI/Mini/CLI consumers, dependencies and explicit-English regression fixtures. Preserve raw output and locale-only interaction state.         |
| `bcfb00247d` | Visible child Session identity                  | Subagent management list and `i18n-subagent-id` test. Use the existing child identity without introducing another mapping.                                             |
| `dfa2b05fa8` | Visible close controls                          | Existing header callbacks and `i18n-close-control` test. Keep keyboard and selection-aware dismissal.                                                                  |
| `41c8e9f83e` | Background-tab Location admission               | SessionTabs owner and request/move tests. Preserve global reads and explicit navigation without activating foreign Locations implicitly.                               |
| `20ceb04406` | Completion-title affordance                     | Session notice row and title/completion tests. Preserve exact-child routing, selection protection and non-navigating Shell notices.                                    |
| `93878c2643` | Native-tool detail collapse                     | Explicit tool display classifications, unchanged official BlockTool and `environment-tools-collapse` tests. No Core tool-description or execution change.              |

Localization remains one coordinated commit because its exported translation
owner, four resource families, all consumers and test providers depend on each
other. The separately requested UI features are not hidden inside that commit.
Mixed files were staged from reviewed intermediate snapshots without rewriting
the accepted working-tree files. These intermediate commits are reviewable units,
not separately built or certified releases.

## Safe upstream synchronization

Perform the following only when an upstream update is separately authorized.
Do not use an implicit `git pull` in the current delivery worktree.

1. Confirm the custom worktree is clean and identify the last accepted checkpoint.
   Preserve any new work as scoped commits before integration. Keep a named local
   recovery ref and, when needed, a Git bundle on separate storage.
2. Fetch the official `v2` branch, record its exact target SHA, and inspect the
   upstream range before merging. Read the target revision's `AGENTS.md`, actual
   runtime/dependency versions, migration changes and affected owner contracts.
3. Create a separate integration branch/worktree from the accepted custom
   checkpoint. Merge the exact official target there; keep the current usable
   worktree, installed executable and live state untouched.
4. Resolve conflicts by owner and the commit map above. Do not copy the old full
   customization branch over current modules or restore retired features by
   association. If upstream now provides an equivalent behavior, remove the
   redundant local implementation while retaining its required regression coverage.
5. Verify affected behavior and current integration. Record the new upstream SHA,
   preserved/retired custom deltas, test results, limitations and artifact identity.
   Update this document and `CUSTOMIZATIONS.md` when their operational or product
   expectations change.
6. Only after acceptance, fast-forward the custom branch to the integration
   result and create a new immutable local checkpoint tag. Do not move an old
   acceptance tag or rewrite the published checkpoint history to hide a failed sync.
   Remote push, release publication and real-data activation require separate
   authority.

Example starting commands, not executed by this checkpoint:

```powershell
# From a clean custom worktree; choose a unique integration name and directory.
git status --short
git fetch origin v2
git rev-parse origin/v2
git log --oneline custom-lite-base-20260919..origin/v2
git worktree add -b sync-next-v2 <new-worktree-path> v2-custom-lite

# In the new worktree, use the exact SHA reviewed above.
git merge --no-ff --no-commit <reviewed-official-sha>
# Inspect and resolve the result, then make the integration commit when ready.
```

Abort an in-progress merge only in that positively identified integration
worktree. Never reset or clean the live delivery worktree to recover a trial sync.
Separate private servers sharing a database are not a substitute for isolated
verification environments.

## Verification and generation boundaries

- Use the package-manager version in the target root manifest. Current baseline:
  Bun 1.4.2, TypeScript 5.8.2, Effect 4.0.0-rc.112, Solid 1.9.15, OpenTUI 0.5.10.
  Preserve the lockfile; do not upgrade dependencies merely while organizing Git.
- Run tests from their package directories, never the repository-root test script.
  Use private HOME/USERPROFILE/XDG/APPDATA/TEMP paths and synthetic data, clear
  credentials, and use only owned loopback services. Do not let a CLI test discover
  or replace the real managed service.
- Select focused tests from the commit map and affected upstream seams. Run
  `bun typecheck` in affected packages during iteration. The repository's canonical
  full lint/type gate is `bun run check`; record its actual result when used.
- For database declaration changes use the canonical Core migration generator.
  Commit the intended migration together with `packages/core/schema.json`,
  `migration.gen.ts` and `schema.gen.ts`; do not add a duplicate column migration.
- Public Protocol/HttpApi changes require the Client generator under repository
  policy. Do not hand-edit generated client output.
- CLI schema output `services/www/public/cli.json` is generated and ignored by the
  existing repository policy. Verify its generator when applicable; do not force
  it into Git merely because it exists after local checks.
- Build manual Windows replacements with `OPENCODE_CHANNEL=latest` and an explicit
  custom version. From `packages/cli`, the accepted build used
  `bun script/build.ts --target=opencode-windows-x64 --skip-install` after dependency
  setup. Do not reuse `local`: it changes the default database/service/TUI namespace.
- Check compiled version/runtime, old synthetic history at the default database
  path, authentication, embedded WebUI and owned-service shutdown. Follow the
  timestamped export/three-copy hash convention in `CUSTOMIZATIONS.md`.

The accepted source already has focused/type/build evidence recorded for its
implementation milestones. Git organization preserves that evidence; it does not
turn unexecuted intermediate-commit checks into passes. Existing documented
Windows collation and Client matcher limitations remain recorded, not waived.

## Deliberately outside this checkpoint

Startup-delay changes and switching the default TUI to private standalone mode
are deferred by the user. Their evaluations do not constitute implemented fixes.
The intermittent blank invalid-URI underline is not claimed fixed in source;
the temporary Windows Terminal automatic-URL comparison was restored.

Keep personal configuration, credentials, live Session databases, logs, scratch
diagnostics, dependencies and compiled executables out of commits. The root
`opencode2.exe` and its adjacent metadata remain ignored delivery mirrors.
Local commits and a bundle on the same machine are not an off-machine backup.
