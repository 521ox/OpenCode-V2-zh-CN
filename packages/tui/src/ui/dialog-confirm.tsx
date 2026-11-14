import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { useNewDesigns } from "../config"
import { DialogButtons, DialogHeader, DialogLayout, useDialog } from "./dialog"
import { createStore } from "solid-js/store"
import { useI18n } from "../context/i18n"
import { Locale } from "../util/locale"

export type DialogConfirmProps = {
  title: string
  message: string
  onConfirm?: () => void
  onCancel?: () => void
  label?: {
    confirm?: string
    cancel?: string
  }
}

const keys = ["cancel", "confirm"] as const

export function DialogConfirm(props: DialogConfirmProps) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const newDesigns = useNewDesigns()
  const [store, setStore] = createStore({
    active: "confirm" as "confirm" | "cancel",
  })

  const choose = (key: "confirm" | "cancel") => {
    if (key === "confirm") props.onConfirm?.()
    if (key === "cancel") props.onCancel?.()
    dialog.clear()
  }

  const toggle = () => setStore("active", store.active === "confirm" ? "cancel" : "confirm")

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: t("main.dialog.confirm"),
        group: t("main.group.dialog"),
        run: () => choose(store.active),
      },
      { bind: "left", title: t("main.dialog.previous"), group: t("main.group.dialog"), run: toggle },
      { bind: "right", title: t("main.dialog.next"), group: t("main.group.dialog"), run: toggle },
      { bind: "tab", title: t("main.dialog.next"), group: t("main.group.dialog"), run: toggle },
      { bind: "shift+tab", title: t("main.dialog.previous"), group: t("main.group.dialog"), run: toggle },
      ...(newDesigns()
        ? [{ bind: "escape", title: t("main.cancel"), group: t("main.group.dialog"), run: () => choose("cancel") }]
        : []),
    ],
  }))
  return (
    <DialogLayout
      header={<DialogHeader title={props.title} />}
      buttons={
        <DialogButtons
          buttons={keys.map((key) => ({
            label: Locale.titlecase(props.label?.[key] ?? t(key === "confirm" ? "main.confirm" : "main.cancel")),
            run: () => choose(key),
          }))}
          active={keys.indexOf(store.active)}
          onActive={(index) => setStore("active", keys[index]!)}
        />
      }
    >
      <text fg={theme.text.muted}>{props.message}</text>
    </DialogLayout>
  )
}
