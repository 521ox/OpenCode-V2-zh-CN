# Maintaining the Minimal Custom V2 Branch

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
