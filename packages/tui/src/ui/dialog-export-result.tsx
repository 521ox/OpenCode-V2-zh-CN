import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog, type DialogContext } from "./dialog"
import { useI18n } from "../context/i18n"

export function DialogExportResult(props: { path: string; onClose?: () => void }) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")

  const close = () => {
    props.onClose?.()
    dialog.clear()
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: t("main.export.close"),
        group: t("main.group.dialog"),
        run: close,
      },
    ],
  }))

  return (
    <DialogLayout
      header={<DialogHeader title={t("main.export.done")} onClose={close} />}
      footer={
        <box flexDirection="row" justifyContent="flex-end" gap={1}>
          <box
            paddingLeft={3}
            paddingRight={3}
            backgroundColor={theme.background.action.primary.focused}
            onMouseUp={close}
          >
            <text fg={theme.text.action.primary.focused}>{t("main.close")}</text>
          </box>
        </box>
      }
    >
      <text fg={theme.text.base}>{props.path}</text>
    </DialogLayout>
  )
}

DialogExportResult.show = (dialog: DialogContext, path: string) =>
  new Promise<void>((resolve) => {
    dialog.replace(() => <DialogExportResult path={path} onClose={resolve} />, resolve)
  })
