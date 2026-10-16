import { useTerminalDimensions } from "@opentui/solid"
import { createMemo, createSignal } from "solid-js"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog } from "../ui/dialog"
import { useI18n } from "../context/i18n"

type ImagePreviewItem = Readonly<{
  uri: string
  mention?: Readonly<{ text: string }>
}>

export function DialogImagePreview(props: { images: readonly ImagePreviewItem[]; initial: number }) {
  const { t } = useI18n()
  const dialog = useDialog()
  const dimensions = useTerminalDimensions()
  const theme = useTheme().surface("dialog")
  const [index, setIndex] = createSignal(Math.max(0, Math.min(props.images.length - 1, props.initial)))
  const [failed, setFailed] = createSignal(false)
  const current = createMemo(() => props.images[index()])
  const imageHeight = createMemo(() => Math.max(3, dimensions().height - 8))

  dialog.setSize("xlarge")
  dialog.setCentered(true)

  function move(direction: number) {
    if (props.images.length < 2) return
    setFailed(false)
    setIndex((value) => (value + direction + props.images.length) % props.images.length)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      { bind: "left", title: t("main.image.previous"), group: t("main.group.dialog"), run: () => move(-1) },
      { bind: "right", title: t("main.image.next"), group: t("main.group.dialog"), run: () => move(1) },
    ],
  }))

  return (
    <DialogLayout
      id="prompt-image-viewer"
      header={<DialogHeader title={t("main.image.count", { index: index() + 1, count: props.images.length })} />}
      footer={
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text.muted} onMouseUp={() => move(-1)}>
            {props.images.length > 1 ? `← ${t("main.previous")}` : ""}
          </text>
          <text fg={failed() ? theme.text.feedback.error.base : theme.text.muted} wrapMode="none" truncate>
            {failed()
              ? t("main.image.noPreview")
              : (current().mention?.text ?? t("main.image.index", { index: index() + 1 }))}
          </text>
          <text fg={theme.text.muted} onMouseUp={() => move(1)}>
            {props.images.length > 1 ? `${t("main.next")} →` : ""}
          </text>
        </box>
      }
    >
      <image
        id="prompt-image-viewer-image"
        source={current().uri}
        fit="fit"
        protocol="auto"
        width="100%"
        height={imageHeight()}
        onError={() => setFailed(true)}
      />
    </DialogLayout>
  )
}
