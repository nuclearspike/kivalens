// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Component as PartnersRoute } from './Partners'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import type { Criteria, KivaLoan, Partner } from '../types'

/**
 * Paul, 2026-10-06: "from the Partners tab, I just went and found a bunch to loan
 * to, but there's NO WAY to transition the partner cut into a bunch of loans".
 * The button over the list: what it says, and the search it starts.
 */

const partner = (id: number, name: string, status: string, defaultRate: number): Partner =>
  ({ id, name, status, default_rate: defaultRate, countries: [], kl_regions: [], start_date: '2015-01-01' }) as unknown as Partner

const PARTNERS = () => [
  partner(1, 'Alpha Kenya', 'active', 0.5),
  partner(2, 'Beta Peru', 'active', 6),
  partner(3, 'Gamma Uganda', 'active', 1),
  partner(4, 'Delta Paused', 'paused', 0.2),
]

const loan = (id: number, partnerId: number): KivaLoan =>
  ({ id, name: `Borrower ${id}`, status: 'fundraising', partner_id: partnerId }) as unknown as KivaLoan

// Two loans with Alpha, three with Beta, none with Gamma.
const LOANS = [loan(11, 1), loan(12, 1), loan(21, 2), loan(22, 2), loan(23, 2)]

const kl = getKivaLoans()
const saved = { partners: kl.partnersFromKiva, active: kl.activePartners, filter: kl.filter }
const savedCriteria = useCriteriaStore.getState().lastKnown

function Address() {
  const { pathname } = useLocation()
  return <div data-testid="address">{pathname}</div>
}

const open = () =>
  render(
    <MemoryRouter initialEntries={['/partners']}>
      <Address />
      <Routes>
        <Route path="/partners" element={<PartnersRoute />} />
        <Route path="/search" element={<div>the search page</div>} />
      </Routes>
    </MemoryRouter>,
  )

const showLoans = (name: RegExp | string) => screen.findByRole('button', { name })
/** The loan filter as the count asked it, last. */
const counted = () => (kl.filter as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Criteria

beforeEach(() => {
  kl.partnersFromKiva = []
  kl.processPartners(PARTNERS())
  // The loans of the active partners the search's partner criteria admit: the real
  // partner filter, over this test's loans.
  kl.filter = vi.fn((criteria: Partial<Criteria>) => {
    const admitted = new Set(kl.filterAllPartners({ ...criteria.partner, direct: undefined, status: 'active', status_all_any_none: 'any' }).map((p) => p.id))
    return LOANS.filter((l) => admitted.has(l.partner_id as number))
  }) as never
  useLoanStore.setState({ loans: LOANS, downloading: false })
})

afterEach(() => {
  cleanup()
  kl.partnersFromKiva = saved.partners
  kl.activePartners = saved.active
  kl.filter = saved.filter
  useLoanStore.setState({ loans: [], downloading: false })
  useCriteriaStore.getState().setCriteria(savedCriteria)
  useUtilsStore.setState({ aiCriteriaTab: null })
})

describe('Show these partners’ loans, over the partner list', () => {
  it('says how many loans the listed partners have, counted by the search it would start', async () => {
    open()
    expect(await showLoans('Show these partners’ loans (5)')).toBeEnabled()
    // Reset's own settings with the partners' part on top: what Search will run.
    expect(counted().partner).toEqual({ direct: 'mfi' })
    expect(counted().portfolio).toMatchObject({ exclude_portfolio_loans: 'true' })
    expect(counted().loan).toEqual({ name: '', use: '' })
  })

  it('follows the list as it is narrowed', async () => {
    open()
    fireEvent.change(screen.getByPlaceholderText('Search by name...'), { target: { value: 'beta' } })
    expect(await showLoans('Show these partners’ loans (3)')).toBeEnabled()
  })

  it('starts a search for the partners a name search left, opens Search on its Partner tab', async () => {
    open()
    fireEvent.change(screen.getByPlaceholderText('Search by name...'), { target: { value: 'alpha' } })
    fireEvent.click(await showLoans('Show these partners’ loans (2)'))
    expect(screen.getByTestId('address')).toHaveTextContent('/search')
    const now = useCriteriaStore.getState().lastKnown
    expect(now.partner).toEqual({ direct: 'mfi', partners: '1' })
    // Nothing left over from the search before: Reset's settings everywhere else.
    expect(now.loan).toEqual({ name: '', use: '' })
    expect(now.portfolio).toMatchObject({ exclude_portfolio_loans: 'true' })
    expect(useUtilsStore.getState().aiCriteriaTab?.tab).toBe('partner')
  })

  it('carries a slider over as the same slider', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /set exact default rate \(%\) minimum and maximum/i }))
    const [, maxUnset] = screen.getAllByRole('checkbox', { name: 'not set' })
    fireEvent.click(maxUnset)
    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    // Alpha (0.5) and Gamma (1) are left; only Alpha has loans.
    fireEvent.click(await showLoans('Show these partners’ loans (2)'))
    expect(useCriteriaStore.getState().lastKnown.partner).toEqual({ direct: 'mfi', partner_default_max: 2 })
  })

  it('is off, and says why in its own words, when none of the listed partners has a loan', async () => {
    open()
    fireEvent.change(screen.getByPlaceholderText('Search by name...'), { target: { value: 'gamma' } })
    const button = await showLoans('No loans from these partners now')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(screen.getByTestId('address')).toHaveTextContent('/partners')
  })

  it('is off when no listed partner is active, and when nobody is listed', async () => {
    open()
    fireEvent.change(screen.getByPlaceholderText('Search by name...'), { target: { value: 'nobody by this name' } })
    expect(await showLoans('No loans from these partners now')).toBeDisabled()
  })

  it('waits for the loans before it says a number', () => {
    useLoanStore.setState({ loans: [], downloading: true })
    open()
    const button = screen.getByRole('button', { name: 'Show these partners’ loans (…)' })
    expect(button).toBeDisabled()
    expect(kl.filter).not.toHaveBeenCalled()
  })

  it('says what pressing it does', async () => {
    open()
    expect(await showLoans('Show these partners’ loans (5)')).toHaveAttribute('title', 'Starts a new search with only the loans of the partners listed here.')
  })
})
