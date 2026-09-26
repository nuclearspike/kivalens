import { afterEach, describe, expect, it, vi } from 'vitest'
import { createState, handleApi } from '../../server/klCore.mjs'
import { observeFundedLoans, recentlyFunded, RECENTLY_FUNDED_TTL_MS } from '../../server/loanLifecycle.mjs'

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
      description: { texts: { en: 'Old story' } }, kl_repayments: [] }]
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
