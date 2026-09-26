// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import Basket from './Basket'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import type { KivaLoan, Partner } from '../types'
import type { BalancerResult } from '../stores/criteriaStore'

// The loan panel beside the list is its own page's concern; here it only has to open.
vi.mock('./Loan', () => ({ default: ({ loanId }: { loanId: number }) => <div data-testid="loan-panel">{loanId}</div> }))

/**
 * The basket page end to end: the line under Checkout at Kiva, the warnings, and
 * narrowing the basket list to the loans a warning or a breakdown row is about.
 */

const PARTNERS = [
  { id: 20, name: 'Low Stars MFI', rating: '1.5', status: 'active' },
  { id: 40, name: 'Five Star', rating: '5.0', status: 'active' },
] as unknown as Partner[]

const loan = (id: number, partnerId: number, country: string): KivaLoan =>
  ({
    id,
    name: `Borrower ${id}`,
    status: 'fundraising',
    partner_id: partnerId,
    sector: 'Retail',
    activity: 'Clothing Sales',
    location: { country, country_code: 'XX' },
    image: { id: 1 },
    borrowers: [],
    kl_still_needed: 500,
    kl_repayments: [{ date: new Date(2026, 10, 1), display: 'Nov 2026', amount: 5 }],
  }) as unknown as KivaLoan

// Six with a 1.5-star partner in Kenya, two with a 5-star partner in Uganda.
const LOANS = [
  ...[1, 2, 3, 4, 5, 6].map((id) => loan(id, 20, 'Kenya')),
  ...[7, 8].map((id) => loan(id, 40, 'Uganda')),
]

const kl = getKivaLoans()
const saved = { loans: kl.indexedLoans, partners: kl.partnersFromKiva, fetchRepay: kl.fetchDescrAndRepayments }
const savedFetchBalancer = useCriteriaStore.getState().fetchBalancerData

function Address() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      {/* Not an <output>: that is a status role, like the bar over the narrowed list. */}
      <div data-testid="address">{`${pathname}${search}`}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  )
}
const address = () => screen.getByTestId('address').textContent

function openBasket(ids = LOANS.map((l) => l.id), at = '/basket') {
  act(() => useLoanStore.setState({ basket: ids.map((id) => ({ loan_id: id, amount: 25 })), loans: LOANS, downloading: false }))
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[at]}>
        <Address />
        <Routes>
          <Route path="/basket" element={<Basket />} />
          <Route path="/basket/:id" element={<Basket />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

const listed = () => document.querySelectorAll('.list-group .loan_list_item')

beforeEach(() => {
  kl.indexedLoans = Object.fromEntries(LOANS.map((l) => [l.id, l]))
  kl.partnersFromKiva = PARTNERS
  kl.fetchDescrAndRepayments = vi.fn(async () => {})
  Element.prototype.scrollIntoView = vi.fn()
  useUtilsStore.setState({ lenderId: '' })
  lsj.set('Options', {})
})

afterEach(() => {
  cleanup()
  kl.indexedLoans = saved.loans
  kl.partnersFromKiva = saved.partners
  kl.fetchDescrAndRepayments = saved.fetchRepay
  useCriteriaStore.setState({ fetchBalancerData: savedFetchBalancer })
  useLoanStore.setState({ basket: [] })
  lsj.set('Options', {})
})

describe('the basket page', () => {
  it('says under Checkout what the basket leans on, and warns in red about a low-rated partner', () => {
    openBasket()
    expect(screen.getByText(/Heavy on Low Stars MFI\./)).toHaveClass('kl-spread-line-danger')
    const alert = screen.getByText('Heavy on one field partner').closest('.alert')!
    expect(alert).toHaveClass('alert-danger')
    expect(alert).toHaveTextContent('Low Stars MFI: 6 loans in this basket.')
    expect(alert).toHaveTextContent('Kiva rates it 1.5 out of 5 stars')
    // Without a lender ID, only the basket is counted, and the page says so.
    expect(screen.getByText(/Only this basket is counted\./)).toBeInTheDocument()
  })

  it('shows the warning’s loans on request, and all of them again after', () => {
    openBasket()
    expect(listed()).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show these 6 loans' }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 6 of 8 loans: Low Stars MFI')
    expect(listed()).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }))
    expect(listed()).toHaveLength(8)
    expect(screen.queryByText(/Showing 6 of 8/)).toBeNull()
  })

  it('narrows the list from a breakdown row too, and lifts it once the row’s loans are gone', () => {
    openBasket()
    fireEvent.click(screen.getByRole('button', { name: /^Uganda/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 8 loans: Uganda')
    expect(listed()).toHaveLength(2)
    act(() => useLoanStore.setState({ basket: [1, 2, 3, 4, 5, 6].map((id) => ({ loan_id: id, amount: 25 })) }))
    expect(screen.queryByText(/Showing 2 of/)).toBeNull()
    expect(listed()).toHaveLength(6)
  })

  it('clears the warning once the basket is back within the limit', () => {
    openBasket()
    expect(screen.getByText('Heavy on one field partner')).toBeInTheDocument()
    act(() => useLoanStore.setState({ basket: [1, 2, 3, 4, 5, 7].map((id) => ({ loan_id: id, amount: 25 })) }))
    expect(screen.queryByText('Heavy on one field partner')).toBeNull()
    expect(screen.getByText('2 field partners · 2 countries')).toBeInTheDocument()
  })

  it('uses the lender’s own limit from Options', () => {
    lsj.set('Options', { basket_partner_limit: 6 })
    openBasket()
    expect(screen.queryByText('Heavy on one field partner')).toBeNull()
    expect(screen.getByText(/You’re warned past 6 loans with one field partner/)).toBeInTheDocument()
  })

  it('takes you down to the warnings from the line under Checkout', () => {
    openBasket()
    fireEvent.click(screen.getByRole('button', { name: 'See why' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toHaveClass('kl-mix-warnings')
  })
})

describe('the narrowed list has an address', () => {
  it('puts the narrowing in the address, and Back steps out of it', () => {
    openBasket()
    fireEvent.click(screen.getByRole('button', { name: 'Show these 6 loans' }))
    expect(address()).toBe('/basket?show=partner.p20')
    expect(listed()).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(address()).toBe('/basket')
    expect(listed()).toHaveLength(8)
  })

  it('keeps the narrowing while a loan from it is open, and after it is closed', () => {
    openBasket()
    fireEvent.click(screen.getByRole('button', { name: /^Uganda/ }))
    fireEvent.click(listed()[0])
    expect(address()).toBe('/basket/7?show=country.Uganda')
    expect(listed()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Selected' }))
    expect(address()).toBe('/basket?show=country.Uganda')
    expect(listed()).toHaveLength(1)
  })

  it('opens narrowed from a link, once the basket’s loans have arrived', () => {
    kl.indexedLoans = {}
    openBasket(undefined, '/basket?show=country.Uganda')
    act(() => useLoanStore.setState({ loans: [] }))
    // Nothing to judge the narrowing by yet, so the address keeps it.
    expect(address()).toBe('/basket?show=country.Uganda')
    act(() => {
      kl.indexedLoans = Object.fromEntries(LOANS.map((l) => [l.id, l]))
      useLoanStore.setState({ loans: LOANS })
    })
    expect(listed()).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 8 loans: Uganda')
  })

  it('drops a narrowing the basket has no loans for', () => {
    openBasket(undefined, '/basket?show=partner.p99')
    expect(address()).toBe('/basket')
    expect(listed()).toHaveLength(8)
  })
})

describe('with a lender ID', () => {
  const slices = (pairs: Array<[string, string, number]>): BalancerResult => ({
    slices: pairs.map(([id, name, value]) => ({ id, name, value, percent: 0 })),
    total_sum: pairs.reduce((sum, [, , value]) => sum + value, 0),
  })

  it('waits for the lender’s active loans, then counts them in', async () => {
    let answer: (value: [BalancerResult, BalancerResult]) => void = () => {}
    const both = new Promise<[BalancerResult, BalancerResult]>((resolve) => (answer = resolve))
    const fetchBalancerData = vi.fn((sliceBy: string) => both.then(([p, c]) => (sliceBy === 'partner' ? p : c)))
    useCriteriaStore.setState({ fetchBalancerData: fetchBalancerData as never })
    useUtilsStore.setState({ lenderId: 'examplelender' })
    openBasket()
    expect(screen.getByText('Checking your active loans on Kiva…')).toBeInTheDocument()
    expect(screen.queryByText('Heavy on one field partner')).toBeNull()
    expect(fetchBalancerData).toHaveBeenCalledWith('partner', { enabled: true, allactive: 'active' })
    expect(fetchBalancerData).toHaveBeenCalledWith('country', { enabled: true, allactive: 'active' })
    // The line under Checkout already speaks for the basket itself.
    expect(screen.getByText(/Heavy on Low Stars MFI\./)).toBeInTheDocument()

    await act(async () => answer([slices([['40', 'Five Star', 4]]), slices([['2', 'Kenya', 20]])]))
    await waitFor(() => expect(screen.queryByText('Checking your active loans on Kiva…')).toBeNull())
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Five Star: 2 in this basket and 4 you already have, 6 loans in all.')).toBeInTheDocument()
    expect(screen.getByText('Kenya: 6 in this basket and 20 you already have, 26 loans in all.')).toBeInTheDocument()
    expect(screen.getByText(/Heavy on Low Stars MFI, Five Star, and Kenya\./)).toBeInTheDocument()
    expect(screen.queryByText(/only this basket is counted/i)).toBeNull()
  })

  it('stops waiting after 8 seconds and says only the basket was counted', async () => {
    vi.useFakeTimers()
    try {
      useCriteriaStore.setState({ fetchBalancerData: vi.fn(() => new Promise<BalancerResult>(() => {})) as never })
      useUtilsStore.setState({ lenderId: 'examplelender' })
      openBasket()
      expect(screen.getByText('Checking your active loans on Kiva…')).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(8000)
      })
      expect(screen.getByText('Couldn’t read your active loans from Kiva, so only this basket is counted.')).toBeInTheDocument()
      expect(screen.getByText('Heavy on one field partner')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not ask Kiva while the basket is empty', () => {
    const fetchBalancerData = vi.fn(async () => ({ slices: [], total_sum: 0 }))
    useCriteriaStore.setState({ fetchBalancerData: fetchBalancerData as never })
    useUtilsStore.setState({ lenderId: 'examplelender' })
    openBasket([])
    expect(fetchBalancerData).not.toHaveBeenCalled()
    expect(screen.queryByText('How this basket is spread')).toBeNull()
  })

  it('says only the basket was counted when Kiva refuses', async () => {
    useCriteriaStore.setState({ fetchBalancerData: vi.fn(async () => Promise.reject(new Error('502'))) as never })
    useUtilsStore.setState({ lenderId: 'examplelender' })
    openBasket()
    await waitFor(() =>
      expect(screen.getByText('Couldn’t read your active loans from Kiva, so only this basket is counted.')).toBeInTheDocument(),
    )
  })
})
