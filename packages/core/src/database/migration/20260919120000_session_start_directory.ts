import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { DatabaseMigration } from "../migration.js"
import { SessionRulesLocation } from "../../session/rules-location.js"

const migration: DatabaseMigration.Migration = {
  id: "20260919120000_session_start_directory",
  up(tx) {
    return Effect.gen(function* () {
      const columns = yield* tx.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('session_v2')`)
      if (!columns.some((column) => column.name === "start_directory"))
        yield* tx.run(sql`ALTER TABLE session_v2 ADD COLUMN start_directory text`)
      const legacy = (yield* tx.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('session')`)).some(
        (column) => column.name === "start_directory",
      )
      let cursor = ""
      while (true) {
        const rows = yield* tx.all<{ id: string }>(sql`
          SELECT id FROM session_v2 WHERE id > ${cursor} AND start_directory IS NULL ORDER BY id LIMIT 500
        `)
        if (rows.length === 0) break
        for (const row of rows) {
          if (!SessionRulesLocation.safeID(row.id)) continue
          const direct = legacy
            ? yield* tx.get<{ start_directory: string | null }>(
                sql`SELECT start_directory FROM session WHERE id = ${row.id}`,
              )
            : undefined
          const start = SessionRulesLocation.startDirectory(direct?.start_directory)
          if (start) {
            yield* tx.run(sql`UPDATE session_v2 SET start_directory = ${start} WHERE id = ${row.id}`)
            continue
          }
          // Count all creation events, including late or malformed ones, before accepting the sole sequence-zero fact.
          const events = yield* tx.all<{ seq: number; session_id: unknown; directory: unknown }>(sql`
            SELECT seq,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.sessionID') END AS session_id,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.location.directory') END AS directory
            FROM event WHERE aggregate_id = ${row.id} AND type = 'session.created.1' LIMIT 2
          `)
          const event = events.length === 1 ? events[0] : undefined
          if (!event || event.seq !== 0 || event.session_id !== row.id || typeof event.directory !== "string") continue
          const directory = SessionRulesLocation.startDirectory(event.directory)
          if (directory) yield* tx.run(sql`UPDATE session_v2 SET start_directory = ${directory} WHERE id = ${row.id}`)
        }
        cursor = rows.at(-1)!.id
      }
    })
  },
}

export default migration
