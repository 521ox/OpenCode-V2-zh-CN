import { expect, test } from "bun:test"
import { sessionEpilogue } from "../../src/util/presentation"
import { translate } from "../../src/i18n"

test("formats session continuation summary", () => {
  const epilogue = sessionEpilogue({ title: "A session", sessionID: "ses_123" }, (key, params) =>
    translate("en", key, params),
  )
  expect(epilogue).toContain("A session")
  expect(epilogue).toContain("opencode -s ses_123")
})
