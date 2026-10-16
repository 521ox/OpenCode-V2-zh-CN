import { Slug } from "@opencode/core/util/slug"
import { type DialogContext } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useI18n } from "../context/i18n"

export function DialogWorktreeName(props: { onConfirm: (name: string) => void }) {
  const { t } = useI18n()
  return (
    <DialogPrompt
      title={t("main.worktree.name")}
      placeholder={t("main.worktree.placeholder")}
      onConfirm={(value) => props.onConfirm(slugify(value) || Slug.create())}
      actions={[
        {
          title: t("main.worktree.generateOne"),
          command: "dialog.worktree.generate",
          commandTitle: t("main.worktree.generate"),
          onTrigger: (prompt) => prompt.setValue(Slug.create()),
        },
      ]}
    />
  )
}

DialogWorktreeName.show = (dialog: DialogContext) =>
  new Promise<string | null>((resolve) => {
    dialog.replace(
      () => <DialogWorktreeName onConfirm={resolve} />,
      () => resolve(null),
    )
  })

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}
