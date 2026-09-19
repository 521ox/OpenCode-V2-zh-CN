import type { Key } from "./en"
import main from "./main/zh"
import session from "./session/zh"
import feature from "./feature/zh"
import miniCli from "./miniCli/zh"

export const dict = {
  ...main,
  ...session,
  ...feature,
  ...miniCli,
  "language.title": "语言",
  "language.en": "英语",
  "language.zh": "简体中文",
} satisfies Record<Key, string>

export default dict
