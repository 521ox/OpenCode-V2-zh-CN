import { describe, expect } from "bun:test"
import os from "os"
import { Effect, Layer } from "effect"
import { TestClock } from "effect/testing"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Location } from "@opencode/core/location"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { AbsolutePath } from "@opencode/core/schema"
import { InstructionBuiltIns } from "@opencode/core/instructions/builtins"
import { SessionSchema } from "@opencode/core/session/schema"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"
import { readInitial, readUpdate, state } from "../lib/instructions"

const directory = AbsolutePath.make(FSUtil.resolve("/repo/packages/core"))
const projectDirectory = AbsolutePath.make(FSUtil.resolve("/repo"))
const timestamp = Date.parse("2026-06-03T12:00:00.000Z")
const sessionID = SessionSchema.ID.make("ses_builtin_test")
const temporary = os.tmpdir()
const localDate = (time: number) => new Date(time).toDateString()
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(
    location(
      { directory },
      { projectDirectory, vcs: { type: "git", store: AbsolutePath.make(FSUtil.resolve("/repo/.git")) } },
    ),
  ),
)
const it = testEffect(
  AppNodeBuilder.build(InstructionBuiltIns.node, [
    Location.node.replace(locationLayer),
    Global.node.replace(Global.layerWith({ config: temporary, tmp: temporary })),
  ]),
)

describe("InstructionBuiltIns", () => {
  it.effect("loads location-scoped environment and host-local date instructions", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(timestamp)
      const context = yield* InstructionBuiltIns.Service
      const initialized = yield* readInitial(yield* context.load(sessionID))

      expect(initialized.text).toBe(
        [
          "Here is some useful information about the environment you are running in:",
          "<env>",
          `  Current conversation session ID: ${sessionID}`,
          `  Working directory: ${directory}`,
          `  Workspace root folder: ${projectDirectory}`,
          "  Is directory a git repo: yes",
          `  Platform: ${process.platform}`,
          `  Prefer ${temporary} over generic system temporary directories such as /tmp; it is pre-created and approved for external access.`,
          "  Create only temporary artifacts needed for the task. When verification or the task ends, remove your own task-created temporary scripts, test data, private environments, redundant caches, and intermediate builds that are no longer needed, within existing permissions.",
          "  Put deliverables in the agreed location. Retain only the minimal still-needed failure or recovery evidence, and report retained temporary paths and why they are needed.",
          "  Never delete the whole temporary root, other people's or user files, shared caches, or anything still used by background processes. If ownership or activity is uncertain, do not delete; report the paths and uncertainty.",
          "</env>",
          "",
          `Today's date: ${localDate(timestamp)}`,
        ].join("\n"),
      )
    }),
  )

  it.effect("renders cleanup guidance in changed environments once without rewriting the prior value", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(timestamp)
      const context = yield* InstructionBuiltIns.Service
      const instructions = yield* context.load(sessionID)
      const previous = state({
        "core/environment": "<env>\n  Working directory: /previous\n</env>",
        "core/date": localDate(timestamp),
      })
      const refreshed = yield* readUpdate(instructions, previous)
      const initialized = yield* readInitial(instructions)

      expect(refreshed.changed).toBe(true)
      expect(refreshed.text).toBe(
        `The environment you are running in is now:\n${initialized.values["core/environment"]}`,
      )
      expect(refreshed.text.split("Create only temporary artifacts needed for the task.")).toHaveLength(2)
      expect(refreshed.values).toEqual(initialized.values)
      expect(previous.values["core/environment"]).toBe("<env>\n  Working directory: /previous\n</env>")
      const repeated = yield* readUpdate(yield* context.load(sessionID), refreshed)
      expect(repeated.changed).toBe(false)
      expect(repeated.text).toBe("")
    }),
  )

  it.effect("updates the date without repeating unchanged environment instructions", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(timestamp)
      const context = yield* InstructionBuiltIns.Service
      const initialized = yield* readInitial(yield* context.load(sessionID))

      yield* TestClock.setTime(timestamp + 24 * 60 * 60 * 1000)
      const refreshed = yield* readUpdate(yield* context.load(sessionID), initialized)

      expect(refreshed.text).toBe(`Today's date is now: ${localDate(timestamp + 24 * 60 * 60 * 1000)}`)
    }),
  )

  it.effect("does not update again within the same local calendar day", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(timestamp)
      const context = yield* InstructionBuiltIns.Service
      const initialized = yield* readInitial(yield* context.load(sessionID))

      yield* TestClock.setTime(timestamp + 60 * 60 * 1000)
      expect((yield* readUpdate(yield* context.load(sessionID), initialized)).changed).toBe(false)
    }),
  )
})
