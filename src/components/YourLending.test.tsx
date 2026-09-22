// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import YourLending, { SliceChart } from './YourLending'
import { useCriteriaStore, useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

// Sibling of the race fixed in BalancingRow (CriteriaTabs.tsx, commit
// 73e4728d): a fetch resolving in the gap between a render-time reset and
// this effect's own deferred (passive) cleanup could reapply data the reset
// already cleared.
//
// That specific race is NOT bite-proofable here: React Testing Library's
// act() flushes passive effects SYNCHRONOUSLY as part of the same call that
// triggers the state change, which is exactly the async gap (real browsers
// defer passive-effect flushing past paint) the bug depends on. A test built
// to "switch lenderId, then resolve the stale promise" cannot reproduce it,
// because act() has already run the old effect's cleanup by the time control
// returns to resolve anything — confirmed by writing exactly that test and
// watching it pass on the UNFIXED code too (a green result that verified
// nothing, caught before it shipped). BalancingRow's identical mechanism
// wasn't unit-tested for the same reason; it was verified by code review
// (six rounds of adversarial review before it was sound) and live-browser
// exercise instead. What follows verifies the REFACTOR didn't break
// SliceChart's actual observable contract — loading, success, failure, and
// resetting when the data-driving triggers change — which the race fix
// depends on being correct in the first place.

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('YourLending > SliceChart', () => {
  afterEach(cleanup)

  // Asserts the loading→success transition itself, not sort order or
  // localization — those happen inside data handed to Recharts, whose jsdom
  // rendering isn't reliable to assert against directly (see the file-level
  // comment above).
  it('shows loading, then clears it once the fetch succeeds', async () => {
    const d = deferred<{ slices: unknown[] }>()
    const fetchBalancerData = vi.fn(() => d.promise)
    useCriteriaStore.setState({ fetchBalancerData })
    useUtilsStore.setState({ lenderId: 'lender-one' })

    render(<SliceChart sliceBy="sector" label="By Sector" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(fetchBalancerData).toHaveBeenCalledWith('sector', { enabled: true, allactive: 'all' })

    await act(async () => {
      d.resolve({
        slices: [
          { id: '1', name: 'Agriculture', value: 3, percent: 30 },
          { id: '2', name: 'Retail', value: 7, percent: 70 },
        ],
      })
      await d.promise
    })

    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.queryByText('No data.')).toBeNull()
    expect(screen.queryByText("Couldn't load this breakdown.")).toBeNull()
  })

  it('shows "No data." for an empty result, not a loading or failed state', async () => {
    const d = deferred<{ slices: unknown[] }>()
    useCriteriaStore.setState({ fetchBalancerData: vi.fn(() => d.promise) })
    useUtilsStore.setState({ lenderId: 'lender-one' })

    render(<SliceChart sliceBy="country" label="By Country" />)
    await act(async () => {
      d.resolve({ slices: [] })
      await d.promise
    })

    expect(screen.getByText('No data.')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('shows a failure message on rejection, not an infinite loading state', async () => {
    const d = deferred<{ slices: unknown[] }>()
    useCriteriaStore.setState({ fetchBalancerData: vi.fn(() => d.promise) })
    useUtilsStore.setState({ lenderId: 'lender-one' })

    render(<SliceChart sliceBy="activity" label="By Activity" />)
    await act(async () => {
      d.reject(new Error('network error'))
      await d.promise.catch(() => {})
    })

    expect(screen.getByText("Couldn't load this breakdown.")).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('resets to loading and starts a new fetch when lenderId changes', async () => {
    const calls: unknown[][] = []
    const first = deferred<{ slices: unknown[] }>()
    const second = deferred<{ slices: unknown[] }>()
    const fetchBalancerData = vi.fn((...args: unknown[]) => {
      calls.push(args)
      return calls.length === 1 ? first.promise : second.promise
    })
    useCriteriaStore.setState({ fetchBalancerData })
    useUtilsStore.setState({ lenderId: 'lender-one' })

    render(<SliceChart sliceBy="sector" label="By Sector" />)
    await act(async () => {
      first.resolve({ slices: [{ id: '1', name: 'Agriculture', value: 1, percent: 100 }] })
      await first.promise
    })
    expect(screen.queryByText('Loading…')).toBeNull()

    act(() => {
      useUtilsStore.setState({ lenderId: 'lender-two' })
    })
    expect(calls).toHaveLength(2)
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    await act(async () => {
      second.resolve({ slices: [] })
      await second.promise
    })
    expect(screen.getByText('No data.')).toBeInTheDocument()
  })
})

describe('YourLending on the Stats page', () => {
  beforeEach(() => {
    // No network here: with an ID the charts wait instead of fetching.
    useCriteriaStore.setState({ fetchBalancerData: () => new Promise(() => {}) } as never)
    useUtilsStore.setState({ lenderId: '' })
  })
  afterEach(cleanup)

  it('without a lender ID: a pitch naming the three charts, not a gap', () => {
    render(<YourLending />)
    expect(screen.getByRole('heading', { name: en.pitch_your_lending_title })).toBeInTheDocument()
    expect(screen.getByText(/by sector, by country and by activity/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.set_lender_id_2 })).toBeInTheDocument()
  })

  it('the pitch gives way to the charts when an ID is set, and comes back when it is cleared', () => {
    render(<YourLending />)
    act(() => useUtilsStore.setState({ lenderId: 'examplelender' }))
    expect(screen.queryByRole('heading', { name: en.pitch_your_lending_title })).toBeNull()
    expect(screen.getByRole('heading', { name: en.lending })).toBeInTheDocument()
    act(() => useUtilsStore.setState({ lenderId: '' }))
    expect(screen.getByRole('heading', { name: en.pitch_your_lending_title })).toBeInTheDocument()
  })
})
