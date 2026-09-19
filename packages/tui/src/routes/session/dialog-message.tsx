import { createMemo } from "solid-js"
import { useI18n } from "../../context/i18n"
import { useData } from "../../context/data"
import { DialogSelect } from "../../ui/dialog-select"
import { useClipboard } from "../../context/clipboard"
import { useToast } from "../../ui/toast"
import { useClient } from "../../context/client"
import { errorMessage } from "../../util/error"
import { DialogFork } from "./dialog-fork"
import type { PromptInfo } from "../../prompt/history"
import { projectedPromptInput } from "../../prompt/codec"

export function DialogMessage(props: {
  messageID: string
  sessionID: string
  setPrompt?: (prompt: PromptInfo) => void
}) {
  const { t } = useI18n()
  const data = useData()
  const clipboard = useClipboard()
  const toast = useToast()
  const client = useClient()
  const message = createMemo(() => data.session.message.get(props.sessionID, props.messageID))

  return (
    <DialogSelect
      title={t("session.messageActions")}
      options={[
        {
          title: t("session.jumpTo"),
          value: "message.jump",
          description: t("session.viewMessage"),
          onSelect: (dialog) => dialog.clear(),
        },
        {
          title: t("session.revert"),
          value: "session.revert",
          description: t("session.revertDescription"),
          onSelect: (dialog) => {
            const value = message()
            if (value?.type === "user") {
              props.setPrompt?.({
                ...projectedPromptInput(value),
                pasted: [],
              })
            }
            void client.api.session.revert
              .stage({ sessionID: props.sessionID, messageID: props.messageID })
              .catch((error) => toast.show({ message: errorMessage(error), variant: "error", duration: 5000 }))
            dialog.clear()
          },
        },
        {
          title: t("session.copy"),
          value: "message.copy",
          description: t("session.copyDescription"),
          onSelect: async (dialog) => {
            const value = message()
            if (!value) return
            const text =
              value.type === "user"
                ? value.text
                : value.type === "assistant"
                  ? value.content
                      .filter((content) => content.type === "text")
                      .map((content) => content.text)
                      .join("\n")
                  : "text" in value
                    ? value.text
                    : ""
            try {
              await clipboard.write(text)
              dialog.clear()
            } catch (error) {
              toast.error(error)
            }
          },
        },
        {
          title: t("session.fork"),
          value: "session.fork",
          description: t("session.forkDescription"),
          onSelect: (dialog) => {
            const value = message()
            if (!value || value.type !== "user") return
            dialog.replace(() => <DialogFork sessionID={props.sessionID} messageID={props.messageID} />)
          },
        },
      ]}
    />
  )
}
