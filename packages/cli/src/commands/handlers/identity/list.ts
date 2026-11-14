// WP-5 / W5-c · identity list —— 列出清册中已知绑定卡（fail-closed：清册缺失给出 OLO_REGISTRY_DRIFT）。
import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { defaultRegistryPath, readEnrolledAgents } from "./shared"

export default Runtime.handler(
  Commands.commands.identity.commands.list,
  Effect.fn("cli.identity.list")(function* () {
    const registryPath = defaultRegistryPath()
    const enrolled = readEnrolledAgents(registryPath)
    if (enrolled.length === 0) {
      process.stdout.write(`OLO_REGISTRY_DRIFT: no enrolled agents found at ${registryPath}\n`)
      return
    }
    process.stdout.write(`registry: ${registryPath}\n`)
    for (const e of enrolled) {
      process.stdout.write(`- agent_id=${e.agent_id} permission_domain=${e.permission_domain}\n`)
    }
  }),
)
