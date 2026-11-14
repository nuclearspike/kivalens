// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import Basket from './Basket'
import { useLoanStore, useUtilsStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import { escapesWithNoWindow, held, turn } from '../test/lateWork'
import { showConfirm } from '../lib/dialog'
import type { KivaLoan, Partner } from '../types'

vi.mock('./Loan', () => ({ default: ({ loanId }: { loanId: number }) => <div data-testid="loan-panel">{loanId}</div> }))
vi.mock('../lib/dialog', async (original) => ({ ...(await original<typeof import('../lib/dialog')>()), showConfirm: vi.fn(async () => false) }))

// The basket asks Kiva for the details of loans it holds without a repayment schedule. That check
// can fail, and the page can be gone before it answers.

const PARTNERS = [{ id: 40, name: 'Five Star', rating: '5.0', status: 'active' }] as unknown as Partner[]

/** A basket loan as a warm start leaves it: no repayment schedule yet. */
const unchecked = (id: number): KivaLoan =>
  ({
    id,
    name: `Borrower ${id}`,
    status: 'fundraising',
    partner_id: 40,
    sector: 'Retail',
    activity: 'Clothing Sales',
    location: { country: 'Uganda', country_code: 'UG' },
    image: { id: 1 },
    borrowers: [],
    kl_still_needed: 500,
    kl_repayments: [],
  }) as unknown as KivaLoan

const kl = getKivaLoans()
const saved = { loans: kl.indexedLoans, partners: kl.partnersFromKiva, fetchRepay: kl.fetchDescrAndRepayments }

function openBasket(loans: KivaLoan[]) {
  kl.indexedLoans = Object.fromEntries(loans.map((l) => [l.id, l]))
  act(() =>
    useLoanStore.setState({
      basket: loans.map((l) => ({ loan_id: l.id, amount: 25 })),
      loans,
      downloading: false,
      pendingCheckout: null,
    }),
  )
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/basket']}>
        <Routes>
          <Route path="/basket" element={<Basket />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => {
  kl.partnersFromKiva = PARTNERS
  Element.prototype.scrollIntoView = vi.fn()
  useUtilsStore.setState({ lenderId: '' })
  lsj.set('Options', {})
})

afterEach(() => {
  cleanup()
  kl.indexedLoans = saved.loans
  kl.partnersFromKiva = saved.partners
  kl.fetchDescrAndRepayments = saved.fetchRepay
  useLoanStore.setState({ basket: [], pendingCheckout: null })
  lsj.set('Options', {})
})

describe("the basket's check of its loans with Kiva", () => {
  it('a check that fails leaves the basket on screen, and nothing escapes the page', async () => {
    const check = held<void>()
    kl.fetchDescrAndRepayments = vi.fn(() => check.promise)
    const escaped: unknown[] = []
    const noteEscape = (reason: unknown) => { escaped.push(reason) }
    process.on('unhandledRejection', noteEscape)
    try {
      openBasket([unchecked(61), unchecked(62)])
      expect(kl.fetchDescrAndRepayments).toHaveBeenCalledTimes(1)
      await act(async () => {
        check.reject(new Error('Some loan details could not be verified'))
        await turn()
      })
      expect(escaped).toEqual([])
      expect(screen.getByText('Borrower 61')).toBeInTheDocument()
    } finally {
      process.off('unhandledRejection', noteEscape)
    }
  })

  it.each([
    ['answers', (check: ReturnType<typeof held<void>>) => check.resolve()],
    ['fails', (check: ReturnType<typeof held<void>>) => check.reject(new Error('Some loan details could not be verified'))],
  ])('a check that %s after the basket page has gone changes nothing, and nothing throws', async (_outcome, land) => {
    const check = held<void>()
    kl.fetchDescrAndRepayments = vi.fn(() => check.promise)
    openBasket([unchecked(63)]).unmount()
    expect(await escapesWithNoWindow(() => land(check))).toEqual([])
  })
})

describe("the basket's check of a checkout with Kiva, on the lender's return", () => {
  const checkedLoan = (id: number): KivaLoan => ({ ...unchecked(id), kl_repayments: [{ date: new Date(2026, 10, 1), display: 'Nov 2026', amount: 5 }] }) as unknown as KivaLoan

  it.each([
    ['leaves the basket', (view: ReturnType<typeof openBasket>) => view.unmount()],
    ['sets another lender ID', () => act(() => { useUtilsStore.setState({ lenderId: 'otherlender' }) })],
  ])('a lender who %s while Kiva is asked has nothing removed or asked, and the checkout waits for the next visit', async (_what, moveOn) => {
    const kivaLoans = held<number[]>()
    const saveRefresh = kl.refreshLenderFundraisingLoans
    kl.refreshLenderFundraisingLoans = vi.fn(() => kivaLoans.promise)
    try {
      useUtilsStore.setState({ lenderId: 'somelender' })
      const view = openBasket([checkedLoan(81), checkedLoan(82)])
      act(() => useLoanStore.setState({ pendingCheckout: { ids: [81, 82], at: Date.now() } }))
      // The page reconciles when the lender comes back to its tab.
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
      expect(kl.refreshLenderFundraisingLoans).toHaveBeenCalledTimes(1)
      moveOn(view)
      await act(async () => {
        kivaLoans.resolve([81])
        await turn()
      })
      expect(useLoanStore.getState().basket.map((item) => item.loan_id)).toEqual([81, 82])
      expect(useLoanStore.getState().pendingCheckout?.ids).toEqual([81, 82])
      expect(showConfirm).not.toHaveBeenCalled()
    } finally {
      kl.refreshLenderFundraisingLoans = saveRefresh
      vi.mocked(showConfirm).mockClear()
    }
  })

  it('a lender still on the basket has the loans Kiva confirms taken out, and is asked about the rest', async () => {
    const kivaLoans = held<number[]>()
    const saveRefresh = kl.refreshLenderFundraisingLoans
    kl.refreshLenderFundraisingLoans = vi.fn(() => kivaLoans.promise)
    try {
      useUtilsStore.setState({ lenderId: 'somelender' })
      const loans = [checkedLoan(83), checkedLoan(84)]
      openBasket(loans)
      act(() => useLoanStore.setState({ pendingCheckout: { ids: [83, 84], at: Date.now() } }))
      // The page reconciles when the lender comes back to its tab.
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
      await act(async () => {
        kivaLoans.resolve([83])
        await turn()
      })
      expect(useLoanStore.getState().basket.map((item) => item.loan_id)).toEqual([84])
      expect(showConfirm).toHaveBeenCalledTimes(1)
    } finally {
      kl.refreshLenderFundraisingLoans = saveRefresh
      vi.mocked(showConfirm).mockClear()
    }
  })

  it("a check against the lender's loans at Kiva that fails asks the lender instead, and is reported", async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    const saveRefresh = kl.refreshLenderFundraisingLoans
    kl.refreshLenderFundraisingLoans = vi.fn(async () => { throw new Error('HTTP 503') })
    try {
      useUtilsStore.setState({ lenderId: 'somelender' })
      openBasket([checkedLoan(85)])
      act(() => useLoanStore.setState({ pendingCheckout: { ids: [85], at: Date.now() } }))
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await turn()
      })
      expect(showConfirm).toHaveBeenCalledTimes(1)
      expect(reported).toEqual(["Checking a checkout against the lender's loans at Kiva failed, so the lender was asked: HTTP 503"])
    } finally {
      kl.refreshLenderFundraisingLoans = saveRefresh
      vi.mocked(showConfirm).mockClear()
      vi.unstubAllGlobals()
    }
  })
})
