import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { METRICS } from '../../../src/lib/rum/payload'
import { MAX_BODY_BYTES, USAGE_SINCE, fingerprint, parseBeacon, parseUsage, type Beacon } from './beacon'
import { DAILY_DAYS, RAW_DAYS, ROLLUP_DAYS, beaconStatements, dayOf, monthlyStatements, monthsToRoll, nightly, nightlyStatements, rollupStatements, retentionStatements, type SqlDatabase, type SqlStatement } from './store'
import { authorized, parseStatsQuery, stats } from './stats'
import worker from './index'

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
  // Every migration, in order, as D1 applies them.
  const dir = path.join(__dirname, '../migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) raw.exec(readFileSync(path.join(dir, file), 'utf8'))
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

  it('scrubs an error again, so a page from an older build cannot store an address or id', () => {
    const page = 'https://www.kivalens.org'
    const b = ok(
      parseBeacon(
        report({
          final: false,
          errors: [
            {
              message: 'HTTP 404: https://api.kivaws.org/v1/lenders/jane1987/loans.json for loan 2931233',
              source: `${page}/loans/2931233?lender=jane`,
              stack: `Error\n at ${page}/partners/246:1:2\n at f (${page}/assets/index-Ab.js:3:4)`,
            },
          ],
        }),
        'www.kivalens.org',
        HOSTS,
      ),
    )
    expect(b.errors[0]).toMatchObject({
      message: 'HTTP 404: https://api.kivaws.org/… for loan #',
      source: '[page]',
      stack: `Error\n at [page]:1:2\n at f (${page}/assets/index-Ab.js:3:4)`,
    })
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
    expect(b.errors[3]).toMatchObject({ message: 'boom 3', count: 2, route: 'loan', fingerprint: fingerprint(['loan', 'boom 3', 'https://www.kivalens.org/assets/index.js', 3]) })
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

  it('keeps the same error on two pages as two rows', async () => {
    const err = { message: 'x is undefined', source: 'https://www.kivalens.org/assets/a.js', line: 3 }
    await store(report({ view: 'view-0001', errors: [{ ...err, route: 'search' }, { ...err, route: 'loan' }] }))
    expect(rows('SELECT route, count FROM errors ORDER BY route')).toEqual([
      { route: 'loan', count: 1 },
      { route: 'search', count: 1 },
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

  it('runs the nightly job end to end, catching up on nights it missed', async () => {
    await store(report({ view: 'view-y001', m: { lcp: 700 } }), NOW - 86_400_000)
    await store(report({ view: 'view-y005', m: { lcp: 300 } }), NOW - 5 * 86_400_000)
    await nightly(db, NOW)
    expect(rows("SELECT day, n, p50 FROM daily WHERE metric = 'lcp' AND route = '*' ORDER BY day")).toEqual([
      { day: '2026-09-20', n: 1, p50: 300 },
      { day: '2026-09-24', n: 1, p50: 700 },
    ])
  })

  it('stays within the free plan: at most 50 D1 queries a night, and a report is one batch of 21 or fewer', () => {
    expect(nightlyStatements(db, NOW).length).toBeLessThanOrEqual(50)
    expect(ROLLUP_DAYS).toBeGreaterThanOrEqual(2)
    const errors = Array.from({ length: 20 }, (_, i) => ({ message: `e${i}` }))
    expect(beaconStatements(db, ok(parseBeacon(report({ errors }), 'www.kivalens.org', HOSTS)), NOW, null).length).toBe(21)
  })
})

describe('usage statistics', () => {
  // A day after usage statistics existed, so a browser number's birthday is real.
  const T = Date.UTC(2026, 9, 10, 12)
  const DAY_MS = 86_400_000
  const ID_A = 'AAAAAAAAAAAAAAAAAAAAAA'
  const ID_B = 'BBBBBBBBBBBBBBBBBBBBBB'
  const usage = (over: Record<string, unknown> = {}) => ({
    id: ID_A, born: '2026-10-01', lender: 1, saved: 2, searches: 3,
    c: { sector: 2, 'sector:none': 1, age: 1, 'mode:both': 3 }, p: { search: 2, loan: 4 }, e: { basket_add: 2, 'preset:popular': 1 },
    ...over,
  })
  let db: ReturnType<typeof memoryD1>
  beforeEach(() => {
    db = memoryD1()
  })
  const store = (body: string, at = T, host = 'www.kivalens.org') => db.batch(beaconStatements(db, ok(parseBeacon(body, host, HOSTS, at)), at, 'US'))
  const rows = (sql: string) => db.raw.prepare(sql).all() as Array<Record<string, unknown>>

  it('accepts the usage part, keeping only names of the right shape and whole counts', () => {
    const today = '2026-10-10'
    const u = parseUsage(usage({ c: { sector: 2, 'Sector!': 1, age: -1, tags: 1.5, ['x'.repeat(41)]: 1, 'sort:newest': 1 }, lender: 'yes', saved: 5000 }), today)
    expect(u).toMatchObject({ browser: ID_A, born: '2026-10-01', lender: 0, saved: 0, searches: 3 })
    expect(u!.counts.c).toEqual({ sector: 2, 'sort:newest': 1 })
    // A page is a route id, as the page's report names it.
    expect(parseUsage(usage({ p: { basketLoan: 1, '/loans/1': 1 } }), today)!.counts.p).toEqual({ basketLoan: 1 })
    // At most 150 names of a kind.
    const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, 1]))
    expect(Object.keys(parseUsage(usage({ c: many }), today)!.counts.c)).toHaveLength(150)
  })

  it('drops a malformed usage part but keeps the page timings, and reads an impossible birthday as today', () => {
    const b = ok(parseBeacon(report({ u: usage({ id: 'short' }) }), 'www.kivalens.org', HOSTS, T))
    expect(b.view).toMatchObject({ metrics: { lcp: 900 }, usage: null })
    expect(parseUsage(usage({ born: '2019-01-01' }), '2026-10-10')!.born).toBe('2026-10-10')
    expect(parseUsage(usage({ born: '2030-01-01' }), '2026-10-10')!.born).toBe('2026-10-10')
    expect(parseUsage(usage({ born: USAGE_SINCE }), '2026-10-10')!.born).toBe(USAGE_SINCE)
    expect(parseUsage('nope', '2026-10-10')).toBeNull()
  })

  it('stores it with the page view, and nothing for a browser that does not share it', async () => {
    await store(report({ view: 'view-u001', u: usage() }))
    await store(report({ view: 'view-u002' }))
    expect(rows('SELECT view, browser, born, lender, saved, searches, usage FROM views ORDER BY view')).toEqual([
      { view: 'view-u001', browser: ID_A, born: '2026-10-01', lender: 1, saved: 2, searches: 3, usage: JSON.stringify({ c: { sector: 2, 'sector:none': 1, age: 1, 'mode:both': 3 }, p: { search: 2, loan: 4 }, e: { basket_add: 2, 'preset:popular': 1 } }) },
      { view: 'view-u002', browser: null, born: null, lender: null, saved: null, searches: null, usage: null },
    ])
  })

  async function seed() {
    // Browser A: two page loads on two days, a lender ID, number made on Oct 1.
    await store(report({ view: 'view-a001', u: usage() }), T - DAY_MS)
    await store(report({ view: 'view-a002', u: usage({ searches: 1, c: { sector: 1, 'mode:mfi': 1, partner_risk_rating: 1 }, p: { search: 1 }, e: {} }) }), T)
    // Browser B: new on Oct 10, no lender ID, one search with no criteria.
    await store(report({ view: 'view-b001', u: usage({ id: ID_B, born: '2026-10-10', lender: 0, searches: 1, c: { 'mode:both': 1 }, p: { search: 1 }, e: {} }) }), T)
    // A page load that shares nothing, and one on beta.
    await store(report({ view: 'view-x001' }), T)
    await store(report({ view: 'view-beta', host: 'beta.kivalens.org', u: usage({ id: 'CCCCCCCCCCCCCCCCCCCCCC', born: '2026-10-10' }) }), T, 'beta.kivalens.org')
  }

  it('counts each browser once, new on the day its number was made, with its lender ID and searches', async () => {
    await seed()
    const r = await stats(db, { from: '2026-10-04', to: '2026-10-10', host: 'www.kivalens.org' }, T)
    // A's number was made on Oct 1, before this window: A is returning, B is new.
    expect(r.totals).toEqual({ pages: 4, shared: 3, browsers: 2, new_browsers: 1, lender_browsers: 1, searches: 5 })
    expect(r.daily).toEqual([
      { day: '2026-10-09', pages: 1, shared: 1, browsers: 1, new_browsers: 0, lender_browsers: 1, searches: 3 },
      { day: '2026-10-10', pages: 3, shared: 2, browsers: 2, new_browsers: 1, lender_browsers: 1, searches: 2 },
    ])
    // A window that includes Oct 1 counts A as new too.
    const wider = await stats(db, { from: '2026-10-01', to: '2026-10-10', host: 'www.kivalens.org' }, T)
    expect(wider.totals.new_browsers).toBe(2)
    // Every site: beta's browser is its own (a site's numbers are its own origin's).
    expect((await stats(db, { from: '2026-10-04', to: '2026-10-10', host: '*' }, T)).totals.browsers).toBe(3)
  })

  it('says how many browsers used each criterion, page and action, and how many times', async () => {
    await seed()
    const r = await stats(db, { from: '2026-10-04', to: '2026-10-10', host: 'www.kivalens.org' }, T)
    const by = (list: Array<{ key: string; browsers: number; n: number }>) => Object.fromEntries(list.map((x) => [x.key, [x.browsers, x.n]]))
    expect(by(r.criteria)).toEqual({ sector: [1, 3], 'sector:none': [1, 1], age: [1, 1], 'mode:both': [2, 4], 'mode:mfi': [1, 1], partner_risk_rating: [1, 1] })
    expect(by(r.pages)).toEqual({ search: [2, 4], loan: [1, 4] })
    expect(by(r.events)).toEqual({ basket_add: [1, 2], 'preset:popular': [1, 1] })
    // Filter depth: A used sector, age and partner_risk_rating (the mode and list modes are not criteria of their own); B none.
    expect(r.depth).toEqual([
      { key: '0', browsers: 1 }, { key: '1', browsers: 0 }, { key: '2', browsers: 0 },
      { key: '3-4', browsers: 1 }, { key: '5-7', browsers: 0 }, { key: '8+', browsers: 0 },
    ])
    expect(r.countries).toEqual([{ key: 'US', browsers: 2, n: 4 }])
    expect(r.landing).toEqual([{ key: 'search', browsers: 2, n: 4 }])
  })

  it('splits page loads by country, device, language and first page, each value on its own row', async () => {
    const at = (view: string, over: Record<string, unknown>, country: string) =>
      db.batch(beaconStatements(db, ok(parseBeacon(report({ view, ...over }), 'www.kivalens.org', HOSTS, T)), T, country))
    await at('view-d001', { device: 'mobile', lang: 'de', route: 'loan', u: usage() }, 'DE')
    await at('view-d002', { device: 'desktop', lang: 'en', route: 'search', u: usage({ id: ID_B }) }, 'US')
    await at('view-d003', { device: 'desktop', lang: 'en', route: 'search' }, 'US')
    const r = await stats(db, { from: '2026-10-10', to: '2026-10-10', host: 'www.kivalens.org' }, T)
    expect(r.countries).toEqual([{ key: 'US', browsers: 1, n: 2 }, { key: 'DE', browsers: 1, n: 1 }])
    expect(r.devices).toEqual([{ key: 'desktop', browsers: 1, n: 2 }, { key: 'mobile', browsers: 1, n: 1 }])
    expect(r.langs).toEqual([{ key: 'en', browsers: 1, n: 2 }, { key: 'de', browsers: 1, n: 1 }])
    expect(r.landing).toEqual([{ key: 'search', browsers: 1, n: 2 }, { key: 'loan', browsers: 1, n: 1 }])
  })

  it('writes month totals nightly while all the month is still in the raw rows, then leaves them standing', async () => {
    await seed()
    await store(report({ view: 'view-sep1', u: usage({ id: 'DDDDDDDDDDDDDDDDDDDDDD', born: '2026-09-28' }) }), Date.UTC(2026, 8, 28, 12))
    // On Oct 10 September is whole inside the 45 days kept, so both months are rewritten.
    expect(monthsToRoll(T)).toEqual(['2026-09', '2026-10'])
    // From mid-November, October's first days are gone: its totals stand as written.
    expect(monthsToRoll(Date.UTC(2026, 10, 20))).toEqual(['2026-11'])
    await nightly(db, T)
    expect(rows("SELECT month, metric, n FROM monthly WHERE host = 'www.kivalens.org' AND month = '2026-09' ORDER BY metric")).toEqual([
      { month: '2026-09', metric: 'browsers', n: 1 },
      { month: '2026-09', metric: 'lender_browsers', n: 1 },
      { month: '2026-09', metric: 'new_browsers', n: 1 },
      { month: '2026-09', metric: 'pages', n: 1 },
      { month: '2026-09', metric: 'searches', n: 3 },
      { month: '2026-09', metric: 'shared', n: 1 },
    ])
    expect(rows("SELECT key, browsers, n FROM monthly_usage WHERE month = '2026-10' AND host = 'www.kivalens.org' AND kind = 'c' AND key = 'sector'")).toEqual([{ key: 'sector', browsers: 1, n: 3 }])
    expect(rows("SELECT key, browsers FROM monthly_usage WHERE month = '2026-10' AND host = 'www.kivalens.org' AND kind = 'd' ORDER BY key")).toEqual([
      { key: '0', browsers: 1 },
      { key: '3-4', browsers: 1 },
    ])
    // Re-running replaces rather than adds.
    await db.batch(monthlyStatements(db, '2026-10'))
    expect(rows("SELECT COUNT(*) AS c FROM monthly_usage WHERE month = '2026-10' AND kind = 'c' AND key = 'sector' AND host = 'www.kivalens.org'")).toEqual([{ c: 1 }])
    // The dashboard's months: September from the totals, October live.
    const r = await stats(db, { from: '2026-10-04', to: '2026-10-10', host: 'www.kivalens.org' }, T)
    expect(r.months.map((m) => [m.month, m.live, m.browsers])).toEqual([['2026-09', false, 1], ['2026-10', true, 2]])
    // Still inside the free plan's 50 queries a night with two months to write.
    expect(nightlyStatements(db, T).length).toBeLessThanOrEqual(50)
  })

  it('reads a window inside the raw rows only, and a site it knows', () => {
    const q = (s: string) => parseStatsQuery(new URL(`https://rum.kivalens.org/v1/stats?${s}`), T, HOSTS)
    expect(q('')).toEqual({ from: '2026-09-11', to: '2026-10-10', host: 'www.kivalens.org' })
    expect(q('from=2026-01-01&to=2026-10-10&host=*')).toEqual({ from: dayOf(T - (RAW_DAYS - 1) * DAY_MS), to: '2026-10-10', host: '*' })
    expect(q('from=2026-10-10&to=2026-10-01')).toEqual({ error: 'The window ends before it starts.' })
    expect(q('host=evil.example')).toEqual({ error: 'Unknown host.' })
    expect(q('from=yesterday')).toEqual({ error: 'Dates are YYYY-MM-DD.' })
  })

  it('opens the numbers only to the key', async () => {
    const req = (auth?: string) => new Request('https://rum.kivalens.org/v1/stats', { headers: auth ? { Authorization: auth } : {} })
    expect(await authorized(req('Bearer s3cret'), 's3cret')).toBe(true)
    expect(await authorized(req('Bearer s3cre'), 's3cret')).toBe(false)
    expect(await authorized(req(), 's3cret')).toBe(false)
    expect(await authorized(req('s3cret'), 's3cret')).toBe(false)
    // No key configured: nobody gets in, however the request is shaped.
    expect(await authorized(req('Bearer '), undefined)).toBe(false)
  })

  it('serves the dashboard under a strict policy, and the numbers only with the key', async () => {
    await seed()
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext
    const env = (key?: string) => ({ DB: db as unknown as D1Database, ALLOWED_ORIGINS: 'https://www.kivalens.org,https://kivalens.org,https://beta.kivalens.org', STATS_KEY: key })
    const get = (path: string, key?: string, auth?: string) =>
      worker.fetch(new Request(`https://rum.kivalens.org${path}`, { headers: auth ? { Authorization: auth } : {} }) as never, env(key) as never, ctx)
    const page = await get('/dashboard', 'k')
    expect(page.status).toBe(200)
    expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self'")
    expect(page.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(await page.text()).toContain('<script src="/dashboard.js"></script>')
    const js = await (await get('/dashboard.js', 'k')).text()
    // The page's code carries names, never numbers: those need the key.
    expect(js).toContain('"sector":"Sector"')
    expect(js).not.toContain(ID_A)
    expect((await get('/v1/stats', undefined, 'Bearer k')).status).toBe(503)
    expect((await get('/v1/stats', 'k')).status).toBe(401)
    expect((await get('/v1/stats', 'k', 'Bearer wrong')).status).toBe(401)
    const ok200 = await get('/v1/stats?from=2026-10-04&to=2026-10-10', 'k', 'Bearer k')
    expect(ok200.status).toBe(200)
    expect(ok200.headers.get('Cache-Control')).toBe('no-store')
    const body = (await ok200.json()) as { totals: { browsers: number } }
    expect(body.totals.browsers).toBeGreaterThanOrEqual(0)
  })
})
