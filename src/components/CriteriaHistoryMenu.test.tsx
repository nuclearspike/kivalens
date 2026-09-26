// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import CriteriaHistoryMenu from './CriteriaHistoryMenu'
import PartnerDetail from './PartnerDetail'
import { useCriteriaStore, useLoanStore } from '../stores'
import { resetCriteriaHistoryForTests, startCriteriaHistory, useCriteriaHistory } from '../stores/criteriaHistoryStore'
import { freshCriteria } from '../lib/freshCriteria'
import { getKivaLoans } from '../api/kiva'
import type { Criteria, KivaLoan, Partner } from '../types'

/**
 * Paul, 2026-09-25: a History button between Reset and Saved Searches, a
 * dropdown of what the settings were, each line starting with how long ago,
 * "…" when too long with a hover showing all the details; typing "jane",
 * deleting to "j" and typing "jen" leaves a "jane" entry and a "jen" entry.
 */

const criteria = () => useCriteriaStore.getState()
const withLoan = (loan: Record<string, unknown>): Criteria => {
  const f = freshCriteria()
  return { ...f, loan: { ...f.loan, ...loan } } as Criteria
}

let stop: () => void
beforeEach(() => {
  window.localStorage.removeItem('kl_criteria_history')
  resetCriteriaHistoryForTests()
  criteria().startFresh()
  stop = startCriteriaHistory()
})
afterEach(() => {
  stop()
  cleanup()
})

const renderMenu = () =>
  render(
    <I18nProvider>
      <MemoryRouter>
        <CriteriaHistoryMenu />
      </MemoryRouter>
    </I18nProvider>,
  )
const open = () => fireEvent.click(screen.getByRole('button', { name: 'History' }))
const lines = () => [...document.querySelectorAll('.kl-criteria-history-item')] as HTMLElement[]

describe('the History menu', () => {
  it('records typing as the lender meant it: jane, then jen, nothing between', () => {
    for (const name of ['j', 'ja', 'jan', 'jane', 'jan', 'ja', 'j', 'je', 'jen']) {
      act(() => criteria().setCriteria(withLoan({ name })))
    }
    renderMenu()
    open()
    expect(lines().map((l) => l.querySelector('.kl-criteria-history-summary')!.textContent)).toEqual([
      'Name: jen',
      'Name: jane',
      'No filters',
    ])
  })

  it('starts each line with how long ago, and hovers with the date and every detail', () => {
    act(() => criteria().setCriteria(withLoan({ sector: 'Food', name: 'jane' })))
    renderMenu()
    open()
    const [line] = lines()
    expect(line.firstElementChild).toHaveClass('kl-criteria-history-when')
    expect(line.firstElementChild!.textContent).toMatch(/now|second/)
    expect(line.title.split('\n').slice(1)).toEqual(['Sector: Food', 'Name: jane'])
    expect(line.querySelector('.kl-criteria-history-summary')).toHaveTextContent('Sector: Food · Name: jane')
  })

  it('marks the search in force, and goes back to another one when chosen', () => {
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    act(() => criteria().saveSearch('test-history-switch'))
    act(() => criteria().setCriteria(withLoan({ sector: 'Food', country_code: 'KE' })))
    renderMenu()
    open()
    expect(lines()[0]).toHaveAttribute('aria-current', 'true')
    fireEvent.click(lines().find((l) => l.textContent?.endsWith('Sector: Food'))!)
    expect(criteria().lastKnown.loan).toMatchObject({ sector: 'Food' })
    expect(criteria().lastKnown.loan).not.toHaveProperty('country_code')
    // The switcher stops naming a saved search, so its Re-save cannot overwrite it.
    expect(criteria().lastSwitch).toBeNull()
    // The search gone back to is now the newest, not a duplicate.
    const summaries = useCriteriaHistory.getState().history.entries.map((e) => (e.criteria.loan as Record<string, unknown>).country_code ?? '-')
    expect(summaries).toEqual(['-', 'KE', '-'])
  })

  it('keeps the history across visits, and clears to just the search in force, with a way back', () => {
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    window.dispatchEvent(new Event('pagehide'))
    const saved = JSON.parse(window.localStorage.getItem('kl_criteria_history')!)
    expect(saved.version).toBe(1)
    expect(saved.entries).toHaveLength(2)
    renderMenu()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search history' }))
    expect(useCriteriaHistory.getState().history.entries).toHaveLength(1)
    expect(criteria().lastKnown.loan).toMatchObject({ sector: 'Food' })
    // Undo rather than a confirmation (rule 18): the menu stays open on the result,
    // with the way back where Clear was.
    expect(lines()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Restore search history' }))
    expect(useCriteriaHistory.getState().history.entries).toHaveLength(2)
    expect(lines()).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Clear search history' })).not.toHaveAttribute('aria-disabled')
  })

  it('offers the way back only until the search changes, and with nothing earlier, Clear says why', () => {
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    renderMenu()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search history' }))
    expect(screen.getByRole('button', { name: 'Restore search history' })).toBeInTheDocument()
    // A new search after the clear: restoring now would lose it, so the offer lapses.
    act(() => criteria().setCriteria(withLoan({ sector: 'Retail' })))
    expect(useCriteriaHistory.getState().cleared).toBeNull()
    expect(screen.queryByRole('button', { name: 'Restore search history' })).not.toBeInTheDocument()
    // Only the search in force, nothing to restore: Clear stays in view, unavailable, saying why.
    act(() => useCriteriaHistory.getState().clear())
    act(() => useCriteriaHistory.setState({ cleared: null }))
    const clear = screen.getByRole('button', { name: /Clear search history/ })
    expect(clear).toHaveAttribute('aria-disabled', 'true')
    expect(clear).toHaveAccessibleDescription(/nothing earlier to clear/)
    expect(clear).not.toBeDisabled() // still reachable, to hear why
    fireEvent.click(clear)
    expect(useCriteriaHistory.getState().history.entries).toHaveLength(1)
    expect(useCriteriaHistory.getState().cleared).toBeNull() // a click on nothing to clear clears nothing
  })

  it('names a field partner once the partner list has arrived, the next time it opens', () => {
    const kl = getKivaLoans()
    const saved = kl.partnersFromKiva
    kl.partnersFromKiva = []
    try {
      act(() => criteria().startFresh({ loan: {}, partner: { direct: 'mfi', partners: '246' }, portfolio: {} } as Criteria))
      renderMenu()
      open()
      expect(lines()[0]).toHaveTextContent('#246')
      open() // close
      kl.partnersFromKiva = [{ id: 246, name: 'ADICLA' } as unknown as Partner]
      open()
      expect(lines()[0]).toHaveTextContent('Field partner: ADICLA')
    } finally {
      kl.partnersFromKiva = saved
    }
  })

  it('explains itself when there is nothing yet', () => {
    resetCriteriaHistoryForTests()
    renderMenu()
    open()
    expect(screen.getByText('Each search you run appears here, newest first.')).toBeInTheDocument()
  })
})

describe("a partner's Show loans", () => {
  it('resets first, then shows just that partner’s loans, as one step', () => {
    act(() => criteria().setCriteria(withLoan({ sector: 'Retail', country_code: 'KE', loan_amount_min: 500 })))
    const partner = { id: 246, name: 'ADICLA', status: 'active', countries: [], start_date: '2020-01-01' } as unknown as Partner
    useLoanStore.setState({ loans: [{ id: 1, partner_id: 246, status: 'fundraising', sector: 'Retail' } as unknown as KivaLoan] })
    const before = useCriteriaHistory.getState().history.entries.length
    let where = ''
    function Where() {
      where = useLocation().pathname
      return null
    }
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/partners/246']}>
          <Routes>
            <Route path="*" element={<><PartnerDetail partner={partner} /><Where /></>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show Loans' }))
    expect(where).toBe('/search')
    expect(criteria().lastKnown.loan).toEqual({ name: '', use: '' })
    expect(criteria().lastKnown.partner).toEqual({ direct: 'mfi', partners: '246' })
    expect(useCriteriaHistory.getState().history.entries).toHaveLength(before + 1)
  })
})
