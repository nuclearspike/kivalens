// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { RangeRow, Component as PartnersRoute } from './Partners'
import { useLoanStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import type { Partner } from '../types'

// Paul: "the partners route has the same types of sliders but doesn't have
// the buttons to open the modal." This pins the fix on the actual reported
// route — RangeExactControl.test.tsx covers the shared control's own
// behavior in depth; this file only needs to prove RangeRow renders it.

describe('Partners > RangeRow', () => {
  afterEach(cleanup)

  it('renders the exact-value button, matching the Search > Partner criteria tab', () => {
    render(
      <RangeRow label="Risk Rating (stars)" min={0} max={5} step={0.5} minVal={null} maxVal={null} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /set exact risk rating \(stars\) minimum and maximum/i })).toBeInTheDocument()
  })

  it('the button opens a centered modal wired to this row\'s onChange, using the hint as the modal help text', () => {
    const onChange = vi.fn()
    render(
      <RangeRow
        label="Risk Rating (stars)"
        hint="5 star = very low probability of collapse."
        min={0}
        max={5}
        step={0.5}
        minVal={2}
        maxVal={4}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))

    // Centered like every modal, through the shared .modal-dialog (src/styles/modalCentering.test.ts).
    expect(screen.getByRole('dialog').querySelector('.modal-dialog > .modal-content')).toBeInTheDocument()
    expect(screen.getByText('5 star = very low probability of collapse.')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onChange).toHaveBeenCalledWith(3, 4)
  })
})

describe('Partners route: routePartnerId -> id -> id2 (council finding: stale partner survives the transition)', () => {
  // Undone here rather than at the end of the test, so a failure part-way
  // through cannot leave fake timers or this test's partners behind for the
  // next one — which would report a second, misleading failure.
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    getKivaLoans().partnersFromKiva = []
  })

  // Exposes react-router's navigate on window so the test can drive REAL
  // client-side transitions between /partners and /partners/:id — both
  // resolve to the same Component (see App.tsx), so it stays mounted and
  // its local state persists across the transition exactly as in production.
  // Unmounting and remounting per step (the simpler-looking alternative)
  // would reset that state every time and could never exercise this bug.
  function NavigateExposer() {
    const navigate = useNavigate()
    useEffect(() => {
      testNavigate = navigate
    }, [navigate])
    return null
  }
  let testNavigate: ReturnType<typeof useNavigate>

  const renderRoute = (initialPath: string) =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <NavigateExposer />
        <Routes>
          <Route path="/partners" element={<PartnersRoute />} />
          <Route path="/partners/:id" element={<PartnersRoute />} />
        </Routes>
      </MemoryRouter>,
    )

  const partner = (id: number, name: string): Partner => ({
    id,
    name,
    status: 'active',
    countries: [],
    start_date: '2020-01-01',
  })

  it('never shows partner 1 while partner 2 is still resolving after /partners/1 -> /partners -> /partners/2', () => {
    // Active from the start: the polling interval for partner 2 is created
    // partway through this test, and fake timers only govern timers created
    // AFTER activation — switching later wouldn't convert an already-real one.
    vi.useFakeTimers()
    const kl = getKivaLoans()
    kl.partnersFromKiva = [partner(1, 'First Partner')]

    // The detail pane's name is an <h2> (it also contains a leading Kiva-link
    // icon, so its accessible name is more than the bare partner name — match
    // by substring). The same text also appears in the browsable list on the
    // left, so scoping to the heading role checks specifically what the
    // DETAIL pane is showing.
    renderRoute('/partners/1')
    expect(screen.getByRole('heading', { level: 2, name: /First Partner/ })).toBeInTheDocument()

    act(() => testNavigate('/partners'))
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()

    // Partner 2 is deliberately NOT in partnersFromKiva yet — this is the
    // "still loading" window the bug lived in.
    act(() => testNavigate('/partners/2'))
    expect(screen.queryByRole('heading', { level: 2, name: /First Partner/ })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /Second Partner/ })).toBeNull()

    // Now it loads, and the existing poll picks it up.
    kl.partnersFromKiva = [...kl.partnersFromKiva, partner(2, 'Second Partner')]
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByRole('heading', { level: 2, name: /Second Partner/ })).toBeInTheDocument()
  })
})

describe('Partners route (the actual page, not just RangeRow in isolation)', () => {
  afterEach(cleanup)

  // The RangeRow-level tests above prove the component's own behavior; this
  // proves the ROUTE actually wires it up — the button exists on the page a
  // browser loads, and a click-through Apply flows all the way to the page's
  // own local filter state and back out to what the slider row displays. No
  // partner data needs to be seeded: the filter panel (including every
  // PARTNER_SLIDERS row) renders unconditionally, independent of whatever the
  // Kiva loans singleton has loaded.
  it('the route renders the button, and Apply updates the row\'s own displayed range', () => {
    useLoanStore.setState({ loans: [], downloading: false })
    render(
      <MemoryRouter initialEntries={['/partners']}>
        <PartnersRoute />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /set exact risk rating \(stars\) minimum and maximum/i }))

    const [minUnset, maxUnset] = screen.getAllByRole('checkbox', { name: 'not set' })
    fireEvent.click(minUnset)
    fireEvent.click(maxUnset)
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '2' } })
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    // Round-tripped through Partners' own `filters` state and back into
    // RangeRow's props — not just the modal's internal draft state.
    expect(screen.getByText('2 - 4')).toBeInTheDocument()
  })
})
