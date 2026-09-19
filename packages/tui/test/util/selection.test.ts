import { expect, test } from "bun:test"
import type { SelectionBehavior } from "@opentui/core"
import type { ClipboardService } from "../../src/context/clipboard"
import { Selection, copy, copyOnSelectRelease } from "../../src/util/selection"
import { translate, type Locale } from "../../src/i18n"

test.each(["en", "zh"] as const)("selection copy localizes only toast chrome in %s", async (locale: Locale) => {
  const raw = "C:\\literal\\$&{{name}}$t(main.close)"
  const value = setup(raw, false)
  const messages: string[] = []
  const toast = { show: (input: { message: string }) => messages.push(input.message), error: () => {} }
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(locale, key, params)
  expect(copyOnSelectRelease({ isDragging: true }, value.renderer, toast, value.clipboard, t)).toBeTrue()
  await Promise.resolve()
  expect(value.writes).toEqual([raw])
  expect(messages).toEqual([locale === "en" ? "Copied to clipboard" : "已复制到剪贴板"])
  expect(value.clears()).toBe(0)
})

function renderer() {
  return {
    getSelection: () => ({
      getSelectedText: () => "beta",
      selectedRenderables: [],
      isStart: false,
      behavior: "cell" as const,
    }),
    clearSelection: () => {},
  }
}

function setup(text: string, isStart: boolean, behavior: SelectionBehavior = "cell") {
  const writes: string[] = []
  let clears = 0
  const clipboard: ClipboardService = {
    read: async () => undefined,
    write: async (value) => {
      writes.push(value)
    },
  }
  const renderer = {
    getSelection: () => ({ getSelectedText: () => text, selectedRenderables: [], isStart, behavior }),
    clearSelection: () => {
      clears++
    },
    currentFocusedRenderable: null,
  }
  const toast = { show: () => {}, error: () => {} }
  return { clipboard, renderer, toast, writes, clears: () => clears }
}

test("copy writes selected text without clearing the highlight", () => {
  let cleared = false
  const copied = copy(
    {
      getSelection: () => ({
        getSelectedText: () => "beta",
        selectedRenderables: [],
        isStart: false,
        behavior: "cell",
      }),
      clearSelection: () => {
        cleared = true
      },
    },
    { show: () => {}, error: () => {} },
    {
      async read() {
        return undefined
      },
      async write() {},
    },
  )
  expect(copied).toBe(true)
  expect(cleared).toBe(false)
})

test("copy-on-select ignores a later non-drag release", () => {
  const writes: string[] = []
  const clipboard = {
    async read() {
      return undefined
    },
    async write(value: string) {
      writes.push(value)
    },
  }
  const toast = { show: () => {}, error: () => {} }
  expect(copyOnSelectRelease({}, renderer(), toast, clipboard)).toBe(false)
  expect(copyOnSelectRelease({ isDragging: false }, renderer(), toast, clipboard)).toBe(false)
  expect(copyOnSelectRelease({ isDragging: true }, renderer(), toast, clipboard)).toBe(true)
  expect(writes).toEqual(["beta"])
})

test("copy-on-select preserves a click-only selection for subsequent clicks", () => {
  const value = setup("", true)
  expect(copyOnSelectRelease({ isDragging: true }, value.renderer, value.toast, value.clipboard)).toBeFalse()
  expect(value.clears()).toBe(0)
  expect(value.writes).toEqual([])
})

test.each(["word", "line"] as const)("copy-on-select copies a %s selection without pointer movement", (behavior) => {
  const value = setup("selected", true, behavior)
  expect(copyOnSelectRelease({ isDragging: true }, value.renderer, value.toast, value.clipboard)).toBeTrue()
  expect(value.clears()).toBe(0)
  expect(value.writes).toEqual(["selected"])
})

test("ignores a click-only selection without copying or clearing", () => {
  const value = setup("x", true)
  expect(Selection.copy(value.renderer, value.toast, value.clipboard)).toBeFalse()
  expect(value.clears()).toBe(0)
  expect(value.writes).toEqual([])
})

test("ignores an empty dragged selection without copying or clearing", () => {
  const value = setup("", false)
  expect(Selection.copy(value.renderer, value.toast, value.clipboard)).toBeFalse()
  expect(value.clears()).toBe(0)
  expect(value.writes).toEqual([])
})

test("copies a non-empty dragged selection without clearing its highlight", async () => {
  const value = setup("selected", false)
  expect(Selection.copy(value.renderer, value.toast, value.clipboard)).toBeTrue()
  await Promise.resolve()
  expect(value.clears()).toBe(0)
  expect(value.writes).toEqual(["selected"])
})
