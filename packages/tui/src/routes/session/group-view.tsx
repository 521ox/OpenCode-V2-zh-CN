import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { RGBA, type Renderable } from "@opentui/core"
import { useRenderer, type JSX } from "@opentui/solid"
import type { SessionMessageAssistantTool, SessionMessageInfo } from "@opencode/client"
import { createSyntaxStyleMemo, useTheme, useThemes } from "../../context/theme"
import { reasoningSummary } from "../../context/thinking"
import { SplitBorder } from "../../ui/border"
import { Locale } from "../../util/locale"
import { EntryAnchor, GroupAnchor } from "./anchor-view"
import { groupID } from "./anchors"
import {
  executionFailed,
  executionEntries,
  executionVisible,
  collapsedActivityEntries,
  groupLeaves,
  groupTools,
  instructionPaths,
  isPending,
  type PartRef,
  type SessionEntry,
  type SessionGroup,
  type SessionNode,
} from "./grouping/session"
import { summarizeActivity } from "./activity-summary"
import { InlineToolRow, reasoningContent, toolDisplay } from "./message-parts"
import { use } from "./render-context"
import { resolvePart } from "./rows"
import { generateThinkingSyntax } from "./thinking-syntax"
import { useI18n } from "../../context/i18n"

type Renderers = {
  pendingTools: readonly string[]
  message: (messageID: string) => SessionMessageInfo | undefined
  entry: (entry: SessionEntry, images?: boolean) => JSX.Element
  images: (parts: readonly SessionMessageAssistantTool[]) => JSX.Element
}

type GroupProps = Renderers & {
  node: Extract<SessionNode, { type: "group" }>
  level: number
  completed: boolean
  pending: readonly PartRef[]
  pendingOutside?: boolean
  imagesOutside?: boolean
}

export function SessionGroupView(props: Renderers & { row: SessionGroup }) {
  return (
    <Group
      {...props}
      node={props.row}
      level={0}
      completed={props.row.completed}
      pending={props.row.kind === "exploration" || props.row.kind === "activity" ? props.row.pending : []}
    />
  )
}

function Group(props: GroupProps) {
  // Keep kind-specific hover/title state isolated during reconciliation.
  return (
    <Show when={props.node.kind} keyed>
      {(kind) => (
        <Switch fallback={<GroupContent {...props} />}>
          <Match when={kind === "activity"}>
            <ActivityGroup {...props} />
          </Match>
          <Match when={kind === "instructions"}>
            <InstructionsGroup {...props} />
          </Match>
        </Switch>
      )}
    </Show>
  )
}

function GroupContent(props: GroupProps) {
  const { t } = useI18n()
  const ctx = use()
  const theme = useTheme()
  const disclosure = useDisclosure(props)
  const id = disclosure.id
  const expanded = disclosure.expanded
  const [hover, setHover] = createSignal(false)
  const entries = createMemo(() => groupLeaves(props.node))
  const refs = createMemo(() =>
    entries().flatMap((entry) => (entry.type === "part" && !isPending(entry, props.pending) ? [entry.ref] : [])),
  )
  const thoughts = createMemo(() =>
    props.node.kind !== "reasoning"
      ? []
      : refs().flatMap((ref) => {
          const message = props.message(ref.messageID)
          if (message?.type !== "assistant") return []
          const part = resolvePart(message, ref.partID)
          if (part?.type !== "reasoning" || !reasoningContent(part)) return []
          return [{ message, part }]
        }),
  )
  const tools = createMemo(() =>
    props.node.kind === "reasoning" ? [] : groupTools(props.node, (ref) => toolPart(props, ref), props.pending),
  )
  const latest = createMemo((previous: string | null) => {
    const item = thoughts().at(-1)
    if (!item) return previous
    const title = reasoningSummary(reasoningContent(item.part)).title
    if (title) return title
    if (item.part.time?.completed !== undefined || item.message.time.completed !== undefined) return null
    return previous
  }, null)
  const duration = createMemo(() =>
    thoughts().reduce((total, item) => {
      const start = item.part.time?.created
      const end = item.part.time?.completed
      return total + (start === undefined || end === undefined ? 0 : Math.max(0, end - start))
    }, 0),
  )
  const grouped = () =>
    props.node.kind === "reasoning"
      ? ctx.thinkingMode() === "hide"
      : ctx.groupExploration() && (props.node.kind !== "execution" || tools().length > 1)
  const completed = () =>
    props.node.kind === "reasoning"
      ? props.completed
      : props.node.kind === "execution"
        ? tools().every((part) => part.state.status === "completed" || part.state.status === "error")
        : props.completed || (tools().length > 0 && tools().every((part) => part.time.completed !== undefined))
  const visibleExecutions = createMemo(() =>
    executionEntries(props.node, (ref) => toolPart(props, ref))
      .filter(({ part }) => expanded() || executionVisible(part, props.pendingTools))
      .map(({ entry }) => entry),
  )
  const label = createMemo(() => {
    if (props.node.kind === "execution")
      return t(completed() ? "session.executionsFinished" : "session.executionsRunning", { count: tools().length })
    const counts = tools().reduce<Record<string, number>>((result, part) => {
      const tool = toolDisplay(part.name)
      const name =
        tool === "grep" || tool === "glob" || tool === "websearch" ? "search" : tool === "webfetch" ? "fetch" : tool
      result[name] = (result[name] ?? 0) + 1
      return result
    }, {})
    const names = Object.entries(counts).map(([name, count]) => {
      if (name === "search") return t(count === 1 ? "session.searchOne" : "session.searchCount", { count })
      if (name === "read") return t(count === 1 ? "session.readOne" : "session.readCount", { count })
      return t("session.toolCount", { count, name })
    })
    return t(completed() ? "session.explored" : "session.exploring", { tools: names.join(", ") })
  })
  const toggle = () => disclosure.toggle()
  const children = (mode: "normal" | "thought" | "tool") => (
    <Children {...props} nodes={props.node.children} mode={mode} />
  )

  return (
    <GroupAnchor
      groupID={id()}
      active={grouped() && (props.node.kind === "reasoning" ? thoughts().length > 0 : tools().length > 0)}
    >
      <Show
        when={props.node.kind === "reasoning"}
        fallback={
          <Show when={grouped()} fallback={children("normal")}>
            <Show when={tools().length > 0}>
              <InlineToolRow
                icon={props.node.kind === "execution" && tools().some(executionFailed) ? "✗" : completed() ? "→" : "✱"}
                color={hover() ? theme.text.base : theme.text.muted}
                complete={completed()}
                pending={label()}
                spinner={!completed()}
                onMouseOver={() => setHover(true)}
                onMouseOut={() => setHover(false)}
                onMouseUp={toggle}
              >
                {label()}
              </InlineToolRow>
            </Show>
            <Show
              when={props.node.kind === "execution"}
              fallback={
                <>
                  <Show when={expanded() && tools().length > 0}>{children("tool")}</Show>
                  <Show when={!props.imagesOutside}>{props.images(tools())}</Show>
                </>
              }
            >
              <For each={visibleExecutions()}>
                {(entry) => <EntryAnchor entry={entry}>{props.entry(entry)}</EntryAnchor>}
              </For>
            </Show>
          </Show>
        }
      >
        <Show when={thoughts().length > 0}>
          <Show when={grouped()} fallback={children("normal")}>
            <InlineToolRow
              icon={expanded() ? "-" : "+"}
              color={
                !props.completed
                  ? theme.text.base
                  : hover() || expanded()
                    ? theme.text.feedback.warning.base
                    : RGBA.fromValues(
                        theme.text.feedback.warning.base.r,
                        theme.text.feedback.warning.base.g,
                        theme.text.feedback.warning.base.b,
                        0.6,
                      )
              }
              complete={props.completed}
              pending={latest() ? t("session.thinkingTitle", { title: latest()! }) : t("session.thinking")}
              spinner={!props.completed}
              onMouseOver={() => setHover(true)}
              onMouseOut={() => setHover(false)}
              onMouseUp={toggle}
            >
              {props.completed
                ? t("session.thought")
                : latest()
                  ? t("session.thinkingTitle", { title: latest()! })
                  : t("session.thinking")}
              <Show when={props.completed && !expanded() && latest()}>: {latest()}</Show>
              <Show when={props.completed && thoughts().length > 1}>
                {" "}
                · {t("session.steps", { count: thoughts().length })}
              </Show>
              <Show when={props.completed && duration()}> · {Locale.duration(duration())}</Show>
            </InlineToolRow>
            <Show when={expanded()}>
              <box paddingLeft={3}>{children("thought")}</box>
            </Show>
          </Show>
        </Show>
      </Show>
      <PendingEntries {...props} entries={entries()} />
    </GroupAnchor>
  )
}

/** Low verbosity: one summary for a run of tools, thoughts and instruction loads. */
function ActivityGroup(props: GroupProps) {
  const { t } = useI18n()
  const ctx = use()
  const theme = useTheme()
  const disclosure = useDisclosure(props)
  const [hover, setHover] = createSignal(false)
  const entries = createMemo(() => groupLeaves(props.node))
  const summary = createMemo(() => summarizeActivity(props.node, props.message, props.pending, props.completed, t))
  // Low's outer summary must not hide the native execution collection's visible states.
  const visible = createMemo(() =>
    collapsedActivityEntries(props.node, {
      tool: (ref) => toolPart(props, ref),
      pendingTools: props.pendingTools,
      pending: props.pending,
    }),
  )
  return (
    <Show
      when={ctx.groupExploration()}
      fallback={
        <>
          <Children {...props} nodes={props.node.children} mode="normal" />
          <PendingEntries {...props} entries={entries()} />
        </>
      }
    >
      <GroupAnchor groupID={disclosure.id()} active={summary().label !== ""}>
        <Show when={summary().label}>
          <InlineToolRow
            icon={disclosure.expanded() ? "−" : "+"}
            color={hover() ? theme.text.base : theme.text.muted}
            complete={true}
            pending={summary().label}
            spinner={!disclosure.expanded() && summary().active}
            onMouseOver={() => setHover(true)}
            onMouseOut={() => setHover(false)}
            onMouseUp={(event) => disclosure.toggle(event.currentTarget)}
          >
            {summary().label}
          </InlineToolRow>
          <Show when={disclosure.expanded()}>
            <box flexDirection="column" gap={1} marginTop={1}>
              <Children {...props} nodes={props.node.children} mode="normal" />
            </box>
          </Show>
        </Show>
        <Show
          when={disclosure.expanded()}
          fallback={
            <For each={visible()}>{(entry) => <EntryAnchor entry={entry}>{props.entry(entry)}</EntryAnchor>}</For>
          }
        >
          <PendingEntries {...props} entries={entries()} />
        </Show>
      </GroupAnchor>
    </Show>
  )
}

/** Consecutive instruction loads, summarized by the number of distinct files. */
function InstructionsGroup(props: GroupProps) {
  const { t } = useI18n()
  const theme = useTheme()
  const disclosure = useDisclosure(props)
  const [hover, setHover] = createSignal(false)
  const files = createMemo(
    () =>
      new Set(
        groupLeaves(props.node).flatMap((entry) =>
          entry.type === "message" ? instructionPaths(props.message(entry.messageID)) : [],
        ),
      ).size,
  )
  return (
    <GroupAnchor groupID={disclosure.id()} active={files() > 0}>
      <InlineToolRow
        icon="◈"
        color={hover() ? theme.text.base : theme.text.muted}
        complete={true}
        pending=""
        onMouseOver={() => setHover(true)}
        onMouseOut={() => setHover(false)}
        onMouseUp={() => disclosure.toggle()}
      >
        {t(files() === 1 ? "session.instructionsFile" : "session.instructionsFiles", { count: files() })}
      </InlineToolRow>
      <Show when={disclosure.expanded()}>
        <Children {...props} nodes={props.node.children} mode="normal" />
      </Show>
    </GroupAnchor>
  )
}

function useDisclosure(props: GroupProps) {
  const ctx = use()
  const renderer = useRenderer()
  const id = createMemo(() => groupID(props.node, props.level))
  const expanded = () => {
    const key = id()
    return key ? ctx.groupExpanded(key, props.node.kind) : false
  }
  return {
    id,
    expanded,
    toggle(anchor?: Renderable | null) {
      if (renderer.getSelection()?.getSelectedText()) return
      const key = id()
      if (key) ctx.setGroupExpanded(key, !expanded(), anchor)
    },
  }
}

function toolPart(props: Renderers, ref: PartRef) {
  const message = props.message(ref.messageID)
  if (message?.type !== "assistant") return
  const part = resolvePart(message, ref.partID)
  return part?.type === "tool" ? part : undefined
}

/** Permission-blocked tools stay visible below the root group, even when collapsed. */
function PendingEntries(props: GroupProps & { entries: readonly SessionEntry[] }) {
  return (
    <Show when={!props.pendingOutside}>
      <For each={props.pending}>
        {(ref) => {
          const leaf = createMemo(() =>
            props.entries.find(
              (entry) =>
                entry.type === "part" && entry.ref.messageID === ref.messageID && entry.ref.partID === ref.partID,
            ),
          )
          return <Show when={leaf()}>{(item) => <EntryAnchor entry={item()}>{props.entry(item())}</EntryAnchor>}</Show>
        }}
      </For>
    </Show>
  )
}

function Children(props: GroupProps & { nodes: readonly SessionNode[]; mode: "normal" | "thought" | "tool" }) {
  return (
    <For each={props.nodes}>
      {(node, index) => {
        return (
          <Switch>
            <Match when={node.type === "group" ? node : undefined}>
              {(node) => (
                <Group
                  {...props}
                  node={node()}
                  level={props.level + 1}
                  pendingOutside
                  imagesOutside={props.imagesOutside || props.mode === "tool"}
                  completed={
                    props.completed ||
                    props.nodes
                      .slice(index() + 1)
                      .some((next) => next.type === "group" || !isPending(next.entry, props.pending)) ||
                    (node().kind === "reasoning" && reasoningCompleted(node().children, props.message))
                  }
                />
              )}
            </Match>
            <Match when={node.type === "entry" ? node : undefined}>
              {(node) => (
                <Show when={!isPending(node().entry, props.pending)}>
                  <Show
                    when={props.mode === "thought"}
                    fallback={
                      <EntryAnchor entry={node().entry}>
                        {props.entry(node().entry, props.mode === "tool" ? false : undefined)}
                      </EntryAnchor>
                    }
                  >
                    <ThoughtEntry entry={node().entry} message={props.message} />
                  </Show>
                </Show>
              )}
            </Match>
          </Switch>
        )
      }}
    </For>
  )
}

function ThoughtEntry(props: { entry: SessionEntry; message: Renderers["message"] }) {
  const ctx = use()
  const theme = useTheme()
  const { currentSyntax: syntax } = useThemes()
  const renderer = useRenderer()
  const thinkingSyntax = createSyntaxStyleMemo(() =>
    generateThinkingSyntax(syntax(), theme.text.muted, renderer.nativeScene),
  )
  const message = createMemo(() => {
    if (props.entry.type !== "part") return
    const item = props.message(props.entry.ref.messageID)
    return item?.type === "assistant" ? item : undefined
  })
  const part = createMemo(() => {
    const item = message()
    if (!item || props.entry.type !== "part") return
    const part = resolvePart(item, props.entry.ref.partID)
    return part?.type === "reasoning" ? part : undefined
  })
  const content = createMemo(() => {
    const item = part()
    return item ? reasoningContent(item) : ""
  })
  return (
    <Show when={content()}>
      <EntryAnchor entry={props.entry} marginTop={1}>
        <box
          border={["left"]}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.decrease(theme.background.raised.base)}
          paddingLeft={1}
        >
          <code
            filetype="markdown"
            drawUnstyledText={false}
            streaming={part()?.time?.completed === undefined && message()?.time.completed === undefined}
            syntaxStyle={thinkingSyntax()}
            content={content()}
            conceal={ctx.markdownMode() === "rendered"}
            fg={theme.text.muted}
          />
        </box>
      </EntryAnchor>
    </Show>
  )
}

function reasoningCompleted(nodes: readonly SessionNode[], message: Renderers["message"]): boolean {
  return nodes.every((node) => {
    if (node.type === "group") return reasoningCompleted(node.children, message)
    if (node.entry.type !== "part") return false
    const item = message(node.entry.ref.messageID)
    if (item?.type !== "assistant") return false
    const part = resolvePart(item, node.entry.ref.partID)
    return part?.type === "reasoning" && part.time?.completed !== undefined
  })
}
