# Minimal Custom V2 Distribution

Status: the seven-capability baseline and the three separately authorized upstream-bug repairs passed their bounded integrated reviews with deferred risks. A subsequent manual-upgrade report identified a build-channel error in candidate `2.0.9-custom-lite.20260919.1`; that `local`-channel artifact must not be used as the established distribution's in-place replacement. Corrected candidate `2.0.9-custom-lite.20260919.2` uses `latest` and passes isolated populated-old-database/default-path and completed-transcript checks; its bounded build/export re-review is approved with deferred risks. This is not full legacy-state or production-migration approval. No installed executable or live state is changed by this worktree.

This branch starts from official OpenCode V2 source. It keeps the official model
protocols, remote compaction and recovery policy, Session lifecycle, background
Jobs, managed-service defaults, and TUI interactions except for the selected
additions below. It is not a port of the former full customization set.

## Selected behavior

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

Official compaction remains untouched. Search is a normal-generation capability,
not a tool injected into compact endpoint bodies or auxiliary title/summary work.

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
- No session-memory plugin or previous six-platform fork release workflow.
- No custom Windows build wrapper or installed-binary replacement.
- No change to the official updater policy. Installing a custom binary and later
  accepting official updates may replace custom additions; decide release/update
  policy separately before an actual rollout.

## Verification and operation boundary

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

The production changes remain limited to those three existing files. The tests
describe the required behavior independently of the old implementation, so an
equivalent upstream replacement can supersede the local delta during a later sync.
Broad performance rewrites, Job byte-budget changes, old compaction estimators,
leases, ledgers and root-scope MCP teardown redesign are not included.

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
