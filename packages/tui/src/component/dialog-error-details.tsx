import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import { useConfig } from "../config"
import { useClipboard } from "../context/clipboard"
import { Keymap } from "../context/keymap"
import { useLocation } from "../context/location"
import { useRoute } from "../context/route"
import { getScrollAcceleration } from "../util/scroll"
import { useTheme } from "../context/theme"
import { emptyPrompt } from "../prompt/history"
import { dialogWidth, useDialog } from "../ui/dialog"
import { FilePath } from "../ui/file-path"
import { useToast } from "../ui/toast"
import { errorDetails } from "../util/error-details"
import { useI18n } from "../context/i18n"

export function DialogErrorDetails(props: {
  title: string
  source?: string
  error: string
  context?: string
  diagnosticRef?: string
  onBack: () => void
}) {
  const { t } = useI18n()
  const clipboard = useClipboard()
  const dialog = useDialog()
  const location = useLocation()
  const route = useRoute()
  const toast = useToast()
  const theme = useTheme().surface("dialog")
  const dimensions = useTerminalDimensions()
  const config = useConfig().data
  const [copied, setCopied] = createSignal(false)
  let scroll: ScrollBoxRenderable | undefined

  const copy = () => {
    void clipboard
      .write(errorDetails(props).text)
      .then(() => setCopied(true))
      .catch(toast.error)
  }

  const investigate = () => {
    route.navigate({
      type: "home",
      location: location.ref,
      prompt: {
        ...emptyPrompt(),
        text: errorDetails(props).prompt,
      },
    })
    dialog.clear()
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      { bind: "escape", title: t("main.back"), group: t("main.group.dialog"), run: props.onBack },
      { bind: "c", title: t("main.details.copy"), group: t("main.group.dialog"), run: copy },
      { bind: "i", title: t("main.error.investigate"), group: t("main.group.dialog"), run: investigate },
    ],
  }))

  useKeyboard((event) => {
    if (event.name === "up") return scroll?.scrollBy(-1)
    if (event.name === "down") return scroll?.scrollBy(1)
    if (event.name === "pageup") return scroll?.scrollBy(-20)
    if (event.name === "pagedown") return scroll?.scrollBy(20)
    if (event.name === "home") return scroll?.scrollTo(0)
    if (event.name === "end" && scroll) return scroll.scrollTo(scroll.scrollHeight)
  })

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box>
        <box flexDirection="row" gap={2}>
          <text
            attributes={TextAttributes.BOLD}
            fg={theme.text.base}
            flexGrow={1}
            minWidth={0}
            wrapMode="none"
            truncate
          >
            {props.title}
          </text>
          <text fg={theme.text.muted} flexShrink={0} onMouseUp={props.onBack}>
            {" × "}
          </text>
        </box>
        <Show when={props.source}>
          {(source) => (
            <FilePath
              value={source()}
              maxWidth={Math.min(dialogWidth(dialog.size), dimensions().width - 2) - 4}
              fg={theme.text.muted}
            />
          )}
        </Show>
      </box>
      <box>
        <scrollbox
          ref={(element: ScrollBoxRenderable) => (scroll = element)}
          maxHeight={20}
          contentOptions={{ minHeight: 0 }}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={getScrollAcceleration(config)}
        >
          <text fg={theme.text.base} wrapMode="word">
            {props.error}
          </text>
        </scrollbox>
        <Show when={props.diagnosticRef}>
          <text fg={theme.text.muted}>{t("main.error.reference", { reference: props.diagnosticRef ?? "" })}</text>
        </Show>
      </box>
      <box flexDirection="row" gap={3} flexWrap="wrap">
        <text onMouseUp={investigate}>
          <span style={{ fg: theme.text.base }}>
            <b>i</b>
          </span>
          <span style={{ fg: theme.text.muted }}> {t("main.investigate")}</span>
        </text>
        <text onMouseUp={copy}>
          <span style={{ fg: copied() ? theme.text.feedback.success.base : theme.text.base }}>
            <b>{copied() ? t("main.copy.done") : "c"}</b>
          </span>
          <span style={{ fg: theme.text.muted }}>{copied() ? "" : ` ${t("main.details.copy")}`}</span>
        </text>
        <text fg={theme.text.muted}>↑/↓ {t("main.scroll")}</text>
      </box>
    </box>
  )
}
