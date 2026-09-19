/** @jsxImportSource @opentui/solid */
import { TextAttributes, type CapturedFrame } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import stringWidth from "string-width"
import { ConfigProvider } from "../../../src/config"
import { RouteProvider, useRoute } from "../../../src/context/route"
import { ThemeProvider, useTheme } from "../../../src/context/theme"
import { SessionNoticeCompletionRow } from "../../../src/routes/session"
import { emptyThemeSource } from "../../fixture/fixture"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

type NoticeProps = Parameters<typeof SessionNoticeCompletionRow>[0]

function span(frame: CapturedFrame, value: string) {
  const result = frame.lines.flatMap((line) => line.spans).find((item) => item.text.includes(value))
  if (!result) throw new Error(`Expected a captured span containing ${value}`)
  return { fg: result.fg.toInts(), attributes: result.attributes }
}

async function renderNotice(overrides: Partial<NoticeProps> = {}) {
  let route: ReturnType<typeof useRoute> | undefined
  let theme: ReturnType<typeof useTheme> | undefined
  const props: NoticeProps = {
    childID: "child-session",
    heading: "↳ Explore 已完成",
    description: "定位空白路径链接残留",
    state: "completed",
    width: 72,
    ...overrides,
  }
  const Notice = () => {
    route = useRoute()
    theme = useTheme()
    return <SessionNoticeCompletionRow {...props} />
  }
  const app = await testRender(
    () => (
      <TestTuiContexts paths={{ home: process.env.HOME, state: process.env.XDG_STATE_HOME }}>
        <ConfigProvider config={createTuiResolvedConfig({ locale: "zh-CN" })}>
          <ThemeProvider mode="dark" source={emptyThemeSource}>
            <RouteProvider initialRoute={{ type: "session", sessionID: "parent-session" }}>
              <Notice />
            </RouteProvider>
          </ThemeProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: props.width, height: 2 },
  )
  app.renderer.start()
  await app.waitForFrame((frame) => frame.includes(props.heading.slice(0, 3)))
  const line = app.captureCharFrame().split("\n")[0] ?? ""
  return {
    app,
    line,
    props,
    titleX: 3 + stringWidth(props.heading) + 3,
    separatorX: 3 + stringWidth(props.heading),
    route: () => {
      if (!route) throw new Error("Route not initialized")
      return route
    },
    theme: () => {
      if (!theme) throw new Error("Theme not initialized")
      return theme
    },
  }
}

test("completion heading and distinct title both retain the exact child route", async () => {
  const fixture = await renderNotice()
  try {
    await fixture.app.mockMouse.click(5, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "child-session" })
    fixture.route().navigate({ type: "session", sessionID: "parent-session" })
    await fixture.app.mockMouse.click(fixture.titleX + 2, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "child-session" })
  } finally {
    fixture.app.renderer.destroy()
  }
})

test("old custom title hover is visible, independent and reversible; separator and blank space are inert", async () => {
  const fixture = await renderNotice()
  try {
    const initial = fixture.app.captureSpans()
    const title = span(initial, fixture.props.description)
    const heading = span(initial, fixture.props.heading)
    const separator = span(initial, " · ")
    expect(title.fg).toEqual(fixture.theme().text.action.primary.base.toInts())
    expect(title.attributes & TextAttributes.UNDERLINE).toBe(0)
    await fixture.app.mockMouse.moveTo(fixture.titleX + 1, 0)
    await fixture.app.renderOnce()
    const hovered = fixture.app.captureSpans()
    expect(span(hovered, fixture.props.description)).toEqual({
      fg: fixture.theme().text.action.primary.hovered.toInts(),
      attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE,
    })
    expect(span(hovered, fixture.props.heading)).toEqual(heading)
    expect(span(hovered, " · ")).toEqual(separator)
    await fixture.app.mockMouse.moveTo(0, 1)
    await fixture.app.renderOnce()
    expect(span(fixture.app.captureSpans(), fixture.props.description)).toEqual(title)
    for (const x of [0, fixture.separatorX, fixture.separatorX + 1, fixture.separatorX + 2, 65]) {
      await fixture.app.mockMouse.click(x, 0)
      expect(fixture.route().data).toEqual({ type: "session", sessionID: "parent-session" })
    }
  } finally {
    fixture.app.renderer.destroy()
  }
})

test("drag-selecting title or heading does not navigate", async () => {
  const fixture = await renderNotice()
  try {
    for (const x of [fixture.titleX, 3]) {
      await fixture.app.mockMouse.drag(x, 0, x + 8, 0)
      expect(fixture.app.renderer.getSelection()?.getSelectedText()).toBeTruthy()
      expect(fixture.route().data).toEqual({ type: "session", sessionID: "parent-session" })
    }
  } finally {
    fixture.app.renderer.destroy()
  }
})

test.each([28, 72])("Chinese title uses terminal cell widths and bounded targets at width %s", async (width) => {
  const fixture = await renderNotice({ width })
  try {
    expect(fixture.line).toContain("↳ Explore 已完成 · 定位")
    expect(stringWidth(fixture.line)).toBeLessThanOrEqual(width)
    if (width === 28) expect(fixture.line).not.toContain(fixture.props.description)
    await fixture.app.mockMouse.click(fixture.separatorX + 1, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "parent-session" })
    await fixture.app.mockMouse.click(fixture.titleX, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "child-session" })
  } finally {
    fixture.app.renderer.destroy()
  }
})

test.each([8, 20, 22])("very narrow row remains bounded without an invisible title link at width %s", async (width) => {
  const fixture = await renderNotice({ width })
  try {
    expect(stringWidth(fixture.line)).toBeLessThanOrEqual(width)
    expect(fixture.app.captureCharFrame().split("\n")[1]?.trim()).toBe("")
    await fixture.app.mockMouse.click(width - 1, 1)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "parent-session" })
  } finally {
    fixture.app.renderer.destroy()
  }
})

test.each([{ childID: undefined }, { description: "" }, { description: "   " }])(
  "missing child or empty title has no title link",
  async (overrides) => {
    const fixture = await renderNotice(overrides)
    try {
      await fixture.app.mockMouse.moveTo(fixture.titleX + 1, 0)
      await fixture.app.renderOnce()
      expect(
        fixture.app
          .captureSpans()
          .lines.flatMap((line) => line.spans)
          .some((item) => Boolean(item.attributes & TextAttributes.UNDERLINE)),
      ).toBe(false)
      await fixture.app.mockMouse.click(fixture.titleX + 1, 0)
      expect(fixture.route().data).toEqual({ type: "session", sessionID: "parent-session" })
    } finally {
      fixture.app.renderer.destroy()
    }
  },
)

test.each(["error", "cancelled"])("%s status color and child navigation are preserved", async (state) => {
  const fixture = await renderNotice({ state, heading: `! Explore ${state}` })
  try {
    const color =
      state === "error" ? fixture.theme().text.feedback.error.base : fixture.theme().text.feedback.warning.base
    expect(span(fixture.app.captureSpans(), fixture.props.heading).fg).toEqual(color.toInts())
    await fixture.app.mockMouse.moveTo(5, 0)
    await fixture.app.renderOnce()
    expect(span(fixture.app.captureSpans(), fixture.props.heading).fg).toEqual(color.toInts())
    await fixture.app.mockMouse.click(5, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "child-session" })
    fixture.route().navigate({ type: "session", sessionID: "parent-session" })
    await fixture.app.mockMouse.click(fixture.titleX + 1, 0)
    expect(fixture.route().data).toEqual({ type: "session", sessionID: "child-session" })
  } finally {
    fixture.app.renderer.destroy()
  }
})
