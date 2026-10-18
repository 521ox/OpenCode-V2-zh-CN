import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog } from "./dialog"
import { useI18n } from "../context/i18n"

export function DialogHelp() {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const shortcuts = Keymap.useShortcuts()

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      { bind: "return", title: t("main.help.close"), group: t("main.group.dialog"), run: () => dialog.clear() },
      { bind: "escape", title: t("main.help.close"), group: t("main.group.dialog"), run: () => dialog.clear() },
    ],
  }))

  return (
    <DialogLayout
      header={<DialogHeader title={t("main.help")} closeLabel="    ×    " />}
      footer={{ actions: { primary: [{ title: t("main.ok"), key: "enter", onTrigger: () => dialog.clear() }] } }}
      legacyFooter={
        <box flexDirection="row" justifyContent="flex-end">
          <box
            paddingLeft={3}
            paddingRight={3}
            backgroundColor={theme.background.action.primary.focused}
            onMouseUp={() => dialog.clear()}
          >
            <text fg={theme.text.action.primary.focused}>{t("main.ok")}</text>
          </box>
        </box>
      }
    >
      <text fg={theme.text.muted}>{t("main.help.hint", { key: shortcuts.get("command.palette.show") ?? "" })}</text>
    </DialogLayout>
  )
}
