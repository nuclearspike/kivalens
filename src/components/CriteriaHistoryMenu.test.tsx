// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import CriteriaHistoryMenu from './CriteriaHistoryMenu'
import PartnerDetail from './PartnerDetail'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
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

  it('puts Clear first, a divider under it, outside the list that scrolls; Restore takes its place', () => {
    // Paul, 2026-09-28: "the history dropdown is scrollable but you can't tell that. so the
    // Clear option is hidden. let's have that at the top, divider under it."
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    renderMenu()
    open()
    const menu = () => document.querySelector('.kl-criteria-history') as HTMLElement
    const first = menu().firstElementChild as HTMLElement
    expect(first).toHaveTextContent('Clear search history')
    expect(first.nextElementSibling).toHaveClass('dropdown-divider')
    const list = menu().querySelector('.kl-criteria-history-list') as HTMLElement
    expect(list.contains(first)).toBe(false)
    // Every search line is in the list, and nothing else is.
    expect(lines().length).toBe(2)
    expect([...list.querySelectorAll('.kl-criteria-history-item')]).toEqual(lines())
    fireEvent.click(first)
    expect(menu().firstElementChild).toHaveTextContent('Restore search history')
    expect(menu().firstElementChild!.nextElementSibling).toHaveClass('dropdown-divider')
  })

  it('scrolls only the list, never the menu that holds Clear', () => {
    const scss = readFileSync(path.join(process.cwd(), 'src/styles/main.scss'), 'utf8')
    const block = (selector: string) => scss.slice(scss.indexOf(`${selector} {`), scss.indexOf('}', scss.indexOf(`${selector} {`)))
    expect(block('.kl-criteria-history')).not.toMatch(/overflow-y/)
    expect(block('.kl-criteria-history-list')).toMatch(/overflow-y:\s*auto/)
    expect(block('.dropdown-menu.kl-criteria-history.show')).toMatch(/flex-direction:\s*column/)
  })

  it('says and brings back a search that balances by partner in MFI Only, even one recorded in Both', () => {
    // Paul, 2026-09-28: whatever needs MFI Only switches to it, from History as from Saved Searches.
    const f = freshCriteria()
    const balancing = {
      ...f,
      loan: { ...f.loan, limit_to: { enabled: true, count: 1, limit_by: 'Partner' } },
      partner: { ...f.partner, direct: 'both' },
      portfolio: { ...f.portfolio, pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active', values: [] } },
    } as unknown as Criteria
    act(() => criteria().setCriteria(balancing))
    expect(criteria().lastKnown.partner.direct).toBe('both')
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    renderMenu()
    open()
    const line = lines().find((l) => l.textContent?.includes('per Partner'))!
    // The line says what choosing it gives, balancing and all.
    expect(line.title.split('\n').slice(1)).toEqual([
      'Limit to 1 per Partner',
      'MFI / Direct: MFI Only',
      'Balancer: partner — hide those already in my active portfolio',
    ])
    const before = useCriteriaHistory.getState().history.entries.length
    fireEvent.click(line)
    expect(criteria().lastKnown.partner.direct).toBe('mfi')
    expect(criteria().lastKnown.portfolio.pb_partner).toMatchObject({ enabled: true })
    // Recorded as it runs, and not twice.
    const entries = useCriteriaHistory.getState().history.entries
    expect(entries).toHaveLength(before)
    expect(entries[0].criteria.partner).toMatchObject({ direct: 'mfi' })
  })

  it('tags a line whose search needs a lender ID while none is set (Paul, 2026-09-29)', () => {
    const f = freshCriteria()
    const countries = { ...f, portfolio: { ...f.portfolio, pb_country: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } } } as unknown as Criteria
    useUtilsStore.setState({ lenderId: '' } as never)
    act(() => criteria().setCriteria(countries))
    act(() => criteria().setCriteria(withLoan({ sector: 'Food' })))
    renderMenu()
    open()
    const tagged = lines().filter((l) => l.querySelector('.kl-needs-lender-tag'))
    expect(tagged).toHaveLength(1)
    expect(tagged[0]).toHaveTextContent('Needs your Lender ID')
    act(() => useUtilsStore.setState({ lenderId: 'jane' } as never))
    open()
    open()
    expect(document.querySelectorAll('.kl-needs-lender-tag')).toHaveLength(0)
    useUtilsStore.setState({ lenderId: '' } as never)
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
