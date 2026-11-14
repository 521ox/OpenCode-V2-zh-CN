// WP-5 / W5-c · identity verify —— 校验卡完整性 + 清册入册态（fail-closed）。
import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { defaultCardPath, defaultRegistryPath, loadCard, readEnrolledAgents } from "./shared"

export default Runtime.handler(
  Commands.commands.identity.commands.verify,
  Effect.fn("cli.identity.verify")(function* () {
    const res = loadCard(defaultCardPath())
    if (!res.ok) {
      process.stdout.write(res.error + "\n")
      return
    }
    const card = res.card as Record<string, unknown>
    const agentId = card.agent_id
    const domain = card.permission_domain
    if (typeof agentId !== "string" || typeof domain !== "string") {
      process.stdout.write("OLO_CARD_INVALID: card missing agent_id/permission_domain\n")
      return
    }
    const registryPath = defaultRegistryPath()
    const enrolled = readEnrolledAgents(registryPath)
    const ok = enrolled.some((e) => e.agent_id === agentId && e.permission_domain === domain)
    const spiffe =
      card.spiffe_id === null || card.spiffe_id === undefined ? "null" : String(card.spiffe_id)
    process.stdout.write(
      `binding_id: ${String(card.binding_id ?? "<none>")}\n` +
        `spiffe_id: ${spiffe}\n` +
        `status: ${String(card.status ?? "<none>")}\n` +
        `registry: ${registryPath}\n` +
        `enrolled: ${ok ? "YES" : "NO (OLO_AGENT_NOT_REGISTERED)"}\n`,
    )
  }),
)
