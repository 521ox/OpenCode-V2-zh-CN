import { onCleanup } from "solid-js"
import { useThemes } from "../context/theme"
import { useToast } from "../ui/toast"
import { useI18n } from "../context/i18n"

export function ThemeErrorToast() {
  const { t } = useI18n()
  const themes = useThemes()
  const toast = useToast()

  onCleanup(
    themes.onError(({ name, error }) =>
      toast.show({
        variant: "error",
        title: t("main.theme.failed", { name }),
        message: error.message,
      }),
    ),
  )

  return null
}
