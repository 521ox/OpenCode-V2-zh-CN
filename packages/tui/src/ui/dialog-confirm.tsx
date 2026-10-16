import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog } from "./dialog"
import { createStore } from "solid-js/store"
import { For } from "solid-js"
import { useI18n } from "../context/i18n"

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

export function DialogConfirm(props: DialogConfirmProps) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const [store, setStore] = createStore({
    active: "confirm" as "confirm" | "cancel",
  })

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: t("main.dialog.confirm"),
        group: t("main.group.dialog"),
        run: () => {
          if (store.active === "confirm") props.onConfirm?.()
          if (store.active === "cancel") props.onCancel?.()
          dialog.clear()
        },
      },
      {
        bind: "left",
        title: t("main.dialog.previous"),
        group: t("main.group.dialog"),
        run: () => {
          setStore("active", store.active === "confirm" ? "cancel" : "confirm")
        },
      },
      {
        bind: "right",
        title: t("main.dialog.next"),
        group: t("main.group.dialog"),
        run: () => {
          setStore("active", store.active === "confirm" ? "cancel" : "confirm")
        },
      },
    ],
  }))
  return (
    <DialogLayout
      header={<DialogHeader title={props.title} />}
      footer={
        <box flexDirection="row" justifyContent="flex-end">
          <For each={["cancel", "confirm"] as const}>
            {(key) => (
              <box
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={key === store.active ? theme.background.action.primary.focused : undefined}
                onMouseUp={() => {
                  if (key === "confirm") props.onConfirm?.()
                  if (key === "cancel") props.onCancel?.()
                  dialog.clear()
                }}
              >
                <text fg={key === store.active ? theme.text.action.primary.focused : theme.text.muted}>
                  {props.label?.[key] ?? (key === "confirm" ? t("main.confirm") : t("main.cancel"))}
                </text>
              </box>
            )}
          </For>
        </box>
      }
    >
      <text fg={theme.text.muted}>{props.message}</text>
    </DialogLayout>
  )
}
