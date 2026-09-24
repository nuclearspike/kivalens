// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { createPointerStore, usePointerValue, type PointerStore } from './pointerStore'

/**
 * The property that fixed the basket chart: writing where the pointer is must
 * re-render whoever READS it, and not whoever OWNS the store — because the owner
 * is the chart, and re-rendering the chart is what replaced the bar being pressed.
 */

type Band = { key: string }

// Renders are counted after each commit, which is what a re-render costs.
const commits = { owner: 0, reader: 0 }

function Reader({ store }: { store: PointerStore<Band> }) {
  const value = usePointerValue(store)
  useEffect(() => {
    commits.reader += 1
  })
  return <output data-testid="read">{value?.key ?? 'none'}</output>
}

/** Stands in for the chart: it holds the store and hands it to the hint. */
function Owner({ store }: { store: PointerStore<Band> }) {
  useEffect(() => {
    commits.owner += 1
  })
  return <Reader store={store} />
}

describe('a pointer store', () => {
  it('re-renders the component that reads it, and not the one that owns it', () => {
    const store = createPointerStore<Band>((a, b) => a.key === b.key)
    render(<Owner store={store} />)
    const ownerBefore = commits.owner
    const readerBefore = commits.reader

    act(() => store.set({ key: 'loan_9' }))

    expect(screen.getByTestId('read').textContent).toBe('loan_9')
    expect(commits.reader).toBeGreaterThan(readerBefore)
    // The whole point: the chart that holds the store is not re-rendered.
    expect(commits.owner).toBe(ownerBefore)
  })

  it('wakes nobody for a value that has not changed', () => {
    // Moving within one band fires enter/leave pairs.
    const store = createPointerStore<Band>((a, b) => a.key === b.key)
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ key: 'a' })
    store.set({ key: 'a' })
    expect(listener).toHaveBeenCalledTimes(1)
    store.set({ key: 'b' })
    store.set(null)
    store.set(null)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('stops telling a listener that has gone', () => {
    const store = createPointerStore<Band>()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set({ key: 'a' })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('what counts as the same value', () => {
  it('passes a changed figure through even when the thing pointed at has not moved', () => {
    // The basket chart compares key, month AND amount: data refreshing under a
    // still pointer must not leave the hint showing a stale amount.
    type B = { key: string; month: string; amount: number }
    const store = createPointerStore<B>((a, b) => a.key === b.key && a.month === b.month && a.amount === b.amount)
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ key: 'loan_9', month: 'Nov', amount: 4.12 })
    store.set({ key: 'loan_9', month: 'Nov', amount: 4.12 })
    expect(listener).toHaveBeenCalledTimes(1)
    store.set({ key: 'loan_9', month: 'Nov', amount: 5.0 })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.get()?.amount).toBe(5.0)
  })
})
