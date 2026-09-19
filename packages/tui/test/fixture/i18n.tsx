/** @jsxImportSource @opentui/solid */
import type { ParentProps } from "solid-js"
import { ConfigProvider } from "../../src/config"
import { I18nProvider } from "../../src/context/i18n"
import { createTuiResolvedConfig } from "./tui-runtime"

// For leaf tests without a ConfigProvider. Configured harnesses should put
// I18nProvider inside their own ConfigProvider instead of nesting this fixture.
export function TestI18n(props: ParentProps) {
  return (
    <ConfigProvider config={createTuiResolvedConfig({ locale: "en" })}>
      <I18nProvider>{props.children}</I18nProvider>
    </ConfigProvider>
  )
}
