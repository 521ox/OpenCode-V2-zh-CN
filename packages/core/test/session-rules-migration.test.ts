import { expect, test } from "bun:test"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode/core/database/drizzle"
import { DatabaseMigration } from "@opencode/core/database/migration"
import { migrations } from "@opencode/core/database/migration.gen"
import migration from "@opencode/core/database/migration/20260919120000_session_start_directory"
import { Global } from "@opencode/util/global"
import { Effect } from "effect"
import { sql } from "drizzle-orm"

test.each([false, true])("merged registry upgrades existing history (rules already applied: %s)", async (applied) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* db.run(sql`CREATE TABLE migration (id text PRIMARY KEY, time_completed integer NOT NULL)`)
      const completed = migrations.filter((entry) => (applied ? entry.id <= migration.id : entry.id < migration.id))
      for (const entry of completed) yield* db.run(sql`INSERT INTO migration VALUES (${entry.id}, 123)`)
      yield* db.run(sql`CREATE TABLE project (id text PRIMARY KEY, time_updated integer NOT NULL)`)
      yield* db.run(sql`INSERT INTO project VALUES ('project', 456)`)
      yield* db.run(sql`CREATE TABLE session_v2 (id text PRIMARY KEY, parent_id text, directory text, permission text)`)
      yield* db.run(sql`INSERT INTO session_v2 VALUES
        ('ses_root', NULL, '/moved', 'keep'), ('ses_child', 'ses_root', '/child', 'child-keep')`)
      yield* db.run(sql`CREATE TABLE event (aggregate_id text, seq integer, type text, data text)`)
      const creation = JSON.stringify({ sessionID: "ses_root", location: { directory: "/created" } })
      yield* db.run(sql`INSERT INTO event VALUES ('ses_root', 0, 'session.created.1', ${creation})`)
      yield* db.run(sql`CREATE TABLE session_message (id text PRIMARY KEY, session_id text, data text)`)
      yield* db.run(sql`INSERT INTO session_message VALUES ('message', 'ses_root', '{"text":"completed history"}')`)
      if (applied) {
        yield* db.run(sql`ALTER TABLE session_v2 ADD COLUMN start_directory text`)
        yield* db.run(sql`UPDATE session_v2 SET start_directory = '/persisted-root' WHERE id = 'ses_root'`)
      }

      expect(migrations.slice(-2).map((entry) => entry.id)).toEqual([
        "20260919120000_session_start_directory",
        "20260923013825_project_time_active",
      ])
      yield* DatabaseMigration.apply(db)
      expect(yield* db.get(sql`SELECT time_active FROM project`)).toEqual({ time_active: 456 })
      yield* db.run(sql`UPDATE project SET time_active = 789`)
      yield* DatabaseMigration.apply(db)

      expect(yield* db.all(sql`SELECT * FROM session_v2 ORDER BY id`)).toEqual([
        {
          id: "ses_child",
          parent_id: "ses_root",
          directory: "/child",
          permission: "child-keep",
          start_directory: null,
        },
        {
          id: "ses_root",
          parent_id: null,
          directory: "/moved",
          permission: "keep",
          start_directory: applied ? "/persisted-root" : "/created",
        },
      ])
      expect(yield* db.get(sql`SELECT * FROM event`)).toEqual({
        aggregate_id: "ses_root",
        seq: 0,
        type: "session.created.1",
        data: creation,
      })
      expect(yield* db.get(sql`SELECT * FROM session_message`)).toEqual({
        id: "message",
        session_id: "ses_root",
        data: '{"text":"completed history"}',
      })
      expect(yield* db.get(sql`SELECT * FROM project`)).toEqual({ id: "project", time_updated: 456, time_active: 789 })
      expect(yield* db.all(sql`SELECT id FROM migration ORDER BY id`)).toEqual(
        migrations.map((entry) => ({ id: entry.id })),
      )
      expect(yield* db.get(sql`SELECT count(*) AS count FROM migration WHERE time_completed = 123`)).toEqual({
        count: completed.length,
      })
      yield* db.run(sql`INSERT INTO project (id, time_updated) VALUES ('new', 999)`)
      expect(yield* db.get(sql`SELECT time_active FROM project WHERE id = 'new'`)).toEqual({ time_active: 0 })
    }).pipe(
      Effect.provideService(Global.Service, Global.make({ data: "/unused-rules-test" })),
      Effect.provide(SqliteClient.layer({ filename: ":memory:", disableWAL: true })),
      Effect.scoped,
    ),
  )
})

test.each([false, true])(
  "rules migration only accepts exact creation facts (existing column: %s)",
  async (existing) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* EffectDrizzleSqlite.makeWithDefaults()
        yield* db.run(sql`CREATE TABLE session_v2 (id text PRIMARY KEY, directory text, permission text)`)
        if (existing) yield* db.run(sql`ALTER TABLE session_v2 ADD COLUMN start_directory text`)
        yield* db.run(sql`CREATE TABLE session (id text PRIMARY KEY, start_directory text)`)
        yield* db.run(sql`CREATE TABLE event (aggregate_id text, seq integer, type text, data text)`)
        const facts = [
          { id: "ses_good", seq: 0, directory: "/created" },
          { id: "ses_windows", seq: 0, directory: "C:\\created" },
          { id: "ses_unc", seq: 0, directory: "\\\\server\\share\\created" },
          { id: "ses_late", seq: 1, directory: "/created" },
          { id: "ses_relative", seq: 0, directory: "relative" },
          { id: "ses_root", seq: 0, directory: "/" },
          { id: "ses_duplicate", seq: 0, directory: "/created" },
          { id: "ses_mismatch", seq: 0, directory: "/created" },
        ]
        for (const fact of facts) {
          yield* db.run(sql`INSERT INTO session_v2 (id, directory, permission) VALUES (${fact.id}, '/moved', 'keep')`)
          yield* db.run(
            sql`INSERT INTO event VALUES (${fact.id}, ${fact.seq}, 'session.created.1', ${JSON.stringify({
              sessionID: fact.id === "ses_mismatch" ? "ses_other" : fact.id,
              location: { directory: fact.directory },
            })})`,
          )
        }
        yield* db.run(sql`INSERT INTO event VALUES ('ses_duplicate', 2, 'session.created.1', '{}')`)
        for (const id of ["ses_fork", "ses_legacy", "ses_bad_legacy", "ses_malformed"])
          yield* db.run(sql`INSERT INTO session_v2 (id, directory, permission) VALUES (${id}, '/mutable', 'keep')`)
        yield* db.run(sql`INSERT INTO session VALUES ('ses_legacy', '/original'), ('ses_bad_legacy', 'relative')`)
        yield* db.run(sql`INSERT INTO event VALUES ('ses_malformed', 0, 'session.created.1', '{bad')`)
        yield* DatabaseMigration.applyOnly(db, [migration])
        yield* DatabaseMigration.applyOnly(db, [migration])
        const rows = yield* db.all<{
          id: string
          start_directory: string | null
          directory: string
          permission: string
        }>(sql`SELECT * FROM session_v2`)
        expect(Object.fromEntries(rows.map((row) => [row.id, row.start_directory]))).toEqual({
          ses_good: "/created",
          ses_windows: "C:\\created",
          ses_unc: "\\\\server\\share\\created",
          ses_late: null,
          ses_relative: null,
          ses_root: null,
          ses_duplicate: null,
          ses_mismatch: null,
          ses_fork: null,
          ses_legacy: "/original",
          ses_bad_legacy: null,
          ses_malformed: null,
        })
        expect(rows.every((row) => row.permission === "keep")).toBe(true)
        expect(rows.find((row) => row.id === "ses_good")?.directory).toBe("/moved")
      }).pipe(
        Effect.provideService(Global.Service, Global.make({ data: "/unused-rules-test" })),
        Effect.provide(SqliteClient.layer({ filename: ":memory:", disableWAL: true })),
        Effect.scoped,
      ),
    )
  },
)
