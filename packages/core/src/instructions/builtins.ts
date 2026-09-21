export * as InstructionBuiltIns from "./builtins.js"

import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import type { Session } from "@opencode/schema/session"
import { Global } from "@opencode/util/global"
import { Location } from "../location.js"
import { Instructions } from "./index.js"

export interface Interface {
  readonly load: (sessionID: Session.ID) => Effect.Effect<Instructions.List>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/InstructionBuiltIns") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const global = yield* Global.Service
    const location = yield* Location.Service
    return Service.of({
      load: (sessionID) =>
        Effect.succeed(
          Instructions.combine([
            Instructions.make({
              key: Instructions.Key.make("core/environment"),
              codec: Schema.toCodecJson(Schema.String),
              read: Effect.sync(() =>
                [
                  "<env>",
                  `  Current conversation session ID: ${sessionID}`,
                  `  Working directory: ${location.directory}`,
                  `  Workspace root folder: ${location.project.directory}`,
                  `  Is directory a git repo: ${location.vcs?.type === "git" ? "yes" : "no"}`,
                  `  Platform: ${process.platform}`,
                  `  Prefer ${global.tmp} over generic system temporary directories such as /tmp; it is pre-created and approved for external access.`,
                  "  Create only temporary artifacts needed for the task. When verification or the task ends, remove your own task-created temporary scripts, test data, private environments, redundant caches, and intermediate builds that are no longer needed, within existing permissions.",
                  "  Put deliverables in the agreed location. Retain only the minimal still-needed failure or recovery evidence, and report retained temporary paths and why they are needed.",
                  "  Never delete the whole temporary root, other people's or user files, shared caches, or anything still used by background processes. If ownership or activity is uncertain, do not delete; report the paths and uncertainty.",
                  "</env>",
                ].join("\n"),
              ),
              render: {
                initial: (environment) =>
                  ["Here is some useful information about the environment you are running in:", environment].join("\n"),
                changed: (_previous, environment) =>
                  ["The environment you are running in is now:", environment].join("\n"),
              },
            }),
            Instructions.make({
              key: Instructions.Key.make("core/date"),
              codec: Schema.toCodecJson(Schema.String),
              read: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
              render: {
                initial: (date) => `Today's date: ${date}`,
                changed: (_previous, date) => `Today's date is now: ${date}`,
              },
            }),
          ]),
        ),
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Global.node, Location.node] })
