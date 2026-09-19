import { createSignal } from "solid-js"
import open from "open"
import { useRenderer } from "@opentui/solid"
import { useClipboard } from "../context/clipboard"
import { useDialog } from "./dialog"
import { DialogSelect } from "./dialog-select"
import { useToast } from "./toast"
import { useI18n } from "../context/i18n"

export function useWorkingDirectoryActions(input: { directory: () => string | undefined; onMove?: () => void }) {
  const { t } = useI18n()
  const clipboard = useClipboard()
  const dialog = useDialog()
  const renderer = useRenderer()
  const toast = useToast()
  const [hovered, setHovered] = createSignal(false)

  function openMenu() {
    if (renderer.getSelection()?.getSelectedText()) return
    const directory = input.directory()
    if (!directory) return
    dialog.replace(() => (
      <DialogSelect
        title={t("main.directory")}
        renderFilter={false}
        options={[
          {
            title: t("main.path.copy"),
            value: "location.copy",
            description: directory,
            onSelect: (dialog) => {
              void clipboard.write(directory).then(() => {
                dialog.clear()
                toast.show({ message: t("main.path.copied"), variant: "info" })
              }, toast.error)
            },
          },
          {
            title: t("main.folder.open"),
            value: "location.open",
            description: t("main.folder.system"),
            onSelect: (dialog) => {
              dialog.clear()
              void open(directory).catch(toast.error)
            },
          },
          ...(input.onMove
            ? [
                {
                  title: t("main.workspaces"),
                  value: "session.move",
                  description: t("main.directory.another"),
                  onSelect: () => void input.onMove?.(),
                },
              ]
            : []),
        ]}
      />
    ))
  }

  return {
    hovered,
    onMouseOver: () => setHovered(true),
    onMouseOut: () => setHovered(false),
    onMouseUp: openMenu,
  }
}
