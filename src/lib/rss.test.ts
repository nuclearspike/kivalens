import { describe, it, expect } from 'vitest'
// handleRss is plain JS in klCore; createState gives a baseline server state.
import { handleRss, createState } from '../../server/klCore.mjs'

function mockRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v
    },
    end(b?: string) {
      this.body = b ?? ''
    },
  }
}

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising',
  funded_amount: 0,
  loan_amount: 1000,
  location: { country_code: 'KE', country: 'Kenya' },
  terms: { repayment_interval: 'monthly' },
  kls_tags: [],
  themes: [],
  borrower_count: 1,
  kl_percent_women: 100,
  kl_still_needed: 500,
  kl_percent_funded: 50,
  kl_name_arr: [],
  kls_use_or_descr_arr: [],
  kl_newest_sort: 0,
  posted_date: '2026-06-01',
  name: 'Borrower',
  description: { texts: { en: 'A loan description' } },
  ...o,
})

const state = {
  ...createState(),
  allLoans: [
    mkLoan({ id: 1, sector: 'Agriculture', partner_id: 10, name: 'Aisha' }),
    mkLoan({ id: 2, sector: 'Retail', partner_id: 20, name: 'Bao & Co <Ltd>' }),
  ],
  activePartners: [
    { id: 10, status: 'active', kl_regions: ['af'], kl_sp: [], countries: [{ iso_code: 'KE' }], rating: 5 },
    { id: 20, status: 'active', kl_regions: ['as'], kl_sp: [], countries: [{ iso_code: 'KE' }], rating: 3 },
  ],
  atheistListProcessed: false,
}

const call = (url: string) => {
  const res = mockRes()
  const handled = handleRss(state, { url, headers: { host: 'www.kivalens.org' } }, res)
  return { handled, res }
}
const feedUrl = (crit: object) => '/rss/' + encodeURIComponent(JSON.stringify(crit))

describe('handleRss feed', () => {
  it('returns valid RSS 2.0 with the right content-type and items', () => {
    const { handled, res } = call(feedUrl({ feed: { name: 'My Feed', link_to: 'kiva' } }))
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/rss\+xml/)
    expect(res.body).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(res.body).toContain('<rss version="2.0"')
    expect(res.body).toContain('<title>My Feed</title>')
    expect(res.body).toContain('<title>Aisha</title>')
    expect(res.body).toContain('https://www.kivalens.org/rss_click/kiva/1')
    expect((res.body.match(/<item>/g) || []).length).toBe(2)
  })

  it('XML-escapes titles/descriptions', () => {
    const { res } = call(feedUrl({ feed: { name: 'F', link_to: 'kiva' } }))
    expect(res.body).toContain('Bao &amp; Co &lt;Ltd&gt;')
  })

  it('applies loan criteria to the feed (sector) and link_to=kivalens', () => {
    const { res } = call(feedUrl({ feed: { name: 'Ag', link_to: 'kivalens' }, loan: { sector: 'Agriculture' } }))
    expect((res.body.match(/<item>/g) || []).length).toBe(1)
    expect(res.body).toContain('<title>Aisha</title>')
    expect(res.body).not.toContain('Bao')
    expect(res.body).toContain('rss_click/kivalens/1')
  })

  it('returns 400 on malformed criteria', () => {
    const { res } = call('/rss/not-valid-json')
    expect(res.statusCode).toBe(400)
  })

  it('does not handle unrelated urls', () => {
    expect(call('/api/whatever').handled).toBe(false)
  })
})

describe('handleRss click redirect', () => {
  it('redirects to the Kiva lend page for link_to=kiva', () => {
    const { handled, res } = call('/rss_click/kiva/12345')
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('https://www.kiva.org/lend/12345?app_id=org.kiva.kivalens')
  })

  it('redirects to the KivaLens loan view otherwise', () => {
    const { res } = call('/rss_click/kivalens/777')
    expect(res.headers['location']).toBe('https://www.kivalens.org/#/search/loan/777')
  })
})
