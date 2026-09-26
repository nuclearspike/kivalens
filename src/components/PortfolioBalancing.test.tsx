// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { I18nProvider } from '../i18n'
import BalancingNote from './BalancingNote'
import { Loans, getKivaLoans } from '../api/kiva'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { applyBalancerData } from '../lib/balancerEvents'
import type { Criteria, KivaLoan, Partner } from '../types'

/**
 * Paul, 2026-09-26: "when i selected the the preset "Countries I don't have" it looked
 * like it worked but when i investigated, it hadn't actually looked at my portfolio."
 * The browser side: one copy of the lender's portfolio distribution, read on demand
 * for whatever search is being filtered, the search filtered again when it arrives,
 * and a note under the count when a balancer that is on cannot apply.
 */

afterEach(cleanup)

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Kiva's SuperGraph answer: slice ids in data, their names in the lookup. */
const superGraph = (pairs: Array<[string, string, number]>) => ({
  data: pairs.map(([id, , value]) => ({ name: id, value: String(value) })),
  lookup: Object.fromEntries(pairs.map(([id, name]) => [id, name])),
})

describe('the lender’s portfolio distribution: one copy, read on demand', () => {
  it('reads a slice once however many filters ask, says while it reads, and says when it has', async () => {
    const kl = new Loans()
    kl.lenderId = 'a'
    const fetch = vi.fn(async () => superGraph([['2', 'Kenya', 6], ['5', 'Uganda', 4]]))
    kl.fetchSuperGraphData = fetch
    const events: unknown[] = []
    kl.onNotify((m) => events.push(m))

    expect(kl.balancerSlices('country', 'all')).toBeNull()
    expect(kl.balancerSlices('country', 'all')).toBeNull()
    await settle()
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ sliceBy: 'country', include: 'all', subject_id: 'a', type: 'lender' }))
    expect(kl.balancerSlices('country', 'all')).toEqual([
      { id: '2', name: 'Kenya', value: 6, percent: 60 },
      { id: '5', name: 'Uganda', value: 4, percent: 40 },
    ])
    expect(events).toContainEqual({ filter_dependency_event: { key: 'portfolio-balancer:read:country:all', state: 'started' } })
    expect(events).toContainEqual({ filter_dependency_event: { key: 'portfolio-balancer:read:country:all', state: 'done' } })
    expect(events).toContainEqual({ balancer_data_event: { sliceBy: 'country', include: 'all', failed: false } })
  })

  it('keeps what it read for an hour, then reads it again, lending the old copy meanwhile', async () => {
    const kl = new Loans()
    kl.lenderId = 'a'
    let kenya = 6
    kl.fetchSuperGraphData = vi.fn(async () => superGraph([['2', 'Kenya', kenya]]))
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000_000)
    await kl.loadBalancerData('country', 'all')
    now.mockReturnValue(1_000_000 + 59 * 60_000)
    expect(kl.balancerSlices('country', 'all')?.[0].value).toBe(6)
    await settle()
    expect(kl.fetchSuperGraphData).toHaveBeenCalledTimes(1)
    now.mockReturnValue(1_000_000 + 61 * 60_000)
    kenya = 7
    expect(kl.balancerSlices('country', 'all')?.[0].value).toBe(6)
    await settle()
    await settle()
    expect(kl.balancerSlices('country', 'all')?.[0].value).toBe(7)
    now.mockRestore()
  })

  it('does not ask Kiva again for a slice it would not return, until told to retry', async () => {
    const kl = new Loans()
    kl.lenderId = 'a'
    kl.fetchSuperGraphData = vi.fn(async () => {
      throw new Error('502')
    })
    const events: Array<Record<string, unknown>> = []
    kl.onNotify((m) => events.push(m))
    kl.balancerSlices('country', 'all')
    await settle()
    await settle()
    expect(kl.balancerFailures()).toEqual([{ sliceBy: 'country', include: 'all' }])
    expect(events).toContainEqual({ balancer_data_event: { sliceBy: 'country', include: 'all', failed: true } })
    kl.balancerSlices('country', 'all')
    await settle()
    expect(kl.fetchSuperGraphData).toHaveBeenCalledTimes(1)
    kl.retryBalancerData()
    kl.balancerSlices('country', 'all')
    await settle()
    await settle()
    expect(kl.fetchSuperGraphData).toHaveBeenCalledTimes(2)
  })

  it('keeps applying the last copy when a later re-read fails, and does not report it as unread', async () => {
    const kl = new Loans()
    kl.lenderId = 'a'
    let up = true
    kl.fetchSuperGraphData = vi.fn(async () => {
      if (!up) throw new Error('502')
      return superGraph([['2', 'Kenya', 1]])
    })
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000_000)
    await kl.loadBalancerData('country', 'all')
    now.mockReturnValue(1_000_000 + 61 * 60_000)
    up = false
    expect(kl.balancerSlices('country', 'all')?.map((s) => s.name)).toEqual(['Kenya'])
    await settle()
    await settle()
    expect(kl.balancerSlices('country', 'all')?.map((s) => s.name)).toEqual(['Kenya'])
    expect(kl.balancerFailures()).toEqual([])
    now.mockRestore()
  })

  it('keeps each lender’s portfolio apart', async () => {
    const kl = new Loans()
    kl.lenderId = 'a'
    kl.fetchSuperGraphData = vi.fn(async (params: Record<string, string>) =>
      superGraph(params.subject_id === 'a' ? [['2', 'Kenya', 1]] : [['8', 'Honduras', 1]]),
    )
    await kl.loadBalancerData('country', 'all')
    kl.lenderId = 'b'
    expect(kl.balancerSlices('country', 'all')).toBeNull()
    await settle()
    await settle()
    expect(kl.balancerSlices('country', 'all')?.map((s) => s.name)).toEqual(['Honduras'])
  })

  it('asks nothing for a lender it does not know', () => {
    const kl = new Loans()
    kl.fetchSuperGraphData = vi.fn()
    kl.lenderId = ''
    expect(kl.balancerSlices('country', 'all')).toBeNull()
    expect(kl.fetchSuperGraphData).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// The report itself, through the app's own loan client and stores.
// ---------------------------------------------------------------------------

const mkLoan = (id: number, partnerId: number | null, code: string, country: string) =>
  ({
    id, partner_id: partnerId, status: 'fundraising', funded_amount: 0, loan_amount: 1000,
    location: { country_code: code, country }, terms: { repayment_interval: 'Monthly' },
    kls_tags: [], themes: [], borrower_count: 1, kl_percent_women: 100, kl_still_needed: 500,
    kl_percent_funded: 50, kl_name_arr: [], kls_use_or_descr_arr: [], kl_newest_sort: 0,
    posted_date: '2026-06-01', sector: 'Retail', activity: 'Retail',
  }) as unknown as KivaLoan
const LOANS = [mkLoan(1, 10, 'KE', 'Kenya'), mkLoan(2, 20, 'UG', 'Uganda'), mkLoan(3, 20, 'PE', 'Peru'), mkLoan(4, 10, 'KE', 'Kenya'), mkLoan(5, null, 'US', 'United States')]
const PARTNERS = [
  { id: 10, status: 'active', rating: 5, kl_regions: [], kl_sp: [], countries: [{ iso_code: 'KE' }] },
  { id: 20, status: 'active', rating: 2, kl_regions: [], kl_sp: [], countries: [{ iso_code: 'PE' }] },
] as unknown as Partner[]

// "Countries I Don't Have" as an address or Back brings it: the settings, no list.
const COUNTRIES_I_DONT_HAVE = {
  loan: {},
  partner: { direct: 'both' },
  portfolio: { pb_country: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } },
} as unknown as Criteria

const kl = getKivaLoans()
const saved = {
  ready: kl.isReadyFlag, loans: kl.loansFromKiva, partners: kl.activePartners, lender: kl.lenderId,
  fetch: kl.fetchSuperGraphData, lastKnown: useCriteriaStore.getState().lastKnown,
}
let unsubscribe: () => void = () => {}
const shown = () => useLoanStore.getState().filteredLoans.map((l) => l.id).sort((a, b) => a - b)

function useLender(id: string, answer: () => Promise<unknown>) {
  kl.lenderId = id
  kl.retryBalancerData()
  kl.fetchSuperGraphData = vi.fn(answer)
  useUtilsStore.setState({ lenderId: id })
}

beforeEach(() => {
  kl.isReadyFlag = true
  kl.loansFromKiva = LOANS
  kl.activePartners = PARTNERS
  useCriteriaStore.setState({ lastKnown: COUNTRIES_I_DONT_HAVE })
  useLoanStore.setState({ balancerFailures: [], filteredLoans: [] })
  // The app's own wiring (useKivaLensInit; see the last test below).
  unsubscribe = kl.onNotify((m) => {
    if (m.balancer_data_event) applyBalancerData(kl)
  })
})

afterEach(() => {
  unsubscribe()
  Object.assign(kl, { isReadyFlag: saved.ready, loansFromKiva: saved.loans, activePartners: saved.partners, lenderId: saved.lender, fetchSuperGraphData: saved.fetch })
  useCriteriaStore.setState({ lastKnown: saved.lastKnown })
  useUtilsStore.setState({ lenderId: '' })
  useLoanStore.setState({ balancerFailures: [] })
})

describe('a search that arrives without its balancer list', () => {
  it('is filtered by the lender’s portfolio as soon as it has been read', async () => {
    useLender(`lender-${Math.random()}`, async () => superGraph([['2', 'Kenya', 6], ['5', 'Uganda', 4]]))
    act(() => useLoanStore.getState().filterLoans())
    // Before the portfolio arrives, nothing is balanced out yet (the status says so).
    expect(shown()).toEqual([1, 2, 3, 4, 5])
    await waitFor(() => expect(shown()).toEqual([3, 5]))
  })

  it('says under the count when Kiva would not return the portfolio, and tries again on request', async () => {
    let fail = true
    useLender(`lender-${Math.random()}`, async () => {
      if (fail) throw new Error('502')
      return superGraph([['2', 'Kenya', 1]])
    })
    render(
      <I18nProvider>
        <BalancingNote />
      </I18nProvider>,
    )
    act(() => useLoanStore.getState().filterLoans())
    await waitFor(() =>
      expect(screen.getByText(/Kiva didn’t return your portfolio\./)).toHaveTextContent(
        'Portfolio balancing is on but not applied: Kiva didn’t return your portfolio. Try again',
      ),
    )
    expect(shown()).toEqual([1, 2, 3, 4, 5])
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(shown()).toEqual([2, 3, 5]))
    expect(screen.queryByText(/not applied/)).toBeNull()
  })

  it('says it needs a lender ID when there is none, with the way to set one', () => {
    kl.lenderId = ''
    useUtilsStore.setState({ lenderId: '' })
    render(
      <I18nProvider>
        <BalancingNote />
      </I18nProvider>,
    )
    expect(screen.getByText(/needs your Kiva lender ID/)).toHaveTextContent(
      'Portfolio balancing is on but not applied: it needs your Kiva lender ID. Set your Lender ID',
    )
    expect(screen.getByRole('button', { name: 'Set your Lender ID' })).toBeInTheDocument()
  })

  it('says it is reading the portfolio, then that balancing is applied from it, on the same line', async () => {
    let answer: (value: unknown) => void = () => {}
    useLender(`lender-${Math.random()}`, () => new Promise((resolve) => (answer = resolve)))
    render(
      <I18nProvider>
        <BalancingNote />
      </I18nProvider>,
    )
    act(() => useLoanStore.getState().filterLoans())
    const line = screen.getByText('Portfolio balancing by Countries: reading your portfolio from Kiva…')
    // The read starts once the filter that asked has finished.
    await act(async () => settle())
    expect(kl.fetchSuperGraphData).toHaveBeenCalledTimes(1)
    await act(async () => answer(superGraph([['2', 'Kenya', 1]])))
    await waitFor(() => expect(shown()).toEqual([2, 3, 5]))
    // The same element, its words changed: nothing below it moves.
    expect(line).toHaveTextContent('Portfolio balancing by Countries is applied from your Kiva portfolio.')
    expect(line).not.toHaveClass('kl-count-problem')
    expect(screen.queryByText(/not applied/)).toBeNull()
  })

  it('names every balancer that is on', async () => {
    useLender(`lender-${Math.random()}`, async () => superGraph([['10', 'Partner Ten', 1]]))
    useCriteriaStore.setState({
      lastKnown: {
        ...COUNTRIES_I_DONT_HAVE,
        portfolio: { ...COUNTRIES_I_DONT_HAVE.portfolio, pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active' } },
      } as unknown as Criteria,
    })
    render(
      <I18nProvider>
        <BalancingNote />
      </I18nProvider>,
    )
    expect(screen.getByText(/^Portfolio balancing by Partners and Countries/)).toBeInTheDocument()
  })

  it('is wired into the app: the search is filtered again when the portfolio arrives', () => {
    const init = readFileSync(path.join(process.cwd(), 'src/lib/useKivaLensInit.ts'), 'utf8')
    expect(init).toMatch(/if \(msg\.balancer_data_event\) applyBalancerData\(kl\)/)
    const search = readFileSync(path.join(process.cwd(), 'src/components/Search.tsx'), 'utf8')
    expect(search).toContain('<BalancingNote />')
  })

  it('serves the Portfolio tab, Stats and the basket from the same copy', async () => {
    const lender = `lender-${Math.random()}`
    useLender(lender, async () => superGraph([['2', 'Kenya', 1]]))
    const { fetchBalancerData } = useCriteriaStore.getState()
    await Promise.all([fetchBalancerData('country', { enabled: true, allactive: 'all' }), fetchBalancerData('country', { enabled: true, allactive: 'all' })])
    expect(kl.balancerSlices('country', 'all')?.map((s) => s.name)).toEqual(['Kenya'])
    expect(kl.fetchSuperGraphData).toHaveBeenCalledTimes(1)
  })
})
