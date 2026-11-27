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
  models?: readonly {
    providerID: string
    id: string
    name: string
    experimental?: { speed?: { base: string; id: string } }
  }[],
  previous?: { providerID: string; id: string; variant?: string },
) {
  if (previous?.providerID === model.providerID && previous.id === model.id)
    return t("main.model.switchedVariant", { variant: model.variant ?? "default" })
  const find = (ref: { providerID: string; id: string }) =>
    models?.find((item) => item.providerID === ref.providerID && item.id === ref.id)
  const info = find(model)
  if (info === undefined) return t("main.model.switched", { model: formatRef(model) })
  // A model's faster and slower speeds are models of their own ("gpt-5.5-fast"), so moving between them is a
  // change of speed.
  const before = previous?.providerID === model.providerID ? find(previous) : undefined
  if (before && (before.experimental?.speed?.base ?? before.id) === (info.experimental?.speed?.base ?? info.id))
    return t("main.model.switchedSpeed", { speed: info.experimental?.speed?.id ?? t("main.model.standardSpeed") })
  const variant = model.variant && model.variant !== "default" ? ` (${model.variant})` : ""
  return t("main.model.switched", { model: `${info.name}${variant}` })
}
