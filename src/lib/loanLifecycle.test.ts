import { afterEach, describe, expect, it, vi } from 'vitest'
import { createState, handleApi, prepareData, rehydrateWarmCache, snapshotOf, startRefresh } from '../../server/klCore.mjs'
import { observeFundedLoans, recentlyFunded, RECENTLY_FUNDED_TTL_MS } from '../../server/loanLifecycle.mjs'
import { buildSystemPrompt, execTool } from '../../server/aiChat.mjs'
import { pageMeta, shellLookup } from '../../server/pageMeta.mjs'
import { configureRuntime, resetRuntime } from '../../server/runtime.mjs'
import { recorded } from '../test/upstream'

async function graph(state: ReturnType<typeof createState>, ids: number[], refresh = false): Promise<any> {
  const response = await handleApi(state, new Request('http://www.kivalens.org/graphql', {
    method: 'POST',
    body: JSON.stringify({ query: `{loans(ids:[${ids.join(',')}],refresh:${refresh}){id status description{texts{en}}}}` }),
  }))
  return response!.json()
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('selected loan lifecycle', () => {
  it('resolves a borrower who funded out of the catalog against Kiva instead of returning an empty success', async () => {
    const upstream = vi.fn(async (_url: string | URL | Request) => Response.json({ loans: [{
      id: 3237744, name: 'Francisco', status: 'funded', loan_amount: 175, funded_amount: 175,
      funded_date: new Date(Date.now() - 60_000).toISOString(),
      description: { texts: { en: 'Francisco wants to light his home with a solar kit.' } },
      terms: { scheduled_payments: [] },
    }] }))
    vi.stubGlobal('fetch', upstream)
    const result = await graph(createState(), [3237744])
    expect(result.data.loans).toHaveLength(1)
    expect(result.data.loans[0]).toMatchObject({ id: 3237744, status: 'funded', funded_amount: 175,
      description: { texts: { en: 'Francisco wants to light his home with a solar kit.' } } })
    expect(String(upstream.mock.calls[0]?.[0])).toContain('api.kivaws.org/v1/loans/3237744.json')
  })

  it.each(['funded', 'expired', 'fundraising'])('resolves %s without inferring status from the expiration date or amount', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ loans: [{ id: 1, status,
      loan_amount: 100, funded_amount: 100, planned_expiration_date: '2020-01-01' }] })))
    expect((await graph(createState(), [1])).data.loans[0].status).toBe(status)
  })

  it.each([404, 410])('returns unavailable for an explicit Kiva HTTP %s, not funded', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })))
    const state = createState()
    expect((await graph(state, [1])).data.loans[0]).toMatchObject({ id: 1, status: 'unavailable', kl_status_source: 'kiva' })
    expect(state.recentlyFunded).toEqual([])
  })

  it.each([429, 403, 503])('keeps HTTP %s uncertain and retryable', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })))
    const state = createState()
    expect((await graph(state, [1])).data.loans[0]).toMatchObject({ id: 1, status: 'unknown', kl_lookup_error: 'upstream_unavailable' })
    expect(state.loanDetailRequests.size).toBe(0)
    expect(state.recentlyFunded).toEqual([])
  })

  it.each([{}, { loans: [] }, { loans: [{ id: 99, status: 'funded' }] }, { loans: [{ id: 1, status: 'future-status' }] }])('does not mistake malformed/mismatched/unknown data for verified funding', async body => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))
    const detail = (await graph(createState(), [1])).data.loans[0]
    expect(detail.status).toBe('unknown')
    expect(detail.kl_lookup_error).toBeTruthy()
  })

  it('refreshes a cached fundraising selection and can correct a later funding reversal', async () => {
    const state = createState()
    state.allLoans = [{ id: 1, status: 'fundraising', funded_amount: 25, loan_amount: 100,
      description: { texts: { en: 'Old story' } }, kl_repayments: [], kl_processed: new Date() }]
    const upstream = vi.fn()
      .mockResolvedValueOnce(Response.json({ loans: [{ id: 1, status: 'funded', funded_amount: 100,
        funded_date: new Date().toISOString(), description: { texts: { en: 'Public story' } } }] }))
      .mockResolvedValueOnce(Response.json({ loans: [{ id: 1, status: 'fundraising', funded_amount: 50 }] }))
    vi.stubGlobal('fetch', upstream)
    expect((await graph(state, [1])).data.loans[0].description.texts.en).toBe('Old story')
    expect(upstream).not.toHaveBeenCalled()
    expect((await graph(state, [1], true)).data.loans[0].status).toBe('funded')
    expect(state.recentlyFunded).toHaveLength(1)
    expect((await graph(state, [1], true)).data.loans[0].status).toBe('fundraising')
    expect(state.recentlyFunded).toEqual([])
  })

  it('preserves available cached story but flags it unverified after a failed check', async () => {
    const state = createState()
    state.allLoans = [{ id: 1, status: 'fundraising', description: { texts: { en: 'Cached story' } } }]
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    expect((await graph(state, [1], true)).data.loans[0]).toMatchObject({
      status: 'unknown', kl_lookup_error: 'upstream_unavailable', description: { texts: { en: 'Cached story' } },
    })
  })

  it('shares in-flight lookups, then releases every public detail on completion', async () => {
    let finish!: (response: Response) => void
    const upstream = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', upstream)
    const state = createState()
    const a = graph(state, [1])
    const b = graph(state, [1])
    // Both requests read their bodies, then reach the lookup, before Kiva answers.
    await vi.waitFor(() => expect(upstream).toHaveBeenCalled())
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(state.loanDetailRequests.size).toBe(1)
    expect(upstream).toHaveBeenCalledTimes(1)
    finish(Response.json({ loans: [{ id: 1, status: 'funded' }] }))
    await Promise.all([a, b])
    expect(state.loanDetailRequests.size).toBe(0)
    expect(state.allLoans).toEqual([])
  })

  it('splits a batch-wide 404 so one removed loan does not conceal a valid borrower', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/1,2.json') || url.includes('/2.json')
      ? new Response('', { status: 404 }) : Response.json({ loans: [{ id: 1, status: 'funded' }] })))
    const result = (await graph(createState(), [1, 2])).data.loans
    expect(result.map((loan: { status: string }) => loan.status)).toEqual(['funded', 'unavailable'])
  })
})

// After a restart the server answers from its warm-start snapshot until its first refresh publishes
// (about four minutes in production). Until the snapshot's pages are expanded or the refresh stages
// its own loans, state.allLoans holds each loan's story and schedule alone; the expanded pages carry
// the snapshot's status and figures, which this process never checked. Neither may be passed off as
// a checked status.
describe('a loan asked about right after a restart', () => {
  const listing = recorded('kiva-search-page.json').loans!
  const details = recorded('kiva-loan-details.json').loans!
  // Kiva labels its JSON text/html.
  const kivaJson = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'text/html; charset=utf-8' } })
  const detailIds = (url: string) => /\/v1\/loans\/([\d,]+)\.json/.exec(url)?.[1].split(',').map(Number)

  /** A server that published Kiva's recorded loans, and the snapshot it saved for the next start. */
  async function publishedSnapshot() {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/loans/search.json')) return kivaJson({ paging: { pages: 1, page: 1 }, loans: listing })
      const wanted = detailIds(url)
      if (wanted) return kivaJson({ loans: details.filter((loan) => wanted.includes(loan.id)) })
      if (url.includes('/partners.json')) return kivaJson({ paging: { pages: 1, page: 1 }, partners: [] })
      if (url.includes('api.kivaws.org/graphql')) return kivaJson({ data: { lend: { sector: [], activity: [], tag: [], loanThemeFilter: [] } } })
      if (url.includes('docs.google.com')) return new Response('', { status: 404 })
      throw new Error(`unexpected request: ${url}`)
    }))
    const live = createState()
    await prepareData(live, () => {})
    clearTimeout(live.snapshotTimer)
    expect(live.allLoans.map((loan: { id: number }) => loan.id).sort()).toEqual(details.map((loan) => loan.id).sort())
    return { live, snapshot: snapshotOf(live)! }
  }

  /** The restarted server: warm from the snapshot, its own refresh still downloading. */
  /** Kiva's answer for these ids, as recorded unless a test says what changed since. */
  type Answer = (wanted: number[]) => Response | Promise<Response>
  const asRecorded: Answer = (wanted) => kivaJson({ loans: details.filter((loan) => wanted.includes(loan.id)) })

  async function restarted(snapshot: unknown, answer: Answer = asRecorded) {
    configureRuntime({ snapshots: { save: async () => {}, load: async () => snapshot } })
    const lookups: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const wanted = detailIds(url)
      if (!wanted) return new Promise<Response>(() => {}) // the refresh's own downloads never finish here
      lookups.push(url)
      return answer(wanted)
    }))
    const state = createState()
    const refresh = startRefresh(state, () => {})
    await vi.waitFor(() => expect(state.ready).toBe(true))
    return { state, lookups, stop: () => refresh.stop() }
  }

  afterEach(() => resetRuntime())

  it('checks the status with Kiva instead of answering "unknown" from the warm start', async () => {
    const { snapshot } = await publishedSnapshot()
    const { state, lookups, stop } = await restarted(snapshot)
    try {
      const kiva = details[0]
      // What the warm start holds for it: the story and the schedule, and nothing to vouch for a status.
      const held = state.allLoans.find((loan: { id: number }) => loan.id === kiva.id)
      expect(held.description.texts.en).toBeTruthy()
      expect(held.kl_repayments.length).toBeGreaterThan(0)
      expect(held).not.toHaveProperty('status')
      expect(held).not.toHaveProperty('loan_amount')
      expect(held).not.toHaveProperty('kl_processed')
      const [answer] = (await graph(state, [kiva.id])).data.loans
      expect(answer).toMatchObject({ id: kiva.id, status: 'fundraising', kl_status_source: 'kiva',
        loan_amount: kiva.loan_amount, funded_amount: kiva.funded_amount })
      expect(answer.kl_status_checked_at).toEqual(expect.any(String))
      expect(answer.kl_lookup_error).toBeUndefined()
      expect(answer.description.texts.en).toBe((kiva.description as { texts: { en: string } }).texts.en)
      expect(lookups.map(detailIds)).toEqual([[kiva.id]])
      // The page head for its address names it as a loan not yet loaded, not " · KivaLens".
      expect(pageMeta({ pathname: `/loans/${kiva.id}`, lookup: shellLookup(state, `/loans/${kiva.id}`) }).title)
        .toBe(`Loan ${kiva.id} · KivaLens`)
    } finally { stop() }
  })

  it('still checks with Kiva once the warm pages are expanded: the snapshot cannot vouch for a status', async () => {
    const { snapshot } = await publishedSnapshot()
    const { state, lookups, stop } = await restarted(snapshot)
    try {
      expect(rehydrateWarmCache(state)).toBe(true) // what an Ask KivaLens question during the window does
      const held = state.allLoans.find((loan: { id: number }) => loan.id === details[1].id)
      expect(held).toMatchObject({ status: 'fundraising', loan_amount: details[1].loan_amount })
      expect(held).not.toHaveProperty('kl_processed') // the snapshot's figures, never checked by this process
      const [answer] = (await graph(state, [details[1].id])).data.loans
      expect(answer).toMatchObject({ status: 'fundraising', kl_status_source: 'kiva' })
      expect(lookups.map(detailIds)).toEqual([[details[1].id]])
    } finally { stop() }
  })

  it('answers from the catalog, without asking Kiva, for loans its own refresh checked', async () => {
    const { live } = await publishedSnapshot()
    const asked = vi.fn()
    vi.stubGlobal('fetch', asked)
    const [answer] = (await graph(live, [details[2].id])).data.loans
    expect(answer).toMatchObject({ status: 'fundraising', kl_status_source: 'catalog' })
    expect(answer.kl_status_checked_at).toEqual(expect.any(String))
    expect(asked).not.toHaveBeenCalled()
  })

  // The snapshot says fundraising for every loan in it; Kiva's answer is the one that counts,
  // before the warm pages are expanded and after.
  const funded = (l: Record<string, unknown>) => ({ ...l, status: 'funded', funded_amount: l.loan_amount, funded_date: new Date(Date.now() - 60_000).toISOString() })
  const expired = (l: Record<string, unknown>) => ({ ...l, status: 'expired' })
  it.each([
    ['funded', funded, 'story-only'], ['expired', expired, 'story-only'],
    ['funded', funded, 'expanded'], ['expired', expired, 'expanded'],
  ] as const)('reports a loan that was %s since the snapshot as Kiva says (%s warm record)', async (status, change, held) => {
    const { snapshot } = await publishedSnapshot()
    const { state, stop } = await restarted(snapshot, (wanted) =>
      kivaJson({ loans: details.filter((loan) => wanted.includes(loan.id)).map(change) }))
    try {
      if (held === 'expanded') expect(rehydrateWarmCache(state)).toBe(true)
      const [answer] = (await graph(state, [details[0].id])).data.loans
      expect(answer).toMatchObject({ status, kl_status_source: 'kiva' })
      expect(state.recentlyFunded.map((entry: { id: number }) => entry.id)).toEqual(status === 'funded' ? [details[0].id] : [])
    } finally { stop() }
  })

  it('reports a loan Kiva no longer has as unavailable', async () => {
    const { snapshot } = await publishedSnapshot()
    const { state, stop } = await restarted(snapshot, () => new Response('', { status: 404 }))
    try {
      expect((await graph(state, [details[0].id])).data.loans[0]).toMatchObject({ status: 'unavailable', kl_status_source: 'kiva' })
    } finally { stop() }
  })

  it('says it could not check, and keeps the story, when Kiva does not answer', async () => {
    const { snapshot } = await publishedSnapshot()
    const { state, stop } = await restarted(snapshot, () => { throw new TypeError('fetch failed') })
    try {
      const [answer] = (await graph(state, [details[0].id])).data.loans
      expect(answer).toMatchObject({ status: 'unknown', kl_status_source: 'unverified', kl_lookup_error: 'upstream_unavailable' })
      expect(answer.description.texts.en).toBe((details[0].description as { texts: { en: string } }).texts.en)
    } finally { stop() }
  })

  // Ask KivaLens expands the warm pages when a chat starts. A snapshot that lands after that, or an
  // expand that fails, leaves story-only records in allLoans; the loan tools must not read them as loans.
  it('gives Ask KivaLens the whole loan when the snapshot lands after the chat began', async () => {
    const { snapshot } = await publishedSnapshot()
    const early = createState()
    expect(rehydrateWarmCache(early)).toBe(false) // the chat's own expand, before the snapshot is in
    const { state, stop } = await restarted(snapshot)
    try {
      const id = details[0].id
      const sctx = { state, lenderId: null, selectedLoanId: id, criteria: null, basket: [] }
      const selected = await execTool('get_selected_loan', {}, sctx, () => {})
      expect(selected).toMatchObject({ id, name: details[0].name, status: 'fundraising', loan_amount: details[0].loan_amount })
      const events: unknown[] = []
      await execTool('add_to_basket', { loanId: id }, sctx, (e: unknown) => events.push(e))
      expect(events).toEqual([{ type: 'add_to_basket', loanId: id }])
    } finally { stop() }
  })

  it('tells Ask KivaLens the loan data is loading, rather than passing it a loan with no name or status', async () => {
    const { snapshot } = await publishedSnapshot()
    const { state, stop } = await restarted(snapshot)
    try {
      state.warmRehydrated = true // an expand that failed is not tried again
      const id = details[0].id
      const sctx = { state, lenderId: null, selectedLoanId: id, criteria: null, basket: [], readyDeadline: Date.now() }
      for (const name of ['get_selected_loan', 'get_loan_details']) {
        const result = await execTool(name, { loanId: id }, sctx, () => {})
        expect(result).toMatchObject({ ready: false })
        expect(result).not.toHaveProperty('name')
      }
      const events: unknown[] = []
      expect(await execTool('add_to_basket', { loanId: id }, sctx, (e: unknown) => events.push(e))).toMatchObject({ ready: false })
      expect(await execTool('add_to_basket', { name: String(details[0].name) }, sctx, (e: unknown) => events.push(e))).toMatchObject({ ready: false })
      expect(events).toEqual([])
      expect(buildSystemPrompt(state, null, null, { selectedLoanId: id })).not.toContain('SELECTED LOAN — the user is viewing THIS loan')
    } finally { stop() }
  })

  // The first refresh after a warm start holds its whole live loans while it settles ages and
  // compresses its pages, and keeps them if it then fails; filterableLoans waits for publication.
  it.each([
    ['staged but not yet published', { liveStaged: true }],
    ['left by a refresh that failed after staging, with no expand possible', { liveStaged: false, warmRehydrated: true }],
  ])('lets Ask KivaLens use whole loans %s', async (_, flags) => {
    const { live } = await publishedSnapshot()
    Object.assign(live, { filterableLoans: false }, flags)
    const id = details[0].id
    const sctx = { state: live, lenderId: null, selectedLoanId: id, criteria: null, basket: [], readyDeadline: Date.now() }
    expect(await execTool('get_selected_loan', {}, sctx, () => {})).toMatchObject({ id, name: details[0].name, status: 'fundraising' })
    expect(await execTool('get_loan_details', { loanId: id }, sctx, () => {})).toMatchObject({ id, name: details[0].name })
    const events: unknown[] = []
    expect(await execTool('add_to_basket', { loanId: id }, sctx, (e: unknown) => events.push(e))).toMatchObject({ ok: true })
    expect(events).toEqual([{ type: 'add_to_basket', loanId: id }])
    expect(buildSystemPrompt(live, null, null, { selectedLoanId: id })).toContain('SELECTED LOAN — the user is viewing THIS loan')
  })

  // allLoans can be replaced while a tool awaits: by a late snapshot's story-only records, or by the
  // next batch's version of the same loan. The answer comes from the one record the tool checked.
  it.each([
    ['a late snapshot\u2019s story-only records', (l: Record<string, unknown>) => ({ id: l.id, description: { texts: { en: 'From the snapshot.' } }, kl_repayments: [] })],
    ['the next batch\u2019s version of each loan', (l: Record<string, unknown>) => ({ ...l, name: 'Renamed', description: { texts: { en: 'A newer story.' } } })],
  ])('answers from the record it checked when allLoans is replaced by %s before it resumes', async (_, replace) => {
    const { live } = await publishedSnapshot()
    const id = details[0].id
    const story = (details[0].description as { texts: { en: string } }).texts.en
    const sctx = { state: live, lenderId: null, selectedLoanId: id, criteria: null, basket: [] }
    for (const name of ['get_selected_loan', 'get_loan_details']) {
      const kept = live.allLoans
      const pending = execTool(name, { loanId: id }, sctx, () => {})
      live.allLoans = kept.map(replace)
      const result = await pending
      live.allLoans = kept
      expect(result).toMatchObject({ id, name: details[0].name, description: story })
    }
  })

  it('looks again after waiting: a snapshot that lands while a loan tool waits is expanded and used', async () => {
    const { snapshot } = await publishedSnapshot()
    let deliver!: (s: unknown) => void
    configureRuntime({ snapshots: { save: async () => {}, load: () => new Promise((resolve) => (deliver = resolve)) } })
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const state = createState()
    const refresh = startRefresh(state, () => {})
    try {
      const id = details[0].id
      const sctx = { state, lenderId: null, selectedLoanId: id, criteria: null, basket: [] }
      const selected = execTool('get_selected_loan', {}, sctx, () => {})
      const detail = execTool('get_loan_details', { loanId: id }, sctx, () => {})
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(state.allLoans).toEqual([]) // both tools are waiting: nothing has landed yet
      deliver(snapshot)
      expect(await selected).toMatchObject({ id, name: details[0].name, status: 'fundraising' })
      expect(await detail).toMatchObject({ id, name: details[0].name, status: 'fundraising' })
    } finally { refresh.stop() }
  })
})

describe('three-hour ID/timestamp-only funding record', () => {
  it('expires at the exact three-hour boundary and never extends retention on another observation', () => {
    const state = createState()
    const now = Date.parse('2026-09-05T08:00:00Z')
    const funded = { id: 1, status: 'funded', funded_date: new Date(now - 60_000).toISOString() }
    observeFundedLoans(state, [funded], now)
    observeFundedLoans(state, [funded], now + 60_000)
    expect(recentlyFunded(state, now + RECENTLY_FUNDED_TTL_MS - 60_001)).toEqual([{ id: 1, fundedAt: funded.funded_date }])
    expect(recentlyFunded(state, now + RECENTLY_FUNDED_TTL_MS - 60_000)).toEqual([])
  })

  it('stores no borrower content and rejects missing, future, stale, or non-funded timestamps', () => {
    const state = createState()
    const now = Date.now()
    const records = [
      { id: 1, status: 'funded', funded_date: new Date(now).toISOString(), name: 'Not retained', description: { texts: { en: 'Not retained' } } },
      { id: 2, status: 'funded' },
      { id: 3, status: 'funded', funded_date: new Date(now + 1).toISOString() },
      { id: 4, status: 'funded', funded_date: new Date(now - RECENTLY_FUNDED_TTL_MS).toISOString() },
      { id: 5, status: 'expired', funded_date: new Date(now).toISOString() },
      { id: 6, status: 'fundraising', funded_date: new Date(now).toISOString(), basket_amount: 1000 },
    ]
    observeFundedLoans(state, records, now)
    expect(state.recentlyFunded).toEqual([{ id: 1, fundedAt: records[0].funded_date }])
  })

  it('serves a detached pruned array over the shared endpoint with no HTTP cache', async () => {
    const state = createState()
    state.recentlyFunded = [{ id: 1, fundedAt: new Date().toISOString() }, { id: 2, fundedAt: '2000-01-01' }]
    const response = await handleApi(state, new Request('http://www.kivalens.org/api/recently-funded'))
    expect(response).toBeInstanceOf(Response)
    expect(await response!.json()).toEqual([state.recentlyFunded[0]])
    expect(response!.headers.get('Cache-Control')).toBe('no-store')
    const detached = recentlyFunded(state)
    detached[0].id = 99
    expect(state.recentlyFunded[0].id).toBe(1)
  })
})
