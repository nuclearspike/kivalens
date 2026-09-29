// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import SearchHome from './SearchHome'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { useCriteriaHistory, resetCriteriaHistoryForTests } from '../stores/criteriaHistoryStore'
import { getKivaLoans } from '../api/kiva'
import { freshCriteria } from '../lib/freshCriteria'
import { noteLinkArrival, resetArrivalForTests, sameSearch } from '../lib/arrival'
import { resetVisitForTests, VISITS_KEY } from '../lib/visits'
import { readUsageEvents, resetUsageEventsForTests } from '../lib/rum/usageEvents'
import type { Criteria, KivaLoan } from '../types'

vi.mock('../lib/dialog', async (orig) => ({ ...(await orig<typeof import('../lib/dialog')>()), showPrompt: vi.fn(async () => 'Shared with me') }))

/**
 * The Search page's start panel, one lender at a time. Paul, 2026-09-27: "for many
 * users this isn't their first rodeo ... they have stuff in their basket, they have
 * previous saved searches, they just return to KL after being at Kiva, they have a
 * bunch of loans already selected ... build pages for each one."
 */

const NOW = Date.now()
const H = 3_600_000
const kl = getKivaLoans()
const saved = { loans: kl.indexedLoans, partners: kl.partnersFromKiva, filter: kl.filter, isReady: kl.isReady, balancerPending: kl.balancerPending }
const savedSearchesBefore = useCriteriaStore.getState().savedSearches

const loan = (id: number, over: Record<string, unknown> = {}): KivaLoan =>
  ({
    id, name: `Borrower ${id}`, status: 'fundraising', partner_id: 20, sector: 'Retail', activity: 'Retail',
    location: { country: 'Kenya', country_code: 'KE' }, image: { id: 1 }, borrowers: [], kl_still_needed: 500,
    kl_posted_date: new Date(NOW - 10 * 24 * H), ...over,
  }) as unknown as KivaLoan
const LOANS = [1, 2, 3, 4].map((id) => loan(id))
const withSector = (sector: string): Criteria => ({ ...freshCriteria(), loan: { ...freshCriteria().loan, sector } }) as Criteria

function renderHome() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<SearchHome />} />
          <Route path="/basket" element={<div data-testid="basket-page" />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement
const loansReady = (filtered: KivaLoan[] = LOANS) => useLoanStore.setState({ loans: LOANS, filteredLoans: filtered, downloading: false })
const lastVisit = (hoursAgo: number) => localStorage.setItem(VISITS_KEY, JSON.stringify({ start: NOW - hoursAgo * H - H, seen: NOW - hoursAgo * H, previousEnd: null }))

beforeEach(() => {
  localStorage.clear()
  resetVisitForTests()
  resetArrivalForTests()
  resetUsageEventsForTests()
  resetCriteriaHistoryForTests()
  kl.indexedLoans = Object.fromEntries(LOANS.map((l) => [l.id, l]))
  kl.partnersFromKiva = [{ id: 20, name: 'Partner Twenty', rating: '4.0', status: 'active' }] as never
  kl.isReady = () => true
  kl.filter = vi.fn(() => LOANS.slice(0, 3)) as never
  useLoanStore.setState({ basket: [], pendingCheckout: null, loans: [], filteredLoans: [], downloading: true })
  useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: false })
  useCriteriaStore.setState({ savedSearches: savedSearchesBefore, lastKnown: freshCriteria(), lastSwitch: '' as never })
})

afterEach(() => {
  cleanup()
  kl.indexedLoans = saved.loans
  kl.partnersFromKiva = saved.partners
  kl.filter = saved.filter
  kl.isReady = saved.isReady
  kl.balancerPending = saved.balancerPending
  useLoanStore.setState({ basket: [], pendingCheckout: null })
})

describe('first visit', () => {
  it('welcomes a newcomer with ready-made searches, each with what it finds now', async () => {
    loansReady()
    renderHome()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome to KivaLens')
    const start = card('Start with a ready-made search')
    await waitFor(() => expect(within(start).getAllByText('3 loans').length).toBeGreaterThan(0))
    fireEvent.click(within(start).getAllByRole('button', { name: /^Open / })[0])
    expect(useCriteriaStore.getState().lastSwitch).toBe('expiring_soon')
    expect(readUsageEvents().events).toMatchObject({ 'home:first_visit': 1, 'preset:expiring_soon': 1 })
    expect(card('Quick Start')).toBeInTheDocument()
  })

  it('keeps a starting point that finds nothing right now in its place, with Open disabled and the reason', async () => {
    kl.filter = vi.fn(() => []) as never
    loansReady()
    renderHome()
    const start = card('Start with a ready-made search')
    await waitFor(() => expect(within(start).getAllByText('0 loans').length).toBeGreaterThan(0))
    const open = within(start).getAllByRole('button', { name: /^Open / })[0]
    expect(open).toBeDisabled()
    expect(open).toHaveAttribute('title', 'Finds no loans right now.')
  })
})

describe('back from Kiva', () => {
  it('leads when a basket was just handed to Kiva, and sends the lender to see what went through', () => {
    useLoanStore.setState({ basket: [{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 50 }], pendingCheckout: { ids: [1, 2], at: NOW - H } })
    renderHome()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome back from Kiva')
    const c = card('Your checkout at Kiva')
    expect(c).toHaveTextContent(/You sent 2 loans \(\$75(\.00)?\) to Kiva 1 hour ago\./)
    expect(c).toHaveTextContent('Tell KivaLens whether it went through')
    fireEvent.click(within(c).getByRole('button', { name: 'See what went through' }))
    expect(screen.getByTestId('basket-page')).toBeInTheDocument()
  })
})

describe('the basket', () => {
  it('says how the basket stands, holding its line while the loans are checked', () => {
    useLoanStore.setState({ basket: [1, 2, 3].map((id) => ({ loan_id: id, amount: 25 })) })
    const { rerender } = renderHome()
    const c = card('Your basket')
    expect(c).toHaveTextContent(/3 loans · \$75/)
    expect(within(c).getByRole('status')).toHaveTextContent('Checking your basket’s loans…')
    kl.indexedLoans = { ...kl.indexedLoans, 2: loan(2, { status: 'funded' }) }
    act(() => loansReady())
    rerender(
      <I18nProvider>
        <MemoryRouter initialEntries={['/search']}>
          <SearchHome />
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(within(card('Your basket')).getByRole('status')).toHaveTextContent('1 finished funding since you added it.')
    expect(card('Your basket')).toHaveClass('kl-home-card-attention')
  })
})

describe('a search from a link', () => {
  it('offers to save it, or to go back to the search the browser had', async () => {
    const mine = withSector('Agriculture')
    const shared = withSector('Retail')
    useCriteriaStore.setState({ lastKnown: shared })
    noteLinkArrival(shared, mine)
    loansReady()
    renderHome()
    const c = card('A search from a link')
    expect(c).toHaveTextContent('Sector: Retail')
    fireEvent.click(within(c).getByRole('button', { name: 'Save this search' }))
    await waitFor(() => expect(within(c).getByText('Saved as “Shared with me”.')).toBeInTheDocument())
    expect(useCriteriaStore.getState().savedSearches['Shared with me']).toBeTruthy()
    fireEvent.click(within(c).getByRole('button', { name: 'Back to the search you had' }))
    expect(sameSearch(useCriteriaStore.getState().lastKnown, mine)).toBe(true)
    expect(screen.queryByRole('heading', { name: 'A search from a link' })).toBeNull()
  })
  it('goes back to the search the link replaced in the mode it needs: balancing by partner means MFI Only', async () => {
    const f = freshCriteria()
    const mine = {
      ...f,
      partner: { ...f.partner, direct: 'both' },
      portfolio: { ...f.portfolio, pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active', values: [] } },
    } as unknown as Criteria
    const shared = withSector('Retail')
    useCriteriaStore.setState({ lastKnown: shared })
    noteLinkArrival(shared, mine)
    loansReady()
    renderHome()
    fireEvent.click(within(card('A search from a link')).getByRole('button', { name: 'Back to the search you had' }))
    expect(useCriteriaStore.getState().lastKnown.partner.direct).toBe('mfi')
    expect(useCriteriaStore.getState().lastKnown.portfolio.pb_partner).toMatchObject({ enabled: true })
  })
})

describe('where you left off', () => {
  it('names the search left here last time, untouched, and offers a fresh start', () => {
    const kept = withSector('Retail')
    lastVisit(48)
    useCriteriaStore.setState({ lastKnown: kept })
    useCriteriaHistory.setState({ history: { entries: [{ id: 'h1', at: NOW - 50 * H, criteria: kept }], live: null } })
    loansReady()
    renderHome()
    const c = card('Where you left off')
    expect(c).toHaveTextContent('Sector: Retail')
    fireEvent.click(within(c).getByRole('button', { name: 'Start fresh' }))
    expect(sameSearch(useCriteriaStore.getState().lastKnown, freshCriteria())).toBe(true)
  })
})

describe('since the last visit', () => {
  it('counts the loans posted since, those the search finds, and the new ones in each saved search', async () => {
    lastVisit(48)
    const newer = [loan(5, { kl_posted_date: new Date(NOW - 2 * H) }), loan(6, { kl_posted_date: new Date(NOW - 3 * H) })]
    useLoanStore.setState({ loans: [...LOANS, ...newer], filteredLoans: [newer[0], LOANS[0]], downloading: false })
    kl.filter = vi.fn(() => [newer[1], LOANS[1]]) as never
    useCriteriaStore.setState({ savedSearches: { ...savedSearchesBefore, 'Kenya farmers': withSector('Agriculture') } as never })
    renderHome()
    const c = card('Since your last visit')
    expect(c).toHaveTextContent('You were last here 2 days ago.')
    await waitFor(() => expect(c).toHaveTextContent('2 new loans went up on Kiva. 1 of them matches your search.'))
    // The saved search's own row says how many of its loans are new, rather than listing it twice.
    expect(card('Your saved searches')).toHaveTextContent('Kenya farmers · 1 new')
    expect(c).not.toHaveTextContent('Kenya farmers')
  })
})

describe('the lender’s own Kiva lending', () => {
  it('greets them by name and suggests searches built from their portfolio', async () => {
    useUtilsStore.setState({ lenderId: 'jane', lenderObj: { lender_id: 'jane', name: 'Jane', loan_count: 42, member_since: '2015-03-01T00:00:00Z' } })
    loansReady()
    renderHome()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome back, Jane')
    const c = card('Your Kiva lending')
    expect(c).toHaveTextContent('42 loans on Kiva since 2015.')
    await waitFor(() => expect(within(c).getAllByText('3 loans')).toHaveLength(2))
    expect(within(c).getByRole('link', { name: 'See your lending on Stats' })).toHaveAttribute('href', '/stats')
  })

  it("waits to count a portfolio search until the lender's portfolio has arrived, then counts it", async () => {
    // Paul, 2026-09-28: Countries I Don't Have looked unbalanced. Its count was made before the
    // portfolio arrived, so it counted every country.
    useUtilsStore.setState({ lenderId: 'jane', lenderObj: { lender_id: 'jane', name: 'Jane', loan_count: 42, member_since: '2015-03-01T00:00:00Z' } })
    let pending = true
    kl.balancerPending = () => pending
    loansReady()
    renderHome()
    const c = card('Your Kiva lending')
    // "…" is also what stands before the first count: wait until the counting has run.
    await waitFor(() => expect(kl.filter).toHaveBeenCalled())
    await act(async () => {})
    expect(within(c).getAllByText('… loans')).toHaveLength(2)
    // Open still works while it waits; the search itself balances when the data comes.
    within(c).getAllByRole('button', { name: /^Open / }).forEach((b) => expect(b).toBeEnabled())
    pending = false
    act(() => useLoanStore.setState((st) => ({ balancerDataVersion: st.balancerDataVersion + 1 })))
    await waitFor(() => expect(within(c).getAllByText('3 loans')).toHaveLength(2))
  })

  it('tags an own saved search that needs a lender ID while none is set (Paul, 2026-09-29)', async () => {
    const f = freshCriteria()
    useCriteriaStore.setState({
      savedSearches: {
        ...savedSearchesBefore,
        'My sectors': { ...f, portfolio: { ...f.portfolio, pb_sector: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } } } as never,
        'My food': withSector('Food') as never,
      },
    })
    lastVisit(48)
    loansReady()
    renderHome()
    const c = card('Your saved searches')
    const row = (name: string) => [...c.querySelectorAll('.kl-home-row')].find((r) => r.textContent?.includes(name)) as HTMLElement
    await waitFor(() => expect(row('My sectors')).toBeTruthy())
    expect(row('My sectors').querySelector('.kl-needs-lender-tag')).toHaveTextContent('Needs your Lender ID')
    expect(row('My food').querySelector('.kl-needs-lender-tag')).toBeNull()
  })

  it('shows a returning lender without an ID what setting one unlocks', () => {
    useCriteriaHistory.setState({ history: { entries: [{ id: 'h1', at: NOW - 100 * H, criteria: freshCriteria() }], live: null } })
    renderHome()
    const c = card('Add your Kiva lender ID')
    fireEvent.click(within(c).getByRole('button', { name: 'Set your Lender ID' }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Start with a ready-made search' })).toBeNull()
  })
})

describe('a handful of results', () => {
  it('says which one filter to remove, with what the search would find, and removes it', async () => {
    const narrow = { ...withSector('Retail'), loan: { ...withSector('Retail').loan, age_min: 18, age_max: 20 } } as Criteria
    useCriteriaStore.setState({ lastKnown: narrow })
    kl.filter = vi.fn((c: Criteria) => ((c.loan as Record<string, unknown>).sector ? LOANS.slice(0, 2) : LOANS)) as never
    loansReady(LOANS.slice(0, 2))
    renderHome()
    const c = card('Only 2 loans match')
    await waitFor(() => expect(within(c).getByText('4 loans')).toBeInTheDocument())
    expect(c).toHaveTextContent('Removing one of these filters would find more:')
    const remove = within(c).getByRole('button', { name: /Remove “Sector: Retail” → 4 loans/ })
    // The word the app uses everywhere else. Paul, 2026-09-29: "i think 'remove' rather than
    // 'take out' is much clearer and translates better also".
    expect(remove).toHaveTextContent(/^Remove$/)
    fireEvent.click(remove)
    expect((useCriteriaStore.getState().lastKnown.loan as Record<string, unknown>).sector).toBeUndefined()
  })
})

describe('the search already showing', () => {
  // Paul, 2026-09-29, on "Countries I Don't Have" with its Open still offered: "when i click the
  // button it does NOTHING bc I'm already on that ... indicate that you're already doing it."
  it("says so in Open's place, and offers Open again once the search changes", async () => {
    useUtilsStore.setState({ lenderId: 'jane', lenderObj: { lender_id: 'jane', name: 'Jane', loan_count: 42, member_since: '2015-03-01T00:00:00Z' } })
    loansReady()
    renderHome()
    act(() => useCriteriaStore.getState().loadSearch('countries_i_dont_have'))
    const c = card('Your Kiva lending')
    const row = (name: string) => [...c.querySelectorAll('.kl-home-row')].find((r) => r.textContent?.includes(name)) as HTMLElement
    await waitFor(() => expect(within(c).getAllByText('3 loans')).toHaveLength(2))
    const countries = row("Countries I Don't Have")
    expect(countries).toHaveAttribute('aria-current', 'true')
    expect(within(countries).queryByRole('button')).toBeNull()
    expect(countries.querySelector('.kl-home-row-in-force')).toBeVisible()
    expect(countries.querySelector('.kl-home-row-in-force')).toHaveTextContent('✓ Showing')
    expect(countries.querySelector('.kl-home-row-in-force')).toHaveAttribute('title', "You're on this search already.")
    expect(within(row('Balance Partner Risk')).getByRole('button', { name: 'Open Balance Partner Risk' })).toBeEnabled()
    expect(row('Balance Partner Risk').querySelector('.kl-home-row-in-force')).not.toBeVisible()
    act(() => {
      const k = useCriteriaStore.getState().lastKnown
      useCriteriaStore.getState().setCriteria({ ...k, loan: { ...k.loan, sort: 'newest' } } as Criteria)
    })
    expect(row("Countries I Don't Have")).not.toHaveAttribute('aria-current')
    expect(row("Countries I Don't Have").querySelector('.kl-home-row-in-force')).not.toBeVisible()
    fireEvent.click(within(row("Countries I Don't Have")).getByRole('button', { name: "Open Countries I Don't Have" }))
    expect((useCriteriaStore.getState().lastKnown.loan as Record<string, unknown>).sort).not.toBe('newest')
    expect(row("Countries I Don't Have").querySelector('.kl-home-row-in-force')).toBeVisible()
  })

  it('does the same for a starting point on a first visit', async () => {
    loansReady()
    renderHome()
    act(() => useCriteriaStore.getState().loadSearch('expiring_soon'))
    const c = card('Start with a ready-made search')
    const row = [...c.querySelectorAll('.kl-home-row')].find((r) => r.textContent?.includes('Expiring Soon')) as HTMLElement
    expect(row.querySelector('.kl-home-row-in-force')).toBeVisible()
    expect(within(row).queryByRole('button')).toBeNull()
    expect(within(c).getAllByRole('button', { name: /^Open / }).length).toBeGreaterThan(0)
  })
})
