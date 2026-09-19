import { expect, test } from "bun:test"
import type { Route } from "@opencode/plugin/tui/context"
import { createPluginContext, type Registry, type usePluginHost } from "../src/plugin/api"
import { translate, type Locale } from "../src/i18n"

type Host = ReturnType<typeof usePluginHost>
type Shown = Parameters<Host["toast"]["show"]>[0]

const sessions: Record<string, { id: string; title?: string; parentID?: string }> = {
  parent: { id: "parent", title: "Parent session" },
  child: { id: "child", title: "Child session", parentID: "parent" },
  other: { id: "other", title: "Other session" },
}

const root = (sessionID: string): string => {
  const parentID = sessions[sessionID]?.parentID
  return parentID ? root(parentID) : sessionID
}

function setup(route: Route, locale: () => Locale = () => "en") {
  const shown: Shown[] = []
  const navigated: Route[] = []
  const host = {
    app: { version: "test", channel: "test" },
    client: { api: {} },
    keymap: {},
    shortcuts: {},
    keymapState: {},
    sessionTabs: {},
    i18n: { t: ((key, params) => translate(locale(), key, params)) satisfies Host["i18n"]["t"] },
    toast: { show: (toast: Shown) => shown.push(toast) },
    route: {
      get data() {
        return route
      },
      navigate: (destination: Route) => navigated.push(destination),
    },
    data: { session: { root, get: (sessionID: string) => sessions[sessionID] } },
  } as unknown as Host
  const registry: Registry = { has: () => false, set() {}, remove() {}, active: () => true }
  const context = createPluginContext({ host, id: "test", options: undefined, owned: [], registry })
  return { shown, navigated, toast: context.ui.toast }
}

test.each([
  ["parent", "parent"],
  ["parent", "child"],
  ["child", "parent"],
])("toast for %s's family shows as-is while %s is open", (target, routed) => {
  const harness = setup({ type: "session", sessionID: routed })
  harness.toast.show({ sessionID: target, message: "done" })
  expect(harness.shown).toEqual([{ title: undefined, message: "done", variant: "info", duration: undefined }])
})

test.each<Route>([{ type: "home" }, { type: "session", sessionID: "parent" }])(
  "toast for a session that is not open gains its title and an Open action (%j)",
  (route) => {
    const harness = setup(route)
    harness.toast.show({ sessionID: "other", message: "done" })
    expect(harness.shown[0]).toMatchObject({ title: "Other session", action: { label: "Open" } })
    harness.shown[0].action?.run()
    expect(harness.navigated).toEqual([{ type: "session", sessionID: "other" }])
  },
)

test("session toast actions read the current locale and preserve caller content", () => {
  let locale: Locale = "zh"
  const harness = setup({ type: "home" }, () => locale)
  const options = {
    sessionID: "other",
    title: "Raw {{title}}",
    message: "Raw $& {{message}}",
    duration: 1234,
    variant: "error" as const,
  }
  harness.toast.show(options)
  expect(harness.shown[0]).toMatchObject({
    title: options.title,
    message: options.message,
    duration: 1234,
    variant: "error",
    action: { label: "打开" },
  })
  locale = "en"
  harness.toast.show(options)
  expect(harness.shown[1].action?.label).toBe("Open")
  harness.shown[0].action?.run()
  expect(harness.navigated).toEqual([{ type: "session", sessionID: "other" }])
})

test("unscoped toasts retain their content without session navigation", () => {
  const harness = setup({ type: "home" })
  harness.toast.show({ message: "Raw {{message}}", variant: "success", duration: 1234 })
  expect(harness.shown).toEqual([{ title: undefined, message: "Raw {{message}}", variant: "success", duration: 1234 }])
  expect(harness.navigated).toEqual([])
})
