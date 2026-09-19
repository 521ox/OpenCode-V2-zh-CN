import { createInstance } from "i18next"
import Mustache from "mustache"
import { DEFAULT_LOCALE, type Locale } from "./locale"

export type Params = Readonly<Record<string, string | number>>
export type Translator<Key extends string = string> = (key: Key, params?: Params) => string

// i18next owns lookup/fallback; Mustache renders parsed tokens without searching
// inserted values. i18next's string-replacement interpolator can match a later
// placeholder inside an earlier value even with skipOnVariables enabled.
export function createTranslator<Key extends string>(resources: {
  en: Record<Key, string>
  zh: Partial<Record<Key, string>>
}): (locale: Locale, key: Key, params?: Params) => string {
  const instance = createInstance()
  const writer = new Mustache.Writer()
  void instance.init({
    initAsync: false,
    lng: DEFAULT_LOCALE,
    fallbackLng: "en",
    supportedLngs: ["en", "zh"],
    resources: {
      en: { translation: resources.en },
      zh: { translation: resources.zh },
    },
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    returnEmptyString: false,
  })
  return (locale, key, params) =>
    writer.render(instance.t(key, { lng: locale, skipInterpolation: true }), new TranslationParams(params), undefined, {
      tags: ["{{", "}}"],
      escape: String,
    })
}

// Mustache normally drops missing variables and supports inherited/dotted view
// lookup. Our flat Params contract instead keeps missing names visible. Parsing,
// interpolation and literal value emission remain entirely library-owned.
class TranslationParams extends Mustache.Context {
  constructor(private readonly params: Params = {}) {
    super(params)
  }

  override lookup(name: string): string | number {
    return Object.hasOwn(this.params, name) ? this.params[name]! : `{{${name}}}`
  }
}
