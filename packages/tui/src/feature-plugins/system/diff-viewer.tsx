/** @jsxImportSource @opentui/solid */
import type { FileDiffInfo, LocationRef } from "@opencode/client"
import type { Vcs } from "@opencode/schema/vcs"
import { Plugin } from "@opencode/plugin/tui"
import type { KeymapCommand, PanelInput, Route } from "@opencode/plugin/tui/context"
import {
  MouseButton,
  TextAttributes,
  type BoxRenderable,
  type RGBA,
  type MouseEvent,
  type ScrollBoxRenderable,
} from "@opentui/core"
import { filetype } from "../../util/filetype"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { DiffViewerFileTree } from "./diff-viewer-file-tree"
import { DiffFileMenu } from "./diff-viewer-file-menu"
import { DiffViewerImage, isDiffImageFile } from "./diff-viewer-image"
import { DIALOG_LIST_INSET, DialogHeader, DialogLayout } from "../../ui/dialog"
import { DialogSelect } from "../../ui/dialog-select"
import { EmptyBorder } from "../../ui/border"
import { SESSION_PANEL_SPLIT_MIN_WIDTH } from "../../ui/layout"
import { FilePath } from "../../ui/file-path"
import { getScrollAcceleration } from "../../util/scroll"
import { createDebouncedSignal } from "../../util/signal"
import { type DiffSource, useConfig } from "../../config"
import { locationKey } from "../../context/data"
import { useTheme, useThemes } from "../../context/theme"
import { useI18n } from "../../context/i18n"
import type { Key } from "../../i18n"
import { PatchDiff, type PatchDiffRef } from "../../component/patch-diff"
import {
  allExpandedFileTreeDirectories,
  buildFileTree,
  fileTreeFileSelection,
  type FileTreeRow,
  flattenFileTree,
  movePatchFileIndex,
  orderedPatchFileIndexes,
  showDiffViewerFileTree,
  singlePatchFileIndex,
  toggleFileTreeDirectory,
} from "./diff-viewer-file-tree-utils"

const ROUTE = "diff"
const MIN_SPLIT_WIDTH = 100
const FILE_TREE_MIN_WIDTH = 30
const FILE_TREE_MAX_WIDTH = 40
const FULL_INSET = 2
// The full layout keeps its file tree and inset cards only while its patches stay as wide as the narrowest docked
// panel, an equal split at the host's split threshold. Narrower full screens use the compact panel layout.
const FULL_LAYOUT_MIN_WIDTH = FILE_TREE_MIN_WIDTH + FULL_INSET * 2 + Math.floor(SESSION_PANEL_SPLIT_MIN_WIDTH / 2)
const FILE_HEADER_HEIGHT = 2
const VCS_DIFF_CONTEXT_LINES = 12
type DiffMode = DiffSource
type DiffView = "split" | "unified"
type SelectedHunk = { readonly fileIndex: number; readonly hunkIndex: number; readonly scrollTop: number }
type FileMenuState = { readonly fileIndex: number; readonly x: number; readonly y: number }

export type DiffFile = {
  readonly file: string
  readonly patch?: string
  readonly additions: number
  readonly deletions: number
  readonly status: "added" | "deleted" | "modified"
}

const normalizeDiffs = (diffs: readonly FileDiffInfo[]): DiffFile[] =>
  diffs.map((item) => ({
    file: item.file,
    patch: item.patch,
    additions: item.additions,
    deletions: item.deletions,
    status: item.status,
  }))

function storedView(value: unknown): DiffView | undefined {
  if (value === "split" || value === "unified") return value
}

const DIFF_SOURCES = {
  branch: { label: "feature.diff.all", description: "feature.diff.branchLocal" },
  committed: { label: "feature.diff.committed", description: "feature.diff.branchOnly" },
  working: { label: "feature.diff.uncommitted", description: "feature.diff.localOnly" },
  turn: { label: "feature.diff.lastTurn", description: "feature.diff.latestTurn" },
} satisfies Record<DiffMode, { label: Key; description: Key }>

const VCS_SOURCES = ["branch", "committed", "working"] as const

const needsBase = (mode: DiffMode) => mode === "branch" || mode === "committed"

function DiffViewer(props: {
  context: Plugin.Context
  sessionID?: string
  initialMode?: DiffMode
  panel?: PanelInput
  onClose: () => void
}) {
  const i18n = useI18n()
  const config = useConfig()
  const [memory, updateMemory] = props.context.storage.memory<{
    source?: DiffMode
    bases: Record<string, string>
  }>("review", { initial: { bases: {} } })
  const sessionID = () => props.sessionID
  const sources = (): readonly DiffMode[] => (sessionID() ? [...VCS_SOURCES, "turn"] : VCS_SOURCES)
  const initialMode = props.initialMode ?? memory.source ?? config.data.diffs?.source ?? "branch"
  const [mode, setMode] = createSignal(sources().includes(initialMode) ? initialMode : "branch")
  const location = createMemo(
    () => {
      const id = sessionID()
      return id
        ? (props.context.data.session.get(id)?.location ?? props.context.data.location.default())
        : props.context.data.location.default()
    },
    undefined,
    { equals: (a, b) => a.directory === b.directory },
  )
  const baseKey = createMemo(() =>
    JSON.stringify([locationKey(location()), props.context.data.location.vcs.info(location())?.branch.current]),
  )
  const selectedBase = () => memory.bases[baseKey()]
  // Mode changes share the same lazy base lookup until this viewer is closed.
  const bases = new Map<string, ReturnType<Plugin.Context["client"]["vcs"]["base"]>>()
  const [reportedBases, setReportedBases] = createSignal<ReadonlyMap<string, Vcs.Base | null>>(new Map())
  const loadBase = (location: LocationRef, key: string) => {
    const cached = bases.get(key)
    if (cached) return cached
    const pending = props.context.client.vcs.base({ location }).then((result) => {
      setReportedBases((known) => new Map(known).set(key, result.data))
      return result
    })
    bases.set(key, pending)
    return pending
  }
  const diffInput = createMemo(() => {
    const current = mode()
    const id = sessionID()
    if (current === "turn" && id) return { mode: current, sessionID: id }
    const vcs = current === "turn" ? "branch" : current
    return {
      mode: vcs,
      location: location(),
      key: baseKey(),
      selected: needsBase(vcs) ? selectedBase() : undefined,
    }
  })
  const [diff, { refetch }] = createResource(diffInput, async (input) => {
    if (input.mode === "turn") {
      return {
        base: null,
        files: normalizeDiffs(
          await props.context.client.session.diff({ sessionID: input.sessionID, context: VCS_DIFF_CONTEXT_LINES }),
        ),
      }
    }
    const base = !needsBase(input.mode)
      ? undefined
      : input.selected
        ? { name: input.selected, ref: input.selected }
        : (await loadBase(input.location, input.key)).data
    if (input !== diffInput() || (input.mode === "committed" && !base)) {
      return { base: null, files: [] }
    }
    const result = await props.context.client.vcs.diff({
      location: input.location,
      mode: input.mode,
      ...(base ? { base: base.ref } : {}),
      context: VCS_DIFF_CONTEXT_LINES,
    })
    return { base, files: normalizeDiffs(result.data ?? []) }
  })
  // Each completed turn replaces the last one.
  createEffect((previous) => {
    if (mode() !== "turn") return undefined
    const id = sessionID()
    const status = id ? props.context.data.session.status(id) : undefined
    if (previous === "running" && status === "idle") void refetch()
    return status
  })
  const sourceBase = () => {
    const ref = selectedBase()
    return ref ? { name: ref, ref } : reportedBases().get(baseKey())
  }
  const result = () => (diff.error || diff.loading ? undefined : diff())
  const sourceDetail = () => {
    if (mode() === "turn") return diff.error ? i18n.t("feature.diff.turnUnavailable") : undefined
    if (mode() === "working") return i18n.t("feature.diff.vs", { base: "HEAD" })
    if (diff.error) return i18n.t("feature.diff.unavailable")
    if (!result()) return i18n.t("feature.diff.resolving")
    const base = result()?.base
    if (!base) return i18n.t("feature.diff.noBase")
    return i18n.t("feature.diff.vs", { base: base.name })
  }
  return (
    <DiffViewerContent
      context={props.context}
      files={result()?.files ?? []}
      loading={diff.loading}
      error={diff.error}
      mode={mode()}
      sources={sources()}
      sourceDetail={sourceDetail()}
      sourceBase={sourceBase()}
      unavailable={mode() === "committed" && !!result() && !result()?.base}
      preferences={config.data.diffs}
      panel={props.panel}
      loadImage={(file, signal) => props.context.client.file.read({ path: file, location: location() }, { signal })}
      onPreferencesChange={(value) => {
        void config
          .update((draft) => {
            draft.diffs = { ...draft.diffs, ...value }
          })
          .catch(() => {})
      }}
      onClose={props.onClose}
      onSwitchSource={(mode) => {
        updateMemory((draft) => {
          draft.source = mode
        })
        setMode(mode)
      }}
      onChooseBase={() => {
        const target = { ...location() }
        const key = baseKey()
        if (!memory.bases[key]) void loadBase(target, key).catch(() => {})
        props.context.ui.dialog.show(() => (
          <DiffBaseDialog
            context={props.context}
            location={target}
            current={memory.bases[key] ?? reportedBases().get(key)?.ref}
            onSelect={(ref) =>
              updateMemory((draft) => {
                draft.bases[key] = ref
              })
            }
          />
        ))
      }}
    />
  )
}

function DiffRoute(props: {
  context: Plugin.Context
  data?: { mode?: DiffMode; sessionID?: string; returnRoute?: Route }
}) {
  const dimensions = useTerminalDimensions()
  return (
    <box position="absolute" zIndex={2500} left={0} top={0} width={dimensions().width} height={dimensions().height}>
      <DiffViewer
        context={props.context}
        sessionID={props.data?.sessionID}
        initialMode={props.data?.mode}
        onClose={() => props.context.ui.router.navigate(props.data?.returnRoute ?? { type: "home" })}
      />
    </box>
  )
}

function DiffBaseDialog(props: {
  context: Plugin.Context
  location: LocationRef
  current?: string
  onSelect: (ref: string) => void
}) {
  const i18n = useI18n()
  const theme = props.context.theme.surface("dialog")
  const [search, setSearch] = createDebouncedSignal("", 150)
  const [branches] = createResource(search, (search) =>
    props.context.client.vcs.branch.list({ location: props.location, search, limit: 100 }),
  )
  const Empty = () => (
    <box paddingLeft={DIALOG_LIST_INSET} paddingRight={DIALOG_LIST_INSET}>
      <text fg={branches.error ? theme.text.feedback.error.base : theme.text.muted}>
        {branches.loading
          ? i18n.t("feature.diff.branchesLoading")
          : branches.error
            ? i18n.t("feature.diff.branchesError")
            : i18n.t("feature.diff.noBranches")}
      </text>
    </box>
  )

  return (
    <DialogSelect
      title={i18n.t("feature.diff.baseBranch")}
      placeholder={i18n.t("feature.diff.searchBranches")}
      skipFilter
      current={props.current?.replace(/^refs\/(heads|remotes)\//, "")}
      onFilter={setSearch}
      emptyView={<Empty />}
      noMatchView={<Empty />}
      footer={<text fg={theme.text.muted}>{i18n.t("feature.diff.remembered")}</text>}
      options={(branches.loading || branches.error ? [] : (branches()?.data ?? [])).map((name) => ({
        title: name,
        value: name,
        onSelect() {
          props.onSelect(name)
          props.context.ui.dialog.clear()
        },
      }))}
    />
  )
}

type DiffPreferences = { tree?: boolean; single?: boolean; view?: "auto" | DiffView; fullscreen?: boolean }

export function DiffViewerContent(props: {
  context: Plugin.Context
  files: readonly DiffFile[]
  loading?: boolean
  error?: unknown
  mode: DiffMode
  sources: readonly DiffMode[]
  sourceDetail?: string
  sourceBase?: Pick<Vcs.Base, "name" | "ref"> | null
  unavailable?: boolean
  loadImage?: (file: string, signal: AbortSignal) => Promise<Uint8Array>
  preferences?: DiffPreferences
  panel?: PanelInput
  onPreferencesChange?: (value: DiffPreferences) => void
  onClose: () => void
  onSwitchSource: (mode: DiffMode) => void
  onChooseBase?: () => void
}) {
  const i18n = useI18n()
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const config = useConfig()
  const dialog = props.context.ui.dialog
  const theme = useTheme()
  const currentSyntax = useThemes().currentSyntax
  const files = () => props.files
  const docked = () => props.panel?.presentation === "panel"
  const width = () => props.panel?.width ?? dimensions().width
  // Docked panels and narrow full screens share the compact layout: no file tree, flush cards, and a footer.
  const compact = () => docked() || width() < FULL_LAYOUT_MIN_WIDTH
  // Full screen has no pane beside it to focus, and is always the active input scope.
  const focused = () => !docked() || props.panel?.focused === true
  // The side panel sits on the slot's raised surface; full screen keeps the base background.
  const surface = () => (docked() ? theme.background.raised.base : theme.background.base)
  // Cards are inset from the pane edges; the gaps between them run edge to edge.
  const inset = () => (compact() ? 0 : FULL_INSET)
  const mode = () => props.mode
  const [fileTreeEnabled, setFileTreeEnabled] = createSignal(props.preferences?.tree ?? true)
  const showFileTree = createMemo(() => !compact() && showDiffViewerFileTree(fileTreeEnabled(), files().length))
  const [singlePatch, setSinglePatch] = createSignal(props.preferences?.single ?? false)
  const fileTreeWidth = createMemo(() =>
    Math.max(FILE_TREE_MIN_WIDTH, Math.min(FILE_TREE_MAX_WIDTH, Math.floor(width() / 4))),
  )
  const patchPaneWidth = createMemo(() => width() - (showFileTree() ? fileTreeWidth() : 0) - inset() * 2)
  const splitAvailable = createMemo(() => patchPaneWidth() >= MIN_SPLIT_WIDTH)
  const [viewOverride, setViewOverride] = createSignal<DiffView | undefined>(storedView(props.preferences?.view))
  const view = createMemo(() =>
    splitAvailable() ? (viewOverride() ?? storedView(props.preferences?.view) ?? "split") : "unified",
  )
  const fileTree = createMemo(() => buildFileTree(files()))
  const [expandedFileNodes, setExpandedFileNodes] = createSignal<ReadonlySet<number>>(new Set())
  const [selectedFileIndex, setSelectedFileIndex] = createSignal<number | undefined>()
  const [reviewedFileNames, setReviewedFileNames] = createSignal<ReadonlySet<string>>(new Set())
  const [exhaustedFileIndex, setExhaustedFileIndex] = createSignal<number | undefined>()
  const [fileMenu, setFileMenu] = createSignal<FileMenuState>()
  const patchScrollAcceleration = createMemo(() => getScrollAcceleration(config.data))
  const patchFileIndexes = createMemo(() => orderedPatchFileIndexes(flattenFileTree(fileTree())))
  const helpShortcut = () => props.context.keymap.shortcuts("diff.help")[0]
  let scroll: ScrollBoxRenderable | undefined
  const patchNodeByFileIndex = new Map<number, BoxRenderable>()
  const patchDiffByFileIndex = new Map<number, PatchDiffRef>()
  const [selectedHunk, setSelectedHunk] = createSignal<SelectedHunk | undefined>()
  const [pendingPatchScrollFileIndex, setPendingPatchScrollFileIndex] = createSignal<number | undefined>()

  createEffect(() => {
    setExpandedFileNodes(allExpandedFileTreeDirectories(fileTree()))
    setSelectedFileIndex(undefined)
    setSelectedHunk(undefined)
    setReviewedFileNames(new Set<string>())
    setExhaustedFileIndex(undefined)
    setFileMenu(undefined)
  })

  const clearPatchSelection = () => {
    setPendingPatchScrollFileIndex(undefined)
    setSelectedHunk(undefined)
    if (!singlePatch()) setSelectedFileIndex(undefined)
  }

  const scrollPage = (direction: -1 | 1, divisor: 1 | 2) => {
    clearPatchSelection()
    if (scroll) scroll.scrollBy(direction * Math.max(1, Math.floor(scroll.viewport.height / divisor)))
  }

  const scrollPatchNodeToTop = (patchNode: BoxRenderable, offset?: number) => {
    if (!scroll || patchNode.isDestroyed) return
    const contentY = patchNode.y - scroll.content.y
    // The fixed pane edge replaces the leading separator when jumping to a later file.
    scroll.scrollTo(contentY + (offset ?? (contentY > 0 ? 1 : 0)))
  }

  const revealFileTreeFile = (fileIndex: number) => {
    const selection = fileTreeFileSelection(fileTree(), fileIndex)
    if (!selection) return
    setExpandedFileNodes((expanded) => {
      if ([...selection.expandedNodes].every((node) => expanded.has(node))) return expanded
      const next = new Set(expanded)
      selection.expandedNodes.forEach((node) => next.add(node))
      return next
    })
  }

  const selectPatchFile = (fileIndex: number) => {
    setPendingPatchScrollFileIndex(undefined)
    setExhaustedFileIndex(undefined)
    revealFileTreeFile(fileIndex)
    setSelectedFileIndex(fileIndex)
  }

  const scrollToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
    const patchNode = patchNodeByFileIndex.get(fileIndex)
    if (patchNode) scrollPatchNodeToTop(patchNode)
  }

  const jumpToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    setSelectedHunk(undefined)
    scrollToFileIndex(fileIndex)
    if (singlePatch()) scrollSinglePatchToTop()
  }

  const currentPatchFileIndex = () => {
    if (!scroll) return undefined
    const viewportContentY = scroll.scrollTop + 1
    const entries = patchFileIndexes()
      .map((fileIndex) => ({
        fileIndex,
        node: patchNodeByFileIndex.get(fileIndex),
      }))
      .filter((entry): entry is { fileIndex: number; node: BoxRenderable } => Boolean(entry.node))
      .map((entry) => ({
        ...entry,
        contentY: scroll!.scrollTop + entry.node.y - scroll!.viewport.y,
      }))
      .sort((left, right) => left.contentY - right.contentY)
    return entries.findLast((entry) => entry.contentY <= viewportContentY)?.fileIndex ?? entries[0]?.fileIndex
  }

  const jumpRelativePatchFile = (offset: number) => {
    setSelectedHunk(undefined)
    const next = movePatchFileIndex(patchFileIndexes(), selectedFileIndex() ?? currentPatchFileIndex(), offset)
    if (singlePatch()) {
      if (next === undefined) return
      selectPatchFile(next)
      scrollSinglePatchToTop()
      return
    }
    scrollToFileIndex(next)
  }

  const jumpRelativeHunk = (offset: -1 | 1) => {
    const patchScroll = scroll
    if (!patchScroll) return
    const hunks = visiblePatchFiles()
      .flatMap((entry) => {
        return (
          patchDiffByFileIndex
            .get(entry.fileIndex)
            ?.hunks()
            .map((node, hunkIndex) => ({
              fileIndex: entry.fileIndex,
              hunkIndex,
              contentY: patchScroll.scrollTop + node.y - patchScroll.viewport.y - (hunkIndex > 0 ? 1 : 0),
            })) ?? []
        )
      })
      .sort((left, right) => left.contentY - right.contentY)
    const selected = selectedHunk()
    const selectedIndex =
      selected?.scrollTop === patchScroll.scrollTop
        ? hunks.findIndex((hunk) => hunk.fileIndex === selected.fileIndex && hunk.hunkIndex === selected.hunkIndex)
        : -1
    const contentTop = patchScroll.scrollTop + FILE_HEADER_HEIGHT
    const next =
      selectedIndex !== -1
        ? hunks[selectedIndex + offset]
        : offset === 1
          ? hunks.find((hunk) => hunk.contentY > contentTop)
          : hunks.findLast((hunk) => hunk.contentY < contentTop)
    if (!next) return
    selectPatchFile(next.fileIndex)
    patchScroll.scrollTo(Math.max(0, next.contentY - FILE_HEADER_HEIGHT))
    setSelectedHunk({ fileIndex: next.fileIndex, hunkIndex: next.hunkIndex, scrollTop: patchScroll.scrollTop })
  }

  const firstPatchFileIndex = () => patchFileIndexes()[0]
  const visiblePatchFiles = createMemo(() => {
    if (!singlePatch()) {
      return patchFileIndexes().flatMap((fileIndex) => {
        const file = files()[fileIndex]
        return file ? [{ file, fileIndex }] : []
      })
    }
    const fileIndex = singlePatchFileIndex(selectedFileIndex(), currentPatchFileIndex(), firstPatchFileIndex())
    const file = fileIndex === undefined ? undefined : files()[fileIndex]
    return file && fileIndex !== undefined ? [{ file, fileIndex }] : []
  })

  const ensureHighlightedPatchFile = () => {
    const fileIndex = currentPatchFileIndex() ?? selectedFileIndex() ?? firstPatchFileIndex()
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
  }

  const scrollToPatchFileIndexAfterRender = (fileIndex: number, offset?: number) => {
    setPendingPatchScrollFileIndex(fileIndex)
    requestAnimationFrame(() => {
      if (pendingPatchScrollFileIndex() !== fileIndex) return
      const patchNode = patchNodeByFileIndex.get(fileIndex)
      if (patchNode) scrollPatchNodeToTop(patchNode, offset)
      requestAnimationFrame(() => {
        if (pendingPatchScrollFileIndex() !== fileIndex) return
        const patchNode = patchNodeByFileIndex.get(fileIndex)
        if (patchNode) scrollPatchNodeToTop(patchNode, offset)
        setPendingPatchScrollFileIndex(undefined)
      })
    })
  }

  const scrollSinglePatchToTop = () => {
    requestAnimationFrame(() => {
      scroll?.scrollTo(0)
      requestAnimationFrame(() => scroll?.scrollTo(0))
    })
  }

  const registerPatchNode = (fileIndex: number, element: BoxRenderable) => {
    patchNodeByFileIndex.set(fileIndex, element)
    if (pendingPatchScrollFileIndex() !== fileIndex) return
    scrollToPatchFileIndexAfterRender(fileIndex)
  }

  const clickFileTreeRow = (row: FileTreeRow) => {
    if (row.fileIndex !== undefined) {
      jumpToFileIndex(row.fileIndex)
      return
    }
    setExpandedFileNodes((expanded) => toggleFileTreeDirectory(fileTree(), expanded, row.id))
  }

  const toggleFileReviewed = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    const file = files()[fileIndex]?.file
    if (!file) return
    const current = selectedFileIndex() ?? currentPatchFileIndex()
    const anchor = current === undefined ? undefined : patchNodeByFileIndex.get(current)
    const offset = anchor && scroll ? scroll.viewport.y - anchor.y : undefined
    const reviewed = reviewedFileNames().has(file)
    setReviewedFileNames((reviewed) => {
      const next = new Set(reviewed)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
    // Completing another file from its menu must not navigate away from the current file.
    if (fileIndex !== current) {
      if (current !== undefined && offset !== undefined && !singlePatch())
        scrollToPatchFileIndexAfterRender(current, offset)
      return
    }
    const nextFileIndex =
      singlePatch() && !reviewed ? (movePatchFileIndex(patchFileIndexes(), fileIndex, 1) ?? fileIndex) : fileIndex
    selectPatchFile(nextFileIndex)
    if (singlePatch() && !reviewed && nextFileIndex === fileIndex) setExhaustedFileIndex(fileIndex)
    setSelectedHunk(undefined)
    scrollToPatchFileIndexAfterRender(nextFileIndex)
  }

  const openFileMenu = (fileIndex: number, event: MouseEvent) => {
    if (event.button !== MouseButton.RIGHT) return
    event.preventDefault()
    event.stopPropagation()
    props.panel?.focus()
    setFileMenu({ fileIndex, x: event.x, y: event.y })
  }

  const close = () => {
    dialog.clear()
    props.onClose()
  }

  const commands = (): KeymapCommand[] => [
    {
      id: "diff.close",
      title: i18n.t("feature.diff.close"),
      group: "VCS",
      run: close,
    },
    {
      id: "diff.down",
      title: i18n.t("feature.diff.down"),
      group: "VCS",
      run() {
        clearPatchSelection()
        scroll?.scrollBy(1)
      },
    },
    {
      id: "diff.up",
      title: i18n.t("feature.diff.up"),
      group: "VCS",
      run() {
        clearPatchSelection()
        scroll?.scrollBy(-1)
      },
    },
    {
      id: "diff.page.down",
      title: i18n.t("feature.diff.pageDown"),
      group: "VCS",
      run: () => scrollPage(1, 1),
    },
    {
      id: "diff.page.up",
      title: i18n.t("feature.diff.pageUp"),
      group: "VCS",
      run: () => scrollPage(-1, 1),
    },
    {
      id: "diff.half_page.down",
      title: i18n.t("feature.diff.halfDown"),
      group: "VCS",
      run: () => scrollPage(1, 2),
    },
    {
      id: "diff.half_page.up",
      title: i18n.t("feature.diff.halfUp"),
      group: "VCS",
      run: () => scrollPage(-1, 2),
    },
    {
      id: "diff.first",
      title: i18n.t("feature.diff.first"),
      group: "VCS",
      run() {
        clearPatchSelection()
        scroll?.scrollTo(0)
      },
    },
    {
      id: "diff.last",
      title: i18n.t("feature.diff.last"),
      group: "VCS",
      run() {
        clearPatchSelection()
        if (scroll) scroll.scrollTo(scroll.scrollHeight)
      },
    },
    {
      id: "diff.next_hunk",
      title: i18n.t("feature.diff.nextHunk"),
      group: "VCS",
      run() {
        jumpRelativeHunk(1)
      },
    },
    {
      id: "diff.previous_hunk",
      title: i18n.t("feature.diff.previousHunk"),
      group: "VCS",
      run() {
        jumpRelativeHunk(-1)
      },
    },
    {
      id: "diff.next_file",
      title: i18n.t("feature.diff.nextFile"),
      group: "VCS",
      run() {
        jumpRelativePatchFile(1)
      },
    },
    {
      id: "diff.previous_file",
      title: i18n.t("feature.diff.previousFile"),
      group: "VCS",
      run() {
        jumpRelativePatchFile(-1)
      },
    },
    {
      id: "diff.mark_reviewed",
      title: i18n.t("feature.diff.toggleReviewed"),
      group: "VCS",
      run() {
        const fileIndex = selectedFileIndex() ?? currentPatchFileIndex()
        if (fileIndex !== undefined && fileIndex === exhaustedFileIndex()) return
        toggleFileReviewed(fileIndex)
      },
    },
    {
      id: "diff.toggle_file_tree",
      title: i18n.t("feature.diff.toggleTree"),
      group: "VCS",
      enabled: () => !compact(),
      run() {
        if (compact()) return
        const next = !fileTreeEnabled()
        setFileTreeEnabled(next)
        props.onPreferencesChange?.({ tree: next })
      },
    },
    {
      id: "diff.single_patch",
      title: i18n.t("feature.diff.toggleSingle"),
      group: "VCS",
      run() {
        setSelectedHunk(undefined)
        if (!singlePatch()) {
          ensureHighlightedPatchFile()
          setSinglePatch(true)
          props.onPreferencesChange?.({ single: true })
          scrollSinglePatchToTop()
          return
        }
        const fileIndex =
          visiblePatchFiles()[0]?.fileIndex ??
          singlePatchFileIndex(selectedFileIndex(), currentPatchFileIndex(), firstPatchFileIndex())
        if (fileIndex !== undefined) selectPatchFile(fileIndex)
        setSinglePatch(false)
        props.onPreferencesChange?.({ single: false })
        if (fileIndex !== undefined) scrollToPatchFileIndexAfterRender(fileIndex)
      },
    },
    {
      id: "diff.switch_source",
      title: i18n.t("feature.diff.switchSource"),
      group: "VCS",
      run() {
        openSwitchDiffDialog()
      },
    },
    {
      id: "diff.toggle_view",
      title: i18n.t("feature.diff.toggleView"),
      group: "VCS",
      run() {
        if (!splitAvailable()) return
        setSelectedHunk(undefined)
        const next = view() === "split" ? "unified" : "split"
        setViewOverride(next)
        props.onPreferencesChange?.({ view: next })
      },
    },
    {
      id: "diff.toggle_fullscreen",
      title: i18n.t("feature.diff.toggleFullscreen"),
      group: "VCS",
      enabled: () => props.panel !== undefined,
      run: () => {
        const panel = props.panel
        if (!panel) return
        const before = panel.presentation
        panel.toggleFullscreen()
        // A narrow terminal forces full screen and ignores the toggle; only a real toggle is remembered.
        if (panel.presentation === before) return
        props.onPreferencesChange?.({ fullscreen: panel.presentation === "fullscreen" })
      },
    },
    {
      id: "diff.help",
      title: i18n.t("feature.diff.moreShortcuts"),
      group: "VCS",
      run() {
        openHelpDialog()
      },
    },
    // Specific diff bindings take precedence over app.exit's Ctrl+D binding.
    {
      id: "app.exit",
      title: i18n.t("feature.diff.close"),
      group: "VCS",
      run: close,
    },
  ]

  const openSwitchDiffDialog = () => {
    dialog.show(() => (
      <DialogSelect<DiffMode | "base">
        title={i18n.t("feature.diff.source")}
        skipFilter={true}
        renderFilter={false}
        current={mode()}
        options={[
          ...props.sources.map((source) => ({
            value: source,
            title: i18n.t(DIFF_SOURCES[source].label),
            titleView: i18n.t(DIFF_SOURCES[source].label).padEnd(11),
            description: i18n.t(DIFF_SOURCES[source].description),
            onSelect() {
              dialog.clear()
              props.onSwitchSource(source)
            },
          })),
          ...(props.onChooseBase
            ? [
                {
                  title: i18n.t("feature.diff.base"),
                  titleView: i18n.t("feature.diff.base").padEnd(11),
                  value: "base" as const,
                  description: props.sourceBase?.name ?? i18n.t("feature.diff.choose"),
                  onSelect: props.onChooseBase,
                },
              ]
            : []),
        ]}
      />
    ))
  }

  const openHelpDialog = () => {
    dialog.show(() => (
      <DiffViewerHelpDialog
        context={props.context}
        single={singlePatch()}
        fullscreen={props.panel !== undefined}
        tree={!compact()}
      />
    ))
    dialog.set({ size: "medium", centered: true })
  }

  const HelpShortcut = (props: { compact?: boolean; label?: string; muted?: boolean }) => (
    <Show when={helpShortcut()}>
      {(shortcut) => (
        <text
          id="diff-help-shortcut"
          fg={props.muted ? theme.text.action.primary.disabled : theme.text.base}
          attributes={props.muted ? TextAttributes.DIM : 0}
          selectable={false}
          flexShrink={0}
          wrapMode="none"
          onMouseUp={(event) => {
            if (event.button !== MouseButton.LEFT) return
            event.stopPropagation()
            openHelpDialog()
          }}
        >
          {props.compact ? "?" : shortcut()}
          <Show when={!props.compact}>
            <span style={props.muted ? {} : { fg: theme.text.muted }}>
              {" "}
              {props.label ?? i18n.t("feature.diff.help")}
            </span>
          </Show>
        </text>
      )}
    </Show>
  )

  props.context.keymap.layer(() => ({
    commands: commands(),
  }))

  return (
    <box width="100%" height="100%" backgroundColor={surface()}>
      <Show when={!showFileTree()}>
        <box
          id="diff-source-header"
          paddingLeft={2}
          // Compact, the header lines up with the card text below it; the card edge row supplies the gap underneath.
          paddingRight={compact() ? 1 : 2}
          // Only the docked panel leaves a row above the header; full screen starts at the top edge.
          paddingTop={docked() ? 1 : 0}
          height={docked() ? 2 : 1}
          flexShrink={0}
          flexDirection="row"
          gap={1}
        >
          <box
            id="diff-source-switch"
            flexDirection="row"
            flexGrow={1}
            minWidth={0}
            onMouseUp={(event) => {
              if (event.button !== MouseButton.LEFT) return
              event.stopPropagation()
              openSwitchDiffDialog()
            }}
          >
            <text
              fg={theme.text.action.secondary.base}
              attributes={TextAttributes.BOLD}
              selectable={false}
              flexShrink={0}
              wrapMode="none"
            >
              {i18n.t(DIFF_SOURCES[mode()].label)}
            </text>
            <Show when={props.sourceDetail}>
              <text fg={theme.text.muted} selectable={false} flexGrow={1} minWidth={0} wrapMode="none" truncate>
                {` · ${props.sourceDetail}`}
              </text>
            </Show>
          </box>
          <text id="diff-review-count" fg={theme.text.muted} flexShrink={0} wrapMode="none">
            {files().filter((file) => reviewedFileNames().has(file.file)).length}/{files().length}
          </text>
        </box>
      </Show>
      <box flexGrow={1} minHeight={0}>
        <Switch>
          <Match when={props.loading}>
            <box flexGrow={1} padding={2} paddingTop={compact() ? 1 : 2}>
              <text fg={theme.text.muted}>{i18n.t("feature.diff.loading")}</text>
            </box>
          </Match>
          <Match when={!props.loading && props.error}>
            <box flexGrow={1} padding={2} paddingTop={compact() ? 1 : 2}>
              <text fg={theme.text.feedback.error.base}>
                {!props.sourceBase && needsBase(mode())
                  ? i18n.t("feature.diff.loadBaseError")
                  : i18n.t("feature.diff.loadError")}
              </text>
            </box>
          </Match>
          <Match when={!props.loading && props.unavailable}>
            <box flexGrow={1} padding={2} paddingTop={compact() ? 1 : 2}>
              <text fg={theme.text.muted}>{i18n.t("feature.diff.committedUnavailable")}</text>
            </box>
          </Match>
          <Match when={!props.loading && files().length === 0}>
            <box flexGrow={1} padding={2} paddingTop={compact() ? 1 : 2}>
              <text fg={theme.text.muted}>{i18n.t("feature.diff.noChanges")}</text>
            </box>
          </Match>
          <Match when={!props.loading}>
            <box flexDirection="row" flexGrow={1} minHeight={0}>
              <Show when={showFileTree()}>
                <DiffViewerFileTree
                  files={files()}
                  loading={props.loading ?? false}
                  error={props.error}
                  width={fileTreeWidth()}
                  selectedFileIndex={
                    selectedFileIndex() ?? (singlePatch() ? visiblePatchFiles()[0]?.fileIndex : undefined)
                  }
                  reviewedFileNames={reviewedFileNames()}
                  expandedNodes={expandedFileNodes()}
                  onRowClick={clickFileTreeRow}
                  onFileContextMenu={openFileMenu}
                  source={i18n.t(DIFF_SOURCES[mode()].label)}
                  sourceDetail={props.sourceDetail}
                  onSwitchSource={openSwitchDiffDialog}
                  footer={<HelpShortcut />}
                />
              </Show>

              <box flexGrow={1} minWidth={0} minHeight={0}>
                <box
                  id="diff-patch-top-edge"
                  marginLeft={inset()}
                  marginRight={inset()}
                  ref={(edge: BoxRenderable) => {
                    // The fixed edge belongs to the visible card, not the tree selection.
                    edge.onLifecyclePass = () => {
                      if (!scroll) return
                      const entry = visiblePatchFiles().findLast(
                        (entry) => (patchNodeByFileIndex.get(entry.fileIndex)?.y ?? Infinity) <= scroll!.viewport.y,
                      )
                      edge.backgroundColor =
                        entry && reviewedFileNames().has(entry.file.file)
                          ? theme.background.raised.high
                          : theme.diff.background.context
                    }
                    renderer.registerLifecyclePass(edge)
                    onCleanup(() => renderer.unregisterLifecyclePass(edge))
                  }}
                  height={1}
                  flexShrink={0}
                  backgroundColor={theme.diff.background.context}
                />
                <scrollbox
                  id="diff-patches"
                  ref={(element: ScrollBoxRenderable) => (scroll = element)}
                  flexGrow={1}
                  minHeight={0}
                  scrollAcceleration={patchScrollAcceleration()}
                  onMouseScroll={clearPatchSelection}
                  verticalScrollbarOptions={{ visible: false }}
                  horizontalScrollbarOptions={{ visible: false }}
                >
                  <For each={visiblePatchFiles()}>
                    {(entry, index) => {
                      const reviewed = () => reviewedFileNames().has(entry.file.file)
                      const background = () =>
                        reviewed() ? theme.background.raised.high : theme.diff.background.context
                      const image = () => isDiffImageFile(entry.file.file)
                      const countsWidth = () =>
                        (image() ? 6 : String(entry.file.additions).length + String(entry.file.deletions).length + 5) +
                        (reviewed() ? 2 : 0)
                      return (
                        <box ref={(element: BoxRenderable) => registerPatchNode(entry.fileIndex, element)}>
                          <Show when={index() > 0}>
                            <CardGap glyph="▄" card={background()} surface={surface()} inset={inset()} />
                          </Show>
                          <box backgroundColor={background()} marginLeft={inset()} marginRight={inset()}>
                            <box
                              id={`diff-file-header-${entry.fileIndex}`}
                              onMouseDown={(event) => openFileMenu(entry.fileIndex, event)}
                              ref={(header: BoxRenderable) => {
                                // Move the original title without changing flow, bounded by its own card.
                                header.onLifecyclePass = () => {
                                  if (!scroll || !header.parent) return
                                  header.translateY = Math.max(
                                    0,
                                    Math.min(
                                      scroll.scrollTop - (header.parent.y - scroll.content.y),
                                      header.parent.height - header.height,
                                    ),
                                  )
                                }
                                renderer.registerLifecyclePass(header)
                                onCleanup(() => renderer.unregisterLifecyclePass(header))
                              }}
                              flexDirection="row"
                              gap={1}
                              flexShrink={0}
                              height={FILE_HEADER_HEIGHT}
                              zIndex={1}
                              backgroundColor={background()}
                              paddingLeft={compact() ? 2 : 1}
                              paddingRight={1}
                              paddingBottom={1}
                            >
                              <box flexGrow={1} minWidth={0}>
                                <FilePath
                                  value={entry.file.file}
                                  maxWidth={Math.max(1, patchPaneWidth() - countsWidth() - 2)}
                                  fg={theme.text.muted}
                                  basenameFg={reviewed() ? theme.text.muted : theme.text.base}
                                />
                              </box>
                              <Show when={reviewed()}>
                                <text fg={theme.text.muted} flexShrink={0}>
                                  ✓
                                </text>
                              </Show>
                              <Show
                                when={!image()}
                                fallback={<text fg={theme.text.muted}>{i18n.t("feature.diff.image")}</text>}
                              >
                                <text flexShrink={0} fg={reviewed() ? theme.text.muted : theme.diff.text.added}>
                                  +{entry.file.additions}
                                </text>
                                <text flexShrink={0} fg={reviewed() ? theme.text.muted : theme.diff.text.removed}>
                                  -{entry.file.deletions}
                                </text>
                              </Show>
                              <Show when={reviewed()}>
                                <box position="absolute" left={-inset()} right={-inset()} bottom={0} height={1}>
                                  <CardGap glyph="▀" card={background()} surface={surface()} inset={inset()} />
                                </box>
                              </Show>
                            </box>
                            <Show when={!reviewed()}>
                              <Switch
                                fallback={
                                  <box
                                    width="100%"
                                    flexShrink={0}
                                    paddingLeft={compact() ? 2 : 1}
                                    paddingRight={1}
                                    paddingBottom={1}
                                  >
                                    <text fg={theme.text.muted}>
                                      {mode() === "committed" && image()
                                        ? i18n.t("feature.diff.committedImage")
                                        : entry.file.status === "deleted" && image()
                                          ? i18n.t("feature.diff.deletedImage")
                                          : i18n.t("feature.diff.noPatch")}
                                    </text>
                                  </box>
                                }
                              >
                                <Match
                                  when={
                                    mode() !== "committed" &&
                                    entry.file.status !== "deleted" &&
                                    image() &&
                                    props.loadImage
                                  }
                                >
                                  {(load) => <DiffViewerImage file={entry.file.file} load={load()} />}
                                </Match>
                                <Match when={!(mode() === "committed" && image()) && entry.file.patch}>
                                  {(patch) => (
                                    <PatchDiff
                                      ref={(component) => {
                                        patchDiffByFileIndex.set(entry.fileIndex, component)
                                        onCleanup(() => patchDiffByFileIndex.delete(entry.fileIndex))
                                      }}
                                      diff={patch()}
                                      scroll={() => scroll}
                                      hunkFg={theme.diff.text.hunkHeader}
                                      view={entry.file.status === "modified" ? view() : "unified"}
                                      filetype={filetype(entry.file.file)}
                                      syntaxStyle={currentSyntax()}
                                      showLineNumbers={true}
                                      gutterPadding={compact() ? 1 : 0}
                                      width="100%"
                                      wrapMode="char"
                                      fg={theme.text.base}
                                      addedBg={theme.diff.background.added}
                                      removedBg={theme.diff.background.removed}
                                      contextBg={theme.diff.background.context}
                                      addedSignColor={theme.diff.highlight.added}
                                      removedSignColor={theme.diff.highlight.removed}
                                      lineNumberFg={theme.diff.lineNumber.text}
                                      lineNumberBg={theme.diff.background.context}
                                      addedLineNumberBg={theme.diff.lineNumber.background.added}
                                      removedLineNumberBg={theme.diff.lineNumber.background.removed}
                                    />
                                  )}
                                </Match>
                              </Switch>
                            </Show>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </scrollbox>
              </box>
            </box>
          </Match>
        </Switch>
      </box>
      <Show when={compact()}>
        {/* Docked, the footer sits on the terminal background, eased in by a half-cell like the prompt. */}
        <box id="diff-footer" flexShrink={0} backgroundColor={theme.background.base}>
          <Show when={docked()}>
            <box
              height={1}
              flexShrink={0}
              border={["bottom"]}
              borderColor={surface()}
              backgroundColor={theme.background.base}
              customBorderChars={{ ...EmptyBorder, horizontal: "▀" }}
            />
          </Show>
          <box height={1} flexShrink={0} flexDirection="row" paddingLeft={2} paddingRight={1}>
            <text
              fg={focused() ? theme.background.action.primary.focused : theme.text.action.primary.disabled}
              attributes={focused() ? 0 : TextAttributes.DIM}
              flexGrow={1}
              minWidth={0}
              wrapMode="none"
              truncate
              selectable={false}
              onMouseUp={(event) => {
                if (event.button !== MouseButton.LEFT) return
                if (!docked()) return close()
                if (!props.panel?.focused) props.panel?.focus()
              }}
            >
              {/* Without a prompt beside the viewer, closing is the way back to the session. */}
              <span>{props.context.keymap.shortcuts(docked() ? "pane.focus.left" : "diff.close")[0] ?? ""}</span>
              <span style={focused() ? { fg: theme.text.muted } : {}}>
                {` ${i18n.t(docked() ? "feature.diff.focusPrompt" : "feature.diff.closeShort")}`}
              </span>
            </text>
            <box flexShrink={0}>
              <HelpShortcut label={i18n.t("feature.diff.seeAll")} muted={!focused()} />
            </box>
          </box>
          <Show when={docked()}>
            <box height={1} flexShrink={0} />
          </Show>
        </box>
      </Show>
      <Show when={!showFileTree() && !compact()}>
        <box position="absolute" top={0} right={0} width={1} height={1}>
          <HelpShortcut compact />
        </box>
      </Show>
      <Show when={fileMenu()} keyed>
        {(state) => (
          <DiffFileMenu
            context={props.context}
            state={state}
            reviewed={reviewedFileNames().has(files()[state.fileIndex]?.file ?? "")}
            onToggle={() => toggleFileReviewed(state.fileIndex)}
            onClose={() => setFileMenu(undefined)}
          />
        )}
      </Show>
    </box>
  )
}

/** A half-row of base background between cards: the card's color over its width, the pane surface in the insets. */
function CardGap(props: { glyph: "▄" | "▀"; card: RGBA; surface: RGBA; inset: number }) {
  const theme = useTheme()
  const half = (color: RGBA, width?: number) => (
    <box
      height={1}
      flexShrink={0}
      {...(width === undefined ? { flexGrow: 1 } : { width })}
      border={[props.glyph === "▄" ? "top" : "bottom"]}
      borderColor={color}
      backgroundColor={theme.background.base}
      customBorderChars={{ ...EmptyBorder, horizontal: props.glyph }}
    />
  )
  return (
    <box height={1} flexShrink={0} flexDirection="row">
      {/* A zero-width inset still claims a cell, which would notch flush cards. */}
      <Show when={props.inset > 0}>{half(props.surface, props.inset)}</Show>
      {half(props.card)}
      <Show when={props.inset > 0}>{half(props.surface, props.inset)}</Show>
    </box>
  )
}

function DiffViewerHelpDialog(props: { context: Plugin.Context; single: boolean; fullscreen: boolean; tree: boolean }) {
  const i18n = useI18n()
  const dimensions = useTerminalDimensions()
  const theme = props.context.theme.surface("dialog")
  const shortcut =
    (...ids: string[]) =>
    () =>
      ids
        .map((id) => props.context.keymap.shortcuts(id)[0])
        .filter(Boolean)
        .join(" / ")
  const groups = () => [
    {
      title: i18n.t("feature.diff.helpReview"),
      rows: [
        {
          shortcut: () => props.context.keymap.shortcuts("diff.next_file").join(" / "),
          label: i18n.t("feature.diff.helpNextFile"),
        },
        {
          shortcut: () => props.context.keymap.shortcuts("diff.previous_file").join(" / "),
          label: i18n.t("feature.diff.helpPreviousFile"),
        },
        {
          shortcut: shortcut("diff.mark_reviewed"),
          label: i18n.t(props.single ? "feature.diff.helpReviewNext" : "feature.diff.helpReviewCollapse"),
        },
        { shortcut: shortcut("diff.next_hunk", "diff.previous_hunk"), label: i18n.t("feature.diff.helpChange") },
        { shortcut: () => i18n.t("feature.diff.rightClick"), label: i18n.t("feature.diff.helpFileMenu") },
      ],
    },
    {
      title: i18n.t("feature.diff.helpScroll"),
      rows: [
        { shortcut: shortcut("diff.down", "diff.up"), label: i18n.t("feature.diff.helpDownUp") },
        { shortcut: shortcut("diff.half_page.down", "diff.half_page.up"), label: i18n.t("feature.diff.helpHalfPage") },
        { shortcut: shortcut("diff.page.down", "diff.page.up"), label: i18n.t("feature.diff.helpPage") },
        { shortcut: shortcut("diff.first", "diff.last"), label: i18n.t("feature.diff.helpFirstLast") },
      ],
    },
    {
      title: i18n.t("feature.diff.helpView"),
      rows: [
        { shortcut: shortcut("diff.toggle_view"), label: i18n.t("feature.diff.helpSplit") },
        { shortcut: shortcut("diff.single_patch"), label: i18n.t("feature.diff.helpAllFiles") },
        ...(props.tree
          ? [{ shortcut: shortcut("diff.toggle_file_tree"), label: i18n.t("feature.diff.helpTree") }]
          : []),
        { shortcut: shortcut("diff.switch_source"), label: i18n.t("feature.diff.helpSource") },
        ...(props.fullscreen
          ? [{ shortcut: shortcut("diff.toggle_fullscreen"), label: i18n.t("feature.diff.helpFullscreen") }]
          : []),
        {
          shortcut: () => props.context.keymap.shortcuts("diff.close").join(" / "),
          label: i18n.t("feature.diff.close"),
        },
      ],
    },
  ]

  return (
    <DialogLayout
      header={
        <DialogHeader
          title={i18n.t("feature.diff.shortcuts")}
          closeLabel={` ×  ${i18n.t("feature.diff.closeShort")}`}
          onClose={() => props.context.ui.dialog.clear()}
        />
      }
    >
      <scrollbox
        id="diff-help-scroll"
        focused
        height={Math.max(
          1,
          Math.min(
            dimensions().height - 6,
            groups().reduce((height, group) => height + group.rows.length + 2, -1),
          ),
        )}
        horizontalScrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{ visible: false }}
      >
        <box gap={1}>
          <For each={groups()}>
            {(group) => (
              <box flexShrink={0}>
                <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
                  {group.title}
                </text>
                <For each={group.rows}>
                  {(row) => (
                    <box flexDirection="row" gap={2}>
                      <text fg={theme.text.base} width={17} flexShrink={0}>
                        {row.shortcut() || i18n.t("feature.diff.unbound")}
                      </text>
                      <text fg={theme.text.muted} flexGrow={1} minWidth={0}>
                        {row.label}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </DialogLayout>
  )
}

function Commands(props: { context: Plugin.Context }) {
  const i18n = useI18n()
  const config = useConfig()
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "diff.open",
        title: i18n.t("feature.diff.open"),
        slash: { name: "diff" },
        group: "VCS",
        palette: true,
        run() {
          const route = props.context.ui.router.current()
          props.context.ui.dialog.clear()
          const current = props.context.ui.panel.current()
          if (route.type === "session" && current?.sessionID === route.sessionID && current.name === ROUTE) {
            props.context.ui.panel.close()
            return
          }
          // Outside a session there is no panel slot, so /diff falls back to the full-screen route.
          if (
            props.context.ui.panel.open(ROUTE, {
              presentation: config.data.diffs?.fullscreen === true ? "fullscreen" : "panel",
            })
          )
            return
          const returnRoute: Route =
            route.type === "home"
              ? { type: "home" }
              : route.type === "session"
                ? { type: "session", sessionID: route.sessionID }
                : {
                    type: "plugin",
                    id: route.id,
                    name: route.name,
                    ...(route.data ? { data: { ...route.data } } : {}),
                  }
          props.context.ui.router.navigate({
            type: "plugin",
            name: ROUTE,
            data: {
              sessionID: route.type === "session" ? route.sessionID : undefined,
              returnRoute,
            },
          })
        },
      },
    ],
  }))
  return null
}

export default Plugin.define({
  id: "opencode.diffs",
  setup(context) {
    context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === ROUTE}>
          <DiffViewer context={context} sessionID={panel.sessionID} panel={panel} onClose={panel.close} />
        </Show>
      ),
    })
    context.ui.router.register({
      name: ROUTE,
      render: ({ data }) => <DiffRoute context={context} data={data} />,
    })
    context.ui.slot({ append: "app", render: () => <Commands context={context} /> })
  },
})
