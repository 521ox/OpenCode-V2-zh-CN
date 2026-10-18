# Maintaining the Minimal Custom V2 Branch

## October 18 synchronization in progress

The authorized target is frozen official dev
`63c1a27af5a391d9caa55b82694f496911e1859b` (2.0.32), based on custom
`57d92d1e7297937f89d43b1d5f94731388446daf` and previous upstream
`eeec76bb620f9bee8cab89c5a3a88e315539645b`. The exact comparison contains
76 commits and 336 paths. Recovery tag: `custom-lite-pre-sync-20261018`.
Planned local artifact: `2.0.32-custom-lite.20261018.1`, latest storage channel,
Windows x64, Bun 1.4.2, bytecode and complete embedded WebUI. The manual release
workflow default is updated without dispatching it. No activation, push or
publication is implied by this local synchronization.

High-throughput DeepSeek long-reasoning display diagnosis is explicitly deferred
until after synchronization. This task does not tune delta batching, animation,
scrolling or provider settings, nor cherry-pick the still-separate session-title
loading fix. Existing memory guidance and native-tool contracts remain required.
Official new-designs experiment settings retain their upstream defaults rather
than being silently enabled during reconciliation.

Frozen installation passed with 2,169 packages and no subsequent lock mutation.
The lock conflict preserves custom Mustache types while adopting the official
TypeScript 7.0.2 native toolchain and TypeScript 6 alias. Canonical Protocol/Client
generation and repeated checks passed without content drift. Client runtime
checks currently have condition-dependent failures under investigation; results
from different conditions must not be combined into a fabricated clean suite.
Final source checks, compiled compatibility and independent acceptance are pending.

The Client runtime failures were compared against the accepted 2.0.30 baseline
using the same Bun binary, arguments and private environment. Both default-condition
reconnect failures and all ten browser-condition proxy-matcher failures reproduce
on both trees, with no I-only failure found in the compared cases. The canonical
Client script uses default conditions: browser-condition diagnostics are not a
substitute passing gate. These remain baseline residuals, not a clean-suite claim
or an automatically attributed upstream defect. Neither product nor test code was
changed to conceal them.

Twelve stable packages passed their canonical typechecks with actual TypeScript
7.0.2. The TypeScript 6 compatibility wrapper's package is 6.0.2 but its installed
forwarded compiler reports 6.0.3; that distinction is retained rather than
misreporting the executed compiler.

Final source verification: fourteen canonical package typechecks passed with
TypeScript 7.0.2, including all five updated/new Core and TUI test roots. Focused
TUI verification passed 288 cases across 29 files with no failures/skips. New
designs remain opt-in; last-message copy and transcript copy remain separate.
Core/AI focused groups and test-only fixture repairs passed within the scopes
recorded in the delivery evidence; overlapping reruns and platform early returns
are not counted as additional coverage. Canonical lint exited 0 with 1,306
warnings, zero errors and the existing unused-suppression diagnostic. No upstream
product bug was patched to force passing results. The canonical Client default
runtime failures remain explicitly documented baseline residuals. Compiled checks
and independent acceptance remain pending for the final artifact.

## October 16 accepted candidate

Independent review `ses_ebd1f85d3ffedgpAk4yUUzZ18T` returned
`APPROVE WITH DEFERRED RISKS` for source
`917f5f463a2b09bb9d27e4eabeed26c1031af777` and Windows x64 candidate
`2.0.30-custom-lite.20261016.1`, latest channel, Bun `1.4.2+744846f84`,
bytecode and complete embedded WebUI. Length: 215,525,376 bytes; SHA256:
`af7a7ac03f7283e16abcda57d10e3231bcb367a6c1ed28b8be6a914935d09930`.
Source repair/re-review usage is 0/1. Earlier review records remain unchanged.

Final compiled run `run-3b05640231d145848afb6b7775848df8` passed NativeArch,
version, UTF-8 Chinese help, embedded runtime and supervised service checks.
The accepted 2.0.26 executable created and cold-read a populated private default
database; the candidate then read the same file, preserving original project,
session and message fields, raw payloads and order, including start_directory.
The new nullable project.time_archived column was verified. Database/channel/XDG/
config-root selectors were absent and ProgramData was private. All recorded test
processes exited and private profiles were removed. Service winner stop exit was
1 under the existing termination contract, not a graceful-zero-exit claim.

Deferred risks: OCT11-P2-1 hybrid Effect output-schema registration compatibility;
existing partial --session help localization; Unix/macOS system-root isolation;
the excluded Desktop auto-download batch and initial TUI environment unknowns;
lint/listener diagnostics and platform non-coverage. Completed synthetic history
does not establish unfinished-state, real-user migration/rollback, live-provider
or browser/Electron acceptance. The first compiled run's overwritten raw probe
output remains incomplete evidence, superseded by a complete fresh second run.
Formal promotion/export facts are recorded separately in executable sidecars.
No activation or remote publication follows from this local acceptance.

### October 16 source verification update

Before compilation, fourteen scoped canonical package typechecks passed. Core's
missing permission-fixture method and CLI isolation-test type mismatches were
corrected without changing their production interfaces or weakening assertions.
Canonical root lint exited 0 with 1,312 warnings and no errors, plus the recorded
unused-suppression diagnostic. The focused TUI suite passed 461 cases in a fresh
clear-env profile with private ProgramData; its earlier environment assumptions
remain unproven rather than retroactively certified. Core has 403 distinct passing
focused cases; CLI/Client have 158 passes and one platform skip, with overlapping
repair reruns recorded separately. Canonical migration, Protocol and Client checks
passed; all 51 migration bodies remain unchanged and output regeneration is stable.

Peripheral execution produced 2,174 compliant passes, with nine explicit filters.
An additional Desktop batch's 44 runner passes are excluded from no-install
acceptance: importing Electron triggered its automatic binary download. The
identified task-created dist/path.txt were removed after checking process exit;
lock and existing top-level package files were unchanged. Full dependency-tree
byte equality was not established. No repeat Desktop execution is implied.
This incident is not concealed by the otherwise successful test output. Browser,
Electron runtime, cross-platform system-root isolation and publication remain
outside the local Windows acceptance claim. Compiled compatibility and independent
review are still pending for the exact candidate.

## October 16 frozen synchronization — in progress

Custom starting point: `c292e252d1e85b003972ebd7e7b8b68e6e30987a`.
Previous official: `4617210822bdbb31e5749751afbfb4584ccedac8` (2.0.26).
The frozen official target is `eeec76bb620f9bee8cab89c5a3a88e315539645b`
on **`dev`**, source version 2.0.30 with Bun 1.4.2. Official V2 development is
now followed on `dev`, not the historical `v2` branch. The exact official range
contains 1,593 commits, including merged history rather than 1,593 new features;
the net tree comparison contains 1,597 changed paths.

Integration worktree: `D:\opencode-local-build\opencode-v2-custom-sync-20261016`.
The maintained delivery worktree remains
`D:\opencode-local-build\opencode-v2-custom-lite`. Planned candidate:
`2.0.30-custom-lite.20261016.1`, `latest` channel, Windows x64 bytecode with the
complete embedded WebUI. This record does not establish a successful build,
compiled-runtime acceptance, final integrated review or local delivery. Existing
accepted sources, artifacts and review/repair budgets below remain historical
facts, not checks rerun for this candidate. Activation and remote publication
remain separate actions.

Retained integration requirements include Chinese/English chrome, native catalog
and direct execution with their existing permission boundaries, complete trusted
child results and navigation, permission-gated native hosted search, legacy-media
reading, task-owned cleanup guidance, and the bounded existing-owner repairs.
The October 13 Session-rules guidance remains compact continuation working memory,
not a general document store or chronological log. Conversation-first selective
reads, current-state writes and shared-writer coordination do not change the
`rules_directory` field, root creation-directory lineage or rules path.
OCT11-P2-1 remains deferred; it is not represented as fixed by this target.

Canonical Core migration generation/check, Protocol generation/check and Client
generation/check passed. Repeated output was byte-stable across all 15 owned
outputs. The two historical migration sets have an exact union of **51** bodies;
all remain unchanged, with no new migration. Registration retains both custom
`session_v2.start_directory` and official `project.time_archived`. The generated
full schema was checked only in SQLite `:memory:`; this does not establish
historical replay, real-user migration, unfinished-state or rollback compatibility.
Detailed generation evidence belongs to this task's `generation-report.md` and
`generation-evidence.json`, not duplicated in this maintenance record.

Windows verification must isolate both per-user and machine-level configuration:
clear the child environment, use explicit private HOME/USERPROFILE, XDG,
APPDATA/LOCALAPPDATA and TEMP paths, and set **nonempty private `ProgramData` and
`ALLUSERSPROFILE`** so discovery cannot fall back to `C:\ProgramData`. The recorded
generation slice used those private roots. Do not probe WSL, use live user
databases or credentials, contact providers, or replace the installed service.
Browser/Electron, Linux/macOS/ARM64 native execution, six-platform publication and
live-provider behavior are not verified by this in-progress record. Earlier
isolation exceptions and other acceptance limits below remain unchanged.

## October 11 accepted local synchronization

Independent reviewer `ses_ed893718cffes3cxllYnqhq58S` returned
`APPROVE WITH DEFERRED RISKS` for source
`91032d0dd8796b737924666889559fe0500d7a3a` and the exact Windows x64 artifact
`2.0.26-custom-lite.20261011.1`: 214,710,272 bytes, SHA256
`97d34a666022bb12d7d5239d19f7914bbd5ff70c938fe40409b4ef62d1126ba5`.
OCT11-E1 and OCT11-E2 are closed. Source repair/re-review cycles used: 0/1.
The earlier synchronization reviews remain unchanged. The paragraphs below record
the integration sequence rather than outstanding acceptance blockers.

The accepted 2.0.22 executable created and cold-read a populated private default
database (two sessions, six completed synthetic messages), then this exact 2.0.26
candidate read the same file. DB/channel/XDG/config-root overrides were absent;
original fields, raw payloads, order, media and opaque/tool content were preserved.
Version, actual UTF-8 Chinese help and embedded Bun revision passed. Official
service smoke passed under external 180-second supervision, including anonymous
WebUI, authenticated APIs, default database, election and registration cleanup.
Winner stop exit was 1, loser exit 0; no graceful-zero-exit guarantee is implied.
All recorded native processes and private profiles were cleaned. Final export
and formal promotion facts belong to the executable sidecar.

Deferred OCT11-P2-1: a callable hybrid Effect Standard Schema used for plugin
output can reach unsupported JSON Schema conversion and fail registration. No
shipped native-tool output consumer is affected. This was not expanded into a
source-repair cycle. Historical WSL startup/descendant unknowns, lint warnings,
platform non-coverage and prior tab/listener diagnostics remain recorded.
Completed synthetic compatibility does not certify unfinished state, real-user
migration, rollback, live-provider replay, browser/Electron or six-platform release.

Authorized local synchronization: custom `e2e166b1905603b750f5c0bbfa808fdf6d73bca3`
plus frozen official `4617210822bdbb31e5749751afbfb4584ccedac8` (2.0.26),
from previous upstream `8380c864bf36d6860f8047ae94077c7d70e3af41`.
The exact comparison contains 235 commits and 2,254 changed paths. Recovery tag:
`custom-lite-pre-sync-20261011`. This task does not authorize automatic activation
or remote publication. Candidate: `2.0.26-custom-lite.20261011.1`, latest channel,
Windows x64 bytecode and embedded WebUI. Bun remains 1.4.2; Effect adopts 4.0.1
and OpenTUI adopts 0.5.17 from the frozen target.

Native search keeps strict adapter capability and tool-choice handling while
reusing canonical lowering instead of duplicate schema probes. Core retains
cross-Location active-connection serialization alongside official policy-change
notifications and tool.use policy semantics. Scoped tests exercise full subagent
results after the specified Location eviction; this is not universal lifecycle
coverage. Existing permissions, protected rules and cleanup instructions remain.

TUI execution groups retain their custom failure mark; other groups adopt official
icons. A one-line projection correction retains error-bearing idle messages for
the existing ExecutionError component while keeping ordinary idle markers hidden
and usage flushing unchanged. Actual en/zh App tests and usage tests cover this
integration repair; it is not represented as already fixed in the official target.

Canonical migration generation/check passed without new migrations or changes to
the 50 historical migration bodies. The custom session-start-directory migration
and new official Azure external-credential migration are both registered. Protocol
and Client generation/check passed, with repeated output stable and matching the
frozen official target. Fourteen scoped package typechecks passed. AI runtime:
611 passes; CLI: 231 passes and nine platform skips; final TUI: 249 passes.
Peripheral tests: 1,457 passes and one skip. Core counts and retained initial
failures are recorded in the delivery verification evidence, without summing
overlapping reruns. Canonical lint exited 0 with warnings; it is not zero-warning.

An isolation exception is explicitly retained: an inherited GUI test invoked the
installed default WSL distro using a login shell to assign a variable and printf.
Its direct child exited 0, but startup-script effects and Linux descendants are
unknown. No further distro probe or shutdown was performed; no assertion of fully
private fixtures is made for that batch. Future checks exclude this discovery path.
Browser/Electron E2E and live-provider behavior remain unverified. Compiled old
default-database compatibility, runtime smoke and independent review are pending.

## October 4 accepted local synchronization

Final independent review by `ses_ef9526c4efferTl32LLp0TFP9t` returned
`APPROVE WITH DEFERRED RISKS` for build source
`a177c8b2ebdecc23c4c1449f96e64a6107dd5440`. OCT4-E1 is closed: an isolated
populated default-path database created and cold-read by the accepted 2.0.18
binary was then read by the exact 2.0.22 candidate. Both sessions and all six
completed synthetic messages retained their contents, order and original stored
fields. DB/channel/XDG overrides were absent. Owned processes exited and private
profiles were removed. This supplements, rather than replaces, cold-media and
managed-service checks. No product-source repair was required; source-repair
review cycles consumed are 0/1. The September 29 review remains unchanged.

Accepted local artifact: `2.0.22-custom-lite.20261004.1`, latest channel,
Windows x64, bytecode and complete embedded WebUI, Bun `1.4.2+744846f84`.
Length: 209,913,856 bytes. SHA256:
`752a3f0fef652b5182a648f5cf77bf4cd169aa1b53d55afda57a29d2d3f9808b`.
Version, Chinese help, embedded runtime and official compiled service smoke
passed. Service stop exited 1 with termination and registration removal verified;
this is not a graceful-zero-exit guarantee. Final copy/export facts belong to the
adjacent executable metadata, not an inferred completion claim in this record.

Residuals: completed synthetic history is not unfinished-state, real-user upgrade
or rollback coverage; strict xAI provenance can increase fallback input; real
provider, browser-rendered extension graph, Electron runtime, compiled
service-disabled standalone and six-platform release are outside local evidence.
Lint warnings and the inherited AI schema-validation documentation discrepancy
remain explicit. The history below describes earlier stages, not open blockers.

The owner authorized a multi-agent local synchronization from custom
`dc0d395d278f4fe17a62a5bd81dfb151fe597ddf` to frozen official V2
`8380c864bf36d6860f8047ae94077c7d70e3af41` (2.0.22). The previous upstream
`7827dbe39630cbe3b3b7cab22f902b6f5e7cf74f` comparison contains 244 commits
and 2,276 changed paths, not the API's truncated 300-file list. Recovery tag
`custom-lite-pre-sync-20261004` preserves the starting point. Formal source,
installed executables, global configuration and user databases remain unchanged
until applicable local delivery gates; activation and remote publication are
separate actions, not implied by this synchronization.

The owner explicitly approved adopting upstream native noninteractive permission
rejection feedback: the denied operation remains denied, feedback goes to the
model so it can continue, and later real interruptions remain visible. Regression
expectations must distinguish this from form cancellation, auto mode and V1;
those separate contracts are not silently redefined.

The native xAI route rename keeps strict checkpoint provenance matching. A
synthetic regression confirms complete original user/tool-call/tool-result
history fallback, valid legacy media decoding and unchanged persisted payloads.
Loss of checkpoint reuse can increase input size and bring normal compaction
forward; live cost/performance is unmeasured. No old/new route alias bypass was
introduced.

The frozen dependency install completed with 2,427 packages and no lock mutation,
using Bun 1.4.2 and OpenTUI 0.5.14. Source/runtime checks are in progress; successful
focused suites do not constitute final type, generated-artifact, compiled-runtime
or independent acceptance. The five previously excluded upstream workflows remain
deleted. No final candidate has been accepted or exported for this task yet.

The planned local candidate is `2.0.22-custom-lite.20261004.1`, latest channel,
Windows x64 bytecode with embedded WebUI. The existing manual six-platform
workflow's default advances to `2.0.22-zhcn.1`; this does not dispatch it.
All fourteen scoped package typechecks now pass following test-fixture interface
adaptations. Canonical Protocol generation/check passed, and repeated Client
generation/check produced no content drift against its merged index. Root lint
completed with exit 0, 12,975 style warnings and no errors; warnings are not
represented as a clean lint report or silently mass-fixed.

The focused session TUI suite passed 154 cases; native AI/Console suites passed
474 cases; GUI/App/SessionUI/Desktop private storage checks passed 1,252 distinct
cases. Core checks passed 106 selected cases (including native-tool cases also
covered by CLI verification; totals must not double-count them). The owner-approved
permission-feedback tests passed 37 CLI/ACP cases and two selected Core permission
cases. Mini's locale-dependent ordering assumption was corrected only in tests:
ASCII navigation and Chinese model selection remain independently asserted using
real keyboard input, without overriding product collation. The final eight-file
Mini/i18n combination passed 247 cases with six skips and zero failures; canonical
TUI typecheck passed again. Original failed checks remain part of the temporary
verification evidence, not concealed by the later results.

## September 29 accepted local synchronization

Independent reviewer `ses_f15d53c10ffevlI661X7O29otg` returned
`APPROVE WITH DEFERRED RISKS` for source
`e8100f9d7200fc335667abfdc5d0cbc0fe1f19b4` and the final `.2` artifact. S29-F1
is closed; this task's same-session repair/re-review allowance is consumed (1/1).
The earlier review histories remain unchanged. The paragraphs below retain staged
integration history and initial failures, not outstanding blockers.

The accepted executable is `2.0.18-custom-lite.20260929.2`, latest channel,
Windows x64 native bytecode with the complete embedded WebUI, built with Bun
`1.4.2+744846f84`. Its length is 208,752,640 bytes and SHA256 is
`02938f1eed0a272966cfa49b4f993ba0cac51ea57248ebf39e2ff25d8e68befb`.
Final compiled cold legacy-media, 28 pairing checks and service smoke passed,
as did version, Chinese-help and embedded-runtime probes. The service winner's
observed stop exit was 1 and registration removal passed; this does not assert
graceful-zero-exit or universally bounded shutdown. No user DB was rewritten.

Remaining limits: missing provider-recording/platform skips are not passes;
real-provider, real-user migration/unfinished-state/rollback, browser E2E,
Desktop runtime and six-platform release are outside this local acceptance.
The existing service-smoke finalizer lacks an outer deadline, although this run
completed and no candidate process remained. Formal delivery facts belong to the
executable sidecar; these post-build documentation changes do not alter the
build-source identity. Activation and remote publication remain separate.

The owner subsequently authorized the additional three official fixes through
`7827dbe39630cbe3b3b7cab22f902b6f5e7cf74f`: wait for Agent/model readiness before
submitting a startup prompt, suppress misleading run interruption errors after
declined prompts, and deduplicate the open-project picker. This is the final
frozen target for this delivery; the original target below records the first
integration stage. The replacement candidate version is
`2.0.18-custom-lite.20260929.2`.

The extended upstream comparison contains 107 commits and 415 changed paths.
The four-file follow-up merged without conflicts. Supplemental checks passed
32 app-lifecycle cases (two existing Windows skips), 22 real-picker cases,
24 noninteractive cases and five CLI stream-localization cases. The noninteractive
fixture now isolates process exit state without weakening exit-code assertions;
new cases cover decline-related error suppression and ordinary-error controls.
A real-picker regression covers duplicate canonical project identities. Final
CLI/TUI typechecks and repository lint passed. These source checks still require
the replacement binary and same-session review below.

Initial independent review rejected source `373d077a75` for S29-F1: mounted-row
budgets counted headers omitted when ordinary tools were pending approval. The
repair reproduced both real-render mismatches, then aligned budget visibility
with the existing summary/tool projections. The full focused TUI suite passed
130 tests with no failures/skips and 760 assertions; canonical TUI typecheck and
six-file formatting passed. The same reviewer must recheck this repair and the
final rebuilt artifact. The initial `.1` binary is not a deliverable: its scoped
compiled checks passed, but it predates the repair and three additional fixes.

The owner authorized a multi-agent local synchronization to frozen official V2
`07338c5d48348f7fc3ba97c348f5f74d754e84b1` (2.0.18). The custom starting point is
`b7cca2e5806ba2f8cc131452dccb1c6f6ba84b9e`; recovery tag
`custom-lite-pre-sync-20260929` preserves it. The local Git comparison from the
previous official `9810d98bc2db41fe9fb59e069fb96bd2e8a93f79` contains 104 commits
and 411 changed paths. The earlier GitHub comparison's 300-file list was capped
and was not the complete change inventory.

Implementation ownership is split between native AI protocol integration, Core
checkpoint/compaction/Console integration, TUI grouping/native-tool presentation,
and remaining CLI/TUI localization. Git, dependency installation, generated
artifacts, final compilation and acceptance remain centrally coordinated. This
record describes work in progress, not a successful build or delivery.

The upstream dependency baseline keeps Bun 1.4.2 and updates OpenTUI to 0.5.12.
The existing custom i18next/Mustache dependencies remain; the obsolete direct
TUI `open` dependency follows upstream's shared browser-opener owner. The official
publishing workflow remains intentionally absent from this fork; the guarded,
manually dispatched custom six-platform workflow is preserved with its proposed
version default advanced to `2.0.18-zhcn.1`. Neither workflow is dispatched here.

Official legacy-media repair `041885d838` is reconciled at the persisted checkpoint
read boundary, not copied blindly: the approved custom data-URL/HTTP(S) handling,
MIME precedence, malformed rejection and unchanged stored data remain requirements.
The official fixture and custom regressions must both pass. Native compaction
follows the new upstream SessionCompaction/LLMClient ownership rather than restoring
the removed strategy plugin. The upstream output-budget and child-affinity changes
must remain compatible with custom hosted-search authorization and protected
Session-rules context.

New transcript verbosity affects presentation only; it is not authorization to
prune tool history. Custom direct-execution collections must retain visible error,
nonzero-exit, active and approval-required entries, selection-aware disclosure and
child-completion navigation across supported verbosity settings. First-party
chrome continues to use the existing Chinese/English locale owner.

The installed executable, live services, user database and global configuration
are not synchronization targets. Prior startup/exit-policy and session-specific
lag investigations remain deferred. No source push, Release publication or
automatic activation is authorized by this local synchronization record. Local
delivery will use the established build/export location after applicable checks
and integrated review; task-owned worktrees and scratch will then be cleaned.

Source verification before compilation: the focused AI suite passed 672 cases
with three missing-recording skips; Core integration passed 199 cases. Web/Server,
SessionUI and timeline checks passed 1,153 cases with one App skip. CLI/native
checks passed 142 cases with one platform skip; the separately deferred two Git
artifact cases then passed alongside 391 focused Codemode/runner cases. These are
bounded suites, not an assertion that all repository tests or live providers ran.
The full focused TUI set passed 127 cases with no skips, including actual en/zh
Low-verbosity rendering, mounted-anchor weights, native-tool disclosure, completion
navigation and new-session retry IDs. Nine earlier TUI fixture failures were
resolved without changing product behavior: assertions now respect real adjacent
narrow-screen wrapping, the existing localized exploration label, and an explicit
English locale for the English retry fixture. No failing case was removed.

Canonical Protocol generation/check and Client generation succeeded. Repository
oxlint reported no warnings or errors. Compiled service, pairing, cold synthetic
legacy-media checks and independent integrated review are still required before
acceptance; source-test results do not substitute for those remaining gates.

## September 25 local delivery of the September 24 synchronization

The permanent `v2-custom-lite` worktree was fast-forwarded to the accepted build
source `332ebd338332ce140e1477cac0f2a38e415ff962`, which includes official V2
`9810d98bc2db41fe9fb59e069fb96bd2e8a93f79`, the retained native-checkpoint media
reader repair, and the bounded recovery-message localization correction below.
Its frozen hoisted dependency installation was refreshed successfully without
changing `bun.lock`. This delivery record changes documentation only after the
build; the binary's source identity remains the build commit above.

The accepted local Windows x64 artifact is `2.0.16-custom-lite.20260924.1`, channel
`latest`, built with Bun `1.4.2+744846f84`, bytecode and the complete embedded WebUI.
It is 207,882,752 bytes with SHA256
`4a3bfda6f587be5ff0259023846228f17283ab39ce4ffe7f62fb06c7890a68e3`.
The version identifies the September 24 integration; its local export occurred
after midnight on September 25. The delivery filename is
`opencode2-zh-CN-2.0.16-custom-lite.20260924.1-windows-x64-20260925-000442.exe`
in `D:\opencode-zh-CN-nightly-windows-x64`. The formal package executable,
`opencode2.exe` worktree mirror and exported executable were verified identical.
The generated package manifest also matches that version. The earlier same-version
candidate with SHA256 `ec406652...` was rejected and deleted, not delivered.

Independent reviewer `ses_f2c33316dffetGO5AQVfypn9qk` returned
`APPROVE WITH DEFERRED RISKS` for this exact source and rebuilt artifact.
SYNC16-F1 is closed. This consumed the synchronization's one repair/re-review
cycle (1/1) in the same review session. The prior native-media repair's approval
and separately consumed 1/1 budget remain unchanged.

Applicable evidence includes twelve affected package typechecks, repository lint,
focused formatting and canonical Client/Protocol generation checks. Source tests
passed 596 AI/Core cases, 43 additional history cases, 17 Server cases plus two
pairing-clock/concurrency cases, 65 CLI cases with one platform skip, 926 App cases
with one skip, 11 timeline cases, 193 SessionUI cases, and 61 retained-custom TUI
cases. The locale correction separately passed 20 prompt-move cases / 110
assertions and TUI typechecking; these overlap the earlier TUI verification rather
than constituting a new disjoint aggregate. Unchanged-source evidence is retained
without claiming that every suite was rerun after the locale-only correction.

The rebuilt executable passed isolated version, Chinese help and embedded-runtime
probes, replacing the initial candidate's historical probe evidence. Its compiled
service smoke passed election, API/OpenAPI authentication, embedded WebUI module,
anonymous API denial, dynamic plugin, default `opencode.db` and owned-stop cleanup.
The owner's observed Windows signal-stop exit was 1, not a graceful-zero-exit
guarantee. Cold legacy-media context and message reads both returned HTTP 200,
with opaque control and synthetic-row preservation checks passing. No real
conversation row was rewritten and no provider request was sent.

Material residuals remain explicit:

- Client tests retain 168 passes and 16 baseline failures reproduced on the
  accepted first parent, as detailed below; they are not counted as a passing suite.
- Compiled pairing passed 28 functional assertions on the rebuilt executable, but
  its harness exited 1 after an owned-child termination-observation timeout.
  Subsequent OS inspection confirmed the exact PID absent and the private profile
  was removed. Repeated timeout evidence is retained, not relabeled as a lifecycle
  pass or used to change the deferred product shutdown policy.
- Real-browser desktop/mobile rendering remains unverified: the isolated Chromium
  launch failed before rendering on the earlier candidate. No browser E2E or
  screenshot verification is claimed for the rebuilt executable.
- Two Server test listener warnings and the prior adapter's P3 own-property
  hardening observation remain without an established production-path defect.
- This is local Windows x64 acceptance, not a full-monorepo, Electron-runtime,
  six-platform-release, real-provider or reverse-rollback compatibility claim.

Both installed old-version executables remain unchanged; activation is left to
the owner. No source push, Release dispatch or online binary download occurred.
The existing public `v2.0.15-zhcn.1` still does not contain the compatibility fix.
The task-owned integration worktree and both repair/synchronization scratch roots
are eligible for removal after verifying the delivered copies. Adjacent metadata
records the actual cleanup result and retained source/recovery references; no
Session-rules narrative is created. Shared caches, unrelated worktrees and user
data are outside cleanup scope.

## September 24 evening synchronization

The owner requested another upstream synchronization before exporting the accepted
checkpoint-compatibility repair. The fixed upstream target is
`9810d98bc2db41fe9fb59e069fb96bd2e8a93f79`, version 2.0.16 with Bun 1.4.2.
Compared with the previous `dca73ba9e3782e2b41983faca5854a9d56a3c482` target,
it adds ten commits across 130 files. The custom starting point is
`a7ef233d4bfcbc0af57a5c86325fdabab5255fc6`; recovery tag
`custom-lite-pre-sync-20260924-evening` retains that accepted repair and repository
rename. Its `.2` binary remains an intermediate verified checkpoint, not a
separately delivered replacement. Final delivery is intended to combine the
repair with this new upstream increment.

The upstream increment adds single-use pairing links and browser/API session
credentials, nested App tab grouping/full Session paths, mobile navigation
settings, missing-directory recovery through Session movement, plugin model
variant selection, GitHub-marked Markdown links, model-catalog refresh and AI
media/client helper refinements. Pairing semantics belong to the upstream
Server/Protocol owners; the TUI conflict resolutions preserve Chinese/English
chrome while adopting those owners rather than retaining password-bearing QR
codes. This sync does not change default service lifetime, startup delays or
child-followup notification behavior.

The previously accepted `SessionProviderContext` compatibility patch and its
review record are retained, not reset or re-reviewed as an unfixed candidate.
This integration needs evidence for the new upstream delta and its interaction
with the repaired media readers. Source, dependency, generated-client, auth/pairing,
TUI and compiled default-database/WebUI checks precede final local acceptance.
No live user data, installed executable, remote publication or online binary
download is part of this synchronization. Task-owned integration and scratch
will be removed after the combined local artifact is accepted and exported.

The vendor dependency versions did not change in this increment; lockfile changes
only advance workspace versions. A clean frozen hoisted installation in the
integration worktree passed and left the lockfile unchanged. The accepted media
compatibility implementation and tests retain their exact Git blobs; initial
physical-file hash differences were Windows CRLF checkout differences, not a
different implementation. No new database migration or Session SQL change was
introduced by the fixed upstream target.

The canonical Client generator passed and produced the exact fixed-upstream
generated client blobs. Canonical Protocol generation added the previously stale
OpenAPI artifact's new pairing endpoints/types and then passed its check. The
generated document was not edited by hand. Focused Server and CLI checks cover
single-use pairing, token/cookie authentication, denied unauthenticated API calls
and the newly public WebUI shell. Additional deterministic-clock tests check the
actual five-minute code expiry boundary and concurrent single consumption.

The broad Client test run had 16 failures, all reproduced on the accepted custom
starting point under matching isolated environments. Splitting default-condition
Effect/Promise tests, browser-condition Solid tests and process-service fixtures
did not remove them. One fixture passes numeric `idle` where the typed Effect API
requires `DateTime.Utc`; six Windows fixture failures assume POSIX SIGTERM/zero
exit behavior; nine Solid subset-match failures have an unestablished root cause.
The relevant tests/runtime sources are unchanged by this increment. These are
retained baseline limitations, not waived passes or evidence that the new pairing
change caused a regression. Product shutdown behavior and test assertions were
not weakened to conceal them. App Happy DOM checks are not real-browser E2E.

## September 24 bounded review repair

The first integrated candidate was held after independent review found that the
new missing-directory recovery route displayed application-generated failure
titles in English even when the selected TUI locale was Simplified Chinese. The
repair is limited to `SessionLocationMissing`: it reuses the existing workspace
translation keys, adds the missing English/Chinese session-move title, and keeps
downstream error bodies literal. Recovery actions, session routing and failure
state are unchanged. The repair commit is
`27cc378b7a` (`fix(tui): localize missing-session recovery errors`), with focused
coverage for both locales at `packages/tui/test/cli/tui/prompt-move.test.tsx`.
The focused suite passed 20 tests / 110 assertions and the TUI typecheck passed.
The earlier compiled `.1` candidate from
`21b24fcd0b80970d743f0363a1af7df0e887a58a` is superseded and is not a
deliverable; any accepted binary must be rebuilt from the repaired source.

## Repository rename on September 24

The owner renamed the existing public repository to `521ox/OpenCode-V2-zh-CN`.
GitHub repository ID `1336715241` and default branch `v2-custom-lite` remain the
same. The local `fork` remote, release workflow repository guard, release contract
constant and current English/Chinese README links now use the new name. The
official `origin` remote is unchanged. Historical entries below retain the name
used when those actions occurred. No remote source push, release dispatch or
download is performed as part of this local rename alignment.

## September 24 native-checkpoint compatibility repair

After activating the locally built `2.0.15-custom-lite.20260924.1`, the owner
observed `Session.MessageDecodeError` while resuming an existing conversation and
returned to the previous `2.0.12` installation. The upstream media-foundation
commit `60c78ed8ab5aa88b856af56ceece87c38e08d27a` changed canonical media parts
from flat `data`/`mediaType` fields to `media.source` without adapting existing
version-1 native provider-context windows. The encrypted compaction checkpoint
was not the incompatible part; retained images used the earlier media shape.
The local synchronization's synthetic completed-message smoke did not cover
that older native-compaction-plus-images case. The already published
`v2.0.15-zhcn.1` uses the same uncorrected source contract.

The repair belongs to `SessionProviderContext`'s persisted read boundary, shared
by validation and model-message decoding, not the global AI schema or a live
database patch. It preserves stored rows, opaque checkpoint content, message
order and attachment metadata. Known legacy media is adapted in memory and
then validated by the current canonical codec; unrelated malformed input is
not discarded. New writes continue to use the current media representation.
This is backward reading compatibility, not a guarantee that the old executable
can read new checkpoints written after activation.

During verification, the permanent worktree's stale installed dependency tree
resolved `gitlab-ai-provider` 6.12.1 although its accepted lockfile requires
6.18.0. The first temporary `.2` binary built against that tree is rejected for
delivery. Verification and the deliverable must use dependencies matching the
unchanged frozen lockfile. This dependency-layout issue is separate from the
observed persisted-media incompatibility.

The same independent reviewer rejected the first adapter because historical
native compaction can persist data URLs and HTTP(S) URLs as well as bare base64.
Treating every string as base64 would let history load but corrupt the next
provider request. The repair now reuses the existing Media data-URL parser and
URL/base64 constructors with data-URL MIME precedence. A synthesized Asset uses
single-asset JSON omission before the JSON codec so optional `undefined` fields
are not mistaken for persisted JSON. The original malformed-input rejection is
retained. The first clean-dependency run caught two optional-JSON decode errors
and two new test typing errors; those failures were corrected without weakening
the fixtures or changing the global AI schema.

With the unchanged frozen lockfile and a clean hoisted install, the seven related
Core suites passed 71 tests / 359 assertions with no failures. Core, AI and CLI
typechecks passed; the stale GitLab type errors disappeared after dependency
restoration. Release/rename regression checks passed 51 tests / 323 assertions
with one POSIX-only skip, including a guard preventing the old repository name
from dispatching under the renamed release contract. Repository lint passed.
This is focused evidence, not a new full-monorepo check or six-platform release.

Read-only validation of the existing native checkpoints passed all 16 windows,
including eight legacy-media windows containing 43 retained media parts across
three Sessions. Each checked row retained its original SHA256, and the read-only
connection reported zero changes. Message order, media payloads/metadata and
opaque checkpoint content were compared without exporting real conversations or
making provider calls. This evidence covers the observed persisted shapes, not
future writes or rollback compatibility.

The corrected Windows candidate is `2.0.15-custom-lite.20260924.2`, channel
`latest`, built with Bun `1.4.2+744846f84`, bytecode and the full embedded WebUI.
Its length is 207,758,848 bytes and SHA256 is
`41272df4583e51d7d5df0abd993234dcd1b5d5edc8daad61ee0fb93f55bd2e9b`.
It was built from `2896b40060e9c7fe4c82235076ffef35b54edcc9` plus the recorded
compatibility patch, not falsely labeled a clean-commit build. Adjacent delivery
metadata records the two changed source hashes and final accepted commit.
Isolated executable version, localized help and embedded runtime probes passed.

A synthetic compiled-service red/green comparison used production startup to
initialize each private default database, inserted fixtures only while its owned
service was stopped, and cold-restarted it. The unpatched `.1` executable passed
the opaque-only checkpoint control but returned HTTP 500 for both context and
message reads with legacy media; returned error references matched the private
decode-failure log. The corrected `.2` returned HTTP 200 for the same fixture
shapes. Both runs preserved the synthetic rows and removed their own profiles.
This verifies cold persisted reads without manufacturing an execution claim or
sending a model prompt; automatic startup resumption and real TUI activation
remain user-level follow-up checks.

The same candidate also passed the established isolated shared-port service smoke:
owned election, authenticated API/OpenAPI, embedded WebUI HTML/module, dynamic
plugin discovery, rejected unauthenticated reads, default database naming and
owned shutdown/registration cleanup. The losing contender exited 0; the stopped
owner's actual Windows exit was 1, consistent with the existing signal-owned
stop contract rather than a newly asserted graceful zero-exit guarantee.

The original reviewer `ses_f2c848b73ffeZktNgHtyNGFfPp` returned
`APPROVE WITH DEFERRED RISKS` for the corrected source and exact `.2` candidate.
P1-R1 and the related P2-R2 persisted-read coverage gap are closed. This used the
single authorized blocking repair/re-review cycle (1/1), preserving the original
findings. P3-R3 remains a nonblocking observation: legacy field guards use
ordinary property lookup rather than own-property checks, without an established
defect on the persisted JSON path. No separate hardening cycle is claimed.
Local delivery records the accepted source commit separately from the dirty-source
build identity; installed files, live data and the existing public Release remain
unchanged. No online publication is included in this repair.

## Native six-platform publication on September 24

After accepting the local synchronization below, the owner separately authorized
pushing the maintained source and running the existing six-platform release CI.
The normal, non-forced push advanced `fork/v2-custom-lite` from
`dd12f1d0d3453aa9ff272e35732fff02e16aa083` to
`3da126e054ffca8291800e040e0daa716a1e58e0`. No runtime, dependency or workflow
changes were added by this publication task. The earlier local-only scope remains
an accurate record of that completed synchronization, not a prohibition on this
subsequently authorized release.

Manual GitHub run `35971350731` used exactly that source and version
`2.0.15-zhcn.1`. All eight jobs succeeded: Linux preflight, six native builds and
publication. Preflight passed 50 tests with one Windows-only skip and 313
assertions across three files. The six native runners covered Windows x64/ARM64,
Linux glibc x64/ARM64 and macOS Intel/Apple Silicon. Each passed source/native
identity, bytecode and embedded-WebUI build, artifact scan, executable version/
help/runtime, isolated default-channel service, archive round-trip verification
and source-cleanliness checks. Publication downloaded all 14 draft attachments,
compared their exact names and checksum file, verified the other 13 SHA256 values,
and only then made the prerelease public.

Release `395457807`, tag `v2.0.15-zhcn.1`, was published at
`2026-09-24T07:57:21Z`. Post-publication API reads confirmed its non-draft
prerelease state, the exact source commit above, and all 14 uploaded assets with
lengths and SHA256 digests. The Windows x64 ZIP is 120,799,930 bytes, SHA256
`a89399cd0aab39ec1af86d0339ad67f1636dd27a5ca5a7b1c3936fd0b196cab4`.
The manifest SHA256 is
`9effedcb68fcad918e714d80e35577143967374b92c30e0feaa102c090a9e1c4`.

An independent public Windows x64 download passed actual length/hash comparisons
against the API, checksum file, sidecar and manifest before execution. The
extracted executable is 207,756,288 bytes, SHA256
`cf011c535a0878dcefce32224ed44c098b24a63201e84d5280c56ecaabd09ead`.
The existing isolated executable probe returned exit 0 for version, help and
embedded Bun revision, confirming `opencode v2.0.15-zhcn.1` and
`1.4.2+744846f84`. It used only private HOME/cwd/config/data/cache/temp locations,
without a live service, model request or installation. Its downloaded archives,
executable, script and probe environment were removed after all processes ended.

The three older Releases and all 42 asset identities, names, lengths and digests
remain unchanged, as do legacy `main`, the three prior public tags, repository
identity/default branch and the Actions policy/five-action SHA allowlist. The
eight protected local executables, metadata files and backup objects also retain
their original lengths and hashes. In particular, the accepted local
`2.0.15-custom-lite.20260924.1` candidate and installed `2.0.12` executable were
not replaced. The public-version binary is a separately identified CI artifact.

Retained upstream Actions again emitted Node 20 deprecation notices while GitHub
ran them under Node 24; no job failed. Coordinated action-pin/allowlist upgrades
remain deferred. This release CI is not a claim that the four retained upstream
reference workflows ran, that the full monorepo check passes, or that every
feature, real user database, code signature, macOS notarization or Electron
Desktop package has been certified. The local synchronization's S24-R1/S24-R2
residuals and the release workflow's draft-recovery limitation remain documented
below; no uncertain publication retry was needed in this run.

After the CI watcher and download verification finished, final hashes reconfirmed
all eight protected local objects. The task-owned
`C:\Users\Administrator\AppData\Local\Temp\opencode\release-v2-20260924`
scratch directory was removed and its absence confirmed (11 remaining files,
552,045 logical bytes; the downloaded binary and archive had already been
removed). No other task directory, shared cache or installed file was deleted.
This tracked record and the GitHub run/Release identities retain the necessary
outcome evidence; no separate Session-rules narrative was created. Follow-up
README and maintenance-record changes are documentation-only and do not rebuild
the published binaries or move their source tag.

## September 24 synchronization

The integration branch `sync-20260924` starts at accepted custom checkpoint
`dd12f1d0d3453aa9ff272e35732fff02e16aa083` and merges the fixed official V2 target
`dca73ba9e3782e2b41983faca5854a9d56a3c482` (source version 2.0.15). The increment
from `b8aa08f260130452dc87fbc20c2a4e2ff743e642` contains 137 commits and 868 changed
files, including substantial App/shared-UI translation additions. Fetch subsequently
observed `0bc8b8dbeb` adding GitHub marks to Markdown links; that later commit is
outside this deliberately frozen integration. The local recovery tag
`custom-lite-pre-sync-20260924` retains the accepted starting point.

Twenty-six textual conflicts were resolved by their current owners. The official
extracted TUI group renderer, persisted disclosure state, exact scroll anchors and
mount budget replace obsolete inline renderers; native execution collections and
their failure/approval visibility integrate into those owners. Existing Chinese/
English chrome, native detail collapse, child-title navigation and background-tab
Location admission remain selected behavior. Automatic tab modes, upstream error
formatting, sidebar state and latest-step token summaries are retained. The
upstream transcript-verbosity additions were reverted before this target and are
not advertised as new functionality.

Model requests adopt parent cache affinity and upstream request hooks/media shapes
while retaining primary-only protected root Session rules and permission-gated
native search. Console policy publication keeps the accepted active-connection
serialization and cross-Location failure retention. No custom compaction, tool
pruning, default service-lifetime or child-followup notification repair is added.

The canonical migration generator reconciles the existing Session start-directory
migration with the new upstream project-activity migration in chronological order;
no duplicate migration is generated and neither historical migration is rewritten.
Upgrade regressions cover existing history, root lineage, already-applied custom
migrations, activity backfill and repeat upgrades. Client code and OpenAPI are
checked through their official generators. Windows CRLF made the initial OpenAPI
byte comparison fail; regeneration passed with no normalized Git content change.

Bun remains 1.4.2. Dependencies use the merged frozen lockfile and a clean hoisted
installation in the disposable integration worktree, reusing the established Bun
cache. The custom release packaging remains intact, including explicit Windows
system bsdtar. Its version fixtures now derive the base version from the manifest
instead of staying fixed at 2.0.12; the manual workflow input suggests 2.0.15-zhcn.1.
This sync does not dispatch that workflow, push source or publish a new Release.

Verification is isolated from installed programs, global configuration and user
databases. The local candidate is `2.0.15-custom-lite.20260924.1`, channel `latest`,
with bytecode and embedded WebUI. Source checks, clean-source build, populated
old-default-database compatibility smoke, independent integrated acceptance and
timestamped three-copy export are separate gates. Source and candidate acceptance
are established below; exact final copy and cleanup results are recorded in the
adjacent artifact metadata. The existing installed program stays usable and is not
replaced by this delivery.

Focused verification distinguishes integration repairs from environment problems.
The TUI toast translation initially passed an optional count to a required parameter;
using the existing Solid `Show` callback accessor restores compile-time narrowing
without changing display conditions. A Shell-output fixture's four one-second polls
plus a 1.1-second post-close assertion exceed Bun's five-second default budget;
that fixture now explicitly allows ten seconds, retaining every assertion and
poll interval. Client surface assertions were already stale on the previous custom
and official baselines (`file.write`, `vcs.branch.list`, interrupt `resume`); tests
are aligned with the canonical Protocol rather than changing product endpoints.
Solid reconnect tests require the browser export condition for actual reactive
effects; the original default-condition failure is not represented as a pass.

The direct compaction fixture also needed the existing temporary Location layer
to satisfy the request owner's real permission/search dependencies; no production
compaction behavior was changed. Windows retained-image testing initially failed
because the Bun executable is on D: while private TEMP is on C:. A distinguishing
link probe returned `EXDEV`; running the unchanged test with the byte-identical
Bun 1.4.2 already installed on C: passed all four cases. This proves the same-volume
path, not cross-volume hard-link support or automatic updater certification.

The canonical full `bun run check` passed repository lint but stopped at the
unmodified Stats App Vite configuration: hoisted Vite/Rolldown plugin types and
that package's Vite/Rollup types are incompatible. The complete monorepo typecheck
is not claimed passed. Separate canonical typechecks passed for Schema, Protocol,
HTTPAPI-codegen, Client, Core, AI, TUI, CLI, App, UI, Session UI, Plugin, browser
plugin, Server and Util; CodeMode's separate typecheck also passed. Stats-specific
dependency repair and Desktop runtime certification remain outside this CLI sync.

The isolated runner initially omitted PowerShell from PATH, causing Windows shell
fixtures to select Git Bash and receive PowerShell syntax errors. Restoring the
verified PowerShell 7 directory in the runner's private PATH made the unchanged
Session/Shell fixtures pass (95 cases, 63 platform/conditional skips); no product
shell-selection policy was changed. An upstream `/new` fixture likewise needed
explicit English locale for its existing English-text assertion, without changing
the Chinese product default. Full-check-generated Storybook declarations were
restored to their tracked baseline rather than committed as unrelated output churn.

Integration-owned formatting and whitespace checks pass. The complete upstream
diff's whitespace check reports only the two vendor patch files for MCP Client
2.0.0 and pacote 21.5.1; their blobs match the frozen official target exactly.
Patch context whitespace is preserved rather than restyled, and successful frozen
dependency installation verifies that the patches apply. This is not a claim that
the complete upstream diff passes Git's whitespace checker.

Independent integrated review `ses_f2dbdc5f4ffex6yqdYrXHFee3w` returned
`APPROVE WITH DEFERRED RISKS` for clean merge
`79ba7d450a2288269a8cbb243d77cb1b76b3f582` and the exact Windows x64 candidate.
The merge has the accepted custom checkpoint and frozen official target as its
two parents. No blocking repair/re-review cycle was needed. The immutable local
acceptance tag `custom-lite-2.0.15-20260924.1` identifies the source plus these
documentation-only acceptance updates; metadata distinguishes it from the build
commit rather than claiming a documentation commit rebuilt the executable.

Final focused evidence contains 4,353 passing cases, 72 conditional/platform skips,
313 test files and 16,016 assertions across 18 non-overlapping suites. The integrated
TUI suite passed 366 cases across 40 files, covering preserved customization and
new grouping/anchor behavior together. Sixteen affected package typechecks passed.
These results do not claim full Test262, real-browser E2E, Desktop execution or
provider entitlement certification. The full Stats App check limitation remains
as recorded above.

The candidate is 207,756,288 bytes, SHA256
`2972007f952f5cc8dd27a556d6f79ccdeb1143c97d09aa538d47181ecbd4503c`.
Its exact version, help and embedded Bun revision `1.4.2+744846f84` passed. Both
the isolated shared-port election/service/WebUI smoke and a separate populated
old-default-database smoke passed on these bytes. The latter preserved the known
Session identity and two prior-schema-valid completed messages, verified activity
backfill and retained start-directory data, and left the original synthetic DB
hash unchanged with a zero-length/absent WAL. Official owned stop terminated the
test processes and removed registration; actual Windows exit code 1 is recorded,
not relabeled as zero or as a graceful-shutdown guarantee. No live data was used.

Review residual S24-R1 is one asynchronous tabs-layout persistence warning in the
integrated TUI test log. The Flock error discards the underlying errno, so neither
the root cause nor a new runtime regression is established. It is not claimed
fixed or harmless: if repeated during normal use, one layout update could be lost.
This concerns client layout persistence, not evidence of lost server-side Session
messages. S24-R2 is the separate full-monorepo Stats App typecheck limitation.
Both are nonblocking P2 residuals under this candidate's fixed acceptance scope.

Promotion keeps source and maintenance documents in the permanent worktree
`D:\opencode-local-build\opencode-v2-custom-lite`. The package executable, root
mirror and timestamped export in `D:\opencode-zh-CN-nightly-windows-x64` must have
identical length and SHA256. Task-owned integration files and scratch are removed
after accepted delivery, with completion recorded in adjacent metadata. Installed
`opencode.exe`, its existing backup, other worktrees, shared caches and the previous
synthetic fixture are outside cleanup. No remote push, online release, user-data
migration or installed activation is part of this synchronization.

## Native release workflow restoration on September 22

After the source-only transition below, the owner explicitly requested and
authorized restoring manual online builds for all six former target combinations:
Windows, Linux glibc and macOS, each x64/ARM64. The new workflow is
`.github/workflows/release-custom-cli.yml`, not the retired legacy workflow.
It follows the current `opencode` executable / `latest` storage-channel contract
and selects `2.0.12-zhcn.1` for its first public prerelease. The existing local
`2.0.12-custom-lite.20260922.1` binary remains a separately identified artifact.

The implementation reuses official `build.ts`, artifact scanning and service
lifecycle owners, existing pinned GitHub setup/artifact actions, and `gh` for
draft publication. Old handwritten archive codecs and fixed legacy version/channel
validators are not restored. Archiver 7.0.1 and matching types are explicit build-
time dependencies; the existing dependency was already in the lockfile transitively.
The lockfile update also synchronizes the already-present `opencode` bin entry,
which had been absent from the previous workspace lock metadata.

Native smoke development exposed an over-strict agent-derived requirement that
every losing starter exit with 0. The official `Service.ensure` owner accepts a
healthy ready service before examining contender failures; explicit `Service.stop`
also owns signal termination rather than promising an exit code. The test was
aligned with that existing contract, without changing production startup/exit.
A Windows cold contender was observed exiting 1 during registration-file rename
while the other contender remained healthy. The underlying OS errno was not
established, and the runtime issue is not claimed fixed. Nonzero losing outcomes
remain visible diagnostics; healthy winner, authenticated APIs, default storage,
embedded WebUI, stopped processes and registration cleanup remain required.

Further diagnosis found a test-induced departure from the upstream smoke: giving
each contender `--port 0` bypassed the official shared-port election and allowed
both processes to bootstrap the same empty database. One captured failure was
`SQLiteError: table account_state already exists`, surfaced as failed service
readiness (HTTP 500). The probe is corrected to share one privately selected
nonzero loopback port, not to ignore failed readiness. This restores the upstream
test's election semantics without contacting the live default port. Production
database concurrency, startup and exit code are unchanged; cross-port concurrent
bootstrap is not certified or claimed fixed by this release work.

Integrated local release checks passed 48 cases (310 assertions) across three
files, with one Windows-inapplicable POSIX-permission case skipped for the Linux
preflight to run. CLI typechecking, changed-file formatting, repository lint and
Actionlint 1.7.12 passed. The corrected Windows smoke passed on the existing
accepted local binary: authenticated API/WebUI, default database, loser termination
(code 0), official owned stop (actual code 1) and registration cleanup. This is
probe evidence, not acceptance of a newly built public-version executable.

The canonical full `bun run check` was attempted. Its initial Turbo global-config
lookup failed in the private Windows environment; using Turbo 2.10.2's explicit
private config-directory overrides resolved that launcher failure. The full check
then stopped on App/Desktop's unchanged `markdown-cache.tsx` import because the
local dependency tree resolves two nominal `@types/trusted-types` declarations
(hoisted and `.bun` paths). No application source was changed to conceal it, and
the full monorepo typecheck is not claimed passed. The affected CLI typecheck was
run separately and passed; clean native CI builds remain mandatory below.

Independent integrated review `ses_f3850e61effeVo01DhMmAIMOh6` approved source
`7c454b174e0ddbdff506f6d086affede33a5e7bb` with deferred risks before the first
dispatch. Its P2 recovery observation is retained: the REST published-release-by-tag
404 check alone cannot exclude an unpublished draft. Inspect the authenticated
complete Release list and any draft identity before retrying an uncertain
publication; never infer that two 404 responses authorize replay. The first
dispatch separately confirmed the new version had neither a draft nor a tag.

GitHub run `35693524080` completed with failure before publication. Its Linux
preflight passed all 49 tests (311 assertions), including POSIX permissions.
All six native compilation, executable/runtime and isolated service/WebUI steps
passed. The four Linux/macOS jobs also packaged and uploaded successfully, but
both Windows jobs failed archive extraction because Git Bash's GNU `tar` preceded
Windows bsdtar on PATH and interpreted the drive letter as a remote host. The
release job was skipped and no new draft, public Release or tag was created.
The bounded repair selects the Windows system archive tool explicitly; it does
not weaken archive verification or change the executable. A new complete run
must use one repaired source SHA rather than mixing artifacts from different runs.

The Windows repair's real child-process regression puts Git GNU tar first on PATH:
legacy extraction of the same ZIP fails with exit 128, while the explicit system
bsdtar completes the unchanged full round-trip checks. Integrated Windows tests
then passed 50 cases (319 assertions; one POSIX-only skip), with CLI typechecking,
focused lint and formatting passing. The GNU-PATH regression is Windows-only;
the Linux preflight independently covers the POSIX permission case.

The same reviewer approved repaired source
`eb86797f373865406f415a3123e1b26e0fb11fd0` with deferred risks. This used the one
bounded blocking repair/re-review in the integrated review; F1 remains a recovery
residual, not a claim that the incomplete draft lookup was repaired.

The complete second run, `35694917252`, succeeded on that source: preflight, all
six native build/verification jobs, and the final publication job (eight jobs).
Linux preflight passed 50 tests / 313 assertions with only the Windows GNU-PATH
case skipped; the local Windows run covers that case. Every native executable
passed version/help, Bun runtime and architecture identity, authenticated service,
default database and embedded WebUI checks. Every archive passed extraction and
content verification. Publication downloaded all 14 draft attachments, checked the
exact file set and all contents, then made the prerelease public.

Public release `393500723`, tag `v2.0.12-zhcn.1`, was published at
`2026-09-22T06:36:40Z`. Its tag resolves to the repaired source above. Authenticated
post-publication reads confirmed 14 uploaded assets with SHA256 digests and a
non-draft prerelease state. The Windows x64 ZIP is 118,951,798 bytes, SHA256
`6ef4075dd5f6bb9d7477a7d2e1c393be2bc4aa38daf47545612722fa55f78eaf`.
The public manifest digest is
`24bcb264781cda044ed42d2b4fd61dd50c6d454c64ff008bd636e1dffcb5e953`.
Legacy `main`, both legacy tags, both Releases and all 28 legacy asset identities,
names, lengths and digests were unchanged. Repository identity, default branch,
Actions policy and the five-action SHA allowlist also remained unchanged.

The retained upstream actions emit Node 20 deprecation notices and are executed
by GitHub under Node 24; all jobs succeeded. Action pin modernization is deferred
because it requires a separate coordinated allowlist change, not because those
notices were hidden. These results do not claim full feature-suite, code-signing,
notarization or real-user-database migration certification. The earlier local
full-monorepo typecheck limitation also remains accurately recorded above.

An independent post-publication Windows x64 download also passed: ZIP and
executable lengths/digests matched the public API, checksum file, sidecar and
manifest before execution. The extracted executable is 205,295,616 bytes, SHA256
`940c7c5eaacc5de20d737cf44ade5dfbeb8b03383ca507e382674e1abb56ae09`.
Isolated version, help and embedded-runtime probes returned exit 0, respectively
confirming `opencode v2.0.12-zhcn.1`, working help and `1.4.2+744846f84`.
No live service or user database was used. Final hash checks confirmed all six
protected local binary/metadata/backup objects remained unchanged, including the
installed `fbc8b717...` executable. This online release does not activate or replace
that local installation.

After all verification processes finished, the task-owned
`release-v2-20260922` scratch directory was removed and its absence confirmed
(9,855 remaining files; 377,368,170 logical bytes). The downloaded Windows archive,
executable and probe environment had already been removed by the download check.
No shared Bun dependency cache, other task directory or installed file was deleted.
Temporary Actionlint catalog registration was invalidated after removing its file.
This tracked record and GitHub run/release identities retain the necessary outcome
and recovery evidence; no separate Session-rules narrative was created.

Local checks and the six native GitHub jobs are separate evidence. Native CI must
validate all six outputs before any public release is claimed. No live local
configuration, user database, installed executable or existing local delivery
mirror is part of CI validation. Temporary local implementation/check tools are
removed after accepted delivery; failed publication evidence is retained only
when needed for recovery. The previous source-only statements below describe that
completed earlier milestone and do not prohibit this newly authorized release work.

## Public source transition on September 22

The owner authorized retaining `521ox/opencode2-zh-CN` and publishing the accepted
maintained enhancement branch as `v2-custom-lite`, with that branch as the default source
entry point. The previous `main` at
`79a88075fc37be57c202400ac6aecffbaf4b0783`, existing tags and legacy Releases are
preserved. Do not force-push, rewrite the legacy branch or publish binaries as
part of this source-only transition. The accepted local binary and its immutable
acceptance tag remain tied to their existing build provenance; README and workflow
changes do not constitute a new runtime build.

Public presentation calls this the community-enhanced Chinese/English edition.
The internal `custom-lite` label describes bounded, upstream-aligned maintenance,
not a claim that the tool, Session, subagent, permission and reliability changes
are merely localization or a small feature set. This wording does not expand the
selected product contract or restore retired functionality.

`README.md` and `README.zh.md` describe the current fork rather than advertising
official packages or legacy six-platform releases as this distribution. The old
`release-cli.yml` workflow was explicitly disabled by its exact GitHub workflow identity
before publication, without deleting its historical source or runs. The new branch excludes 23
upstream deployment, publication, scheduled maintenance and community-automation
workflows. Four upstream validation definitions remain: `check.yml`, `test.yml`,
`nix-eval.yml` and `storybook.yml`. Their upstream branch filters, Blacksmith runner
requirements and the repository's existing action allowlist are not reconfigured
or claimed validated for this fork. Repository-wide Actions settings stay intact.
Future upstream merges must review newly added or resurrected workflows before
publication; preserving runtime changes does not authorize upstream infrastructure
to operate in this repository.

The publication boundary is the explicit `v2-custom-lite` branch ref only, not
`--mirror`, `--all` or automatic tag pushing. Verify the remote branch SHA before
changing the default, then verify the default, bilingual entry points, preserved
legacy refs/releases, unchanged Actions policy and disabled legacy release
workflow. If publication or verification fails, retain the old default or restore
it to `main`; do not replay an uncertain push or settings mutation without reading
remote state first. Local checks include scoped documentation formatting, unchanged
runtime and validation-workflow blobs, and an offline Gitleaks scan of the custom
history relative to the public upstream, including merge diffs. A clean scan is
bounded evidence, not a guarantee that all possible sensitive data is absent.

The source transition completed on September 22, 2026. Initial public tip
`425c01f849c7ae4eb2f3577430d03d7b91a90696` was pushed without force or tags;
GitHub then reported `v2-custom-lite` as the default branch of the same public
repository (ID `1336715241`). The Chinese enhancement description and both README
blob identities were read back successfully. Legacy `main`, both legacy tags,
the two existing Releases and their 28 asset identities were unchanged. The
repository-wide Actions policy and selected-action allowlist were also unchanged,
and no workflow run was added during the switch.

Legacy workflow `350726046` first reported `disabled_manually`. After switching
to a default branch without its file, GitHub reported it as `deleted` and omitted
it from the active workflow list; its source still exists in unchanged legacy
`main`. Verification accepts this retired state only with the prior explicit-
disable evidence, preserved legacy source and absence from the new default branch.
No binary Release or new public tag was created. The local branch tracks
`fork/v2-custom-lite`; `origin` remains the official upstream.

Independent publication-readiness review approved `f5484cbc66fa752121c8b34c0ec8c1cf1e2e49e4`
with deferred risks. The owner's subsequent enhancement-positioning wording and
this completion record are documentation-only changes, checked directly; they do
not change runtime behavior or claim a new binary review. Gitleaks 8.30.1's default
rules found no secret matches in the newly published custom history, including
merge differences. Scoped formatting, local links, runtime/dependency/LICENSE
preservation and the four retained CI definitions were verified. Temporary scan
tools, private check environments and raw task logs are disposable after remote
read-back; this tracked record retains the material result and recovery refs.

## September 22 synchronization and temporary cleanup guidance

The integration branch `sync-v2-20260922` merges fixed official V2 target
`b8aa08f260130452dc87fbc20c2a4e2ff743e642` into accepted custom checkpoint
`9a9d71d11fba67a5b20a399c261a31b388344809`. The upstream increment from
`cbdd1f66da3a50e02d40a3198a6bc270d651327b` contains 16 commits and moves source
manifests to 2.0.12. The target is frozen for this integration, not a moving latest
claim. The Bun 1.4.2 toolchain remains unchanged; the upstream Electron update is
for the separate Desktop package, not the embedded CLI runtime.

The user separately authorized adding task-owned temporary cleanup guidance to
the official environment prompt. The addition preserves the temporary directory
preference, scopes removal to no-longer-needed task artifacts and existing
permissions, protects shared/user/active-process files, and requires explaining
minimal retained evidence. It is not an automatic cleanup service and does not
claim that every model will comply. The selected behavior is in `CUSTOMIZATIONS.md`.

The Core policy conflict preserves both the official Console-managed policy
authority and conservative hosted-search preauthorization. UI conflicts preserve
Chinese/English presentation while adopting terminal-sized `/btw` and Mini exit
completion updates. Existing direct-execution groups, tool detail interactions,
child-title navigation, copy-session-ID action and protected Session rules remain
selected contracts, not opportunities to restore the retired full fork.

Verification uses private configuration, test database and runtime directories,
but reuses the established Bun dependency cache instead of creating a complete
package cache per task. The current task's scratch data is removed after accepted
delivery and compact verification results are retained with the candidate metadata.
Previous task directories, shared caches and running services are outside that
cleanup scope. No installed activation, provider call or live database operation
is part of this synchronization. Startup/default exit and later child-terminal
notification repairs remain deferred.

Candidate version: `2.0.12-custom-lite.20260922.1`, channel `latest`. Source
integration, compiled artifact verification and final export remain distinct gates.

Focused source verification passed 1,122 distinct cases across 46 files: 158 Core
(including the environment instruction and managed-policy/hosted-search integration),
706 Code Mode, 69 TUI, 33 CLI, 83 App, 36 Session UI and 37 browser-plugin cases.
Eleven affected package typechecks and scoped format/lint checks passed. Final
integrated policy and TUI runs passed all 93 and 69 respective cases. Earlier
fixture failures were corrected by seeding the real saved-permission database and
waiting for real Markdown rendering/selection-aware dismissal; production
assertions were not weakened. This evidence includes English/Chinese `/btw`
resize frames and existing native-tool collapse, execution groups, child-title
navigation and copy-ID behavior.

App tests use Happy DOM, not a live browser. HTML artifact previews retain the
upstream sandbox without same-origin permission; this is origin isolation, not
a no-network guarantee. The new CLI upgrade error formatter is source-reviewed
but not directly exercised by the older error fixtures. No complete Test262/WPT
certification, browser end-to-end suite or Electron runtime is claimed.

The initial closure review rejected the first candidate for a Console-policy
cross-Location failure: a new Location's first failed fetch could clear another
Location's process-global organization deny, and a later failure could replay a
stale private snapshot. The bounded repair makes `ManagedPolicy` retain the last
known statements for the same connection and publishes every successful Console
observation, including empty policies and 404. Different connections still never
merge. Two real-plugin, shared-owner regressions first failed on the initial
implementation and then passed with the existing policy suite (95 cases, 471
assertions). The earlier 1,122-case evidence plus those two cases totals 1,124
distinct cases; repaired-source checks, rebuild and same-session re-review remain
separate acceptance gates.

The first re-review retained F1 as blocking: a late old-connection failure could
still clear a newer connection's accepted deny. The user explicitly authorized
one additional bounded repair/re-review cycle. All production policy completions
now pass through the global owner's shared Effect permit, which re-reads the
authoritative active connection before publication. Twelve controlled in-flight
cases cover old 503/success/404 results after a new connection succeeds, fails,
returns 404 or disconnects. Ten failed against the first repair; all twelve and
the prior policy cases pass after the guard (107 cases, 573 assertions). The
distinct focused total is now 1,136 cases across the same 46 files.

Final independent review in `ses_f3ae605b0ffel534wwrpuTVNz7` returned
`APPROVE WITH DEFERRED RISKS` and closed F1 for clean source commit
`ed408935467b426e2c8eae1b51be5b7b6bfa9d7d`. The original merge is
`6212edadda282cae5ebeb61e0e2765ff2760aac9`; repair commits are
`66850902b576f68799a79781c0a925bc06d5fc18` and the final source commit above.
The two rejected candidates remain in Git history; the original review budget
and the user's explicit additional bounded authorization are not erased.

The accepted Windows artifact is `2.0.12-custom-lite.20260922.1`, channel `latest`,
205,199,360 bytes, SHA256
`fbc8b717fd323bb7741cbcc4d918fa75ffe721b6df4b869ee8a2a3efd14e06da`.
It was built from the clean final source using Bun 1.4.2 with embedded revision
`1.4.2+744846f84`, bytecode and the full WebUI. Exact version/runtime probes and
the isolated populated-default-old-database/API/WebUI/owned-service shutdown
smoke passed on these bytes. Source verification totals 1,136 distinct cases,
46 files and 3,146 assertions; eleven package typechecks and scoped style checks
passed, reusing unaffected evidence and rerunning the repaired Core/CLI scope.

The local acceptance tag `custom-lite-2.0.12-20260922.1` identifies the final
source plus documentation-only acceptance updates. The permanent worktree remains
`D:\opencode-local-build\opencode-v2-custom-lite`; this document is tracked there,
not retained only in the disposable integration worktree. Promotion brings code
and maintenance documents together. Package output and root mirror belong in
that permanent worktree; the timestamped export belongs in the agreed delivery
directory. Adjacent metadata records actual copy verification and removal of
this task's temporary worktree and scratch after accepted export. Other worktrees,
older task directories, the shared Bun cache, installed executable and existing
backup remain outside cleanup. No activation, live migration or remote push is
part of this acceptance.

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

Accepted candidate `2.0.11-custom-lite.20260921.1`, channel `latest`, was built from
clean merge commit `ba7ea8a9a29998af7a32dd426fea52aa66b93a9d` with the unchanged
Bun 1.4.2 toolchain and embedded revision `1.4.2+744846f84`. The full Windows
bytecode/WebUI build and isolated populated-default-old-database/API/WebUI/owned-
shutdown smoke passed. The executable is 205,157,888 bytes, SHA256
`cb51501b6cd75e879770937a7a6a451f364093ab464492f73cbdec6ad2ff85b4`.
Independent Material closure review approved this exact source and artifact with
deferred risks; no repair/re-review cycle was required.

The local acceptance tag `custom-lite-2.0.11-20260921.1` identifies the merge plus
documentation-only acceptance updates. Export metadata distinguishes the binary
source commit from that documentation tip. The original custom branch is promoted
only after approval; the fixed-name installed executable, existing backup and live
state remain protected. Installation and restart are user-managed.

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

Two upstream-only limitations remain outside this CLI delivery: the Desktop
profiling helper `scripts/profile-by-source.ts` hard-codes a developer-machine
module path, and that helper plus `src/main/windows/index.ts` retain upstream
whitespace issues. Their blob identities match the fixed official target; the
official diff itself fails whitespace checking. These files were not restyled or
claimed runtime-verified. The scoped integration format/lint result is not a claim
that the complete upstream diff passes every formatting check.

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
2. Fetch the official `dev` branch, record its exact target SHA, and inspect the
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
git fetch origin dev
git rev-parse origin/dev
git log --oneline <previous-official-sha>..<reviewed-official-sha>
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

- Use the package-manager version in the target root manifest. October 16 frozen
  target: Bun 1.4.2, TypeScript 5.8.2, Effect 4.0.1, Solid 1.9.15, OpenTUI 0.5.17.
  Preserve the lockfile; do not upgrade dependencies merely while organizing Git.
- Run tests from their package directories, never the repository-root test script.
  Use private HOME/USERPROFILE/XDG/APPDATA/LOCALAPPDATA/TEMP paths and synthetic
  data. On Windows also set nonempty private ProgramData/ALLUSERSPROFILE roots.
  Clear credentials and use only owned loopback services. Do not let a CLI test
  discover or replace the real managed service, or invoke the default WSL distro.
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
