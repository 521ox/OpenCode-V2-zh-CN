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
import { DIALOG_INSET, DialogFooter, DialogHeader, DialogLayout, dialogWidth, useDialog } from "../ui/dialog"
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

  const actions = () => [
    { title: t("main.investigate"), key: "i", onTrigger: investigate },
    copied()
      ? { title: t("main.copy.done"), color: theme.text.feedback.success.base, onTrigger: copy }
      : { title: t("main.details.copy"), key: "c", onTrigger: copy },
  ]

  useKeyboard((event) => {
    if (event.name === "up") return scroll?.scrollBy(-1)
    if (event.name === "down") return scroll?.scrollBy(1)
    if (event.name === "pageup") return scroll?.scrollBy(-20)
    if (event.name === "pagedown") return scroll?.scrollBy(20)
    if (event.name === "home") return scroll?.scrollTo(0)
    if (event.name === "end" && scroll) return scroll.scrollTo(scroll.scrollHeight)
  })

  return (
    <DialogLayout
      header={
        <box>
          <DialogHeader
            gap={2}
            onClose={props.onBack}
            titleView={
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
            }
          />
          <Show when={props.source}>
            {(source) => (
              <FilePath
                value={source()}
                maxWidth={Math.min(dialogWidth(dialog.size), dimensions().width - 2) - DIALOG_INSET * 2}
                fg={theme.text.muted}
              />
            )}
          </Show>
        </box>
      }
      footer={{ actions: { primary: actions() } }}
      legacyFooter={
        <DialogFooter actions={{ secondary: actions(), primary: [{ title: t("main.scroll"), key: "↑/↓" }] }} />
      }
    >
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
    </DialogLayout>
  )
}
