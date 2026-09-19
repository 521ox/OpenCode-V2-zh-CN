import { type Key, type Translator } from "../i18n"

export function parse(value: string) {
  const [providerID, ...modelID] = value.split("/")
  return { providerID, modelID: modelID.join("/") }
}

export function formatRef(model: { providerID: string; id: string; variant?: string }) {
  return [model.providerID, model.id, model.variant].filter((value) => value !== undefined).join("/")
}

export function switchLabel(
  model: { providerID: string; id: string; variant?: string },
  t: Translator<Key>,
  models?: readonly { providerID: string; id: string; name: string }[],
  previous?: { providerID: string; id: string; variant?: string },
) {
  if (previous?.providerID === model.providerID && previous.id === model.id)
    return t("main.model.switchedVariant", { variant: model.variant ?? "default" })
  const display = models?.find((item) => item.providerID === model.providerID && item.id === model.id)?.name
  if (display === undefined) return t("main.model.switched", { model: formatRef(model) })
  const variant = model.variant && model.variant !== "default" ? ` (${model.variant})` : ""
  return t("main.model.switched", { model: `${display}${variant}` })
}
