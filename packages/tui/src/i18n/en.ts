import main from "./main/en"
import session from "./session/en"
import feature from "./feature/en"
import miniCli from "./miniCli/en"

export const dict = {
  ...main,
  ...session,
  ...feature,
  ...miniCli,
  "language.title": "Language",
  "language.en": "English",
  "language.zh": "Simplified Chinese",
}

export type Key = keyof typeof dict

export default dict
