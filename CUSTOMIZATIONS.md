# Minimal Custom V2 Distribution

Status: the current integration targets official V2 `9810d98bc2db41fe9fb59e069fb96bd2e8a93f79` (2.0.16), retaining the accepted native-checkpoint media compatibility repair and the selected behavior below. It adopts official single-use pairing links while preserving Chinese/English TUI chrome. Existing grouping, disclosure/scroll state, parent cache affinity, cleanup guidance and bounded Console-policy repairs remain intact. See `UPSTREAM_SYNC.md` and the adjacent `.exe.build.json` for exact acceptance, source identity, verification scope and delivery state; a source integration alone is not a verified binary delivery. Acceptance does not activate the installed executable; replacement and restart remain user-managed.

The historical `2.0.9-custom-lite.20260919.1` build used the wrong `local` channel and must not be used as this distribution's in-place replacement. The `.2` correction and later candidates use `latest`; the current candidate verifies that identity again. These checks cover populated default-path synthetic history, not full unfinished legacy-state compatibility or production-migration approval.

This branch starts from official OpenCode V2 source. It keeps the official model
protocols, remote compaction and recovery policy, Session lifecycle, background
Jobs, managed-service defaults, and TUI interactions except for the selected
additions below. It is not a port of the former full customization set.

## Selected behavior

### Task-owned temporary-artifact cleanup guidance

The existing built-in environment instruction still prefers OpenCode's prepared
temporary directory. It now tells Agents to create only necessary temporary
artifacts and remove their own task-created scripts, test data, private environments,
redundant caches and intermediate builds once verification or the task ends and
those artifacts are no longer needed, within existing permissions.

Deliverables belong in the agreed destination. Only minimal still-needed failure
or recovery evidence should remain, with retained temporary paths and reasons
reported. Agents must not delete the temporary root, other people's or user files,
shared caches or files still used by background processes; uncertainty about
ownership or activity means do not delete and report the uncertainty.

This is model-facing guidance in the existing environment fragment, not a deletion
service, timer or guaranteed model-compliance mechanism. It does not change path
permissions, rewrite historical instructions or clean up earlier tasks automatically.
Repeated unchanged loads retain the existing instruction read/diff/render behavior.

### Protected Session rules location

Normal Agent requests receive a protected system context naming
`<root-session-start-directory>/.opencode/rules/<root-session-id>`. Descendants
share the root location through persisted parent lineage. Session movement does
not rewrite the root's creation directory. Resolution does not read or create
files, and missing or unsafe facts produce an unavailable result rather than a
guessed location. User instructions and authoritative project paths take priority.

The context is appended after normal context hooks and is omitted from title,
generate and compaction requests. Historical rows are backfilled only from exact
persisted creation facts or a valid direct historical start-directory fact.

### Environment catalog and direct execution

`environment_tools` stores and revalidates program information; it is not an
installed-software inventory. Missing entries do not establish absence. Catalog
queries, updates, executable invocation and external working directories retain
their own authorization boundaries. Names-only discovery does not probe paths.

`direct_exec` accepts an active catalog ID and an argument array for verified
native EXE/COM programs. It does not accept shell syntax, caller environment,
stdin or background execution. Catalog membership is not execution permission;
executable identity and working directory are checked around approval. Use the
ordinary shell tool for operations that require shell semantics.

Both native tools have explicit TUI classifications and reuse the official
`BlockTool` presentation: a raised block with a left border, selection-aware
click handling, and the standard running, permission and error display. Click
the title to toggle details or click expanded input/output content to collapse
it. Dragging to select text does not collapse the block. Reopening preserves
the displayed input and output; errors remain visible while details are collapsed.
Unknown generic tools retain their existing inline, heading-only interaction.
This UI integration does not change model-facing tool descriptions or execution.

Consecutive `direct_exec` calls use a separate execution collection when the
existing `session.grouping` setting is `auto`. Two or more adjacent calls collapse
under one neutral execution-count heading; a singleton or `grouping: "none"`
retains the individual native block. Existing visible text, reasoning, other-tool
and footer boundaries still separate collections. Execution groups are not
classified as read-only exploration and never reorder permission-blocked calls.

Expanding the collection renders the original tool blocks and their existing
detail controls. Collapsing it retains running/streaming calls, tool errors,
reported nonzero exit codes and pending approvals in their original order. The
heading follows actual tool states, not a later message boundary; "finished"
does not assert success. Selection protection applies to both the collection
heading and individual blocks. Unknown exit metadata is not inferred as failure.
Grouping does not rewrite stored messages, alter exports or add output pruning;
existing tool output limits and the separate `environment_tools` display remain
unchanged.

### Simplified Chinese and English chrome

Terminal UI, Mini and CLI-run chrome share a locale owner. The custom default is
Simplified Chinese; explicit English and English fallback remain available.
Translation must not rewrite model output, tool output, paths, identifiers,
protocol values, JSON events or external error payloads. Upstream key bindings,
navigation, cache behavior and mouse interactions remain unchanged.

Use the existing settings dialog to select the language, or set `"locale": "en"`
in the global `cli.json` for English (`"zh"` for Simplified Chinese). Main TUI
translations react to settings changes. Mini retains its official startup-time
configuration model and reads the selected language when started.

Early CLI help/bootstrap output precedes the normal disk configuration load. It
uses an already-decoded inline locale when available, otherwise Chinese; a disk-only
English preference applies after that existing load. Native CLI-library headings
and raw parser/error bodies remain English. Administrative-command help and model
instructions are outside the Main/Mini/run-chrome translation scope.

### Complete subagent conclusions

Trusted completed subagent results return the complete final assistant text and
the official child Session identity envelope, not a generic tool preview. Other
tool outputs retain normal bounds. Child trajectories are not copied into the
parent. Official Agent/model switching, continuation and notification recovery
remain unchanged. Provider context limits still apply and are not hidden.

### Authorized hosted web search

Supported native OpenAI and xAI Responses routes gain their own typed hosted
`web_search` definitions. Capability is established by the actual native route,
not a provider display name, URL, shared route ID or compaction support alone.

Hosted search requires wildcard Agent authorization and must respect effective
Session permissions, saved rules and restrictive permission hooks. A disabled or
removed search tool is not reintroduced. An allowed native request advertises one
hosted search owner and no duplicate local search. Ask/deny does not preauthorize
hosted search or silently substitute local search. Supplier rejection surfaces
without silently switching search suppliers. Other routes retain official local
search behavior; account/model entitlement is not guaranteed by this source.

For unattended hosted search, add an unrestricted allow rule to the existing V2
`permissions` array in `opencode.jsonc` (preserve the other rules):

```jsonc
{ "action": "websearch", "resource": "*", "effect": "allow" }
```

With no overriding restriction, this authorizes search without repeated TUI
approval prompts. The provider executes the advertised native tool; a separate
local search supplier is not required. Custom provider names and endpoints remain
eligible when they resolve to the supported native adapter. `websearch: false`
still disables search. Selecting a local `websearch.provider` is not the hosted
capability switch and does not override permission rules.

The built-in configuration policy participates through a live blanket-policy
decision. Unknown third-party permission-evaluation hooks and policies that cannot
be proven unrestricted withhold hosted search: the provider chooses individual
queries only after dispatch, so this integration does not fabricate a local
tool-call source or bypass per-query restrictions. In this case there is no silent
local fallback on the supported native routes.

Official compaction strategy and recovery policy remain unchanged. The bounded
persisted-media compatibility repair below only adapts historical checkpoint
reads. Search is a normal-generation capability, not a tool injected into compact
endpoint bodies or auxiliary title/summary work.

### Native checkpoint media compatibility

Version-1 provider-context windows written before the upstream Media Asset
transition may contain flat media parts with `data` and `mediaType`. The Core
`SessionProviderContext` read boundary recognizes that historical shape and
adapts it in memory before using the current canonical Message codec. Bare
base64, base64 data URLs and HTTP(S) URLs retain their distinct meanings; a
data URL's declared MIME type takes priority over the historical fallback type.
Filename, cache and provider metadata, message order and opaque compaction
content remain intact. Both validation and model replay use the same adapter.

The adapter does not rewrite database rows, prune tools, replace an encrypted
checkpoint with a summary, or recover arbitrary malformed data. Existing current
media fields are not overwritten by legacy fields. New checkpoints keep the
current format; backward reading support does not guarantee that an old binary
can read checkpoints written by a newer binary. No real-data migration or
automatic rollback is provided.

### Visible official subagent identity

The subagent management list displays the existing full child `sessionID` next to
its Agent and title. This is a presentation-only addition: no identity generation,
mapping, new controls or backend changes. Official selection, opening and interrupt
targets remain unchanged.

### Visible TUI close controls

Popup and composer-header close controls show `×` instead of a clickable `esc`
label. They reuse the official close/cancel action and hit area. Keyboard Escape,
selection-aware dismissal and existing confirmation behavior remain unchanged.

### Subagent completion-title navigation

The task title after `·` in a subagent completion notice is a distinct clickable
target, using the former customization's title presentation and hover behavior.
It uses the current primary-action theme colors and gains bold/underline styling
only while hovered. Clicking opens the exact existing child Session through the
official route owner; it does not create a separate tab or navigation system.

The existing heading-to-child behavior remains. The separator and trailing blank
area are inert; dragging to select text does not navigate. Missing child identity
or an empty title does not create a title target. Terminal-cell-width truncation
keeps Chinese and narrow layouts bounded. Shell notices remain non-navigating.
This does not restore the old heading-to-parent-tool jump behavior.

## Explicit non-goals

- No old protocol-routing, final-body sealing, custom compaction, pruning, lease,
  continuation-ledger, Job-retention or performance patches are imported as a group.
- No old complex Session-ID controls, MCP-gesture or parent-tool dual-navigation
  framework. Only the explicitly selected identity, close-control and completion-
  title presentation above are restored.
- No session-memory plugin or wholesale restoration of the previous fork's release machinery. The separately authorized native release workflow below uses the current build contract.
- No custom Windows build wrapper or installed-binary replacement.
- No change to the official updater policy. Installing a custom binary and later
  accepting official updates may replace custom additions; decide release/update
  policy separately before an actual rollout.

## Verification and operation boundary

### Native GitHub prereleases

`release-custom-cli.yml` is a manual-only workflow for this repository's
`v2-custom-lite` branch. Release versions follow the current root source version
plus `-zhcn.N`; the first selected version is `2.0.12-zhcn.1`. Internal executable
names stay `opencode` / `opencode.exe`, with storage channel `latest`, Bun 1.4.2,
bytecode and the embedded WebUI. The workflow uses native Windows, Linux glibc
and macOS runners for x64 and ARM64 rather than treating cross-compilation as
native verification. Existing local acceptance tags and binaries are not replaced.

All six builds must pass source/native identity, executable version/help/runtime,
isolated service/default-database/WebUI and archive round-trip checks. The
application-specific manifest binds each archive to its source, target and
SHA256. ZIP and tar.gz creation use Archiver; extraction uses the platform's tar
tool. No custom archive codec is maintained. Fourteen assets are uploaded to a
new draft, downloaded and checked before the draft becomes a prerelease.
Existing tags, Releases and assets are never overwritten. An uncertain or failed
publication retains the draft for inspection; it does not automatically delete
remote state or retry with clobber. Build artifacts have one-day Actions retention.

Service validation uses two contenders on one privately selected loopback port,
matching the official same-port managed-service election without touching the
installed service's default port. It follows the existing lifecycle: `Service.ensure`
accepts a compatible, registered ready winner before considering failed competing
starters. A losing starter must terminate; a nonzero result is reported with a
sanitized diagnostic, not represented as a successful startup. Without a healthy
owned winner, startup remains a failure. The official stop operation owns signal
termination. The test verifies ownership, application health, termination and
registration removal; it does not impose a new all-zero or graceful-shutdown
contract. Forced cleanup by the test itself is a failure.
This release workflow does not change default TUI exit behavior or the official
updater policy, and does not publish npm packages, a custom update feed or Desktop
installers. Binaries are unsigned and macOS archives are not notarized.

### Local Windows candidate delivery

Local candidates follow the established manual-replacement workflow. Keep the
official package build output and a worktree-root `opencode2.exe` mirror, and export
the same verified bytes to `D:\opencode-zh-CN-nightly-windows-x64` as:

```text
opencode2-zh-CN-<compiled-version>-windows-x64-<yyyyMMdd-HHmmss>.exe
```

Write the adjacent `.exe.build.json` metadata and verify the package, root mirror
and timestamped export have identical length and SHA256. The timestamp identifies
the export; metadata distinguishes an existing verified build from a fresh build.
The legacy export prefix does not change the official internal `opencode` name.
Do not treat the package `dist` path alone as completed local delivery.

Build manual replacements with `OPENCODE_CHANNEL=latest`, matching the established
distribution. The channel is a storage/service identity, not merely a release
label: `latest` selects `opencode.db`, `service.json`, and the `latest` TUI state;
`local` instead selects `opencode-local.db`, `service-local.json`, and separate
TUI state. Keep an explicit custom version for artifact identification without
changing that channel. Renaming the executable does not repair a channel mismatch.

Validate an in-place replacement against a disposable populated old-format
database at its default location, with `OPENCODE_DB` and channel overrides absent.
An empty-state smoke with an explicit database path does not verify this contract.
Never move or merge live databases to compensate for a wrongly built channel.
The restored channel retains official update policy; it is not the `local`
channel's automatic skip of update checks.

The exporter must not overwrite the fixed-name installed `opencode.exe`, remove
existing backups, restart the application, or operate on the live database. The
user performs replacement, restart and real-session validation separately. This
delivery convention does not restore the old canary/runtime-selection machinery.

Completed materialized history and unfinished legacy custom state are separate
compatibility concerns. The former full customization can retain active assistant
content in sidecar tables that the official reader does not hydrate. A successful
Session-list check alone does not establish compatibility for those rows, retired
execution state, or rollback after migration. Preserve a consistent backup before
real-data activation; any necessary legacy conversion requires its own bounded
verification and authority, not a blind table copy or live drain.

### Separately tracked upstream defect repairs

These are maintenance fixes in existing upstream owners, not additional private
features or a replacement architecture. No dependency, public API, configuration
switch or second process/cache manager was added.

| Repair                                                                        | Preserved boundary                                                                                                                                                                                                                                                                 | Owner and regression evidence                                                                                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| End a capture buffer when its source closes without end                       | Keep buffered bytes, ordinary stream errors/cancellation, and the official one-second post-exit grace window. Do not truncate immediately on process exit.                                                                                                                         | `packages/util/src/cross-spawn-spawner.ts`; Core spawner, native late-output and concurrent no-match Grep tests.                                 |
| Reject late publication after transcript/pending eviction or deletion         | Reuse current request identity and existing sync entries. Distinguish ordinary refresh invalidation from publication revocation so reconnects still hydrate valid pending prompts. Keep optimistic state, background events, metadata and the official recent-three-family policy. | `packages/client/src/solid/data.ts`; Client eviction/inbox/refresh/page controls and real TUI retention tests.                                   |
| Prevent retained/background tabs from implicitly activating foreign Locations | Filter only Location/VCS/Location-scoped permission/form prefetch. Keep lightweight global Session/message/inbox reads, explicit Location selection and viewed-session moves. Do not stop legitimate background execution or already-running MCP servers.                          | `packages/tui/src/context/session-tabs.tsx`; request-admission/move regressions and the global-read versus Location-acquisition call-path check. |

The original maintenance changes remain limited to those three existing files. The tests
describe the required behavior independently of the old implementation, so an
equivalent upstream replacement can supersede the local delta during a later sync.
Broad performance rewrites, Job byte-budget changes, old compaction estimators,
leases, ledgers and root-scope MCP teardown redesign are not included.

The September 22 synchronization additionally repairs the new upstream Console
policy failure path in `managed-policy.ts` and `plugin/provider/opencode.ts`.
Same-connection fetch failures retain the process-global policy instead of
clearing it or replaying a Location-private snapshot. Successful observations,
including empty policies and 404, still replace it; switching or disconnecting
retains the documented behavior. This uses the existing global owner and Effect
operations, without a persistent offline cache or a second policy system.
Policy publication rechecks the active connection under the global owner's
shared Effect permit, so late old-connection success or failure cannot overwrite
the policy already accepted for a newer connection or undo a disconnect.

The close-without-end regression uses a synthetic launch with real stream/capture
owners; its natural frequency in current native child pipes is not established.
Native short processes, inherited-pipe/late-output cases and concurrent no-match
Grep passed. The MCP admission proof combines real TUI/client request tests with
the server ownership trace; it is not a claim that all MCP lifecycle defects or
all third-party servers have been tested.

Two Mini model-menu ordering assertions also fail identically on the pristine
official baseline and this branch under the tested Windows zh-CN collation. No
sorting policy or test expectation was changed to hide the baseline limitation.

Nine existing Client proxy-array matcher assertions also fail identically on the
pristine baseline and this branch under the tested Bun/browser conditions. The
paired 62-test comparison matched every named outcome; those assertions remain
recorded failures, not claimed passes or newly introduced regressions.

Use focused package tests, typechecks and isolated build/service checks. Never use
live user configuration, credentials or Session data for these checks. A source
change or successful local build is not permission to migrate a production
database, replace an installed program, push source or publish release assets.
Existing-data migration and runtime cutover require separate evidence and authority.
