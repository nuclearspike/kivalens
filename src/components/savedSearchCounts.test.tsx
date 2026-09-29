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
