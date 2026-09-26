import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createState, prepareData, startRefresh, loansFilterable, awaitLoansFilterable, rehydrateWarmCache } from '../../server/klCore.mjs'
import { configureRuntime, memoryCache, resetRuntime } from '../../server/runtime.mjs'
import { filterLoans } from '../../server/loanFilter.mjs'
import zlib from 'node:zlib'

/**
 * Kiva's fundraising listing is LIVE: loans fund out and new ones post while the
 * server is paging through it. Because paging is offset-based, a shift between
 * page N and N+1 can either
 *   - push a loan back across the boundary  -> it is returned TWICE, or
 *   - pull a loan forward across it        -> it is MISSED entirely.
 *
 * The client trusts server batches (setKivaLoans(..., trustNoDupes=true)), so
 * anything the server emits is shown as-is. That makes de-duplication the
 * SERVER's job, and makes a missed loan self-healing: the next refresh re-pulls
 * the whole listing and picks it up.
 */

const loan = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Borrower ${id}`,
  status: 'fundraising',
  loan_amount: 1000,
  funded_amount: 0,
  basket_amount: 0,
  posted_date: '2026-06-01T00:00:00Z',
  sector: 'Agriculture',
  activity: 'Farming',
  use: 'to buy seed',
  location: { country_code: 'KE', country: 'Kenya' },
  terms: { repayment_interval: 'monthly', scheduled_payments: [] },
  borrowers: [{ gender: 'F' }],
  description: { texts: { en: 'A farmer.' } },
  tags: [],
  ...extra,
})

/** Serve a fake Kiva whose search listing is whatever `pages` says right now. */
function fakeKiva(pages: () => Array<Array<ReturnType<typeof loan>>>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

    if (typeof url === 'string' && url.includes('graphql')) {
      return ok({ data: { lend: { sector: [], activity: [], tag: [], loanThemeFilter: [] } } })
    }
    if (typeof url === 'string' && url.includes('docs.google.com')) {
      // A+ spreadsheet is optional; prepareData catches its failure.
      return { ok: false, status: 404, text: async () => '' } as unknown as Response
    }
    if (typeof url === 'string' && url.includes('/partners.json')) {
      return ok({ paging: { pages: 1, page: 1 }, partners: [] })
    }
    if (typeof url === 'string' && url.includes('/loans/search.json')) {
      const p = pages()
      const page = Number(new URL(url).searchParams.get('page') || '1')
      return ok({ paging: { pages: p.length, page }, loans: p[page - 1] ?? [] })
    }
    if (typeof url === 'string' && /\/loans\/[\d,]+\.json/.test(url)) {
      const wanted = url.split('/loans/')[1].split('.json')[0].split(',').map(Number)
      // Detail is id-addressed, so it can never itself duplicate. Echo the loan
      // as the listing described it, so per-loan fields (e.g. funded_amount)
      // are not silently reset by the fake.
      const byId = new Map(pages().flat().map((l) => [l.id, l]))
      return ok({ loans: wanted.map((id) => byId.get(id) ?? loan(id)) })
    }
    void init
    return ok({})
  })
}

const ids = (state: { allLoans: Array<{ id: number }> }) => state.allLoans.map((l) => l.id).sort((a, b) => a - b)
const silent = () => {}

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
  vi.useFakeTimers() // prepareData defers a snapshot write ~8s out; never let it fire
})
afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('klCore paging — a live listing that shifts mid-pull', () => {
  it('checks loans that disappear between refreshes and keeps only their recent funded ID/time', async () => {
    let listing = [[loan(1), loan(2)]]
    let closed = false
    const baseFetch = fakeKiva(() => listing)
    const fundedAt = new Date().toISOString()
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (closed && /\/loans\/[\d,]+\.json/.test(url))
        return { ok: true, status: 200, json: async () => ({ loans: [loan(1), loan(2, { status: 'funded', funded_amount: 1000, funded_date: fundedAt })] }) } as Response
      return baseFetch(url, init)
    }) as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    listing = [[loan(1)]]
    closed = true
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1])
    expect(state.recentlyFunded).toEqual([{ id: 2, fundedAt }])
    expect(state.allLoans.some((item: { id: number }) => item.id === 2)).toBe(false)
  })

  it('does not keep an expired loan simply because some funding is still needed', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1), loan(2, { status: 'expired', funded_amount: 50 })]]) as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1])
    expect(state.recentlyFunded).toEqual([])
  })

  it('emits each loan ONCE when a shift repeats one across the page boundary', async () => {
    // Loan 3 funds out between page 1 and 2, shifting the window back by one, so
    // loan 4 is served again at the head of page 2.
    globalThis.fetch = fakeKiva(() => [
      [loan(1), loan(2), loan(3), loan(4)],
      [loan(4), loan(5), loan(6)],
    ]) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)

    expect(ids(state)).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.allLoans.filter((l: { id: number }) => l.id === 4)).toHaveLength(1)
  })

  it('survives the same loan appearing on several pages', async () => {
    globalThis.fetch = fakeKiva(() => [
      [loan(1), loan(2)],
      [loan(2), loan(3)],
      [loan(3), loan(1)],
    ]) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)

    expect(ids(state)).toEqual([1, 2, 3])
  })

  it('picks up a loan missed at a boundary on the NEXT refresh', async () => {
    // Pass 1: a new loan posts mid-pull, pushing loan 3 forward past the seam.
    let listing: Array<Array<ReturnType<typeof loan>>> = [
      [loan(1), loan(2)],
      [loan(4), loan(5)], // 3 was skipped
    ]
    globalThis.fetch = fakeKiva(() => listing) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1, 2, 4, 5])
    expect(ids(state)).not.toContain(3)

    // Pass 2: the listing is stable, so the full re-pull recovers it.
    listing = [
      [loan(1), loan(2)],
      [loan(3), loan(4), loan(5)],
    ]
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1, 2, 3, 4, 5])
  })

  it('publishes a NEW batch per refresh so clients can tell datasets apart', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1), loan(2)]]) as unknown as typeof fetch
    const state = createState()

    await prepareData(state, silent)
    const first = state.batch
    await prepareData(state, silent)

    expect(state.batch).toBe(first + 1)
    expect(state.ready).toBe(true)
  })
})

/**
 * Reproduces the warm start: Redis restores the compressed API pages plus
 * PARTIAL loan details (descriptions/repayments, no country or sector) and marks
 * the server ready, while the full live objects are still being fetched. Running
 * the shared filter over those partials matches nothing — which made the
 * assistant tell users "no loans match" for ~3 minutes after every deploy, while
 * the site itself showed thousands from the browser's own cache.
 */
describe('loansFilterable — warm start must not look like an empty result set', () => {
  it('is false when the warm start marked the server ready with partial loans', () => {
    const s = createState()
    s.ready = true // /api pages are servable...
    s.allLoans = [{ id: 1, description: { texts: { en: 'hi' } } }] as never // ...but these cannot be filtered
    expect(s.rssReady).toBe(false)
    expect(loansFilterable(s)).toBe(false)
  })

  it('is false before anything has loaded', () => {
    expect(loansFilterable(createState())).toBe(false)
  })

  it('is true once a live refresh has published full loans', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1), loan(2)]]) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)

    expect(loansFilterable(state)).toBe(true)
    expect(state.rssReady).toBe(true)
  })

  it('tolerates a missing/!bogus state rather than throwing', () => {
    expect(loansFilterable(null as never)).toBe(false)
    expect(loansFilterable({} as never)).toBe(false)
  })
})

/**
 * The snapshot already holds the entire dataset as the compressed pages the
 * browser filters against — the warm start just never expanded them, so for the
 * ~150s a cold refresh takes, anything filtering server-side saw nothing. These
 * build a REAL warm start (publish -> reuse those exact pages) and prove the
 * server can filter immediately, with no live fetch available.
 */
describe('rehydrateWarmCache — filter straight from the cache, no waiting', () => {
  /** A state as it looks after hydrateFromCache: pages + partners, no live data. */
  async function warmStartState() {
    // partner_id matters: a loan with no partner is “Direct”, which the default
    // MFI-only filter hides — partnerless fixtures would look like a broken filter.
    globalThis.fetch = fakeKiva(() => [[
      loan(1, { partner_id: 10, sector: 'Agriculture', location: { country_code: 'KE', country: 'Kenya' } }),
      loan(2, { partner_id: 10, sector: 'Retail', location: { country_code: 'PE', country: 'Peru' } }),
      loan(3, { partner_id: 10, sector: 'Retail', location: { country_code: 'KE', country: 'Kenya' } }),
    ]]) as unknown as typeof fetch
    const live = createState()
    await prepareData(live, silent)
    const served = live.batches.get(live.batch)!
    // The fake Kiva serves no partners, so stand in the compressed partner blob
    // the real snapshot would carry — the rehydrate reads it from partnersGz.
    const partnersGz = zlib.gzipSync(
      Buffer.from(JSON.stringify([{ id: 10, status: 'active', name: 'Test MFI', countries: [{ iso_code: 'KE' }] }])),
    )
    live.partnersGz = partnersGz as never

    const warm = createState()
    warm.batch = live.batch
    warm.klStart = live.klStart
    warm.partnersGz = live.partnersGz
    warm.optionsGz = live.optionsGz
    warm.allLoans = [] as never
    warm.warmDetails = [] as never
    warm.batches.set(live.batch, served)
    warm.ready = true // /api pages servable...
    return warm     // ...but filterableLoans is still false
  }

  it('a warm start is not filterable until it is expanded', async () => {
    const warm = await warmStartState()
    expect(warm.ready).toBe(true)
    expect(loansFilterable(warm)).toBe(false)
  })

  it('expands the cached pages into loans the shared filter can use', async () => {
    const warm = await warmStartState()
    expect(rehydrateWarmCache(warm, silent)).toBe(true)
    expect(loansFilterable(warm)).toBe(true)
    expect(warm.allLoans).toHaveLength(3)
  })

  it('filters correctly straight from the cache — the bug that told users “no loans”', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    const ctx = { loans: warm.allLoans, activePartners: warm.activePartners, atheistListProcessed: true }

    expect(filterLoans({ loan: { country_code: 'KE' }, partner: {}, portfolio: {} }, ctx)).toHaveLength(2)
    expect(filterLoans({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} }, ctx)).toHaveLength(2)
    expect(filterLoans({ loan: {}, partner: {}, portfolio: {} }, ctx)).toHaveLength(3)
  })

  it('restores partners — without them the MFI-only default hides every loan', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    expect(warm.activePartners.length).toBeGreaterThan(0)
  })

  it('rebuilds the derived fields the filter depends on', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    const l = warm.allLoans[0] as Record<string, unknown>

    expect(l.kl_still_needed).toBe(1000)
    expect(l.kl_percent_women).toBe(100) // from the klb counts compressLoan kept
    expect(l.borrower_count).toBe(1)
    expect(l.status).toBe('fundraising')
    expect(Array.isArray(l.kl_name_arr)).toBe(true)
    expect(Array.isArray(l.kls_tags)).toBe(true)
  })

  it('does NOT stamp kl_processed, or /api/since would replay the whole dataset', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    expect((warm.allLoans[0] as Record<string, unknown>).kl_processed).toBeUndefined()
  })

  it('only attempts the expand once per boot', async () => {
    const warm = await warmStartState()
    expect(rehydrateWarmCache(warm, silent)).toBe(true)
    expect(rehydrateWarmCache(warm, silent)).toBe(false)
  })

  it('declines cleanly on a genuinely cold boot (nothing cached)', () => {
    expect(rehydrateWarmCache(createState(), silent)).toBe(false)
  })

  it('does not mark RSS ready — RSS needs the LIVE refresh, not the expanded cache', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    expect(loansFilterable(warm)).toBe(true)
    expect(warm.rssReady).toBe(false) // divergence is intended; RSS keeps waiting
  })

  it('never clobbers partners a refresh already enriched (A+ merge survives the expand)', async () => {
    // Cross-exam round 2: expanding during the fetch phase overwrote fresh,
    // A+-merged partners with the pre-merge cached blob and skipped re-merging
    // (the processed flag was already true) — losing enrichment until the next
    // cycle. Partners already owned by the refresh must be left alone.
    const warm = await warmStartState()
    const enriched = [{ id: 10, status: 'active', countries: [{ iso_code: 'KE' }], atheistScore: { secularRating: 4 }, normalizedReligions: ['Secular'] }]
    warm.partners = enriched as never
    warm.activePartners = enriched as never
    warm.atheistListProcessed = true
    warm.building = true // refresh mid-fetch

    expect(rehydrateWarmCache(warm, silent)).toBe(true)
    expect(warm.partners).toBe(enriched) // same array — untouched
    expect((warm.partners[0] as Record<string, unknown>).atheistScore).toBeDefined()
    expect(loansFilterable(warm)).toBe(true) // loans still expanded
  })

  it('still expands while a refresh is FETCHING — that window is the whole point', async () => {
    // First-round fix guarded on state.building, which spans the entire ~150s
    // startup refresh — refusing the expand in exactly the window the feature
    // exists for (cross-exam refutation). Only the staged window may refuse.
    const warm = await warmStartState()
    warm.building = true // refresh running, nothing staged yet
    expect(rehydrateWarmCache(warm, silent)).toBe(true)
    expect(loansFilterable(warm)).toBe(true)
  })

  it('refuses (without latching) only while live loans are STAGED mid-publication', async () => {
    // Expanding between staging and publication overwrote the freshly-built
    // dataset with the old cached one — new pages beside stale loans, persisted
    // by the deferred snapshot (blind-review finding #1).
    const warm = await warmStartState()
    warm.liveStaged = true
    expect(rehydrateWarmCache(warm, silent)).toBe(false)
    expect(warm.warmRehydrated).toBe(false) // refusal must not burn the one attempt

    warm.liveStaged = false // publication cleared it
    expect(rehydrateWarmCache(warm, silent)).toBe(true)
  })

  it('a refresh that fails mid-cycle clears the staged flag (finally), re-enabling the expand', async () => {
    // fakeKiva throwing after staging is hard to arrange here; assert the state
    // contract directly: prepareData’s finally must reset liveStaged.
    globalThis.fetch = (async () => { throw new Error('kiva down') }) as unknown as typeof fetch
    const s = createState()
    s.liveStaged = true // pretend a previous cycle died after staging
    await prepareData(s, silent)
    expect(s.liveStaged).toBe(false)
  })

  it('rescues a Redis hydration that lands AFTER the wait began (council finding #2)', async () => {
    vi.useRealTimers()
    // hydrateFromCache resolves no promise, so before the poll a request that
    // arrived seconds early sat out the full bound with a usable cache present.
    const donor = await warmStartState()
    const late = createState()
    const waiting = awaitLoansFilterable(late, 5000)
    setTimeout(() => {
      late.batch = donor.batch
      late.partnersGz = donor.partnersGz
      late.warmDetails = [] as never
      late.batches.set(donor.batch, donor.batches.get(donor.batch)!)
      late.ready = true
    }, 120)

    const t0 = Date.now()
    await expect(waiting).resolves.toBe(true)
    expect(Date.now() - t0).toBeLessThan(2500) // resolved by the poll, not the bound
    vi.useFakeTimers()
  })


  it('leaves no frozen $/hour — the filter computes it fresh when absent', async () => {
    const warm = await warmStartState()
    rehydrateWarmCache(warm, silent)
    expect((warm.allLoans[0] as Record<string, unknown>).kl_dollars_per_hour).toBeUndefined()
  })

  it('survives a corrupt cached page: returns false, latches, does not throw', async () => {
    const warm = await warmStartState()
    const served = warm.batches.get(warm.batch)!
    served.loanPages = [Buffer.from('not gzip at all')] as never

    expect(() => rehydrateWarmCache(warm, silent)).not.toThrow()
    expect(rehydrateWarmCache(warm, silent)).toBe(false) // latched: no second attempt
    expect(loansFilterable(warm)).toBe(false)
  })

  it('makes awaitLoansFilterable resolve instantly instead of waiting', async () => {
    vi.useRealTimers()
    const warm = await warmStartState()
    const t0 = Date.now()
    await expect(awaitLoansFilterable(warm, 5000)).resolves.toBe(true)
    expect(Date.now() - t0).toBeLessThan(200)
    vi.useFakeTimers()
  })
})

describe('awaitLoansFilterable — wait for a late warm start instead of punting', () => {
  it('returns immediately when the data is already usable', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1)]]) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)

    vi.useRealTimers()
    const t0 = Date.now()
    await expect(awaitLoansFilterable(state, 5000)).resolves.toBe(true)
    expect(Date.now() - t0).toBeLessThan(50) // no needless delay
    vi.useFakeTimers()
  })

  it('resolves as soon as the refresh publishes, not after the full timeout', async () => {
    vi.useRealTimers()
    globalThis.fetch = fakeKiva(() => [[loan(1), loan(2)]]) as unknown as typeof fetch
    const state = createState()

    const waiting = awaitLoansFilterable(state, 10_000) // generous ceiling
    await prepareData(state, silent) // publishes -> resolves rssReadyPromise

    await expect(waiting).resolves.toBe(true)
    vi.useFakeTimers()
  })

  it('gives up cleanly when the data never arrives', async () => {
    vi.useRealTimers()
    // A cold refresh takes ~150s; holding an SSE response that long would trip
    // Heroku's router, so the wait must be bounded.
    await expect(awaitLoansFilterable(createState(), 30)).resolves.toBe(false)
    vi.useFakeTimers()
  })

  it('returns immediately on a zero budget (a request that already spent its wait)', async () => {
    vi.useRealTimers()
    const t0 = Date.now()
    await expect(awaitLoansFilterable(createState(), 0)).resolves.toBe(false)
    expect(Date.now() - t0).toBeLessThan(50)
    vi.useFakeTimers()
  })


  it('does not throw on a state with no readiness promise', async () => {
    await expect(awaitLoansFilterable({} as never, 10)).resolves.toBe(false)
  })
})

describe('klCore paging — listing mechanics', () => {
  it('walks every page reported by paging.pages', async () => {
    globalThis.fetch = fakeKiva(() => [
      [loan(1)], [loan(2)], [loan(3)], [loan(4)],
    ]) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1, 2, 3, 4])
  })

  it('tolerates an empty page without dropping the rest', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1)], [], [loan(3)]]) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1, 3])
  })

  it('drops loans that funded out during the pull', async () => {
    // Kiva still lists it as fundraising, but it is fully funded -> not lendable.
    globalThis.fetch = fakeKiva(() => [
      [loan(1), loan(2, { funded_amount: 1000 })],
    ]) as unknown as typeof fetch

    const state = createState()
    await prepareData(state, silent)
    expect(ids(state)).toEqual([1])
  })

  it('leaves the previous dataset intact when the pull fails outright', async () => {
    globalThis.fetch = fakeKiva(() => [[loan(1), loan(2)]]) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    const before = ids(state)
    const batchBefore = state.batch

    globalThis.fetch = vi.fn(async () => { throw new Error('Kiva down') }) as unknown as typeof fetch
    await prepareData(state, silent) // must not throw

    expect(ids(state)).toEqual(before)
    expect(state.batch).toBe(batchBefore)
  })
})

describe('stopping the refresh', () => {
  // The Vite dev server starts a new refresh on every restart; the old one must
  // not keep downloading the catalog (and holding a whole dataset) behind it.
  it('ends a refresh in flight at its next step, before it publishes, and never starts another', async () => {
    const listing = Array.from({ length: 10 }, (_, p) => Array.from({ length: 50 }, (_, i) => loan(p * 50 + i + 1)))
    const base = fakeKiva(() => listing)
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let detailCalls = 0
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/[\d,]+\.json/.test(url)) {
        detailCalls++
        await gate
      }
      return base(url, init)
    }) as unknown as typeof fetch

    const state = createState()
    const refresh = startRefresh(state, silent)
    await vi.waitFor(() => expect(detailCalls).toBe(4)) // four of ten batches in flight
    refresh.stop()
    release()
    await vi.waitFor(() => expect(state.building).toBe(false))

    expect(detailCalls).toBe(4) // no worker took another batch
    expect(state.batch).toBe(0)
    expect(state.ready).toBe(false)

    const calls = vi.mocked(globalThis.fetch).mock.calls.length
    await prepareData(state, silent)
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(calls)
  })

  it('does not apply a warm start that arrives after stop()', async () => {
    let deliver!: (snapshot: unknown) => void
    const loading = new Promise((resolve) => (deliver = resolve))
    configureRuntime({ snapshots: { save: async () => {}, load: () => loading } })
    try {
      globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, statusText: 'Unavailable', json: async () => ({}) })) as unknown as typeof fetch
      const state = createState()
      const refresh = startRefresh(state, silent)
      refresh.stop()
      deliver({
        batch: 7, newestTime: 1, klStart: { batch: 7, pages: 1, loanLengths: [1], descrLengths: [1] },
        partnersGz: Buffer.from('p'), optionsGz: Buffer.from('o'), loanPages: [Buffer.from('l')], keywordPages: [Buffer.from('k')], details: [],
      })
      for (let i = 0; i < 20; i++) await Promise.resolve()
      expect(state.batch).toBe(0)
      expect(state.ready).toBe(false)
    } finally {
      resetRuntime()
    }
  })

  it('cancels the snapshot a publish just scheduled', async () => {
    const save = vi.fn(async () => {})
    configureRuntime({ snapshots: { save, load: async () => null } })
    try {
      globalThis.fetch = fakeKiva(() => [[loan(1)]]) as unknown as typeof fetch
      // Control: a publish saves its snapshot about eight seconds later.
      const running = createState()
      const kept = startRefresh(running, silent)
      await vi.waitFor(() => expect(running.batch).toBe(1))
      await vi.advanceTimersByTimeAsync(10_000)
      expect(save).toHaveBeenCalledTimes(1)
      kept.stop()

      save.mockClear()
      const state = createState()
      const refresh = startRefresh(state, silent)
      await vi.waitFor(() => expect(state.batch).toBe(1))
      refresh.stop()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(save).not.toHaveBeenCalled()
    } finally {
      resetRuntime()
    }
  })
})

describe('a refresh that fails', () => {
  it('drops only a malformed detail entry: the batch publishes and its other loans keep their details', async () => {
    const listing = [[loan(1), loan(2)], [loan(3)]]
    const base = fakeKiva(() => listing)
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      // Kiva answers the detail batch with a null entry among real loans.
      if (/\/loans\/1,2,3\.json/.test(url))
        return { ok: true, status: 200, json: async () => ({ loans: [null, loan(2, { description: { texts: { en: 'From the detail call.' } } }), loan(3)] }) } as unknown as Response
      return base(url, init)
    }) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)

    expect(state.batch).toBe(1)
    expect(ids(state)).toEqual([1, 2, 3])
    const byId = new Map(state.allLoans.map((l: { id: number; description?: { texts?: { en?: string } } }) => [l.id, l]))
    expect(byId.get(2)?.description?.texts?.en).toBe('From the detail call.')
    expect(byId.get(1)?.description?.texts?.en).toBe('A farmer.') // the listing's own data
  })

  it('lets a malformed detail cost only its own loan: the others\' funding truth survives', async () => {
    // A funded_date no string can be made of (valid JSON) beside a null and a loan that funded.
    const recent = new Date(Date.now() - 60_000).toISOString()
    const base = fakeKiva(() => [[loan(1), loan(2)]])
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/1,2\.json/.test(url))
        return { ok: true, status: 200, json: async () => ({ loans: [
          loan(1, { status: 'funded', funded_amount: 1000, funded_date: recent }),
          null,
          loan(2, { funded_date: { toString: null } }),
        ] }) } as unknown as Response
      return base(url, init)
    }) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    expect(state.batch).toBe(1)
    expect(ids(state)).toEqual([2]) // loan 1 funded, per its own detail
    expect(state.recentlyFunded.map((e: { id: number }) => e.id)).toEqual([1])
  })

  it('serves a loan from the listing when its detail cannot be processed', async () => {
    const base = fakeKiva(() => [[loan(1), loan(2), loan(3)]])
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/1,2,3\.json/.test(url))
        return { ok: true, status: 200, json: async () => ({ loans: [loan(1), { ...loan(2), posted_date: { toString: null } }, loan(3)] }) } as unknown as Response
      return base(url, init)
    }) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    expect(state.batch).toBe(1)
    expect(ids(state)).toEqual([1, 2, 3])
  })

  it('believes a detail that says the loan closed, even when the rest of it cannot be processed', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    // A detail as JSON carries it: a field it does not mention is absent, not undefined.
    const { status: _status, ...fullyFundedNoStatus } = loan(1, { funded_amount: 1000, loan_amount: 1000, posted_date: { toString: null } })
    void _status
    for (const detail1 of [
      loan(1, { status: 'funded', funded_amount: 1000, funded_date: recent, posted_date: { toString: null } }),
      loan(1, { status: 'expired', name: 17 }),
      // Still called fundraising, or not saying, but its amounts show it fully funded.
      loan(1, { status: 'fundraising', funded_amount: 1000, loan_amount: 1000, posted_date: { toString: null } }),
      fullyFundedNoStatus,
      // Amounts it cannot vouch for as numbers: left out, as before, rather than put back.
      loan(1, { status: 'fundraising', funded_amount: '1000', loan_amount: 1000, posted_date: { toString: null } }),
    ]) {
      const base = fakeKiva(() => [[loan(1), loan(2)]])
      globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (/\/loans\/1,2\.json/.test(url))
          return { ok: true, status: 200, json: async () => ({ loans: [detail1, loan(2)] }) } as unknown as Response
        return base(url, init)
      }) as unknown as typeof fetch
      const state = createState()
      await prepareData(state, silent)
      expect(state.batch).toBe(1)
      expect(ids(state)).toEqual([2])
    }
  })

  it('skips a loan whose detail cannot even be read, and publishes the rest', async () => {
    // Only an injected object can do this (JSON has no getters); the detail is read once.
    const unreadable = loan(1)
    Object.defineProperty(unreadable, 'name', { enumerable: true, get() { throw new Error('broken') } })
    const base = fakeKiva(() => [[loan(1), loan(2)]])
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/1,2\.json/.test(url))
        return { ok: true, status: 200, json: async () => ({ loans: [unreadable, loan(2)] }) } as unknown as Response
      return base(url, init)
    }) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    expect(state.batch).toBe(1)
    expect(ids(state)).toEqual([2])
  })

  it('reports the failures inside a refresh that still publishes, whatever the logger returns', async () => {
    // The taxonomy call throws and the A+ sheet answers 404: two failure lines, and
    // a logger that rejects every one of them.
    const base = fakeKiva(() => [[loan(1)]])
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('graphql')) throw new Error('graphql down')
      return base(url, init)
    }) as unknown as typeof fetch
    const reported: string[] = []
    const state = createState()
    await prepareData(state, (m: string) => {
      if (!/failed|skipped/.test(m)) return
      reported.push(m)
      return Promise.reject(new Error('async sink')) as unknown as void
    })
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(state.batch).toBe(1)
    expect(reported).toContain('Taxonomy fetch failed (keeping previous): Error: graphql down')
    expect(reported.some((m) => m.startsWith('A+ data: fetch failed (Error: HTTP 404)'))).toBe(true)
  })

  it('keeps going past a batch with bad details: every batch is fetched and every loan published', async () => {
    const listing = Array.from({ length: 10 }, (_, p) => Array.from({ length: 50 }, (_, i) => loan(p * 50 + i + 1)))
    const base = fakeKiva(() => listing)
    let detailCalls = 0
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/[\d,]+\.json/.test(url) && ++detailCalls === 1) {
        const wanted = url.split('/loans/')[1].split('.json')[0].split(',').map(Number)
        const odd = (id: number) =>
          id === 1 ? { ...loan(1), funded_date: { toString: null } } : id === 2 ? { ...loan(2), posted_date: { toString: null } } : loan(id)
        return { ok: true, status: 200, json: async () => ({ loans: [null, ...wanted.map(odd)] }) } as unknown as Response
      }
      return base(url, init)
    }) as unknown as typeof fetch
    const state = createState()
    await prepareData(state, silent)
    expect(detailCalls).toBe(10)
    expect(state.batch).toBe(1)
    expect(state.allLoans).toHaveLength(500)
  })

  it.each([
    ['an Error', new Error('log sink broke')],
    ['null', null],
    ['0', 0],
    ['an empty string', ''],
  ])('returns only after every detail worker has stopped, even when one throws %s', async (_what, thrown) => {
    const listing = Array.from({ length: 25 }, (_, p) => Array.from({ length: 50 }, (_, i) => loan(p * 50 + i + 1)))
    const base = fakeKiva(() => listing)
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let detailCalls = 0
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (/\/loans\/[\d,]+\.json/.test(url) && ++detailCalls > 10) await gate
      return base(url, init)
    }) as unknown as typeof fetch
    // The progress line after ten batches throws; nothing in a batch is expected to.
    const log = (m: string) => {
      if (m.startsWith('  loan details:')) throw thrown
    }
    const state = createState()
    let returned = false
    const run = prepareData(state, log).then(() => (returned = true))
    await vi.waitFor(() => expect(detailCalls).toBeGreaterThan(10))
    for (let i = 0; i < 50; i++) await Promise.resolve()
    const started = detailCalls
    expect(returned).toBe(false) // workers are still waiting on Kiva
    expect(state.building).toBe(true)
    release()
    await run
    expect(detailCalls).toBe(started) // none took another batch after the failure
    expect(state.batch).toBe(0)
  })

  it('reports a failure whatever was thrown, and whatever the logger does with the report', async () => {
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke() // instanceof, String() and property reads all throw on it
    for (const [thrown, log, expected] of [
      [proxy, (m: string) => void m, 'Data preparation failed: an error that cannot be printed'],
      [new Error('Kiva down'), (m: string) => (m.startsWith('Data preparation failed') ? Promise.reject(new Error('async sink')) : undefined), null],
    ] as Array<[unknown, (m: string) => unknown, string | null]>) {
      globalThis.fetch = vi.fn(async () => { throw thrown }) as unknown as typeof fetch
      const logs: string[] = []
      const state = createState()
      await prepareData(state, (m: string) => {
        logs.push(m)
        return log(m) as void
      })
      for (let i = 0; i < 20; i++) await Promise.resolve()
      expect(state.building).toBe(false)
      expect(state.batch).toBe(0)
      if (expected) expect(logs).toContain(expected)
    }
  })

  it('survives a store that rejects with something unprintable, and a logger that breaks while reporting it', async () => {
    const cases: Array<[() => Promise<never>, (m: string) => void, string | null]> = [
      [async () => { throw { toString: null } }, () => {}, 'Snapshot save failed: an error that cannot be printed'],
      [async () => { throw new Error('store down') }, (m) => { if (m.startsWith('Snapshot save failed')) throw new Error('log sink broke') }, null],
    ]
    for (const [save, breakLog, expected] of cases) {
      configureRuntime({ snapshots: { save, load: async () => null } })
      try {
        globalThis.fetch = fakeKiva(() => [[loan(1)]]) as unknown as typeof fetch
        const logs: string[] = []
        const state = createState()
        const refresh = startRefresh(state, (m: string) => {
          breakLog(m)
          logs.push(m)
        })
        await vi.waitFor(() => expect(state.batch).toBe(1))
        await vi.advanceTimersByTimeAsync(10_000)
        if (expected) expect(logs).toContain(expected)
        refresh.stop()
      } finally {
        resetRuntime()
      }
    }
  })

  it('logs a snapshot save that fails instead of leaving it to reject unhandled', async () => {
    for (const save of [async () => { throw new Error('store down') }, () => { throw new Error('store down') }]) {
      configureRuntime({ snapshots: { save, load: async () => null } })
      try {
        globalThis.fetch = fakeKiva(() => [[loan(1)]]) as unknown as typeof fetch
        const logs: string[] = []
        const state = createState()
        const refresh = startRefresh(state, (m: string) => logs.push(m))
        await vi.waitFor(() => expect(state.batch).toBe(1))
        await vi.advanceTimersByTimeAsync(10_000) // the save runs about 8 s after publishing
        expect(logs).toContain('Snapshot save failed: Error: store down')
        refresh.stop()
      } finally {
        resetRuntime()
      }
    }
  })

  it('logs a failed upkeep job rather than leaving it to reject unhandled, at start and on its timer', async () => {
    configureRuntime({ cache: { ...memoryCache(), cleanup: async () => { throw new Error('disk gone') } } })
    try {
      globalThis.fetch = fakeKiva(() => [[loan(1)]]) as unknown as typeof fetch
      const logs: string[] = []
      const failures = () => logs.filter((m) => m === 'Lender cache cleanup failed: Error: disk gone').length
      const state = createState()
      const refresh = startRefresh(state, (m: string) => logs.push(m))
      await vi.waitFor(() => expect(failures()).toBe(1)) // the run at start
      await vi.advanceTimersByTimeAsync(6 * 60 * 60_000) // one cleanup interval
      expect(failures()).toBe(2)
      refresh.stop()
      await vi.waitFor(() => expect(state.building).toBe(false))
    } finally {
      resetRuntime()
    }
  })
})
