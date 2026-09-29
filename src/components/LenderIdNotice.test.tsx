// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import LenderIdNotice, { ExcludeNeedsLenderIdLine } from './LenderIdNotice'
import { SearchSwitcher } from './Criteria'
import { SavedSearches } from './SavedSearches'
import { useCriteriaStore, useUtilsStore } from '../stores'
import { resetCriteriaHistoryForTests, startCriteriaHistory, useCriteriaHistory } from '../stores/criteriaHistoryStore'
import { useCriteriaInUrl } from '../lib/useCriteriaInUrl'
import { criteriaToSearch } from '../../server/criteriaUrl.mjs'
import { freshCriteria } from '../lib/freshCriteria'
import type { Criteria } from '../types'

/**
 * Paul, 2026-09-29: "when a filter selection requires a lender id, it should never be
 * hidden from the user. If a user selects 'Countries I don't have' but is on the
 * borrower page, nothing shows up ... re-eval all the times that Lender Id is needed
 * when changing History, Saved Search, Loaded from somewhere else, etc and make sure
 * the user knows."
 */

const store = () => useCriteriaStore.getState()
const bal = (over: Record<string, unknown> = {}) => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all', ...over })
const withPortfolio = (portfolio: Record<string, unknown>, partner: Record<string, unknown> = {}): Criteria => {
  const f = freshCriteria()
  return { ...f, partner: { ...f.partner, ...partner }, portfolio: { ...f.portfolio, ...portfolio } } as Criteria
}
const notice = () => screen.queryByRole('status')
const renderNotice = () =>
  render(
    <I18nProvider>
      <LenderIdNotice />
      <ExcludeNeedsLenderIdLine />
    </I18nProvider>,
  )

let savedBefore: Record<string, unknown>
beforeEach(() => {
  savedBefore = { ...store().savedSearches }
  useUtilsStore.setState({ lenderId: '', lenderModalOpen: false } as never)
  store().startFresh()
})
afterEach(() => {
  cleanup()
  useCriteriaStore.setState({ savedSearches: savedBefore as never, lastSwitch: '' as never })
  useUtilsStore.setState({ lenderId: '' } as never)
})

describe('the notice above the results', () => {
  it('says which balancing needs the ID, and gives the way to set it', () => {
    act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'false', pb_country: bal(), pb_sector: bal() })))
    renderNotice()
    expect(notice()).toHaveTextContent("Portfolio balancing by Countries and Sectors needs your Kiva lender ID, so it isn't applied to this search yet.")
    fireEvent.click(screen.getByRole('button', { name: 'Set your Lender ID' }))
    expect((useUtilsStore.getState() as { lenderModalOpen?: boolean }).lenderModalOpen).toBe(true)
  })

  it('says Exclude My Loans in the same sentence when it is on too, so there is one message', () => {
    act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'true', pb_country: bal() })))
    const { container } = renderNotice()
    expect(notice()).toHaveTextContent('Portfolio balancing by Countries and “Exclude My Loans” need your Kiva lender ID, so neither is applied to this search yet.')
    expect(container.querySelector('.kl-exclude-needs-id')).toBeNull()
  })

  it('leaves Exclude My Loans alone to the quiet line under the count', () => {
    act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'true' })))
    const { container } = renderNotice()
    expect(notice()).toBeNull()
    expect(container.querySelector('.kl-exclude-needs-id')).toHaveTextContent("Your own loans aren't left out yet. Set your Lender ID")
  })

  it('goes once an ID is set', () => {
    act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'true', pb_country: bal() })))
    const { container } = renderNotice()
    expect(notice()).not.toBeNull()
    act(() => useUtilsStore.setState({ lenderId: 'jane' } as never))
    expect(notice()).toBeNull()
    expect(container.querySelector('.kl-exclude-needs-id')).toBeNull()
  })

  it('stands outside the result count, so it shows with 0 results, while loading and on every criteria tab', () => {
    const search = readFileSync(path.join(process.cwd(), 'src/components/Search.tsx'), 'utf8')
    // Wide screens: at the top of the results column, before the count bar (which exists only with results).
    const wide = search.indexOf('<LenderIdNotice className="d-none d-md-block" />')
    expect(wide).toBeGreaterThan(search.indexOf('<ResultsHeader'))
    expect(wide).toBeLessThan(search.indexOf('{loanCount > 0 ? ('))
    // Phones: before the columns, since the criteria stack above the results there.
    expect(search.indexOf('<LenderIdNotice className="d-md-none" />')).toBeLessThan(search.indexOf('<Row>'))
    // Not inside any criteria tab.
    expect(readFileSync(path.join(process.cwd(), 'src/components/CriteriaTabs.tsx'), 'utf8')).not.toContain('<LenderIdNotice')
  })
})

describe('whichever way the search arrives, the notice says it', () => {
  it('a saved search (the switcher, the Saved tab, the welcome panel all load this way)', () => {
    renderNotice()
    act(() => store().loadSearch('countries_i_dont_have'))
    expect(notice()).toHaveTextContent('Portfolio balancing by Countries')
  })

  it('a History entry, even one recorded in Both with balance by partner', () => {
    window.localStorage.removeItem('kl_criteria_history')
    resetCriteriaHistoryForTests()
    const stop = startCriteriaHistory()
    try {
      act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'false', pb_partner: bal({ allactive: 'active' }) }, { direct: 'both' })))
      act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'false' })))
      renderNotice()
      expect(notice()).toBeNull()
      const recorded = useCriteriaHistory.getState().history.entries[1]
      act(() => useCriteriaHistory.getState().restore(recorded.id))
      expect(notice()).toHaveTextContent('Portfolio balancing by Partners')
    } finally {
      stop()
    }
  })

  it('a link (the address)', () => {
    const countries = withPortfolio({ exclude_portfolio_loans: 'false', pb_country: bal() })
    function Harness() {
      useCriteriaInUrl(true)
      return <LenderIdNotice />
    }
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[`/search?${criteriaToSearch(countries)}`]}>
          <Routes>
            <Route path="/search" element={<Harness />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(notice()).toHaveTextContent('Portfolio balancing by Countries')
  })

  it('Ask KivaLens (apply_criteria sets the criteria as the page does)', () => {
    renderNotice()
    act(() => store().setCriteria(withPortfolio({ exclude_portfolio_loans: 'false', pb_region: bal() })))
    expect(notice()).toHaveTextContent('Portfolio balancing by Regions')
  })
})

describe('the lists say it before the search is chosen', () => {
  const tagBeside = (name: string) =>
    [...document.querySelectorAll('.kl-needs-lender-tag')].some((tag) => tag.parentElement?.textContent?.includes(name))

  it('Saved Searches: built-in portfolio searches, imported ones, and nothing once an ID is set', () => {
    act(() => {
      store().importSearches({ 'Mine, by sector': withPortfolio({ pb_sector: bal() }) as never })
    })
    render(
      <I18nProvider>
        <MemoryRouter>
          <SearchSwitcher />
        </MemoryRouter>
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Saved Searches' }))
    expect(tagBeside("Countries I Don't Have")).toBe(true)
    expect(tagBeside('Balance Partner Risk')).toBe(true)
    expect(tagBeside('Mine, by sector')).toBe(true)
    expect(tagBeside('Expiring Soon')).toBe(false)
    expect(screen.getAllByText('Needs your Lender ID').length).toBe(3)
    act(() => useUtilsStore.setState({ lenderId: 'jane' } as never))
    expect(document.querySelectorAll('.kl-needs-lender-tag')).toHaveLength(0)
  })

  it('the Saved tab: the tag in the list, and a line with the way to set it above the summary', () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/saved']}>
          <Routes>
            <Route path="/saved" element={<SavedSearches />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(tagBeside("Countries I Don't Have")).toBe(true)
    fireEvent.click(screen.getByText("Countries I Don't Have", { selector: 'span' }))
    const line = document.querySelector('.kl-saved-needs-id') as HTMLElement
    expect(line).toHaveTextContent('This search needs your Kiva lender ID to do what it says. Set your Lender ID')
    fireEvent.click(screen.getAllByRole('button', { name: 'Set your Lender ID' })[0])
    expect((useUtilsStore.getState() as { lenderModalOpen?: boolean }).lenderModalOpen).toBe(true)
  })
})
