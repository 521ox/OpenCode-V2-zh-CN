// English regression fixtures call the production implementation without mocking it.
// Default Chinese and locale selection are covered by i18n-mini-chrome.test.ts.
const transport = await import("../../../src/mini/stream-v2.transport")
const queue = await import("../../../src/mini/runtime.queue")
const runtime = await import("../../../src/mini/runtime")
const entry = await import("../../../src/mini/entry.body")
const config = await import("../../../src/config")
const fixture = await import("../../fixture/tui-runtime")

export function createTuiResolvedConfig(
  input?: Parameters<typeof fixture.createTuiResolvedConfig>[0],
  options?: Parameters<typeof fixture.createTuiResolvedConfig>[1],
) {
  return fixture.createTuiResolvedConfig({ ...input, locale: "en" }, options)
}

export function createSessionTransport(input: Parameters<typeof transport.createSessionTransport>[0]) {
  return transport.createSessionTransport({ ...input, locale: "en" })
}

export function runPromptQueue(input: Parameters<typeof queue.runPromptQueue>[0]) {
  return queue.runPromptQueue({ ...input, locale: "en" })
}

export function runInteractiveDeferredMode(
  input: Parameters<typeof runtime.runInteractiveDeferredMode>[0],
  deps?: Parameters<typeof runtime.runInteractiveDeferredMode>[1],
) {
  return runtime.runInteractiveDeferredMode(
    {
      ...input,
      tuiConfig:
        input.tuiConfig ?? config.resolve({ locale: "en" }, { terminalSuspend: input.host.platform !== "win32" }),
    },
    deps,
  )
}

export function entryBody(
  commit: Parameters<typeof entry.entryBody>[0],
  options?: Parameters<typeof entry.entryBody>[1],
) {
  return entry.entryBody(commit, { ...options, locale: "en" })
}
