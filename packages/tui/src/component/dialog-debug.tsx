import { createMemo, createSignal, For } from "solid-js"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog } from "../ui/dialog"
import { useRoute } from "../context/route"
import { useLocal } from "../context/local"
import { useClipboard } from "../context/clipboard"
import { useToast } from "../ui/toast"
import { describeOS, describeTerminal } from "../util/system"
import { useTuiApp } from "../context/runtime"
import { useI18n } from "../context/i18n"
import { useNewDesigns } from "../config"

export function DialogDebug() {
  const { t } = useI18n()
  const theme = useTheme()
  const dialog = useDialog()
  const route = useRoute()
  const local = useLocal()
  const clipboard = useClipboard()
  const toast = useToast()
  const app = useTuiApp()
  const newDesigns = useNewDesigns()
  const [copied, setCopied] = createSignal(false)

  dialog.setSize("large")

  const entries = createMemo(() => {
    const model = local.model.current()
    return [
      { label: t("main.debug.version"), value: `${app.version} (${app.channel})` },
      { label: t("main.debug.date"), value: new Date().toISOString() },
      { label: t("main.debug.os"), value: describeOS() },
      { label: t("main.group.terminal"), value: describeTerminal() },
      { label: t("main.debug.session"), value: route.data.type === "session" ? route.data.sessionID : t("main.na") },
      { label: t("main.debug.model"), value: model ? `${model.providerID}/${model.modelID}` : t("main.na") },
    ]
  })

  const copy = () => {
    const text = entries()
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join("\n")
    void clipboard
      .write(text)
      .then(() => {
        setCopied(true)
        toast.show({ message: t("main.debug.copied"), variant: "info" })
      })
      .catch(toast.error)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      { bind: newDesigns() ? "c" : "return", title: t("main.debug.copy"), group: t("main.group.dialog"), run: copy },
    ],
  }))

  const copyAction = () => ({
    title: copied() ? t("main.copy.done") : t("main.copy"),
    key: newDesigns() ? "c" : "enter",
    color: copied() ? theme.text.feedback.success.base : undefined,
    onTrigger: copy,
  })

  return (
    <DialogLayout
      header={<DialogHeader title={t("main.group.debug")} description={t("main.debug.share")} />}
      footer={{
        actions: { primary: [copyAction()] },
        get children() {
          if (newDesigns()) return undefined
          return <text fg={theme.text.muted}>{t("main.debug.share")}</text>
        },
      }}
    >
      {/* No click-to-copy here: releasing a mouse selection must trigger the
          global copy-on-select so users can copy a single value, e.g. the session id. */}
      <For each={entries()}>
        {(entry) => (
          <box flexDirection="row" gap={1}>
            <text flexShrink={0} fg={theme.text.muted}>
              {entry.label.padEnd(10)}
            </text>
            <text fg={theme.text.base} wrapMode="word">
              {entry.value}
            </text>
          </box>
        )}
      </For>
    </DialogLayout>
  )
}
