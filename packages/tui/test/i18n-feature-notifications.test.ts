import { expect, test } from "bun:test"
import type { OpenCodeEvent } from "@opencode/client"
import type { AttentionNotifyOptions, Context, ToastOptions } from "@opencode/plugin/tui/context"
import Notifications from "../src/feature-plugins/system/notifications"
import { translate, type Locale } from "../src/i18n"

test("notification listeners read the current locale without resubscription and preserve raw values", async () => {
  let locale: Locale = "zh"
  const messages: AttentionNotifyOptions[] = []
  const toasts: ToastOptions[] = []
  const handlers = new Map<OpenCodeEvent["type"], (event: OpenCodeEvent) => void>()
  let subscriptions = 0
  const cleanup = await Notifications((key, params) => translate(locale, key, params)).setup({
    ui: {
      router: { current: () => ({ type: "session", sessionID: "session" }) },
      toast: { show: (toast: ToastOptions) => toasts.push(toast) },
    },
    attention: {
      async notify(value: AttentionNotifyOptions) {
        messages.push(value)
        return { ok: true, notification: true, sound: true }
      },
    },
    data: {
      session: { get: () => ({ id: "session", title: "Raw {{title}}" }) },
      on: <Type extends OpenCodeEvent["type"]>(
        type: Type,
        handler: (event: Extract<OpenCodeEvent, { type: Type }>) => void,
      ) => {
        subscriptions++
        handlers.set(type, handler as (event: OpenCodeEvent) => void)
        return () => {
          handlers.delete(type)
        }
      },
    },
  } as unknown as Context)
  const initial = subscriptions
  const emit = (event: OpenCodeEvent) => handlers.get(event.type)?.(event)
  const durable = { aggregateID: "session", seq: 0, version: 1 as const }
  const done = (): OpenCodeEvent => ({
    id: "done",
    created: 0,
    type: "session.execution.succeeded",
    durable,
    data: { sessionID: "session" },
  })
  try {
    emit(done())
    emit(done())
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({
      title: "Raw {{title}}",
      message: "会话已完成",
      notification: { when: "blurred" },
      sound: { name: "done", when: "always" },
    })
    locale = "en"
    emit({ id: "start", created: 0, type: "session.execution.started", durable, data: { sessionID: "session" } })
    emit(done())
    expect(messages[1].message).toBe("Session done")
    locale = "zh"
    emit({
      id: "form",
      created: 0,
      type: "form.created",
      data: {
        form: {
          id: "form",
          sessionID: "session",
          title: "Raw form",
          fields: [{ key: "authorization", type: "external", url: "https://example.com" }],
        },
      },
    })
    emit({
      id: "permission",
      created: 0,
      type: "permission.asked",
      data: { id: "permission", sessionID: "session", action: "edit", resources: [], metadata: {}, save: [] },
    })
    expect(messages[2].message).toBe("有输入需要回复")
    expect(messages[2].title).toBe("Raw form")
    expect(messages[3].message).toBe("权限请求需要处理")
    emit({ id: "retry", created: 0, type: "session.execution.started", durable, data: { sessionID: "session" } })
    emit({
      id: "failed",
      created: 0,
      type: "session.execution.failed",
      durable,
      data: { sessionID: "session", error: { type: "unknown", message: "raw $& {{error}}" } },
    })
    expect(toasts).toEqual([{ sessionID: "session", title: "会话失败", message: "raw $& {{error}}", variant: "error" }])
    expect(messages[4].message).toBe("raw $& {{error}}")
    expect(subscriptions).toBe(initial)
  } finally {
    if (typeof cleanup === "function") await cleanup()
  }
  expect(handlers.size).toBe(0)
})
