import { createContext, type Accessor, type JSX, useContext } from "solid-js"
import { useConfig } from "../config"
import { translate, type Key, type Locale, type Translator } from "../i18n"

type Value = {
  readonly locale: Accessor<Locale>
  readonly t: Translator<Key>
  readonly setLocale: (locale: Locale) => Promise<void>
}

const I18nContext = createContext<Value>()

export function I18nProvider(props: { children: JSX.Element }) {
  const config = useConfig()
  const locale = () => config.data.locale
  const value: Value = {
    locale,
    t: (key, params) => translate(locale(), key, params),
    setLocale: async (locale) => {
      await config.update((draft) => {
        draft.locale = locale
      })
    },
  }
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error("I18nProvider is missing")
  return value
}
