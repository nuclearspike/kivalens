import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { createState, prepareData, handleApi, handleRss } from '../../server/klCore.mjs'
import zlib from 'node:zlib'

/**
 * handleApi/handleRss are the server's whole public surface. Both follow a
 * routing contract the callers (Vite middleware and the raw Node server) depend
 * on: return TRUE only when the request was handled, so anything else falls
 * through to the static/SPA handler. Answering a request that is not ours — or
 * declining one that is — breaks the site rather than one endpoint.
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

function fakeKiva(pages: Array<Array<ReturnType<typeof loan>>>) {
  return vi.fn(async (url: string) => {
    const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as unknown as Response
    if (url.includes('graphql')) return ok({ data: { lend: { sector: [], activity: [], tag: [], loanThemeFilter: [] } } })
    if (url.includes('docs.google.com')) return { ok: false, status: 404, text: async () => '' } as unknown as Response
    if (url.includes('/partners.json')) return ok({ paging: { pages: 1, page: 1 }, partners: [] })
    if (url.includes('/loans/search.json')) {
      const page = Number(new URL(url).searchParams.get('page') || '1')
      return ok({ paging: { pages: pages.length, page }, loans: pages[page - 1] ?? [] })
    }
    if (/\/loans\/[\d,]+\.json/.test(url)) {
      const wanted = url.split('/loans/')[1].split('.json')[0].split(',').map(Number)
      const byId = new Map(pages.flat().map((l) => [l.id, l]))
      return ok({ loans: wanted.map((id) => byId.get(id) ?? loan(id)) })
    }
    return ok({})
  })
}

/** Minimal stand-in for a Node ServerResponse that records what was sent. */
function fakeRes() {
  const headers: Record<string, unknown> = {}
  const out = {
    statusCode: 200,
    headers,
    body: undefined as unknown,
    ended: false,
    setHeader(k: string, v: unknown) { headers[k.toLowerCase()] = v },
    end(b?: unknown) { out.body = b; out.ended = true },
  }
  return out
}
const req = (url: string, method = 'GET') => ({ url, method, on: () => {} })
const json = (res: ReturnType<typeof fakeRes>) => JSON.parse(String(res.body))
const gunzip = (res: ReturnType<typeof fakeRes>) => JSON.parse(zlib.gunzipSync(res.body as Buffer).toString())

let state: ReturnType<typeof createState>
let originalFetch: typeof globalThis.fetch

beforeAll(async () => {
  originalFetch = globalThis.fetch
  vi.useFakeTimers()
  globalThis.fetch = fakeKiva([[loan(1), loan(2)], [loan(3)]]) as unknown as typeof fetch
  state = createState()
  await prepareData(state, () => {})
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('handleApi — routing contract', () => {
  it('declines requests that are not its own', () => {
    const res = fakeRes()
    expect(handleApi(state, req('/index.html'), res)).toBe(false)
    expect(res.ended).toBe(false) // must not consume the response
  })

  it.each(['/api/start', '/api/partners', '/api/options'])('claims %s', (url) => {
    expect(handleApi(state, req(url), fakeRes())).toBe(true)
  })
})

describe('handleApi — /api/start', () => {
  it('describes the published batch', () => {
    const res = fakeRes()
    handleApi(state, req('/api/start'), res)
    const body = json(res)
    expect(body.batch).toBe(state.batch)
    expect(body.pages).toBeGreaterThan(0)
    expect(body.loanLengths).toHaveLength(body.pages)
  })

  it('404s before any data is ready, rather than serving an empty dataset', () => {
    const res = fakeRes()
    handleApi(createState(), req('/api/start'), res)
    expect(res.statusCode).toBe(404)
  })
})

describe('handleApi — gzipped payloads', () => {
  it('serves loan pages gzipped, with the headers clients need', () => {
    const res = fakeRes()
    handleApi(state, req(`/api/loans/${state.batch}/1`), res)

    expect(res.headers['content-encoding']).toBe('gzip')
    expect(res.headers['content-length']).toBe((res.body as Buffer).length)
    expect(Array.isArray(gunzip(res))).toBe(true)
  })

  it('serves the keyword pages for the same batch', () => {
    const res = fakeRes()
    handleApi(state, req(`/api/loans/${state.batch}/keywords/1`), res)
    expect(res.headers['content-encoding']).toBe('gzip')
    expect(Array.isArray(gunzip(res))).toBe(true)
  })

  it('404s a page index beyond the batch', () => {
    const res = fakeRes()
    handleApi(state, req(`/api/loans/${state.batch}/99`), res)
    expect(res.statusCode).toBe(404)
  })

  it('404s an evicted/unknown batch instead of serving another one', () => {
    const res = fakeRes()
    handleApi(state, req('/api/loans/999999/1'), res)
    expect(res.statusCode).toBe(404)
  })

  it('404s page 0 (pages are 1-indexed)', () => {
    const res = fakeRes()
    handleApi(state, req(`/api/loans/${state.batch}/0`), res)
    expect(res.statusCode).toBe(404)
  })
})

describe('handleApi — /api/since (incremental catch-up)', () => {
  it('404s for a batch the server no longer retains', () => {
    const res = fakeRes()
    handleApi(state, req('/api/since/999999'), res)
    expect(res.statusCode).toBe(404)
  })

  it('returns nothing changed when the client is on the current batch', () => {
    const res = fakeRes()
    handleApi(state, req(`/api/since/${state.batch}`), res)
    expect(json(res)).toEqual([])
  })

  it('returns loans reprocessed after the client’s batch was built', () => {
    const s = createState()
    s.ready = true
    s.batches.set(1, { loanPages: [], keywordPages: [], klStart: {}, newestTime: 1000 })
    s.allLoans = [
      { ...loan(1), kl_processed: new Date(2000), kls_tags: [], kl_repayments: [] },
      { ...loan(2), kl_processed: new Date(500), kls_tags: [], kl_repayments: [] },
    ] as never

    const res = fakeRes()
    handleApi(s, req('/api/since/1'), res)
    const changed = json(res)
    expect(changed).toHaveLength(1) // only the one processed after newestTime
  })

  it('sends [] rather than a huge payload when too much changed', () => {
    // Past 500 the client is better off re-downloading the batch wholesale.
    const s = createState()
    s.ready = true
    s.batches.set(1, { loanPages: [], keywordPages: [], klStart: {}, newestTime: 0 })
    s.allLoans = Array.from({ length: 501 }, (_, i) => ({
      ...loan(i + 1), kl_processed: new Date(9999), kls_tags: [], kl_repayments: [],
    })) as never

    const res = fakeRes()
    handleApi(s, req('/api/since/1'), res)
    expect(json(res)).toEqual([])
  })
})

describe('handleApi — heartbeat', () => {
  it('always answers 200 so the client’s liveness ping cannot fail', () => {
    const res = fakeRes()
    expect(handleApi(state, req('/api/heartbeat/anything?install_id=x'), res)).toBe(true)
    expect(json(res)).toEqual({ status: 200 })
  })
})

describe('handleRss — click redirects', () => {
  it('sends a Kiva click to the loan page with the app id', () => {
    const res = fakeRes()
    expect(handleRss(state, req('/rss_click/kiva/12345'), res)).toBe(true)
    expect(res.statusCode).toBe(302)
    expect(String(res.headers.location)).toBe('https://www.kiva.org/lend/12345?app_id=org.kiva.kivalens')
  })

  it('sends a KivaLens click to the in-app loan route', () => {
    const res = fakeRes()
    handleRss(state, req('/rss_click/kivalens/12345'), res)
    expect(String(res.headers.location)).toBe('https://www.kivalens.org/loans/12345')
  })

  it('escapes the id rather than letting it alter the destination', () => {
    const res = fakeRes()
    handleRss(state, req('/rss_click/kiva/12%2F..%2Fevil'), res)
    const dest = String(res.headers.location)
    expect(dest.startsWith('https://www.kiva.org/lend/')).toBe(true)
    expect(dest).not.toContain('/../')
  })

  it('declines URLs that are not RSS', () => {
    const res = fakeRes()
    expect(handleRss(state, req('/index.html'), res)).toBe(false)
    expect(res.ended).toBe(false)
  })

  it('claims /rss/ paths (the feed itself is served asynchronously)', () => {
    const res = fakeRes()
    expect(handleRss(state, req('/rss/%7B%7D'), res)).toBe(true)
  })
})

/**
 * A ready state whose loans belong to an ACTIVE field partner. Loans with no
 * partner are "Direct", which the default MFI-only filter hides — so a feed
 * built from partnerless fixtures is legitimately empty.
 */
function rssState(loans: Array<Record<string, unknown>>) {
  const s = createState()
  s.ready = true
  s.rssReady = true
  s.partners = [{ id: 10, status: "active", countries: [{ iso_code: "KE" }] }] as never
  s.activePartners = s.partners
  s.allLoans = loans.map((l) => ({
    kl_processed: new Date(),
    kls_tags: [],
    kl_repayments: [],
    kl_still_needed: 500,
    kl_percent_women: 100,
    kl_name_arr: [],
    kls_use_or_descr_arr: [],
    partner_id: 10,
    ...l,
  })) as never
  return s
}

/** handleRss returns synchronously; the feed is written later. */
async function rssFeed(s: ReturnType<typeof createState>, criteria: unknown) {
  const res = fakeRes()
  handleRss(s, req(`/rss/${encodeURIComponent(JSON.stringify(criteria))}`), res)
  for (let i = 0; i < 200 && !res.ended; i++) await Promise.resolve()
  return res
}

describe('handleRss — feed generation', () => {
  it('rejects criteria that are not valid JSON', async () => {
    const res = fakeRes()
    handleRss(state, req('/rss/not-json%7B'), res)
    for (let i = 0; i < 50 && !res.ended; i++) await Promise.resolve()
    expect(res.statusCode).toBe(400)
  })

  it('refuses portfolio filters without a lender id instead of silently dropping them', async () => {
    // Quietly ignoring the filter would hand the user a feed that does not match
    // the search they saved.
    const res = await rssFeed(state, { portfolio: { exclude_portfolio_loans: 'true' } })
    expect(res.statusCode).toBe(400)
    expect(String(res.body)).toMatch(/lender id/i)
  })

  it('emits a well-formed feed with one item per matching loan', async () => {
    const s = rssState([loan(1), loan(2)])
    const res = await rssFeed(s, { feed: { name: 'My Feed' } })
    const xml = String(res.body)

    expect(xml.match(/<item>/g)).toHaveLength(2)

    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<title>My Feed</title>')
    expect(xml).toContain('<item>')
    expect(xml.match(/<\/item>/g)!.length).toBe(xml.match(/<item>/g)!.length)
    expect(String(res.headers['content-type'])).toMatch(/xml/)
  })

  it('falls back to a default feed name', async () => {
    const res = await rssFeed(state, { feed: { name: '   ' } })
    expect(String(res.body)).toContain('<title>KivaLens Feed</title>')
  })

  it('applies the saved criteria instead of feeding every loan', async () => {
    const s = rssState([loan(1, { sector: 'Agriculture' }), loan(2, { sector: 'Retail' })])
    const res = await rssFeed(s, { feed: { name: 'Ag only' }, loan: { sector: 'Agriculture' } })
    expect(String(res.body).match(/<item>/g)).toHaveLength(1)
  })

  it('links items to Kiva or to KivaLens per the feed setting', async () => {
    const s = rssState([loan(1)])
    const toKiva = await rssFeed(s, { feed: { name: 'f', link_to: 'kiva' } })
    expect(String(toKiva.body)).toContain('/rss_click/kiva/1')

    const toKl = await rssFeed(s, { feed: { name: 'f', link_to: 'kivalens' } })
    expect(String(toKl.body)).toContain('/rss_click/kivalens/1')
  })

  it('escapes XML metacharacters and strips XML-illegal control chars', async () => {
    // Guards the control-char class in xmlEscape: a raw 0x08 in borrower text
    // would make the feed unparseable for every subscriber.
    const s = rssState([loan(1, { name: 'A & B <script> "x"\x08\x00 end' })])

    const res = await rssFeed(s, { feed: { name: 'Esc & <Test>' } })
    const xml = String(res.body)

    expect(xml).toContain('Esc &amp; &lt;Test&gt;')
    expect(xml).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F]/) // no illegal chars survived
    // A bare '&' or '<' would break every XML parser reading the feed.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/)
  })
})
