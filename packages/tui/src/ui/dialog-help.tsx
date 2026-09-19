import { TextAttributes } from "@opentui/core"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { useDialog } from "./dialog"
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
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text.base}>
          {t("main.help")}
        </text>
        <text fg={theme.text.muted} onMouseUp={() => dialog.clear()}>
          esc/enter
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={theme.text.muted}>{t("main.help.hint", { key: shortcuts.get("command.palette.show") ?? "" })}</text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box
          paddingLeft={3}
          paddingRight={3}
          backgroundColor={theme.background.action.primary.focused}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={theme.text.action.primary.focused}>{t("main.ok")}</text>
        </box>
      </box>
    </box>
  )
}
