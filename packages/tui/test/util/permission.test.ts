import { expect, test } from "bun:test"
import { permissionPresentation } from "../../src/util/permission"
import { translate, type Key, type Params } from "../../src/i18n"
const t = (key: Key, params?: Params) => translate("en", key, params)

test("preserves permission roots and self-contained metadata", () => {
  expect(permissionPresentation({ action: "external_directory", resources: ["/*"] }, t).title).toBe(
    "Access external directory /",
  )
  expect(permissionPresentation({ action: "external_directory", resources: ["C:/*"] }, t).title).toBe(
    "Access external directory C:/",
  )
  expect(
    permissionPresentation({ action: "webfetch", resources: [], metadata: { url: "https://example.com" } }, t),
  ).toMatchObject({
    title: "WebFetch https://example.com",
    lines: ["URL: https://example.com"],
  })
  expect(
    permissionPresentation({ action: "websearch", resources: [], metadata: { query: "releases" } }, t),
  ).toMatchObject({
    title: 'Web Search "releases"',
    lines: ["Query: releases"],
  })
})
