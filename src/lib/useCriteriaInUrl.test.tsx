// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useCriteriaInUrl } from './useCriteriaInUrl'
import { useCriteriaStore } from '../stores'

function Harness({ active = true }: { active?: boolean }) {
  useCriteriaInUrl(active)
  const location = useLocation()
  return <output data-testid="search">{location.search}</output>
}

const at = (entry: string, active = true) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/search" element={<Harness active={active} />} />
      </Routes>
    </MemoryRouter>,
  )

const address = () => screen.getByTestId('search').textContent

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useCriteriaStore.getState().setCriteria({ loan: {}, partner: {}, portfolio: {} })
  useCriteriaStore.getState().clearLastSwitch()
})

describe('an address that names a search is the search', () => {
  it('replaces whatever the browser had stored', () => {
    useCriteriaStore.getState().setCriteria({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    at('/search?country_code=KE&age=18..40&direct=mfi')
    const stored = useCriteriaStore.getState().lastKnown
    expect(stored.loan.country_code).toBe('KE')
    expect(stored.loan.age_min).toBe(18)
    expect(stored.loan.age_max).toBe(40)
    expect(stored.partner.direct).toBe('mfi')
    // Replaced, not merged: a link is the whole search, so what the lender had
    // before does not leak into what they were sent.
    expect(stored.loan.sector).toBeUndefined()
  })

  it('leaves the stored search alone when the address names none', () => {
    useCriteriaStore.getState().setCriteria({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    at('/search?utm_source=news')
    expect(useCriteriaStore.getState().lastKnown.loan.sector).toBe('Retail')
  })

  it('does nothing at all while a one-shot preset is still being applied', () => {
    useCriteriaStore.getState().setCriteria({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    at('/search?country_code=KE', false)
    expect(useCriteriaStore.getState().lastKnown.loan.country_code).toBeUndefined()
    expect(useCriteriaStore.getState().lastKnown.loan.sector).toBe('Retail')
  })
})

describe('afterwards the address follows the search', () => {
  it('writes the search into the bar once the lender stops changing it', () => {
    vi.useFakeTimers()
    at('/search?sector=Retail')
    act(() => {
      useCriteriaStore
        .getState()
        .setCriteria({ loan: { sector: 'Agriculture', age_min: 20 }, partner: {}, portfolio: {} })
    })
    expect(address()).toBe('?sector=Retail')
    act(() => void vi.advanceTimersByTime(500))
    expect(address()).toBe('?sector=Agriculture&age=20..')
  })

  it('waits rather than writing an address per keystroke', () => {
    vi.useFakeTimers()
    at('/search?sector=Retail')
    for (const use of ['w', 'we', 'wea', 'weav']) {
      act(() => {
        useCriteriaStore.getState().setCriteria({ loan: { use }, partner: {}, portfolio: {} })
        vi.advanceTimersByTime(100)
      })
      expect(address()).toBe('?sector=Retail')
    }
    act(() => void vi.advanceTimersByTime(400))
    expect(address()).toBe('?use=weav')
  })

  it('keeps the campaign tag it arrived with', () => {
    vi.useFakeTimers()
    at('/search?utm_source=news&sector=Retail')
    act(() => {
      useCriteriaStore.getState().setCriteria({ loan: { sector: 'Arts' }, partner: {}, portfolio: {} })
    })
    act(() => void vi.advanceTimersByTime(500))
    expect(address()).toBe('?utm_source=news&sector=Arts')
  })

  it('empties the search out of the bar when the lender clears it', () => {
    vi.useFakeTimers()
    at('/search?sector=Retail&age=18..40')
    act(() => {
      useCriteriaStore.getState().setCriteria({ loan: {}, partner: {}, portfolio: {} })
    })
    act(() => void vi.advanceTimersByTime(500))
    expect(address()).toBe('')
  })

  it('does not rewrite an address that already says the same thing', () => {
    vi.useFakeTimers()
    at('/search?sector=Retail')
    act(() => {
      useCriteriaStore.getState().setCriteria({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    })
    act(() => void vi.advanceTimersByTime(500))
    expect(address()).toBe('?sector=Retail')
  })
})

describe('the saved-search button', () => {
  it('stops naming a saved search when a link brings its own criteria', () => {
    useCriteriaStore.getState().loadSearch('expiring_soon')
    expect(useCriteriaStore.getState().lastSwitch).toBe('expiring_soon')
    at('/search?country_code=KE')
    // "Re-save ‘Expiring Soon’" and "Delete ‘Expiring Soon’" would otherwise act
    // on a search these criteria did not come from.
    expect(useCriteriaStore.getState().lastSwitch).toBeNull()
  })

  it('leaves it alone when the address names no search', () => {
    useCriteriaStore.getState().loadSearch('expiring_soon')
    at('/search?utm_source=news')
    expect(useCriteriaStore.getState().lastSwitch).toBe('expiring_soon')
  })
})
