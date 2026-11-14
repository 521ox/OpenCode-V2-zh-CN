export * as SubagentCompletion from "./subagent-completion.js"

import { Effect } from "effect"
import type { Job } from "../job.js"
import type { Session } from "../session.js"
import type { SessionMessage } from "./message.js"

export const NO_TEXT = "Subagent completed without a text response."

export function text(message: SessionMessage.Info | undefined) {
  if (message?.type !== "assistant") return NO_TEXT
  return (
    message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .filter((text) => text.length > 0)
      .join("\n\n") || NO_TEXT
  )
}

export const deliver = Effect.fnUntraced(function* (
  sessions: Pick<Session.Interface, "synthetic">,
  jobs: Pick<Job.Interface, "completeBackground">,
  input: Pick<Job.Info, "status" | "output" | "error" | "notificationID"> & {
    recovery: Extract<Job.Recovery, { kind: "subagent" }>
    resume?: boolean
  },
) {
  if (input.status === "running") return
  const recovery = input.recovery
  const text =
    input.status === "completed"
      ? (input.output ?? NO_TEXT)
      : input.status === "error"
        ? (input.error ?? "Subagent failed")
        : "Subagent cancelled"
  yield* sessions.synthetic({
    ...(input.notificationID ? { id: input.notificationID } : {}),
    sessionID: recovery.parentSessionID,
    ...(input.resume === false ? { resume: false } : {}),
    description: recovery.description,
    text: `<subagent sessionID="${recovery.childSessionID}" state="${input.status}" description="${recovery.description}">\n${text}\n</subagent>`,
    // W-12 · M-B3：委派 metadata 新增两可空身份字段（T13：四字段 + 两可空；真实 UID 填充为下游步骤）
    metadata: {
      source: "subagent",
      childID: recovery.childSessionID,
      agent: recovery.agent,
      state: input.status,
      // W-12 · M-B3：委派链身份字段（T13：四字段 + 两可空 agent_uid/parent_agent_uid）。
      agent_uid: null as string | null,
      parent_agent_uid: null as string | null,
      // W-5c · M-B3：AIB 绑定锚（与 agent_uid 并列，非替代；T13 阶段 2 绑定判据）。
      childBindingID: recovery.binding?.childID ?? null,
      parentBindingID: recovery.binding?.parentID ?? null,
    },
  })
  if (input.notificationID) yield* jobs.completeBackground(input.notificationID)
})
