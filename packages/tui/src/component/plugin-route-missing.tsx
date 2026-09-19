import { useTheme } from "../context/theme"
import { useI18n } from "../context/i18n"

export function PluginRouteMissing(props: { id: string; name: string; onHome: () => void }) {
  const { t } = useI18n()
  const theme = useTheme()

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
      <text fg={theme.text.feedback.warning.base}>{t("main.plugin.unknown", { id: props.id, name: props.name })}</text>
      <box
        onMouseUp={props.onHome}
        backgroundColor={theme.background.action.primary.hovered}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.text.action.primary.hovered}>{t("main.home")}</text>
      </box>
    </box>
  )
}
