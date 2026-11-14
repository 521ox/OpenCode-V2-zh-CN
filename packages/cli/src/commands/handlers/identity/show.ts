// WP-5 / W5-c · identity show —— 打印当前 AIB 绑定卡（fail-closed：无卡/坏卡给出明确错误码）。
import { EOL } from "os"
import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { defaultCardPath, loadCard } from "./shared"

export default Runtime.handler(
  Commands.commands.identity.commands.show,
  Effect.fn("cli.identity.show")(function* () {
    const res = loadCard(defaultCardPath())
    if (!res.ok) {
      process.stdout.write(res.error + "\n")
      return
    }
    process.stdout.write(JSON.stringify(res.card, null, 2) + EOL)
  }),
)
