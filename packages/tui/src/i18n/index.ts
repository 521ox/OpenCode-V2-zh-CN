import en from "./en"
import zh from "./zh"
import { createTranslator } from "./translator"

export { DEFAULT_LOCALE, resolveLocale, type Locale } from "./locale"
export type { Key } from "./en"
export type { Params, Translator } from "./translator"

export const translate = createTranslator({ en, zh })
