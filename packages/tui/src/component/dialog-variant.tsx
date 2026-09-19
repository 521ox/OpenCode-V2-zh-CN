import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useI18n } from "../context/i18n"

export function DialogVariant() {
  const { t } = useI18n()
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() => [
    {
      value: "default",
      title: t("main.default"),
      onSelect: () => {
        dialog.clear()
        local.model.variant.set(undefined)
      },
    },
    ...local.model.variant
      .list()
      .filter((variant) => variant !== "default")
      .map((variant) => ({
        value: variant,
        title: variant,
        onSelect: () => {
          dialog.clear()
          local.model.variant.set(variant)
        },
      })),
  ])

  return (
    <DialogSelect<string>
      options={options()}
      title={t("main.variant.select")}
      current={local.model.variant.current() ?? "default"}
      flat={true}
    />
  )
}
