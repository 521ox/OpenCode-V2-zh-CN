import { RGBA } from "@opentui/core"
import { useTheme } from "../context/theme"
import { Spinner } from "./spinner"
import { useI18n } from "../context/i18n"

export function Reconnecting(props: { managed?: boolean }) {
  const { t } = useI18n()
  const theme = useTheme()

  return (
    <box
      position="absolute"
      zIndex={10_000}
      top={0}
      right={0}
      bottom={0}
      left={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
      alignItems="center"
      justifyContent="center"
    >
      <box
        width={48}
        maxWidth="90%"
        flexDirection="column"
        backgroundColor={theme.background.raised.base}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        gap={1}
      >
        <Spinner color={theme.text.base}>
          {props.managed ? t("main.service.restarting") : t("main.connection.lost")}
        </Spinner>
        <text fg={theme.text.muted}>
          {props.managed ? t("main.connection.resume") : t("main.connection.reconnecting")}
        </text>
      </box>
    </box>
  )
}
