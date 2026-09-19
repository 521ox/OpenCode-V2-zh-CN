import { expect, spyOn, test } from "bun:test"
import { OpenCode, type EventSubscribeOutput } from "@opencode/client/promise"
import { runNonInteractivePrompt } from "../src/run/noninteractive"

const raw = "RAW --flag provider/model {{text}} $& 中文"
const blockedFetch: typeof fetch = Object.assign(
  async () => {
    throw new Error("Unexpected network call")
  },
  {
    preconnect: () => {
      throw new Error("Unexpected network preconnect")
    },
  },
)

test("stream fixture rejects fetch and preconnect without using the network", async () => {
  await expect(blockedFetch("https://unused.invalid")).rejects.toThrow("Unexpected network call")
  expect(() => blockedFetch.preconnect("https://unused.invalid")).toThrow("Unexpected network preconnect")
})

for (const locale of ["zh", "en"] as const) {
  for (const format of ["default", "json"] as const) {
    test(`${locale}/${format} run stream retains model text and wire values`, async () => {
      const admitted = Promise.withResolvers<string>()
      const sdk = OpenCode.make({
        baseUrl: "https://unused.invalid",
        fetch: blockedFetch,
      })
      const output: string[] = []
      const errors: string[] = []
      const previous = process.exitCode
      const spies = [
        spyOn(process.stdout, "write").mockImplementation((chunk) => {
          output.push(String(chunk))
          return true
        }),
        spyOn(process.stderr, "write").mockImplementation((chunk) => {
          errors.push(String(chunk))
          return true
        }),
        spyOn(sdk.session, "prompt").mockImplementation(async (request) => {
          admitted.resolve(request.id!)
          return {
            id: request.id!,
            sessionID: "ses_RAW",
            time: { created: 1 },
            type: "user",
            payload: { text: request.text },
            delivery: "steer",
          }
        }),
        spyOn(sdk.permission, "list").mockResolvedValue([]),
        spyOn(sdk.session.form, "list").mockResolvedValue([]),
        spyOn(sdk.event, "subscribe").mockImplementation(() =>
          (async function* (): AsyncGenerator<EventSubscribeOutput> {
            yield { id: "evt_connected", type: "server.connected", data: {} }
            const inboxID = await admitted.promise
            yield {
              id: "evt_delivered",
              created: 1,
              durable: { aggregateID: "ses_RAW", seq: 1, version: 1 },
              type: "session.inbox.delivered",
              data: { sessionID: "ses_RAW", inboxID },
            }
            yield {
              id: "evt_text",
              created: 2,
              durable: { aggregateID: "ses_RAW", seq: 2, version: 1 },
              type: "session.text.ended",
              data: { sessionID: "ses_RAW", assistantMessageID: "msg_RAW", ordinal: 0, text: raw },
            }
            yield {
              id: "evt_reason",
              created: 3,
              durable: { aggregateID: "ses_RAW", seq: 3, version: 1 },
              type: "session.reasoning.ended",
              data: { sessionID: "ses_RAW", assistantMessageID: "msg_RAW", ordinal: 0, text: raw },
            }
            yield {
              id: "evt_failed",
              created: 4,
              durable: { aggregateID: "ses_RAW", seq: 4, version: 1 },
              type: "session.execution.failed",
              data: { sessionID: "ses_RAW", error: { type: "unknown", message: raw } },
            }
          })(),
        ),
      ]
      try {
        await runNonInteractivePrompt({
          client: sdk,
          locale,
          format,
          sessionID: "ses_RAW",
          location: { directory: "/unused" },
          message: raw,
          files: [],
          thinking: true,
          auto: false,
          attached: true,
          compatibility: "v1",
          renderTool: async () => {
            throw new Error("Unexpected tool")
          },
          renderToolError: async () => {
            throw new Error("Unexpected tool")
          },
        })
        if (format === "json") {
          const events = output
            .join("")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
          expect(events.map((event) => event.type)).toEqual(["text", "reasoning", "error"])
          expect(events[0].part.text).toBe(raw)
          expect(events[1].part.text).toBe(raw)
          expect(events[2].error).toEqual({ type: "unknown", message: raw })
          expect(errors.join("")).toBe("")
        } else {
          const all = output.join("") + errors.join("")
          expect(all).toContain(raw)
          expect(all).toContain((locale === "zh" ? "思考：" : "Thinking: ") + raw)
          expect(all).toContain(locale === "zh" ? "错误：" : "Error: ")
        }
      } finally {
        spies.forEach((spy) => spy.mockRestore())
        process.exitCode = previous ?? 0
      }
    })
  }
}
