import { Schema } from "effect"
import { SessionSchema } from "../session/schema.js"

export const RecoverySchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("shell"),
    sessionID: SessionSchema.ID,
    shellID: Schema.String,
    command: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("subagent"),
    parentSessionID: SessionSchema.ID,
    childSessionID: SessionSchema.ID,
    agent: Schema.String,
    description: Schema.String,
    // W-12/W-5c · M-B3：AIB 绑定锚（与 agent_uid/parent_agent_uid 并列，非替代）。
    // 仅当 OLO_AIB_CARD_PATH 配置时由 subagent.ts 填充 active 卡 binding_id；缺省 undefined（向后兼容序列化）。
    binding: Schema.optionalKey(
      Schema.Struct({ childID: Schema.String, parentID: Schema.String }),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("image"),
    sessionID: SessionSchema.ID,
    path: Schema.String,
    model: Schema.String,
  }),
])

export type Recovery = typeof RecoverySchema.Type
