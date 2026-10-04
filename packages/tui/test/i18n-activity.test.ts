import { expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageAssistantTool } from "@opencode/client"
import { translate, type Key, type Translator } from "../src/i18n"
import { activitySummary, busyLabel, summarizeActivity } from "../src/routes/session/activity-summary"
import { reduceSessionRows } from "../src/routes/session/rows"

const t: Translator<Key> = (key, params) => translate("zh", key, params)
const message: SessionMessageAssistant = {
  type: "assistant",
  id: "assistant-literal",
  agent: "build",
  model: { id: "model-literal", providerID: "provider-literal" },
  time: { created: 1, completed: 2 },
  content: [],
}

const tool = (name: string): SessionMessageAssistantTool => ({
  type: "tool",
  id: name,
  name,
  time: { created: 1, completed: 2 },
  state: { status: "completed", input: {}, content: [{ type: "text", text: "ok" }], metadata: {} },
})

test("activity labels localize every count without changing English defaults or summary shape", () => {
  const items = [
    ...["shell", "bash", "edit", "read", "custom.raw"].map((name) => ({ message, part: tool(name) })),
    { message, part: { type: "reasoning" as const, text: "raw reasoning", time: { created: 1, completed: 2 } } },
  ]
  expect(activitySummary(items, 2)).toEqual({
    label: "2 commands, 1 edit, 1 thought, 1 read, 1 tool, 2 instructions",
    active: false,
  })
  expect(activitySummary(items, 2, false, t)).toEqual({
    label: "2 条命令, 1 次编辑, 1 次思考, 1 次读取, 1 次工具调用, 2 个指令文件",
    active: false,
  })
  expect(activitySummary([], 0, false, t)).toEqual({ label: "", active: false })
})

test("busy activity labels translate chrome but retain raw tool names", () => {
  const raw = "custom.$&{{name}}"
  const running: SessionMessageAssistantTool = {
    ...tool(raw),
    state: { status: "running", input: {}, metadata: {} },
  }
  expect(busyLabel(running)).toBe(`Running ${raw}…`)
  expect(busyLabel(running, t)).toBe(`正在运行${raw}…`)
  expect(busyLabel({ ...running, name: "shell" }, t)).toBe("正在运行命令…")
  expect(busyLabel({ ...running, name: "execute" }, t)).toBe("正在运行代码…")
  expect(busyLabel({ ...running, name: "bash", state: { status: "streaming", input: "" } }, t)).toBe("正在准备命令…")
  expect(busyLabel({ type: "reasoning", text: "", time: { created: 1 } }, t)).toBe("正在思考…")
})

test("subtree summary forwards the translator to finished counts and active fallback", () => {
  const part: SessionMessageAssistantTool = {
    ...tool("shell"),
    state: { status: "running", input: {}, metadata: {} },
  }
  const open = { ...message, time: { created: 1 }, content: [part] }
  const activity = reduceSessionRows([open], new Set(), false, "low")[0]
  if (activity.type !== "group") throw new Error("Expected activity group")
  expect(summarizeActivity(activity, () => open, [], false)).toEqual({
    label: "Running command…",
    active: true,
  })
  expect(summarizeActivity(activity, () => open, [], false, t)).toEqual({
    label: "正在运行命令…",
    active: true,
  })
  expect(summarizeActivity(activity, () => ({ ...message, content: [tool("shell")] }), [], true, t)).toEqual({
    label: "1 条命令",
    active: false,
  })
})
