import { METRICS } from '../../../src/lib/rum/payload'
import { DAILY_DAYS, RAW_DAYS } from '../../../src/lib/rum/retention'
import type { Beacon } from './beacon'

/**
 * The collector's SQL. D1 is SQLite, so these run unchanged against node:sqlite
 * in the tests. Only the small part of D1's API used here is assumed.
 */
export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement
  run(): Promise<unknown>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement
  batch(statements: SqlStatement[]): Promise<unknown>
}

export { DAILY_DAYS, RAW_DAYS }

export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const daysBefore = (ms: number, days: number): string => dayOf(ms - days * 86_400_000)

const VIEW_COLUMNS = ['view', 'day', 'at', 'host', 'route', 'version', 'lang', 'device', 'net', 'source', 'country', 'chats', ...METRICS]

/** Everything one report writes, as one batch. */
export function beaconStatements(db: SqlDatabase, b: Beacon, now: number, country: string | null): SqlStatement[] {
  const day = dayOf(now)
  const out: SqlStatement[] = []
  if (b.view) {
    const v = b.view
    const values = [v.view, day, now, v.host, v.route, v.version, v.lang, v.device, v.net, v.source, country, v.chats, ...METRICS.map((m) => v.metrics[m] ?? null)]
    out.push(
      db
        .prepare(`INSERT OR REPLACE INTO views (${VIEW_COLUMNS.join(', ')}) VALUES (${VIEW_COLUMNS.map(() => '?').join(', ')})`)
        .bind(...values),
    )
  }
  for (const e of b.errors) {
    out.push(
      db
        .prepare(
          `INSERT INTO errors (day, host, fingerprint, message, stack, source, line, col, route, version, count, first_at, last_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (day, host, fingerprint) DO UPDATE SET
             count = count + excluded.count,
             last_at = excluded.last_at,
             stack = COALESCE(errors.stack, excluded.stack)`,
        )
        .bind(day, b.host, e.fingerprint, e.message, e.stack, e.source, e.line, e.col, e.route, b.version, e.count, now, now),
    )
  }
  return out
}

/**
 * One day's percentiles per host and page, and across pages ('*'), computed by
 * SQLite itself so the Worker does almost no work (a free-plan cron has 10 ms of
 * CPU). Two statements a day, one per grouping: a free-plan invocation may run 50
 * D1 queries, so a statement per metric (thirty a day) would not fit. The metrics
 * are turned into rows with json_each rather than a UNION of one SELECT per
 * metric, because D1 caps the terms in a compound SELECT. 'views' is the day's
 * page-view count, with no percentiles. Re-running a day replaces its rows.
 */
export function rollupStatements(db: SqlDatabase, day: string): SqlStatement[] {
  const pick = `CASE m.value WHEN 'views' THEN 0 ${METRICS.map((metric) => `WHEN '${metric}' THEN v.${metric}`).join(' ')} END`
  return [true, false].map((byRoute) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO daily (day, host, route, metric, n, p50, p75, p95)
         SELECT ?1, host, r, metric, n,
           CASE WHEN metric = 'views' THEN NULL ELSE MIN(CASE WHEN rn >= 0.50 * n THEN x END) END,
           CASE WHEN metric = 'views' THEN NULL ELSE MIN(CASE WHEN rn >= 0.75 * n THEN x END) END,
           CASE WHEN metric = 'views' THEN NULL ELSE MIN(CASE WHEN rn >= 0.95 * n THEN x END) END
         FROM (
           SELECT host, r, metric, x,
             ROW_NUMBER() OVER (PARTITION BY host, r, metric ORDER BY x) AS rn,
             COUNT(*) OVER (PARTITION BY host, r, metric) AS n
           FROM (
             SELECT v.host, ${byRoute ? 'v.route' : "'*'"} AS r, m.value AS metric, ${pick} AS x
             FROM views v, json_each(?2) m
             WHERE v.day = ?1
           )
           WHERE x IS NOT NULL
         )
         GROUP BY host, r, metric`,
      )
      .bind(day, JSON.stringify(['views', ...METRICS])),
  )
}

/** Days the nightly job summarises again, so a missed night heals itself. */
export const ROLLUP_DAYS = 7

/** Raw rows go after RAW_DAYS, daily summaries after DAILY_DAYS. */
export function retentionStatements(db: SqlDatabase, now: number): SqlStatement[] {
  const raw = daysBefore(now, RAW_DAYS)
  return [
    db.prepare('DELETE FROM views WHERE day < ?').bind(raw),
    db.prepare('DELETE FROM errors WHERE day < ?').bind(raw),
    db.prepare('DELETE FROM daily WHERE day < ?').bind(daysBefore(now, DAILY_DAYS)),
  ]
}

/**
 * The nightly job: the last ROLLUP_DAYS days summarised again (late reports and a
 * missed night included), then expiry. Every statement counts against the free
 * plan's 50 D1 queries per invocation (nightlyStatements is tested against it).
 */
export function nightlyStatements(db: SqlDatabase, now: number): SqlStatement[] {
  const days = Array.from({ length: ROLLUP_DAYS }, (_, i) => daysBefore(now, ROLLUP_DAYS - i))
  return [...days.flatMap((day) => rollupStatements(db, day)), ...retentionStatements(db, now)]
}

export async function nightly(db: SqlDatabase, now: number): Promise<void> {
  await db.batch(nightlyStatements(db, now))
}
