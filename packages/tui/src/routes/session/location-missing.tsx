import { createMemo } from "solid-js"
import { useI18n } from "../../context/i18n"
import { useTuiPaths } from "../../context/runtime"
import { useTheme } from "../../context/theme"
import { Locale } from "../../util/locale"
import { abbreviateHome } from "../../util/path-format"
import { SessionQuestion } from "./permission"
import { usePromptMove } from "../../component/prompt/move"

export function SessionLocationMissing(props: { directory: string; projectID: string; sessionID: string }) {
  const move = usePromptMove({ projectID: () => props.projectID, sessionID: () => props.sessionID })
  return <SessionLocationUnavailable directory={props.directory} onMove={move.open} />
}

export function SessionLocationUnavailable(props: { directory: string; onMove: () => void }) {
  const { t } = useI18n()
  const paths = useTuiPaths()
  const theme = useTheme()
  const directory = createMemo(() => Locale.truncateMiddle(abbreviateHome(props.directory, paths.home), 72))

  return (
    <SessionQuestion
      id="session.location-missing"
      group={t("session.recovery")}
      choicesLabel={t("session.recoveryActions")}
      instance={props.directory}
      title={t("session.locationUnavailable")}
      body={
        <box paddingLeft={1} gap={1}>
          <text fg={theme.text.muted}>{directory()}</text>
          <text fg={theme.text.base}>{t("session.chooseAnotherDirectory")}</text>
        </box>
      }
      options={{ move: t("session.chooseDirectory") }}
      onSelect={props.onMove}
    />
  )
}
