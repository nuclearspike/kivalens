import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { METRICS } from '../../../src/lib/rum/payload'
import { MAX_BODY_BYTES, fingerprint, parseBeacon, type Beacon } from './beacon'
import { DAILY_DAYS, RAW_DAYS, beaconStatements, dayOf, nightly, rollupStatements, retentionStatements, type SqlDatabase, type SqlStatement } from './store'

/**
 * The collector's rules, and its SQL run for real: D1 is SQLite, so node:sqlite
 * executes the same statements (the shim below is the part of D1's API used).
 */

class Stmt implements SqlStatement {
  constructor(private db: DatabaseSync, private sql: string, private values: unknown[] = []) {}
  bind(...values: unknown[]): SqlStatement {
    return new Stmt(this.db, this.sql, values)
  }
  async run(): Promise<unknown> {
    return this.db.prepare(this.sql).run(...(this.values as never[]))
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...(this.values as never[])) as T[] }
  }
}
function memoryD1(): SqlDatabase & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  raw.exec(readFileSync(path.join(__dirname, '../migrations/0001_init.sql'), 'utf8'))
  return {
    raw,
    prepare: (sql) => new Stmt(raw, sql),
    batch: async (statements) => {
      raw.exec('BEGIN')
      try {
        for (const s of statements) await s.run()
        raw.exec('COMMIT')
      } catch (e) {
        raw.exec('ROLLBACK')
        throw e
      }
    },
  }
}

const HOSTS = new Set(['www.kivalens.org', 'kivalens.org', 'beta.kivalens.org'])
const report = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, view: 'view-0001', host: 'www.kivalens.org', route: 'search', version: '2026.9.25', final: true, m: { lcp: 900 }, ...over })
const ok = (b: ReturnType<typeof parseBeacon>): Beacon => {
  if ('refused' in b) throw new Error(`refused: ${b.refused}`)
  return b
}
const NOW = Date.UTC(2026, 8, 25, 12)

describe('what the collector accepts', () => {
  it('keeps a page report from an allowed page', () => {
    const b = ok(parseBeacon(report({ lang: 'de', device: 'mobile', net: '4g', source: 'kl', chats: 2 }), 'www.kivalens.org', HOSTS))
    expect(b.view).toMatchObject({ view: 'view-0001', host: 'www.kivalens.org', route: 'search', lang: 'de', device: 'mobile', source: 'kl', chats: 2, metrics: { lcp: 900 } })
  })

  it('refuses a report whose host is not the page that sent it, or not ours', () => {
    expect(parseBeacon(report(), 'beta.kivalens.org', HOSTS)).toEqual({ refused: 'host' })
    expect(parseBeacon(report({ host: 'evil.example' }), 'evil.example', HOSTS)).toEqual({ refused: 'host' })
  })

  it('refuses what is not a report', () => {
    expect(parseBeacon('nope', 'www.kivalens.org', HOSTS)).toEqual({ refused: 'not JSON' })
    expect(parseBeacon('[1]', 'www.kivalens.org', HOSTS)).toEqual({ refused: 'not an object' })
    expect(parseBeacon(report({ v: 2 }), 'www.kivalens.org', HOSTS)).toEqual({ refused: 'unknown version' })
    expect(parseBeacon(report({ view: 'x' }), 'www.kivalens.org', HOSTS)).toEqual({ refused: 'view, route or version' })
    // A path can never be a route label: only a route id is.
    expect(parseBeacon(report({ route: '/loans/2931233' }), 'www.kivalens.org', HOSTS)).toEqual({ refused: 'view, route or version' })
    expect(parseBeacon('x'.repeat(MAX_BODY_BYTES + 1), 'www.kivalens.org', HOSTS)).toEqual({ refused: 'too large' })
    expect(parseBeacon(report({ final: false }), 'www.kivalens.org', HOSTS)).toEqual({ refused: 'nothing to keep' })
  })

  it('keeps only known, sane numbers', () => {
    const b = ok(parseBeacon(report({ m: { lcp: 1200, cls: 0.12, inp: -5, fcp: 'fast', bogus: 3, ttfb: 10 * 60_000 + 1, results: Number.NaN } }), 'www.kivalens.org', HOSTS))
    expect(b.view!.metrics).toEqual({ lcp: 1200, cls: 0.12 })
  })

  it('takes at most 20 errors, each capped, counted and fingerprinted', () => {
    const errors = Array.from({ length: 30 }, (_, i) => ({ message: `boom ${i}`, source: 'https://www.kivalens.org/assets/index.js', line: i, count: 2, route: 'loan' }))
    const b = ok(parseBeacon(report({ final: false, errors }), 'www.kivalens.org', HOSTS))
    expect(b.view).toBeNull()
    expect(b.errors).toHaveLength(20)
    expect(b.errors[3]).toMatchObject({ message: 'boom 3', count: 2, route: 'loan', fingerprint: fingerprint(['boom 3', 'https://www.kivalens.org/assets/index.js', 3]) })
    expect(ok(parseBeacon(report({ errors: [{ message: 'm'.repeat(900) }] }), 'www.kivalens.org', HOSTS)).errors[0].message).toHaveLength(500)
  })
})

describe('what the collector stores', () => {
  let db: ReturnType<typeof memoryD1>
  beforeEach(() => {
    db = memoryD1()
  })
  const store = (body: string, at = NOW, host = 'www.kivalens.org') => db.batch(beaconStatements(db, ok(parseBeacon(body, host, HOSTS)), at, 'US'))
  const rows = (sql: string) => db.raw.prepare(sql).all() as Array<Record<string, unknown>>

  it('has a column for every metric the page sends', () => {
    const columns = new Set(rows('PRAGMA table_info(views)').map((c) => c.name))
    for (const m of METRICS) expect(columns.has(m), m).toBe(true)
  })

  it('keeps one row per page view: a second report of the same view replaces the first', async () => {
    await store(report({ m: { lcp: 900 } }))
    await store(report({ m: { lcp: 950, inp: 80 } }))
    expect(rows('SELECT view, lcp, inp, country, day FROM views')).toEqual([{ view: 'view-0001', lcp: 950, inp: 80, country: 'US', day: '2026-09-25' }])
  })

  it('counts an error across reports on the same day, and starts again the next day', async () => {
    const err = { message: 'x is undefined', source: 'https://www.kivalens.org/assets/a.js', line: 3, count: 2 }
    await store(report({ view: 'view-0001', errors: [err] }))
    await store(report({ view: 'view-0002', errors: [{ ...err, count: 5 }] }))
    await store(report({ view: 'view-0003', errors: [err] }), NOW + 86_400_000)
    expect(rows('SELECT day, count FROM errors ORDER BY day')).toEqual([
      { day: '2026-09-25', count: 7 },
      { day: '2026-09-26', count: 2 },
    ])
  })

  it('summarises a day as percentiles per host and page, and across pages', async () => {
    for (let i = 1; i <= 100; i++) {
      await store(report({ view: `view-${String(i).padStart(4, '0')}`, route: i % 2 ? 'search' : 'loan', m: { lcp: i } }))
    }
    await store(report({ view: 'beta-0001', host: 'beta.kivalens.org', m: { lcp: 5000 } }), NOW, 'beta.kivalens.org')
    await db.batch(rollupStatements(db, '2026-09-25'))
    const all = rows("SELECT n, p50, p75, p95 FROM daily WHERE host = 'www.kivalens.org' AND route = '*' AND metric = 'lcp'")
    expect(all).toEqual([{ n: 100, p50: 50, p75: 75, p95: 95 }])
    const views = rows("SELECT route, n FROM daily WHERE host = 'www.kivalens.org' AND metric = 'views' ORDER BY route")
    expect(views).toEqual([{ route: '*', n: 100 }, { route: 'loan', n: 50 }, { route: 'search', n: 50 }])
    // Hosts never mix: beta's one slow view is beta's alone.
    expect(rows("SELECT n, p50 FROM daily WHERE host = 'beta.kivalens.org' AND route = '*' AND metric = 'lcp'")).toEqual([{ n: 1, p50: 5000 }])
    // Re-running a day replaces its rows rather than adding to them.
    await db.batch(rollupStatements(db, '2026-09-25'))
    expect(rows("SELECT COUNT(*) AS c FROM daily WHERE host = 'www.kivalens.org' AND route = '*' AND metric = 'lcp'")).toEqual([{ c: 1 }])
  })

  it(`keeps raw rows ${RAW_DAYS} days and daily summaries ${DAILY_DAYS}`, async () => {
    const day = (n: number) => NOW - n * 86_400_000
    await store(report({ view: 'view-old1' }), day(RAW_DAYS + 1))
    await store(report({ view: 'view-new1', errors: [{ message: 'e' }] }), day(RAW_DAYS - 1))
    await store(report({ view: 'view-old2', errors: [{ message: 'e' }] }), day(RAW_DAYS + 1))
    db.raw.exec(`INSERT INTO daily VALUES ('${dayOf(day(DAILY_DAYS + 1))}', 'www.kivalens.org', '*', 'lcp', 1, 1, 1, 1),
                                         ('${dayOf(day(DAILY_DAYS - 1))}', 'www.kivalens.org', '*', 'lcp', 1, 1, 1, 1)`)
    await db.batch(retentionStatements(db, NOW))
    expect(rows('SELECT view FROM views')).toEqual([{ view: 'view-new1' }])
    expect(rows('SELECT day FROM errors')).toEqual([{ day: dayOf(day(RAW_DAYS - 1)) }])
    expect(rows('SELECT day FROM daily')).toEqual([{ day: dayOf(day(DAILY_DAYS - 1)) }])
  })

  it('runs the nightly job end to end', async () => {
    await store(report({ view: 'view-y001', m: { lcp: 700 } }), NOW - 86_400_000)
    await nightly(db, NOW)
    expect(rows("SELECT day, n, p50 FROM daily WHERE metric = 'lcp' AND route = '*'")).toEqual([{ day: '2026-09-24', n: 1, p50: 700 }])
  })
})
