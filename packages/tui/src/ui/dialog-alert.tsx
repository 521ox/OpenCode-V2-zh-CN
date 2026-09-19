import { TextAttributes } from "@opentui/core"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { useDialog } from "./dialog"
import { useI18n } from "../context/i18n"

export type DialogAlertProps = {
  title: string
  message: string
  onConfirm?: () => void
}

export function DialogAlert(props: DialogAlertProps) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: t("main.alert.confirm"),
        group: t("main.group.dialog"),
        run: () => {
          props.onConfirm?.()
          dialog.clear()
        },
      },
    ],
  }))
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text.base}>
          {props.title}
        </text>
        <text fg={theme.text.muted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={theme.text.muted}>{props.message}</text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box
          paddingLeft={3}
          paddingRight={3}
          backgroundColor={theme.background.action.primary.focused}
          onMouseUp={() => {
            props.onConfirm?.()
            dialog.clear()
          }}
        >
          <text fg={theme.text.action.primary.focused}>{t("main.ok")}</text>
        </box>
      </box>
    </box>
  )
}
