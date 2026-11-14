/**
 * On 2026-10-10 the server published a batch in which 200 of 6,709 loans had come
 * without their details (Kiva had not answered four detail requests). One such
 * loan made the page give up the whole batch and fetch every loan from Kiva,
 * which takes minutes, so every visitor had the slow load until the next batch.
 *
 * A loan the page cannot use costs only itself: the rest of the batch loads at
 * once, and Kiva is asked for the loans left out.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKivaLoans, type Loans, type NotifyMessage } from './kiva'
import { LoanWithoutDetails, ResultProcessors } from './kivajs/ResultProcessors'
import { held } from '../test/lateWork'

/** A loan as the server's batch carries it (compressLoan in server/klCore.mjs). */
const served = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Borrower ${id}`,
  image: { id: 6360988 },
  activity: 'Farming',
  sector: 'Agriculture',
  use: 'to buy seed.',
  location: { country_code: 'KE', country: 'Kenya' },
  partner_id: 10,
  posted_date: '2026-10-01T07:10:32Z',
  planned_expiration_date: '2026-11-05T08:10:32Z',
  loan_amount: 1000,
  terms: { disbursal_date: '2026-09-14T07:00:00Z', repayment_interval: 'Monthly', loss_liability: { nonpayment: 'lender', currency_exchange: 'lender' } },
  kls_has_descr: true,
  kls_half_back: '2027-03-01T00:00:00.000Z',
  kls_half_back_actual: 50,
  kls_75_back: '2027-06-01T00:00:00.000Z',
  kls_75_back_actual: 75,
  kls_final_repayment: '2027-09-01T07:00:00.000Z',
  kls_repaid_in: 11,
  klb: { F: 1 },
  kls: true,
  ...extra,
})

/** A loan as the server sent it that day when its details had not arrived: field for field from batch 12571. */
const withoutDetails = (id: number) => ({
  id,
  name: `Borrower ${id}`,
  image: { id: 6335738 },
  activity: 'Retail',
  sector: 'Retail',
  use: 'buy cleaning products to build up her inventory.',
  location: { country_code: 'NI', country: 'Nicaragua' },
  partner_id: 10,
  posted_date: '2026-10-05T16:53:53Z',
  planned_expiration_date: '2026-11-09T17:53:53Z',
  loan_amount: 1000,
  bonus_credit_eligibility: true,
  kls_tags: ['#Parent'],
  kls_has_descr: false,
  klb: {},
  kls: true,
})

/** Kiva's own answer for a loan (api.kivaws.org/v1/loans/<ids>.json). */
const fromKiva = (id: number) => ({
  id,
  name: `Borrower ${id}`,
  status: 'fundraising',
  funded_amount: 100,
  basket_amount: 0,
  loan_amount: 1000,
  posted_date: '2026-10-05T16:53:53Z',
  planned_expiration_date: '2026-11-09T17:53:53Z',
  sector: 'Retail',
  activity: 'Retail',
  use: 'buy cleaning products to build up her inventory.',
  location: { country_code: 'NI', country: 'Nicaragua' },
  partner_id: 10,
  description: { languages: ['en'], texts: { en: 'She sells soap from her house.' } },
  terms: {
    disbursal_date: '2026-09-20T07:00:00Z',
    repayment_interval: 'Monthly',
    scheduled_payments: [
      { due_date: '2027-01-01T08:00:00Z', amount: 500 },
      { due_date: '2027-02-01T08:00:00Z', amount: 500 },
    ],
    local_payments: [],
    loss_liability: { nonpayment: 'lender', currency_exchange: 'lender' },
  },
  borrowers: [{ first_name: 'Alondra', last_name: '', gender: 'F' }],
  tags: [],
})

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

/** The KivaLens server and Kiva, as far as a catalog load reaches them. */
function fakeNetwork(pages: unknown[][], kivaRefuses: (ids: number[]) => boolean = () => false, failing: (url: string) => number | undefined = () => undefined) {
  const asked: string[] = []
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    asked.push(url)
    const status = failing(url)
    if (status) return { ok: false, status, json: async () => ({}), text: async () => '' } as unknown as Response
    if (url.endsWith('/api/start')) return ok({ batch: 7, pages: pages.length, loanLengths: pages.map(() => 1000), descrLengths: pages.map(() => 100), builtAt: Date.now() })
    if (url.includes('/api/partners')) return ok([{ id: 10, name: 'Test MFI', status: 'active', countries: [{ iso_code: 'KE', region: 'Africa' }], start_date: '2010-01-01T00:00:00Z' }])
    let m
    if ((m = /\/api\/loans\/7\/keywords\/(\d+)/.exec(url))) return ok((pages[Number(m[1]) - 1] as Array<{ id: number }>).filter((l) => l && typeof l === 'object').map((l) => ({ id: l.id, t: ['SEED'] })))
    if ((m = /\/api\/loans\/7\/(\d+)/.exec(url))) return ok(pages[Number(m[1]) - 1])
    if (url.includes('/api/since/7')) return ok([])
    if ((m = /api\.kivaws\.org\/v1\/loans\/([\d,]+)\.json/.exec(url))) {
      const wanted = m[1].split(',').map(Number)
      // Kiva answers a request holding one id it does not know with an error for the whole request.
      if (kivaRefuses(wanted)) return { ok: false, status: 404, json: async () => ({ message: 'Invalid loan ID' }), text: async () => '' } as unknown as Response
      return ok({ loans: wanted.map(fromKiva) })
    }
    if (url.includes('loans/search.json')) return ok({ paging: { page: 1, pages: 1, total: 0 }, loans: [] })
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as unknown as Response
  })
  return { fetchStub, asked }
}

let kl: Loans
let reported: Error[]
let originalFetch: typeof globalThis.fetch
const ids = () => kl.loansFromKiva.map((l) => l.id).sort((a, b) => a - b)

/** Starts a catalog load and resolves with what the page was told, in order. */
function load(fetchStub: typeof globalThis.fetch) {
  globalThis.fetch = fetchStub
  kl = createKivaLoans()
  const heard: NotifyMessage[] = []
  // What the catalog held at the moment each new_loans was announced.
  const whenAnnounced: number[][] = []
  kl.onNotify((msg) => {
    heard.push(msg)
    if (msg.new_loans) whenAnnounced.push(kl.loansFromKiva.map((l) => l.id).sort((a, b) => a - b))
  })
  void kl.init({}, () => ({ mergeAtheistList: false }), { maxConcurrent: 8 })
  const until = (what: (msg: NotifyMessage) => unknown) => vi.waitFor(() => expect(heard.some((m) => what(m))).toBe(true), { timeout: 4000 })
  return { heard, until, whenAnnounced }
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  reported = []
  ;(globalThis as { reportError?: (e: unknown) => void }).reportError = (e) => reported.push(e as Error)
})
afterEach(() => {
  kl?.kill()
  globalThis.fetch = originalFetch
  delete (globalThis as { reportError?: unknown }).reportError
})

// Each test uses loan ids of its own: requests to Kiva for the same ids are shared
// while one is in flight (req.ts), across the catalogs of two tests as well.
describe('a batch from the server that holds loans without their details', () => {
  it('loads at once with every other loan, and never falls back to fetching the catalog from Kiva', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(11), withoutDetails(12), served(13)], [withoutDetails(14), served(15)]])
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)

    // The loans with details are all there the moment the batch is in.
    expect(kl.isReady()).toBe(true)
    expect([11, 13, 15].every((id) => kl.hasLoan(id))).toBe(true)
    expect(kl.getById(11)).toMatchObject({ status: 'fundraising', kls_repaid_in: 11, borrower_count: 1 })
    // The fast path went on to its next step, the changes since the batch.
    await vi.waitFor(() => expect(asked.some((u) => u.includes('/api/since/7'))).toBe(true))
    await until((m) => m.new_loans)
    // And the page never went to Kiva's listing for the catalog: that is the slow load.
    expect(asked.filter((u) => u.includes('loans/search.json'))).toEqual([])
  })

  it('asks Kiva for the loans left out, and adds them with their details', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(21), withoutDetails(22), served(23)], [withoutDetails(24), served(25)]])
    const { until, whenAnnounced } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await until((m) => m.new_loans)

    // They are in the catalog by the time they are announced: the list is rebuilt
    // from the catalog on that announcement, and showed none of them when it came first.
    expect(whenAnnounced).toEqual([[21, 22, 23, 24, 25]])

    // One request, for exactly the loans the batch came without.
    expect(asked.filter((u) => u.includes('api.kivaws.org')).map((u) => /\/loans\/([\d,]+)\.json/.exec(u)?.[1])).toEqual(['22,24'])
    expect(ids()).toEqual([21, 22, 23, 24, 25])
    // With what the batch could not give them: the story, the terms and the schedule.
    const completed = kl.getById(22)!
    expect(completed.description.texts.en).toBe('She sells soap from her house.')
    expect(completed.terms.repayment_interval).toBe('Monthly')
    expect(completed.kl_repayments?.length).toBeGreaterThan(0)
    expect(completed.borrowers).toHaveLength(1)
  })

  it('asks a hundred at a time, each request on its own: one Kiva refuses does not cost the others', async () => {
    const bare = Array.from({ length: 250 }, (_, i) => withoutDetails(1000 + i))
    const { fetchStub, asked } = fakeNetwork([[served(71), ...bare]], (wanted) => wanted.includes(1150))
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await vi.waitFor(() => expect(kl.loansFromKiva.length).toBe(1 + 150), { timeout: 4000 })
    expect(asked.filter((u) => u.includes('api.kivaws.org')).map((u) => /\/loans\/([\d,]+)\.json/.exec(u)![1].split(',').length)).toEqual([100, 100, 50])
    // The hundred with the id Kiva refused are not in; the rest are.
    expect(kl.hasLoan(1099)).toBe(true)
    expect(kl.hasLoan(1100)).toBe(false)
    expect(kl.hasLoan(1249)).toBe(true)
  })

  it('tells the error collector, without a loan id or a count in the message', async () => {
    const { fetchStub } = fakeNetwork([[served(31), withoutDetails(32), withoutDetails(33)]])
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await until((m) => m.new_loans)
    // Once for the page of the batch, however many loans it left out.
    expect(reported.map((e) => e.message)).toEqual(['Loans left out of a batch: The server sent a loan without its details'])
  })

  it('leaves out an entry that is no loan at all, and has nothing to ask Kiva for', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(41), null, 'loan', 17, served(42)]])
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await vi.waitFor(() => expect(asked.some((u) => u.includes('/api/loans/7/keywords/1'))).toBe(true))
    expect(ids()).toEqual([41, 42])
    expect(asked.filter((u) => u.includes('api.kivaws.org'))).toEqual([])
  })

  it('asks Kiva for a loan it could not process for any other reason too', async () => {
    // A name that is not text stops processing; Kiva's own copy of the loan is whole.
    const { fetchStub } = fakeNetwork([[served(51), served(52, { name: 17 })]])
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await until((m) => m.new_loans)
    expect(ids()).toEqual([51, 52])
    expect(kl.getById(52)!.name).toBe('Borrower 52')
  })

  it('falls back to Kiva only when the batch holds nothing it can use', async () => {
    const { fetchStub, asked } = fakeNetwork([[withoutDetails(61), withoutDetails(62)]])
    load(fetchStub as unknown as typeof fetch)
    await vi.waitFor(() => expect(asked.some((u) => u.includes('loans/search.json'))).toBe(true), { timeout: 4000 })
    expect(kl.loansFromKiva).toEqual([])
  })
})

describe('processing a batch of loans', () => {
  it('returns the loans it could process and hands over the ones it could not, with why', () => {
    const leftOut: Array<[unknown, unknown]> = []
    const batch = [served(1), withoutDetails(2), null, served(3)]
    const kept = ResultProcessors.processLoans(batch, (loan, error) => leftOut.push([loan, error]))
    expect(kept.map((l) => l.id)).toEqual([1, 3])
    expect(kept.every((l) => l.kl_processed instanceof Date)).toBe(true)
    expect(leftOut.map(([loan]) => (loan as { id?: number } | null)?.id)).toEqual([2, undefined])
    expect(leftOut[0][1]).toBeInstanceOf(LoanWithoutDetails)
  })

  it('reports once for the batch, with the first reason', () => {
    ResultProcessors.processLoans([withoutDetails(1), withoutDetails(2), null])
    expect(reported.map((e) => e.message)).toEqual(['Loans left out of a batch: The server sent a loan without its details'])
  })

  it('reports nothing for a batch it could process whole', () => {
    expect(ResultProcessors.processLoans([served(1), served(2)])).toHaveLength(2)
    expect(reported).toEqual([])
  })

  it('does not lose the batch to a callback that throws, or to there being no collector', () => {
    delete (globalThis as { reportError?: unknown }).reportError
    const kept = ResultProcessors.processLoans([withoutDetails(1), served(2)], () => {
      throw new Error('bookkeeping broke')
    })
    expect(kept.map((l) => l.id)).toEqual([2])
  })

  it('still takes a loan from Kiva’s listing, which never has terms: only the server’s loans must', () => {
    const listed = { id: 9, name: 'Listed', posted_date: '2026-10-05T16:53:53Z', loan_amount: 500, status: 'fundraising', description: { languages: ['en'] } }
    expect(ResultProcessors.processLoans([listed]).map((l) => l.id)).toEqual([9])
    expect(reported).toEqual([])
  })

  it('setKivaLoans takes in only the loans that could be processed', () => {
    kl = createKivaLoans()
    kl.setKivaLoans([withoutDetails(1), served(2)] as never, true, true)
    expect(ids()).toEqual([2])
    kl.setKivaLoans([withoutDetails(3)] as never, false)
    expect(ids()).toEqual([2])
  })
})

// The page carries on past each of these, the slower way or with less; without a report nothing records it.
describe('a failure the catalog carries on past is reported', () => {
  const messages = () => reported.map((e) => e.message)
  const reportedOnce = (message: string) => vi.waitFor(() => expect(messages().filter((m) => m === message)).toHaveLength(1), { timeout: 4000 })

  it('no batch ready on this site, so the whole catalog comes from Kiva', async () => {
    const { fetchStub, asked } = fakeNetwork([])
    load(fetchStub as unknown as typeof fetch)
    await reportedOnce('This site had no loan batch ready, so the catalog was loaded from Kiva')
    await vi.waitFor(() => expect(asked.some((u) => u.includes('loans/search.json'))).toBe(true))
  })

  it('this site’s batch failing, so the catalog comes from Kiva', async () => {
    const { fetchStub } = fakeNetwork([[served(81)]], undefined, (url) => (/\/api\/loans\/7\/\d+$/.test(url) ? 503 : undefined))
    load(fetchStub as unknown as typeof fetch)
    await reportedOnce('Loading the catalog from this site failed, so it was loaded from Kiva: HTTP 503')
  })

  it('the loans changed since the batch', async () => {
    const { fetchStub } = fakeNetwork([[served(82)]], undefined, (url) => (url.includes('/api/since/7') ? 503 : undefined))
    const { until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await reportedOnce('Reading the loans changed since the batch from this site failed: HTTP 503')
  })

  it('the loan descriptions, without which a keyword search finds nothing', async () => {
    const { fetchStub } = fakeNetwork([[served(83)]], undefined, (url) => (url.includes('/keywords/') ? 503 : undefined))
    load(fetchStub as unknown as typeof fetch)
    await reportedOnce('Loading loan descriptions from this site failed: HTTP 503')
  })

  it('this site’s partners, read from Kiva instead, and Kiva failing too, each once', async () => {
    const { fetchStub } = fakeNetwork([[served(84)]], undefined, (url) => (url.includes('/api/partners') ? 503 : undefined))
    const { until } = load(fetchStub as unknown as typeof fetch)
    await reportedOnce('Reading partners from this site failed, so they were read from Kiva: HTTP 503')
    await vi.waitFor(() => expect(messages().filter((m) => m.startsWith('Reading partners from Kiva failed: '))).toHaveLength(1), { timeout: 4000 })
    await until((m) => m.failed)
    expect(messages().filter((m) => m.startsWith('Reading partners'))).toHaveLength(2)
  })
})

// Each catalog a test makes is killed when the test ends (afterEach above). A killed catalog
// starts nothing more, so nothing it had scheduled reaches the network after its test, through
// another test's stub, or through the real fetch the test put back.
describe('a catalog that has been killed', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  // Longer than every delay a catalog keeps: the catch-up after a fresh batch (five minutes) and
  // the partner refresh (a day).
  const LATER = 25 * 60 * 60_000

  /** The network, with the first request `match` picks held until the test lets it through. */
  function holding(pages: unknown[][], match: (url: string) => boolean, failing?: (url: string) => number | undefined) {
    const { fetchStub } = fakeNetwork(pages, undefined, failing)
    const gate = held<void>()
    const asked: string[] = []
    let holdingOne = true
    const stub = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (holdingOne && match(url)) {
        holdingOne = false
        await gate.promise
      }
      return fetchStub(input)
    })
    return { stub: stub as unknown as typeof fetch, asked, release: () => gate.resolve() } as { stub: typeof fetch; asked: string[]; release: () => void }
  }

  /**
   * Starts a catalog, kills it once `ready` holds (a request is held then), lets the held request
   * through, and returns everything the catalog asked for after it was killed.
   */
  async function killedWhile(network: ReturnType<typeof holding>, ready: () => boolean, options: Record<string, unknown> = {}) {
    globalThis.fetch = network.stub
    kl = createKivaLoans()
    const heard: NotifyMessage[] = []
    kl.onNotify((msg) => { heard.push(msg) })
    void kl.init({}, () => ({ mergeAtheistList: false, ...options }), { maxConcurrent: 8 })
    await vi.waitFor(() => expect(ready()).toBe(true), { timeout: 4000 })
    const before = network.asked.length
    const heardBefore = heard.length
    kl.kill()
    // A killed catalog keeps no timer: no start-up, catch-up, partner refresh or lender read.
    expect(vi.getTimerCount()).toBe(0)
    network.release()
    await vi.advanceTimersByTimeAsync(LATER)
    return { askedAfter: network.asked.slice(before), heardAfter: heard.slice(heardBefore) }
  }

  it('killed before it starts, asks for nothing, not even for the lender’s own loans', async () => {
    const { fetchStub } = fakeNetwork([[served(901)]])
    globalThis.fetch = fetchStub as unknown as typeof fetch
    kl = createKivaLoans()
    void kl.init({}, () => ({ mergeAtheistList: false, kiva_lender_id: 'somelender' }), { maxConcurrent: 8 })
    kl.kill()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(LATER)
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('killed once loaded, asks for nothing more: no catch-up, no partner refresh', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(902), served(903)]])
    const { heard, until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    // The batch's descriptions are the last of the load itself.
    await vi.waitFor(() => expect(heard.some((m) => m.all_descriptions_loaded)).toBe(true), { timeout: 4000 })
    const before = asked.length
    kl.kill()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(LATER)
    expect(asked.slice(before)).toEqual([])
  })

  it('killed while it asks this site where to start, stops there', async () => {
    const network = holding([[served(904)]], (url) => url.endsWith('/api/start'))
    const { askedAfter } = await killedWhile(network, () => network.asked.includes('/api/start'))
    expect(askedAfter).toEqual([])
  })

  it('killed while a page of the batch is on its way, asks for nothing after it', async () => {
    const network = holding([[served(907)]], (url) => /\/api\/loans\/7\/1$/.test(url))
    const { askedAfter } = await killedWhile(network, () => network.asked.some((u) => /\/api\/loans\/7\/1$/.test(u)))
    expect(askedAfter).toEqual([])
  })

  it('killed while a page that then fails is on its way, does not go on to load from Kiva', async () => {
    const network = holding([[served(908)]], (url) => /\/api\/loans\/7\/1$/.test(url), (url) => (/\/api\/loans\/7\/1$/.test(url) ? 503 : undefined))
    const { askedAfter } = await killedWhile(network, () => network.asked.some((u) => /\/api\/loans\/7\/1$/.test(u)))
    expect(askedAfter).toEqual([])
  })

  it('killed while it asks for the loans changed since the batch, starts nothing that comes after the load', async () => {
    const network = holding([[served(909)]], (url) => url.includes('/api/since/7'))
    const { askedAfter, heardAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('/api/since/7')))
    expect(askedAfter).toEqual([])
    expect(heardAfter.filter((m) => m.loans_loaded)).toEqual([])
  })

  it('killed while it downloads the descriptions, asks for no further page of them', async () => {
    const network = holding([[served(910)], [served(911)]], (url) => url.includes('/keywords/1'))
    const { askedAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('/keywords/1')))
    expect(askedAfter).toEqual([])
  })

  it('killed while it loads the catalog from Kiva itself, takes in nothing of it', async () => {
    const network = holding([[served(912)]], (url) => url.includes('loans/search.json'))
    // Kiva's search (asked for ids only) finds one loan, so the load has something to take in.
    const plain = network.stub
    network.stub = (async (input: RequestInfo | URL) => {
      const answer = await plain(input)
      return String(input).includes('loans/search.json') ? ok({ paging: { page: 1, pages: 1, total: 1 }, loans: [912] }) : answer
    }) as typeof fetch
    const { askedAfter, heardAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('loans/search.json')), { loansFromKiva: true })
    // The search already under way finishes its own request for the loans' details; nothing else
    // is asked, and nothing it found is taken in.
    expect(askedAfter.filter((url) => !url.startsWith('https://api.kivaws.org/v1/loans/'))).toEqual([])
    expect(heardAfter.filter((m) => m.loans_loaded)).toEqual([])
  })

  it('killed while it catches up from Kiva, starts no refresh of its loans', async () => {
    const { fetchStub } = fakeNetwork([[served(905), served(906)]])
    const searchAnswered = held<void>()
    const asked: string[] = []
    const stub = vi.fn(async (input: RequestInfo | URL) => {
      asked.push(String(input))
      if (String(input).includes('loans/search.json')) await searchAnswered.promise
      return fetchStub(input)
    })
    const { heard, until } = load(stub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await vi.waitFor(() => expect(heard.some((m) => m.all_descriptions_loaded)).toBe(true), { timeout: 4000 })
    void kl.backgroundResync()
    await vi.advanceTimersByTimeAsync(20)
    const before = asked.length
    expect(asked[before - 1]).toContain('loans/search.json')
    kl.kill()
    searchAnswered.resolve()
    await vi.advanceTimersByTimeAsync(LATER)
    expect(asked.slice(before)).toEqual([])
  })

  it('asked to catch up once killed, asks nothing', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(913)]])
    const { heard, until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await vi.waitFor(() => expect(heard.some((m) => m.all_descriptions_loaded)).toBe(true), { timeout: 4000 })
    const before = asked.length
    kl.kill()
    await kl.backgroundResync()
    await vi.advanceTimersByTimeAsync(LATER)
    expect(asked.slice(before)).toEqual([])
  })

  it("killed while this site's partners are on their way, does not go on to Google's list of them", async () => {
    const network = holding([[served(914)]], (url) => url.includes('/api/partners'))
    const { askedAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('/api/partners')), { mergeAtheistList: true })
    // Pages asked for before the kill still go out once the partners are in; nothing new does.
    expect(askedAfter.filter((url) => url.includes('/proxy/gdocs/'))).toEqual([])
  })

  it("killed while this site's partners are on their way, and they fail, does not go on to read them from Kiva", async () => {
    const network = holding([[served(915)]], (url) => url.includes('/api/partners'), (url) => (url.includes('/api/partners') ? 503 : undefined))
    const { askedAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('/api/partners')))
    expect(askedAfter.filter((url) => url.includes('api.kivaws.org/v1/partners'))).toEqual([])
    expect(reported.map((e) => e.message).filter((m) => m.startsWith('Reading partners from this site failed'))).toEqual([])
  })

  it('killed while it downloads the last page of descriptions, takes none of them in', async () => {
    const network = holding([[served(916)]], (url) => url.includes('/keywords/1'))
    const { heardAfter } = await killedWhile(network, () => network.asked.some((u) => u.includes('/keywords/1')))
    expect(heardAfter.filter((m) => m.all_descriptions_loaded)).toEqual([])
  })

  it('killed while it looks for the rest of the catalog at Kiva, asks for none of what it found', async () => {
    // Kiva's catalog: one loan within the repayment limit, and one more the second search finds.
    const { fetchStub } = fakeNetwork([[served(917)]])
    const secondSearch = held<void>()
    const asked: string[] = []
    let searches = 0
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (url.includes('loans/search.json')) {
        searches++
        if (searches === 2) await secondSearch.promise
        return ok({ paging: { page: 1, pages: 1, total: searches === 1 ? 1 : 2 }, loans: searches === 1 ? [917] : [917, 918] })
      }
      return fetchStub(input)
    }) as unknown as typeof fetch
    kl = createKivaLoans()
    void kl.init({}, () => ({ mergeAtheistList: false, loansFromKiva: true, maxRepaymentTerms_on: true, maxRepaymentTerms: 12 }), { maxConcurrent: 8 })
    await vi.waitFor(() => expect(searches).toBe(2), { timeout: 4000 })
    const before = asked.length
    kl.kill()
    secondSearch.resolve()
    await vi.advanceTimersByTimeAsync(LATER)
    expect(asked.slice(before).filter((url) => url.includes('/v1/loans/918'))).toEqual([])
  })

  it('killed during the pause before it takes the descriptions in, keeps no timer and takes none in', async () => {
    const { fetchStub, asked } = fakeNetwork([[served(919)]])
    const { heard, until } = load(fetchStub as unknown as typeof fetch)
    await until((m) => m.loans_loaded)
    await vi.waitFor(() => expect(asked.some((u) => u.includes('/keywords/1'))).toBe(true), { timeout: 4000 })
    // Less than the 200 ms pause: the descriptions are in, not yet taken in.
    await vi.advanceTimersByTimeAsync(50)
    expect(heard.some((m) => m.all_descriptions_loaded)).toBe(false)
    const heardBefore = heard.length
    kl.kill()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(LATER)
    expect(heard.slice(heardBefore).filter((m) => m.all_descriptions_loaded)).toEqual([])
  })

  it('killed just before the pause before taking the descriptions in, sets no timer and takes none in', async () => {
    const network = holding([[served(920)]], (url) => url.includes('/keywords/1'))
    globalThis.fetch = network.stub
    kl = createKivaLoans()
    const heard: NotifyMessage[] = []
    kl.onNotify((msg) => { heard.push(msg) })
    void kl.init({}, () => ({ mergeAtheistList: false }), { maxConcurrent: 8 })
    await vi.waitFor(() => expect(network.asked.some((u) => u.includes('/keywords/1'))).toBe(true), { timeout: 4000 })
    // The load waits here for the loans to be processed; the test holds that step.
    const processed = held<void>()
    kl._loansProcessedPromise = processed.promise
    network.release()
    await vi.advanceTimersByTimeAsync(0)
    kl.kill()
    processed.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(LATER)
    expect(heard.filter((m) => m.all_descriptions_loaded)).toEqual([])
  })
})
