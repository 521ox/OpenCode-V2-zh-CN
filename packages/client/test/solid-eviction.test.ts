import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createData, type CreateDataInput } from "../src/solid"
import { OpenCode, type OpenCodeEvent, type SessionInfo } from "../src/promise"

test("evicts a whole family while preserving metadata and attention", async () => {
  const setup = fixture()
  try {
    for (const id of ["ses_parent", "ses_child", "ses_grandchild", "ses_other"]) {
      await setup.data.session.message.sync(id)
      await setup.data.session.pending.sync(id)
    }
    setup.data.session.setStatus("ses_child", "running")
    setup.emit({
      id: "evt_permission",
      created: 1,
      type: "permission.asked",
      data: { id: "per_test", sessionID: "ses_child", action: "bash", resources: ["bun test"] },
    })

    setup.data.session.evict("ses_parent")

    for (const id of ["ses_parent", "ses_child", "ses_grandchild"]) {
      expect(setup.data.session.message.list(id)).toEqual([])
      expect(setup.data.session.message.get(id, "msg_page")).toBeUndefined()
      expect(setup.data.session.message.more(id)).toBe(false)
      expect(setup.data.session.message.loading(id)).toBe(false)
      expect(setup.data.session.pending.list(id)).toEqual([])
      expect(setup.data.session.input.list(id)).toEqual([])
      expect(setup.data.session.get(id)?.id).toBe(id)
    }
    expect(setup.data.session.family("ses_parent")).toEqual(["ses_parent", "ses_child", "ses_grandchild"])
    expect(setup.data.session.status("ses_child")).toBe("running")
    expect(setup.data.session.permission.list("ses_child")?.[0]?.id).toBe("per_test")
    expect(setup.data.session.message.list("ses_other")).toHaveLength(2)

    setup.emit({
      id: "evt_agent",
      created: 1,
      type: "session.agent.selected",
      durable: { aggregateID: "ses_parent", seq: 1, version: 1 },
      data: { sessionID: "ses_parent", agent: "build" },
    })
    expect(setup.data.session.message.list("ses_parent").map((item) => item.type)).toEqual(["agent-switched"])
    await setup.data.session.message.sync("ses_parent")
    expect(setup.data.session.message.list("ses_parent").map((item) => item.id)).toEqual(["msg_page"])
    await setup.data.session.message.sync("ses_grandchild")
    await setup.data.session.pending.sync("ses_grandchild")
    expect(setup.data.session.message.list("ses_grandchild")).toHaveLength(2)
    expect(setup.data.session.message.list("ses_child")).toEqual([])
  } finally {
    setup.dispose()
  }
})

test("evicting an in-flight read leaves the next sync invalidated", async () => {
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let requests = 0
  const setup = fixture(async () => {
    if (++requests !== 1) return
    requested.resolve()
    await release.promise
  })
  try {
    const initial = setup.data.session.message.sync("ses_child")
    await requested.promise
    setup.data.session.evict("ses_parent")
    release.resolve()
    await initial
    expect(setup.data.session.message.list("ses_child")).toEqual([])
    expect(setup.data.session.message.get("ses_child", "msg_page")).toBeUndefined()
    expect(setup.data.session.message.more("ses_child")).toBe(false)
    await setup.data.session.message.sync("ses_child")
    expect(requests).toBe(2)
    expect(setup.data.session.message.list("ses_child")).toHaveLength(1)
  } finally {
    release.resolve()
    setup.dispose()
  }
})

test.each(["echo", "reject"] as const)("eviction preserves optimistic submissions until %s", async (mode) => {
  const release = Promise.withResolvers<void>()
  const setup = fixture(async (url) => {
    if (!url.pathname.endsWith("/prompt")) return undefined
    await release.promise
    return mode === "reject"
      ? Response.json({ message: "rejected" }, { status: 400 })
      : Response.json({ id: "msg_local" })
  })
  try {
    const request = setup.data.session.prompt({ sessionID: "ses_child", id: "msg_local", text: "local" })
    const settled = Promise.allSettled([request])
    setup.data.session.evict("ses_parent")
    expect(
      setup.data.session.message
        .list("ses_child")
        .map((item) => ({ id: item.id, text: item.type === "user" ? item.text : undefined })),
    ).toEqual([{ id: "msg_local", text: "local" }])
    if (mode === "echo") setup.emit(enqueued("ses_child", "msg_local"))
    release.resolve()
    await settled
    expect(setup.data.session.message.list("ses_child")).toHaveLength(mode === "echo" ? 1 : 0)
    expect(setup.data.session.pending.list("ses_child")).toHaveLength(mode === "echo" ? 1 : 0)
  } finally {
    release.resolve()
    setup.dispose()
  }
})

test.each(["message", "pending", "page"] as const)(
  "invalidated %s reads cannot publish after eviction or deletion",
  async (kind) => {
    for (const action of ["evict", "delete"] as const) {
      const requested = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const setup = fixture(async (url) => {
        if (kind === "page" && !url.searchParams.has("cursor")) return
        requested.resolve()
        await release.promise
      })
      try {
        if (kind === "page") await setup.data.session.message.sync("ses_child")
        const request =
          kind === "pending"
            ? setup.data.session.pending.sync("ses_child")
            : kind === "page"
              ? setup.data.session.message.loadMore("ses_child")
              : setup.data.session.message.sync("ses_child")
        await requested.promise
        if (action === "evict") setup.data.session.evict("ses_parent")
        else
          setup.emit({
            id: "evt_delete",
            created: 1,
            type: "session.deleted",
            data: { sessionID: "ses_child" },
            durable: { aggregateID: "ses_child", seq: 1, version: 1 },
          })
        release.resolve()
        await request
        expect(setup.data.session.message.list("ses_child")).toEqual([])
        expect(setup.data.session.message.get("ses_child", "msg_page")).toBeUndefined()
        expect(setup.data.session.message.more("ses_child")).toBe(false)
        expect(setup.data.session.message.loading("ses_child")).toBe(false)
        expect(setup.data.session.pending.list("ses_child")).toEqual([])
      } finally {
        release.resolve()
        setup.dispose()
      }
    }
  },
)

test("reopening queues a fresh initial read without publishing the evicted reply", async () => {
  const requested = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
  const release = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
  let count = 0
  const setup = fixture(async () => {
    const index = count++
    requested[index].resolve()
    await release[index].promise
  })
  try {
    const old = setup.data.session.message.sync("ses_child")
    await requested[0].promise
    setup.data.session.evict("ses_parent")
    const fresh = setup.data.session.message.sync("ses_child")
    release[0].resolve()
    await old
    await requested[1].promise
    expect(setup.data.session.message.list("ses_child")).toEqual([])
    release[1].resolve()
    await fresh
    expect(count).toBe(2)
    expect(setup.data.session.message.get("ses_child", "msg_page")?.type).toBe("user")
    expect(setup.data.session.message.more("ses_child")).toBe(true)
  } finally {
    release.forEach((item) => item.resolve())
    setup.dispose()
  }
})

test.each(["old-first", "new-first"] as const)("reopened paging retains its request ownership: %s", async (order) => {
  const requested = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
  const release = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
  let pages = 0
  let publications = 0
  const setup = fixture(async (url) => {
    if (!url.searchParams.has("cursor")) return
    const index = pages++
    requested[index].resolve()
    await release[index].promise
    return Response.json({
      data: [{ id: index === 0 ? "msg_old" : "msg_new", type: "user", text: "older", time: { created: 0 } }],
      cursor: {},
    })
  })
  try {
    await setup.data.session.message.sync("ses_child")
    const old = setup.data.session.message.loadMore("ses_child", { all: true, beforePublish: () => publications++ })
    await requested[0].promise
    setup.data.session.evict("ses_parent")
    await setup.data.session.message.sync("ses_child")
    const fresh = setup.data.session.message.loadMore("ses_child", { beforePublish: () => publications++ })
    await requested[1].promise
    if (order === "old-first") {
      release[0].resolve()
      await old
      expect(setup.data.session.message.loading("ses_child")).toBe(true)
      expect(publications).toBe(0)
      release[1].resolve()
      await fresh
    } else {
      release[1].resolve()
      await fresh
      release[0].resolve()
      await old
    }
    expect(publications).toBe(1)
    expect(setup.data.session.message.list("ses_child").map((item) => item.id)).toEqual(["msg_new", "msg_page"])
    expect(setup.data.session.message.get("ses_child", "msg_old")).toBeUndefined()
    expect(setup.data.session.message.loading("ses_child")).toBe(false)
    expect(setup.data.session.message.more("ses_child")).toBe(false)
  } finally {
    release.forEach((item) => item.resolve())
    setup.dispose()
  }
})

test.each(["message", "pending"] as const)("reconnecting does not discard a current %s read", async (kind) => {
  const [status, setStatus] = createSignal<"connected" | "reconnecting">("connected")
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let requests = 0
  const setup = fixture(
    async () => {
      requests++
      requested.resolve()
      await release.promise
    },
    { status },
  )
  try {
    const request = setup.data.session[kind].sync("ses_child")
    await requested.promise
    setStatus("reconnecting")
    if (kind === "pending") setup.emit(enqueued("ses_child", "msg_concurrent"))
    release.resolve()
    await request
    expect(setup.data.session.message.list("ses_child").map((item) => item.id)).toEqual(
      kind === "message" ? ["msg_page"] : ["msg_concurrent", "msg_pending"],
    )
    if (kind === "pending")
      expect(setup.data.session.pending.list("ses_child").map((item) => item.id)).toEqual([
        "msg_pending",
        "msg_concurrent",
      ])
    setStatus("connected")
    await setup.data.session[kind].sync("ses_child")
    expect(requests).toBe(2)
  } finally {
    release.resolve()
    setup.dispose()
  }
})

test.each(["message", "pending"] as const)("eviction revokes an already queued %s reload", async (kind) => {
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const setup = fixture(async () => {
    requested.resolve()
    await release.promise
  })
  try {
    const old = setup.data.session[kind].sync("ses_child")
    await requested.promise
    setup.data.session[kind].invalidate("ses_child")
    const queued = setup.data.session[kind].sync("ses_child")
    setup.data.session.evict("ses_parent")
    release.resolve()
    await Promise.all([old, queued])
    expect(setup.data.session.message.list("ses_child")).toEqual([])
    expect(setup.data.session.pending.list("ses_child")).toEqual([])
    await setup.data.session[kind].sync("ses_child")
    expect(setup.data.session.message.list("ses_child")).toHaveLength(1)
  } finally {
    release.resolve()
    setup.dispose()
  }
})

function info(id: string, parentID?: string): SessionInfo {
  return {
    id,
    parentID,
    projectID: "project",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 0, updated: 0 },
    location: { directory: "/project" },
  }
}

function enqueued(sessionID: string, inboxID = "msg_pending"): OpenCodeEvent {
  return {
    id: `evt_${inboxID}`,
    created: 1,
    type: "session.inbox.enqueued",
    durable: { aggregateID: sessionID, seq: 1, version: 1 },
    data: { sessionID, inboxID, item: { type: "user", delivery: "steer", payload: { text: "pending" } } },
  }
}

function fixture(read?: (url: URL) => Promise<Response | void>, connection?: CreateDataInput["connection"]) {
  const listeners = new Set<Parameters<CreateDataInput["event"]["listen"]>[0]>()
  const api = OpenCode.make({
    baseUrl: "http://opencode.local",
    fetch: async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      const response = await read?.(url)
      if (response) return response
      const sessionID = url.pathname.split("/")[3]
      if (url.pathname.endsWith("/inbox"))
        return Response.json({
          data: [
            {
              id: "msg_pending",
              sessionID,
              type: "user",
              delivery: "steer",
              payload: { text: "pending" },
              time: { created: 1 },
            },
          ],
        })
      return Response.json({
        data: [{ id: "msg_page", type: "user", text: "page", time: { created: 0 } }],
        cursor: url.searchParams.has("cursor") ? {} : { next: "older" },
      })
    },
  })
  return createRoot((dispose) => {
    const data = createData({
      api: () => api,
      connection,
      directory: "/project",
      event: {
        on: () => () => {},
        listen(handler) {
          listeners.add(handler)
          return () => listeners.delete(handler)
        },
      },
    })
    data.session.remember(info("ses_parent"))
    data.session.remember(info("ses_child", "ses_parent"))
    data.session.remember(info("ses_grandchild", "ses_child"))
    data.session.remember(info("ses_other"))
    return {
      data,
      dispose,
      emit: (details: OpenCodeEvent) => listeners.forEach((listener) => listener({ name: details.type, details })),
    }
  })
}
