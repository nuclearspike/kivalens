// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { SearchSwitcher } from './Criteria'
import CriteriaHistoryMenu from './CriteriaHistoryMenu'
import { useCriteriaStore } from '../stores'
import { resetCriteriaHistoryForTests, startCriteriaHistory } from '../stores/criteriaHistoryStore'
import { freshCriteria } from '../lib/freshCriteria'
import type { Criteria } from '../types'

/**
 * Paul, 2026-09-29, on "Countries I Don't Have" with its Open still offered: "when i click
 * the button it does NOTHING bc I'm already on that. so we need either to hide it or to
 * indicate that you're already doing it." Every list that offers a stored search says
 * which one is already in force, by one rule (isSearchInForce). The Search welcome panel
 * is covered in SearchHome.test.tsx.
 */

const store = () => useCriteriaStore.getState()
const withSector = (sector: string): Criteria => {
  const f = freshCriteria()
  return { ...f, loan: { ...f.loan, sector } } as Criteria
}
const renderIn = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
const tagged = () => [...document.querySelectorAll('.kl-in-force-tag')].map((tag) => tag.parentElement as HTMLElement)

beforeEach(() => {
  window.localStorage.removeItem('kl_criteria_history')
  resetCriteriaHistoryForTests()
  store().startFresh()
})
afterEach(() => cleanup())

describe('Saved Searches', () => {
  it('tags the search in force, and only that one, while the menu is open', () => {
    act(() => store().loadSearch('expiring_soon'))
    renderIn(<SearchSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: /Expiring Soon/ }))
    expect(tagged()).toHaveLength(1)
    expect(tagged()[0]).toHaveTextContent('Expiring Soon')
    expect(tagged()[0]).toHaveAttribute('aria-current', 'true')
    expect(tagged()[0].querySelector('.kl-in-force-tag')).toHaveTextContent('✓ Showing')
  })

  it('tags none once the search changes, though the menu still names the search it came from', () => {
    act(() => store().loadSearch('expiring_soon'))
    act(() => {
      const k = store().lastKnown
      store().setCriteria({ ...k, loan: { ...k.loan, sort: 'newest' } } as Criteria)
    })
    renderIn(<SearchSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: /Expiring Soon/ }))
    expect(tagged()).toHaveLength(0)
  })
})

describe('History', () => {
  it('tags the line whose search is in force', () => {
    const stop = startCriteriaHistory()
    try {
      act(() => store().setCriteria(withSector('Food')))
      act(() => store().setCriteria(withSector('Retail')))
      renderIn(<CriteriaHistoryMenu />)
      fireEvent.click(screen.getByRole('button', { name: 'History' }))
      expect(tagged()).toHaveLength(1)
      expect(tagged()[0]).toHaveTextContent('Sector: Retail')
      expect(tagged()[0]).toHaveAttribute('aria-current', 'true')
    } finally {
      stop()
    }
  })
})
