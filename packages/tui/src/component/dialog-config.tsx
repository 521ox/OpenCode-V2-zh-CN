import { createMemo, createSignal } from "solid-js"
import { useConfig } from "../config"
import { useThemes } from "../context/theme"
import { DialogSelect } from "../ui/dialog-select"
import { useToast } from "../ui/toast"
import { useI18n } from "../context/i18n"
import { type Key, type Translator } from "../i18n"

type Setting = {
  title: string
  category: string
  path: string[]
  default: unknown
  values?: readonly unknown[]
  labels?: readonly string[]
  step?: number
  min?: number
  max?: number
  format?: (value: unknown) => string
  keywords?: readonly string[]
}

export const settings: Setting[] = [
  {
    title: "Language",
    category: "Appearance",
    path: ["locale"],
    default: "zh",
    values: ["zh", "en"],
    keywords: ["language", "locale", "中文", "English"],
  },
  {
    title: "Theme",
    category: "Appearance",
    path: ["theme", "name"],
    default: "opencode",
    keywords: ["color scheme", "colors"],
  },
  {
    title: "Color mode",
    category: "Appearance",
    path: ["theme", "mode"],
    default: "system",
    values: ["system", "dark", "light"],
    keywords: ["dark mode", "light mode", "system theme"],
  },
  {
    title: "Animations",
    category: "Appearance",
    path: ["animations"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["motion", "effects"],
  },
  {
    title: "Sidebar",
    category: "Session",
    path: ["session", "sidebar"],
    default: "auto",
    values: ["hide", "auto"],
    keywords: ["side panel"],
  },
  {
    title: "Scrollbar",
    category: "Session",
    path: ["session", "scrollbar"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["scroll bar"],
  },
  {
    title: "Thinking",
    category: "Session",
    path: ["session", "thinking"],
    default: "hide",
    values: ["hide", "show"],
    keywords: ["reasoning", "chain of thought"],
  },
  {
    title: "Markdown",
    category: "Session",
    path: ["session", "markdown"],
    default: "rendered",
    values: ["source", "rendered"],
    keywords: ["syntax", "concealment", "rendering"],
  },
  {
    title: "Tool grouping",
    category: "Session",
    path: ["session", "grouping"],
    default: "auto",
    values: ["none", "auto"],
    keywords: ["transcript", "messages", "reads", "searches"],
  },
  {
    title: "Transcript images",
    category: "Session",
    path: ["session", "image_preview"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["attachments", "images", "tool output"],
  },
  {
    title: "TPS",
    category: "Session",
    path: ["session", "tps"],
    default: true,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["tokens per second", "throughput"],
  },
  {
    title: "New session location",
    category: "Session",
    path: ["session", "new_location"],
    default: "launch",
    values: ["launch", "inherit"],
    labels: ["launch directory", "active session"],
    keywords: ["directory", "cwd", "inherit"],
  },
  {
    title: "Permissions",
    category: "Session",
    path: ["session", "permissions"],
    default: "prompt",
    values: ["prompt", "autoaccept"],
    labels: ["prompt", "auto accept"],
    keywords: ["approve", "accept", "permission requests"],
  },
  {
    title: "Mode",
    category: "Tabs",
    path: ["tabs", "mode"],
    default: "auto",
    values: ["off", "on", "auto"],
  },
  {
    title: "Scope",
    category: "Tabs",
    path: ["tabs", "scope"],
    default: "cwd",
    values: ["cwd", "global"],
    labels: ["current directory", "global"],
  },
  {
    title: "Layout",
    category: "Tabs",
    path: ["tabs", "layout"],
    default: "horizontal",
    values: ["horizontal", "vertical"],
    keywords: ["sidebar", "orientation", "left"],
  },
  {
    title: "Indicators",
    category: "Tabs",
    path: ["tabs", "indicators"],
    default: "status",
    values: ["status", "numbers"],
    labels: ["status icons", "always show numbers"],
    keywords: ["tab numbers", "number mode", "status icons"],
  },
  {
    title: "Layout",
    category: "Diffs",
    path: ["diffs", "view"],
    default: "auto",
    values: ["auto", "split", "unified"],
    keywords: ["diff layout", "split diff", "unified diff"],
  },
  {
    title: "Wrapping",
    category: "Diffs",
    path: ["diffs", "wrap"],
    default: "word",
    values: ["none", "word"],
    keywords: ["diff wrap", "word wrap", "line wrap"],
  },
  {
    title: "File tree",
    category: "Diffs",
    path: ["diffs", "tree"],
    default: true,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["diff files"],
  },
  {
    title: "Single patch",
    category: "Diffs",
    path: ["diffs", "single"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["one file", "selected file"],
  },
  {
    title: "Scroll speed",
    category: "Input",
    path: ["scroll", "speed"],
    default: 3,
    step: 0.25,
    min: 0.25,
    max: 10,
    format: (value) => Number(value).toFixed(2),
    keywords: ["scrolling"],
  },
  {
    title: "Acceleration",
    category: "Input",
    path: ["scroll", "acceleration"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["scroll acceleration"],
  },
  {
    title: "Mouse",
    category: "Input",
    path: ["mouse"],
    default: true,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["mouse capture"],
  },
  {
    title: "Editor context",
    category: "Input",
    path: ["prompt", "editor"],
    default: true,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["file context", "prompt context", "editor selection"],
  },
  {
    title: "Large pastes",
    category: "Input",
    path: ["prompt", "paste"],
    default: "compact",
    values: ["compact", "full"],
    keywords: ["paste summary", "clipboard", "pasted content"],
  },
  {
    title: "Image previews",
    category: "Input",
    path: ["prompt", "image_preview"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["attachments", "clipboard", "images", "prompt"],
  },
  {
    title: "Leader timeout",
    category: "Input",
    path: ["leader", "timeout"],
    default: 2000,
    step: 250,
    min: 250,
    max: 10000,
    format: (value) => `${value} ms`,
    keywords: ["leader key", "shortcut timeout"],
  },
  {
    title: "Notifications",
    category: "Alerts",
    path: ["attention", "notifications"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["system notifications", "desktop notifications", "alerts"],
  },
  {
    title: "Sounds",
    category: "Alerts",
    path: ["attention", "sound"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["audio", "sound effects", "alerts"],
  },
  {
    title: "Volume",
    category: "Alerts",
    path: ["attention", "volume"],
    default: 0.4,
    step: 0.1,
    min: 0,
    max: 1,
    format: (value) => `${Math.round(Number(value) * 100)}%`,
    keywords: ["sound volume", "audio volume"],
  },
  {
    title: "Window title",
    category: "Terminal",
    path: ["terminal", "title"],
    default: true,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["terminal title", "tab title"],
  },
  {
    title: "Copy behavior",
    category: "Terminal",
    path: ["terminal", "copy"],
    default: process.platform === "win32" ? "manual" : "select",
    values: ["manual", "select"],
    keywords: ["selection", "clipboard"],
  },
  {
    title: "Developer tools",
    category: "Debug",
    path: ["debug", "devtools"],
    default: false,
    values: [false, true],
    labels: ["off", "on"],
    keywords: ["debug bar", "developer tools"],
  },
]

export function settingID(setting: Setting) {
  return setting.path.join(".")
}

const titles: Record<string, Key> = {
  locale: "language.title",
  "theme.name": "main.setting.theme",
  "theme.mode": "main.setting.colorMode",
  animations: "main.setting.animations",
  "session.sidebar": "main.setting.sidebar",
  "session.scrollbar": "main.setting.scrollbar",
  "session.thinking": "main.setting.thinking",
  "session.markdown": "main.setting.markdown",
  "session.grouping": "main.setting.grouping",
  "session.image_preview": "main.setting.transcriptImages",
  "session.tps": "main.setting.tps",
  "session.new_location": "main.setting.newLocation",
  "session.permissions": "main.setting.permissions",
  "tabs.mode": "main.setting.tabsMode",
  "tabs.scope": "main.setting.scope",
  "tabs.layout": "main.setting.layout",
  "tabs.indicators": "main.setting.indicators",
  "diffs.view": "main.setting.layout",
  "diffs.wrap": "main.setting.wrapping",
  "diffs.tree": "main.setting.fileTree",
  "diffs.single": "main.setting.singlePatch",
  "scroll.speed": "main.setting.scrollSpeed",
  "scroll.acceleration": "main.setting.acceleration",
  mouse: "main.setting.mouse",
  "prompt.editor": "main.setting.editorContext",
  "prompt.paste": "main.setting.largePastes",
  "prompt.image_preview": "main.setting.imagePreviews",
  "leader.timeout": "main.setting.leaderTimeout",
  "attention.notifications": "main.setting.notifications",
  "attention.sound": "main.setting.sounds",
  "attention.volume": "main.setting.volume",
  "terminal.title": "main.setting.windowTitle",
  "terminal.copy": "main.setting.copyBehavior",
  "debug.devtools": "main.setting.devtools",
}

const categories: Record<string, Key> = {
  Appearance: "main.group.appearance",
  Session: "main.group.session",
  Tabs: "main.group.tabs",
  Diffs: "main.group.diffs",
  Input: "main.group.input",
  Alerts: "main.group.alerts",
  Terminal: "main.group.terminal",
  Debug: "main.group.debug",
}

const labels: Record<string, Key> = {
  off: "main.value.off",
  on: "main.value.on",
  system: "main.value.system",
  dark: "main.value.dark",
  light: "main.value.light",
  hide: "main.value.hide",
  auto: "main.value.auto",
  show: "main.value.show",
  source: "main.value.source",
  rendered: "main.value.rendered",
  none: "main.value.none",
  "launch directory": "main.value.launch",
  "active session": "main.value.active",
  prompt: "main.value.prompt",
  "auto accept": "main.value.autoaccept",
  "current directory": "main.value.cwd",
  global: "main.value.global",
  horizontal: "main.value.horizontal",
  vertical: "main.value.vertical",
  "status icons": "main.value.status",
  "always show numbers": "main.value.numbers",
  split: "main.value.split",
  unified: "main.value.unified",
  word: "main.value.word",
  compact: "main.value.compact",
  full: "main.value.full",
  manual: "main.value.manual",
  select: "main.value.select",
  zh: "language.zh",
  en: "language.en",
}

export function settingTitle(setting: Setting, t: Translator<Key>) {
  return titles[settingID(setting)] ? t(titles[settingID(setting)]) : setting.title
}

export function settingCategory(setting: Setting, t: Translator<Key>) {
  return categories[setting.category] ? t(categories[setting.category]) : setting.category
}

export function DialogConfig(props: { current?: string }) {
  const { t, setLocale } = useI18n()
  const config = useConfig()
  const toast = useToast()
  const themes = useThemes()
  const current = Math.max(
    0,
    settings.findIndex((setting) => settingID(setting) === props.current),
  )
  const [selected, setSelected] = createSignal(current)
  const [saving, setSaving] = createSignal(false)

  const value = (setting: Setting) => {
    const current = setting.path.reduce<unknown>((result, key) => {
      if (!result || typeof result !== "object") return undefined
      return (result as Record<string, unknown>)[key]
    }, config.data)
    if (setting.path.join(".") === "theme.name") return current ?? themes.selected
    return current ?? setting.default
  }
  const values = (setting: Setting) =>
    setting.path.join(".") === "theme.name"
      ? Object.keys(themes.all()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      : setting.values
  const display = (setting: Setting) => {
    const current = value(setting)
    if (setting.format) return setting.format(current)
    const index = setting.values?.indexOf(current)
    const label = index === undefined || index < 0 ? String(current) : (setting.labels?.[index] ?? String(current))
    if (settingID(setting) === "theme.name") return label
    return labels[label] ? t(labels[label]) : label
  }
  const options = createMemo(() =>
    settings.map((setting, index) => ({
      title: settingTitle(setting, t),
      category: settingCategory(setting, t),
      searchText: setting.keywords?.join(" "),
      footer: display(setting),
      value: index,
    })),
  )

  async function change(direction: number, index = selected()) {
    if (saving()) return
    const setting = settings[index]
    const current = value(setting)
    const choices = values(setting)
    const next = choices
      ? choices[(choices.indexOf(current) + direction + choices.length) % choices.length]
      : Math.min(setting.max!, Math.max(setting.min!, Number(current) + direction * setting.step!))
    if (next === current) return
    setSaving(true)
    if (settingID(setting) === "locale" && (next === "en" || next === "zh")) {
      await setLocale(next)
        .catch(toast.error)
        .finally(() => setSaving(false))
      return
    }
    await config
      .update((draft) => {
        const parent = setting.path.slice(0, -1).reduce<Record<string, unknown>>((result, key) => {
          if (!result[key] || typeof result[key] !== "object") result[key] = {}
          return result[key] as Record<string, unknown>
        }, draft)
        parent[setting.path.at(-1)!] = next
      })
      .catch(toast.error)
      .finally(() => setSaving(false))
  }

  return (
    <DialogSelect
      title={t("main.settings")}
      options={options()}
      current={current}
      filterThreshold={0.7}
      onMove={(option) => setSelected(option.value)}
      onSelect={(option) => void change(1, option.value)}
      footerHints={[{ title: "←/→", label: t("main.change") }]}
      bindings={[
        {
          bind: "left",
          title: t("main.value.previous"),
          group: t("main.settings"),
          run: () => void change(-1),
        },
        {
          bind: "right",
          title: t("main.value.next"),
          group: t("main.settings"),
          run: () => void change(1),
        },
      ]}
    />
  )
}
