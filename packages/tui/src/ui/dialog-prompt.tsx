import { TextareaRenderable } from "@opentui/core"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogFooter, DialogHeader, DialogLayout, useDialog, type DialogSize } from "./dialog"
import { Show, createEffect, createSignal, onMount, type JSX } from "solid-js"
import { Spinner } from "../component/spinner"
import { useConfig } from "../config"
import { useRenderer } from "@opentui/solid"
import { useI18n } from "../context/i18n"

export type DialogPromptAction = {
  title: string
  /** Keymap command id, bound while the prompt input is focused and shown in the footer. */
  command: string
  /** Keymap command title, e.g. for help listings. Defaults to `title`. */
  commandTitle?: string
  onTrigger: (prompt: { setValue: (value: string) => void }) => void
}

export type DialogPromptProps = {
  title: string
  size?: DialogSize
  description?: () => JSX.Element
  placeholder?: string
  value?: string
  busy?: boolean
  busyText?: string
  actions?: DialogPromptAction[]
  onConfirm?: (value: string) => void
  onCancel?: () => void
}

export function DialogPrompt(props: DialogPromptProps) {
  const { t } = useI18n()
  const dialog = useDialog()
  const renderer = useRenderer()
  const theme = useTheme().surface("dialog")
  const config = useConfig().data
  const [textareaTarget, setTextareaTarget] = createSignal<TextareaRenderable>()
  let textarea: TextareaRenderable

  function confirm() {
    if (props.busy) return
    props.onConfirm?.(textarea.plainText)
  }

  const handle = {
    setValue(value: string) {
      textarea.setText(value)
      textarea.gotoLineEnd()
    },
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    target: textareaTarget,
    enabled: textareaTarget() !== undefined && !props.busy,
    // Dialog form semantics must win over the global managed textarea input layer.
    priority: 1,
    commands: [
      {
        id: "dialog.prompt.submit",
        title: t("main.dialog.submit"),
        group: t("main.group.dialog"),
        run: confirm,
      },
      ...(props.actions ?? []).map((action) => ({
        id: action.command,
        title: action.commandTitle ?? action.title,
        group: t("main.group.dialog"),
        run: () => action.onTrigger(handle),
      })),
    ],
  }))

  Keymap.createLayer(() => ({
    mode: "modal",
    enabled: props.onCancel !== undefined,
    priority: 1,
    commands: [
      {
        bind: "escape",
        title: t("main.back"),
        group: t("main.group.dialog"),
        run: () => {
          if (renderer.getSelection()) {
            renderer.clearSelection()
            return
          }
          if (!props.busy) props.onCancel?.()
        },
      },
    ],
  }))

  onMount(() => {
    dialog.setSize(props.size ?? "medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      if (props.busy) return
      textarea.focus()
    }, 1)
    textarea.gotoLineEnd()
  })

  createEffect(() => {
    if (!textarea || textarea.isDestroyed) return
    const traits = props.busy
      ? {
          suspend: true,
          status: "BUSY",
        }
      : {}
    textarea.traits = traits
    if (props.busy) {
      textarea.blur()
      return
    }
    textarea.focus()
  })

  return (
    <DialogLayout
      header={
        <DialogHeader
          title={props.title}
          onClose={() => {
            if (!props.busy) (props.onCancel ?? dialog.clear)()
          }}
        />
      }
      footer={
        <Show when={!props.busy} fallback={<text fg={theme.text.muted}>{t("main.processing")}</text>}>
          <DialogFooter
            actions={[
              { title: t("main.submit"), command: "dialog.prompt.submit", onTrigger: confirm },
              ...(props.actions ?? []).map((action) => ({
                title: action.title,
                command: action.command,
                onTrigger: () => action.onTrigger(handle),
              })),
            ]}
          />
        </Show>
      }
    >
      <box gap={1}>
        {props.description?.()}
        <textarea
          height={1}
          wrapMode="none"
          ref={(val: TextareaRenderable) => {
            textarea = val
            setTextareaTarget(val)
          }}
          initialValue={props.value}
          placeholder={props.placeholder ?? t("main.enterText")}
          placeholderColor={theme.text.muted}
          textColor={props.busy ? theme.text.formfield.disabled : theme.text.formfield.base}
          focusedTextColor={props.busy ? theme.text.formfield.disabled : theme.text.formfield.base}
          cursorColor={props.busy ? theme.background.formfield.disabled : theme.text.base}
          cursorStyle={config.cursor}
        />
        <Show when={props.busy}>
          <Spinner color={theme.text.muted}>{props.busyText ?? t("main.working")}</Spinner>
        </Show>
      </box>
    </DialogLayout>
  )
}
