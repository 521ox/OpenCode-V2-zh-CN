import { createEffect, createMemo, createResource, createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { UpdateState } from "../context/update-notification"
import { DialogButtons, DialogHeader, DialogLayout, useDialog } from "../ui/dialog"
import { errorMessage } from "../util/error"
import { Spinner } from "./spinner"
import { useI18n } from "../context/i18n"
import type { Key } from "../i18n"

type UpdateButton = { label: Key; run: () => void }

export function DialogUpdate(props: {
  check?: (signal: AbortSignal) => Promise<string | undefined>
  state: () => UpdateState | undefined
  skip: () => void
  install: () => Promise<void>
  restart: () => void
}) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const [error, setError] = createSignal<string>()
  const [active, setActive] = createSignal(0)
  const controller = new AbortController()
  onCleanup(() => controller.abort())

  dialog.setCentered(true)

  const [check] = createResource(
    () => props.check,
    (check) =>
      check(controller.signal).catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error))
        return undefined
      }),
  )
  const state = createMemo(() => {
    const message = error()
    if (message) return { type: "check-failed" as const, message }
    const current = props.state()
    if (current?.type === "installing") return current
    if (check.loading) return { type: "checking" as const }
    const unavailable = check()
    if (unavailable) return { type: "unavailable" as const, message: unavailable }
    return current ?? { type: "current" as const }
  })
  const buttons = createMemo<UpdateButton[]>(() => {
    const type = state().type
    if (type === "installing") return []
    const confirm: UpdateButton | undefined =
      type === "available"
        ? { label: "main.update", run: props.install }
        : type === "installed"
          ? { label: "main.restart", run: props.restart }
          : undefined
    return [
      {
        label: "main.skip",
        run: () => {
          props.skip()
          dialog.clear()
        },
      },
      ...(confirm ? [confirm] : []),
    ]
  })

  createEffect(() => setActive(Math.max(0, buttons().length - 1)))

  const move = (step: number) => {
    const count = buttons().length
    if (count) setActive((value) => (value + step + count) % count)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: t("main.update.confirm"),
        group: t("main.group.dialog"),
        run: () => void buttons()[active()]?.run(),
      },
      ...["left", "right", "tab", "shift+tab"].map((bind) => ({
        bind,
        title: bind === "left" || bind === "shift+tab" ? t("main.update.previous") : t("main.update.next"),
        group: t("main.group.dialog"),
        run: () => move(bind === "left" || bind === "shift+tab" ? -1 : 1),
      })),
    ],
  }))

  return (
    <DialogLayout
      header={
        <DialogHeader
          title={
            state().type === "installing"
              ? t("main.update.updating")
              : state().type === "available" || state().type === "failed"
                ? t("main.update.available")
                : t("main.update")
          }
        />
      }
      buttons={
        <Show when={buttons().length > 0}>
          <DialogButtons
            buttons={buttons().map((button) => ({ label: t(button.label), run: () => void button.run() }))}
            active={active()}
            onActive={setActive}
          />
        </Show>
      }
    >
      <Show when={state()} keyed>
        {(current) => (
          <Switch>
            <Match when={current.type === "checking"}>
              <Spinner shimmer={theme.text.base}>{t("main.update.checking")}</Spinner>
            </Match>
            <Match when={current.type === "available"}>
              <text fg={theme.text.muted}>{t("main.update.hint")}</text>
            </Match>
            <Match when={current.type === "installing"}>
              <Spinner shimmer={theme.text.base}>
                {current.type === "installing" ? t("main.update.installing", { version: current.version }) : ""}
              </Spinner>
            </Match>
            <Match when={current.type === "installed"}>
              <text fg={theme.text.muted} wrapMode="word">
                {t("main.update.success")}
              </text>
            </Match>
            <Match when={current.type === "current"}>
              <text fg={theme.text.muted}>{t("main.update.current")}</text>
            </Match>
            <Match when={current.type === "unavailable"}>
              <text fg={theme.text.muted} wrapMode="word">
                {current.type === "unavailable" ? current.message : ""}
              </text>
            </Match>
            <Match when={current.type === "failed" || current.type === "check-failed"}>
              <text fg={theme.text.feedback.error.base}>
                {current.type === "failed" || current.type === "check-failed" ? current.message : ""}
              </text>
            </Match>
          </Switch>
        )}
      </Show>
    </DialogLayout>
  )
}
