import { Plugin } from "@opencode/plugin/tui"
import { createMemo, Show } from "solid-js"
import { contextUsage } from "../../util/session"
import { useI18n } from "../../context/i18n"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const i18n = useI18n()
  const theme = props.context.theme
  const msg = createMemo(() => props.context.data.session.message.list(props.sessionID))
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const cost = createMemo(() => props.context.data.session.cost(props.sessionID))

  const state = createMemo(() =>
    contextUsage(msg(), props.context.data.location.model.list(session()?.location), session()?.revert?.messageID),
  )

  return (
    <Show when={state() || cost() > 0}>
      <box>
        <text fg={theme.text.base}>
          <b>{i18n.t("feature.context.title")}</b>
        </text>
        <Show when={state()}>
          {(value) => (
            <>
              <text fg={theme.text.muted}>
                {i18n.t("feature.context.tokens", { count: value().tokens.toLocaleString() })}
              </text>
              <Show when={value().percent !== undefined}>
                <text fg={theme.text.muted}>{i18n.t("feature.context.used", { percent: value().percent! })}</text>
              </Show>
            </>
          )}
        </Show>
        <Show when={cost() > 0}>
          <text fg={theme.text.muted}>{i18n.t("feature.context.spent", { cost: money.format(cost()) })}</text>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
