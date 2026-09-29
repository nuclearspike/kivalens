// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { SearchSwitcher } from './Criteria'
import { SavedSearches } from './SavedSearches'
import { useLoanStore } from '../stores'
import { getKivaLoans } from '../api/kiva'

/**
 * Paul, 2026-09-28: "Countries I Don't Have" looked unbalanced. A count made before
 * the lender's portfolio has arrived runs without its balancer, so every list of
 * saved searches shows "…" for it instead, and counts it when the portfolio arrives
 * (loanStore.balancerDataVersion). Searches with no balancer are counted at once.
 */

const kl = getKivaLoans()
const saved = { isReady: kl.isReady, filter: kl.filter, balancerPending: kl.balancerPending }
let pending = true
beforeEach(() => {
  pending = true
  kl.isReady = () => true
  kl.filter = (() => [1, 2, 3]) as never
  kl.balancerPending = () => pending
})
afterEach(() => {
  cleanup()
  Object.assign(kl, saved)
})

const arrive = () => {
  pending = false
  act(() => useLoanStore.setState((s) => ({ balancerDataVersion: s.balancerDataVersion + 1 })))
}
/** The count shown beside a saved search's name, wherever it is listed. */
const countOf = (name: string) =>
  [...document.querySelectorAll('.saved-search-count')].find((b) => b.parentElement?.textContent?.includes(name))?.textContent

describe('the Saved tab says the whole search', () => {
  // Paul, 2026-09-29: "the criteria summary isn't complete. it leaves out PB crits.
  // 'Countries I dont' have' doesn't show the port balancing."
  it('by tab: the limit under Borrower, and the balancer under Your Portfolio with what it hides now', async () => {
    pending = false
    const savedSlices = kl.balancerSlices
    kl.balancerSlices = ((slice: string) => (slice === 'country' ? [{ id: 'KE', name: 'Kenya', value: 3, percent: 60 }, { id: 'UG', name: 'Uganda', value: 2, percent: 40 }] : null)) as never
    try {
      render(
        <I18nProvider>
          <MemoryRouter initialEntries={['/saved']}>
            <Routes>
              <Route path="/saved" element={<SavedSearches />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>,
      )
      fireEvent.click(screen.getByText("Countries I Don't Have", { selector: 'span' }))
      const summary = screen.getByText('Criteria Summary').closest('.card') as HTMLElement
      const sections = [...summary.querySelectorAll('section')].map((sec) => [sec.querySelector('h5')!.textContent, [...sec.querySelectorAll('li')].map((li) => li.textContent)])
      expect(sections).toEqual([
        ['Borrower', ['Limit to 1 per Country']],
        ['Your Portfolio', ['Balancer: country — hide those already in my total portfolio · hidden now: 2']],
      ])
    } finally {
      kl.balancerSlices = savedSlices
    }
  })
})

describe('saved-search counts wait for the portfolio', () => {
  it('in the Saved Searches menu, counting again while it is open', async () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <SearchSwitcher />
        </MemoryRouter>
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Saved Searches' }))
    await waitFor(() => expect(countOf('Expiring Soon')).toBe('3'))
    expect(countOf("Countries I Don't Have")).toBe('…')
    expect(countOf('Balance Partner Risk')).toBe('…')
    arrive()
    await waitFor(() => expect(countOf("Countries I Don't Have")).toBe('3'))
    expect(countOf('Balance Partner Risk')).toBe('3')
  })

  it('on the Saved tab, in the list and for the search chosen', async () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/saved']}>
          <Routes>
            <Route path="/saved" element={<SavedSearches />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    await waitFor(() => expect(countOf('Expiring Soon')).toBe('3'))
    expect(countOf("Countries I Don't Have")).toBe('…')
    fireEvent.click(screen.getByText("Countries I Don't Have", { selector: 'span' }))
    expect(screen.getByText('… matching loans')).toBeInTheDocument()
    arrive()
    await waitFor(() => expect(countOf("Countries I Don't Have")).toBe('3'))
    expect(screen.getByText('3 matching loans')).toBeInTheDocument()
  })
})
