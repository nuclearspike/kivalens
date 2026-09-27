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

const VIEW_COLUMNS = ['view', 'day', 'at', 'host', 'route', 'version', 'lang', 'device', 'net', 'source', 'country', 'chats', ...METRICS, 'browser', 'born', 'lender', 'saved', 'searches', 'usage']

/** Everything one report writes, as one batch. */
export function beaconStatements(db: SqlDatabase, b: Beacon, now: number, country: string | null): SqlStatement[] {
  const day = dayOf(now)
  const out: SqlStatement[] = []
  if (b.view) {
    const v = b.view
    const u = v.usage
    const values = [
      v.view, day, now, v.host, v.route, v.version, v.lang, v.device, v.net, v.source, country, v.chats,
      ...METRICS.map((m) => v.metrics[m] ?? null),
      u?.browser ?? null, u?.born ?? null, u ? u.lender : null, u ? u.saved : null, u ? u.searches : null,
      u ? JSON.stringify(u.counts) : null,
    ]
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

/** Monthly totals: every page load, those that shared usage, and the browsers among them. */
export const MONTHLY_METRICS = ['pages', 'shared', 'browsers', 'new_browsers', 'lender_browsers', 'searches'] as const
export type MonthlyMetric = (typeof MONTHLY_METRICS)[number]
/** Usage kinds in a view's JSON: criteria, pages, actions. */
export const USAGE_KINDS = ['c', 'p', 'e'] as const
/** Filter depth: how many distinct criteria a browser used, in these buckets. */
export const DEPTH_BUCKETS = ['0', '1', '2', '3-4', '5-7', '8+'] as const

/**
 * The rows of views a window covers: its days, and one host or every host ('*').
 * `?1`/`?2` are the first and last day, `?3` the host, in every statement below.
 */
const IN_WINDOW = `day BETWEEN ?1 AND ?2 AND (?3 = '*' OR host = ?3)`

/**
 * The totals for a window, one row per host and metric. A browser is counted once
 * however many page loads it had; it is new when its number was made in the window.
 * The metrics become rows through json_each rather than a UNION (see rollupStatements).
 */
export const totalsSelect = `
  SELECT host, m.value AS metric,
    CASE m.value
      WHEN 'pages' THEN COUNT(*)
      WHEN 'shared' THEN COUNT(browser)
      WHEN 'browsers' THEN COUNT(DISTINCT browser)
      WHEN 'new_browsers' THEN COUNT(DISTINCT CASE WHEN born BETWEEN ?1 AND ?2 THEN browser END)
      WHEN 'lender_browsers' THEN COUNT(DISTINCT CASE WHEN lender = 1 THEN browser END)
      WHEN 'searches' THEN COALESCE(SUM(searches), 0)
    END AS n
  FROM views, json_each('${JSON.stringify(MONTHLY_METRICS)}') m
  WHERE ${IN_WINDOW}
  GROUP BY host, m.value`

/** Per host, usage kind and name: how many browsers used it and how many times. */
export const usageSelect = `
  SELECT v.host, k.value AS kind, j.key AS key, COUNT(DISTINCT v.browser) AS browsers, SUM(j.value) AS n
  FROM views v, json_each('${JSON.stringify(USAGE_KINDS)}') k, json_each(v.usage, '$.' || k.value) j
  WHERE v.usage IS NOT NULL AND v.day BETWEEN ?1 AND ?2 AND (?3 = '*' OR v.host = ?3)
  GROUP BY v.host, k.value, j.key`

/**
 * Per host: how many browsers used how many distinct criteria (the sort order and
 * the MFI/Direct mode are not filters, and a list's All/None is part of its criterion).
 */
export const depthSelect = `
  SELECT host, CASE
      WHEN k = 0 THEN '0' WHEN k = 1 THEN '1' WHEN k = 2 THEN '2'
      WHEN k <= 4 THEN '3-4' WHEN k <= 7 THEN '5-7' ELSE '8+' END AS key,
    COUNT(*) AS browsers
  FROM (
    SELECT v.host, v.browser, COUNT(DISTINCT j.key) AS k
    FROM views v LEFT JOIN json_each(v.usage, '$.c') j ON instr(j.key, ':') = 0 AND j.key <> 'sort'
    WHERE v.browser IS NOT NULL AND v.day BETWEEN ?1 AND ?2 AND (?3 = '*' OR v.host = ?3)
    GROUP BY v.host, v.browser
  )
  GROUP BY host, key`

const monthBounds = (month: string): [string, string] => {
  const [y, m] = month.split('-').map(Number)
  return [`${month}-01`, new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)]
}
const monthOf = (day: string) => day.slice(0, 7)
const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

/**
 * The month's totals and usage, rewritten from the raw rows. Four statements; only
 * run for a month whose raw rows are all still kept (monthsToRoll).
 */
export function monthlyStatements(db: SqlDatabase, month: string): SqlStatement[] {
  const [first, last] = monthBounds(month)
  return [
    db.prepare(`INSERT OR REPLACE INTO monthly (month, host, metric, n) SELECT ?4, host, metric, n FROM (${totalsSelect})`).bind(first, last, '*', month),
    db.prepare('DELETE FROM monthly_usage WHERE month = ?').bind(month),
    db.prepare(`INSERT INTO monthly_usage (month, host, kind, key, browsers, n) SELECT ?4, host, kind, key, browsers, n FROM (${usageSelect})`).bind(first, last, '*', month),
    db.prepare(`INSERT INTO monthly_usage (month, host, kind, key, browsers, n) SELECT ?4, host, 'd', key, browsers, browsers FROM (${depthSelect})`).bind(first, last, '*', month),
  ]
}

/**
 * The months the nightly job rewrites: this one, and the last one while every one
 * of its days is still inside the raw window. After that a month's totals stand.
 */
export function monthsToRoll(now: number): string[] {
  const month = monthOf(dayOf(now))
  const last = previousMonth(month)
  return monthBounds(last)[0] >= daysBefore(now, RAW_DAYS) ? [last, month] : [month]
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
  return [
    ...days.flatMap((day) => rollupStatements(db, day)),
    ...monthsToRoll(now).flatMap((month) => monthlyStatements(db, month)),
    ...retentionStatements(db, now),
  ]
}

export async function nightly(db: SqlDatabase, now: number): Promise<void> {
  await db.batch(nightlyStatements(db, now))
}
