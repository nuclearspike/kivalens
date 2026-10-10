// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import Options from './Options'
import BulkAddModal from './BulkAddModal'
import BasketListItem from './BasketListItem'
import LoanListItem from './LoanListItem'
import { useLoanStore, useUtilsStore } from '../stores'
import type { KivaLoan } from '../types'

/**
 * Paul, 2026-10-10: "We need to remove the dollar drop-downs now that kiva only
 * accepts $25 as the default. it gives a false signal to the user". Every place
 * an amount could be chosen, and that it no longer can.
 */

const loan = (id: number, stillNeeded = 500): KivaLoan =>
  ({
    id,
    name: `Borrower ${id}`,
    status: 'fundraising',
    loan_amount: 1000,
    funded_amount: 1000 - stillNeeded,
    partner_id: 40,
    sector: 'Retail',
    activity: 'Clothing Sales',
    use: 'to buy stock',
    location: { country: 'Uganda', country_code: 'UG' },
    image: { id: 1 },
    borrowers: [],
    kl_still_needed: stillNeeded,
  }) as unknown as KivaLoan

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

beforeEach(() => {
  localStorage.clear()
  useLoanStore.setState({ basket: [], filteredLoans: [], loans: [], pendingCheckout: null })
  useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: false })
})
afterEach(cleanup)

describe('no amount can be chosen in KivaLens', () => {
  it('Options has no default lending amount, even for a browser that stored one', () => {
    localStorage.setItem('Options', JSON.stringify({ default_lend_amount: 100 }))
    const { container } = render(<MemoryRouter><Options /></MemoryRouter>)
    expect(screen.queryByText('Default Lending Amount')).toBeNull()
    for (const select of container.querySelectorAll('select')) {
      expect([...select.options].some((o) => /^\$\d/.test(o.textContent ?? ''))).toBe(false)
    }
  })

  it('a result row double-clicked goes into the basket at $25, whatever default was stored', () => {
    localStorage.setItem('Options', JSON.stringify({ default_lend_amount: 100 }))
    render(<MemoryRouter><LoanListItem loan={loan(7)} /></MemoryRouter>)
    fireEvent.doubleClick(screen.getByText('Borrower 7'))
    expect(useLoanStore.getState().basket).toEqual([{ loan_id: 7, amount: 25 }])
  })

  it('a basket row has no amount to choose', () => {
    const { container } = render(<BasketListItem entry={{ id: 7, amount: 25, loan: loan(7) }} onSelect={vi.fn()} />)
    expect(container.querySelector('select')).toBeNull()
    expect(container.textContent).not.toMatch(/\$\d/)
  })

  it('a basket row says so when its loan counts for less than $25, in words and not as a choice', () => {
    const { container } = render(<BasketListItem entry={{ id: 7, amount: 10, loan: loan(7, 10) }} onSelect={vi.fn()} />)
    expect(screen.getByText('$10: all this loan still needs')).toBeInTheDocument()
    expect(container.querySelector('select')).toBeNull()
  })

  it('a basket row still says when its loan needs nothing more', () => {
    render(<BasketListItem entry={{ id: 7, amount: 25, loan: loan(7, 0) }} onSelect={vi.fn()} />)
    expect(screen.getByText('Fully funded — will be removed on checkout')).toBeInTheDocument()
  })

  it('the loan page has one Lend button, no amount to pick beside it, and a hint naming the amount it adds', () => {
    const page = source('src/components/Loan.tsx')
    expect(page).not.toMatch(/<select/)
    expect(page).not.toMatch(/setLendAmount|lendAmountOptions|default_lend_amount/)
    // The amount is the one rule's, worked out from what the loan still needs.
    expect(page).toContain('const lendAmount = currency(lendAmountFor(loan.kl_still_needed), { min: 0, max: 2 })')
    // The button keeps its name; the amount is in its hint.
    expect(page).toContain("{t('lend')}")
    expect(page).toContain("title={t('lend_adds_at_amount', { amount: lendAmount })}")
    expect(page).toContain('addToBasket(loan.id)')
  })

  it('nothing on the page side can ask for another amount: the store, the assistant’s actions and its event types', () => {
    for (const file of ['src/stores/loanStore.ts', 'src/components/AskKivaLens/AskKivaLens.tsx', 'src/api/aiChat.ts']) {
      expect(source(file), file).not.toMatch(/setBasketAmount|setAllBasketAmounts|set_lend_amount|set_all_lend_amounts/)
    }
  })
})

describe('Bulk Add', () => {
  const open = (loans: KivaLoan[]) => {
    useLoanStore.setState({ filteredLoans: loans })
    return render(<BulkAddModal onHide={vi.fn()} />)
  }

  it('asks for a total and nothing per loan, and says each loan goes in at $25', () => {
    const { container } = open([loan(1), loan(2)])
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(screen.queryByText(/Max per loan/)).toBeNull()
    expect(screen.getByText(/adds each loan not already in your basket at \$25, up to the total below/)).toBeInTheDocument()
  })

  it('adds each loan at $25, or at what it still needs when that is less', () => {
    open([loan(1), loan(2, 10), loan(3)])
    fireEvent.click(screen.getByRole('button', { name: 'Add a bunch!' }))
    expect(useLoanStore.getState().basket).toEqual([
      { loan_id: 1, amount: 25 },
      { loan_id: 2, amount: 10 },
      { loan_id: 3, amount: 25 },
    ])
  })

  it('adds a loan whole or not at all: $10 of room in the basket takes a loan that needs $10 and not part of a $25 one', () => {
    // Kiva's basket holds $10,000: this one has $10 of room left.
    useLoanStore.setState({ basket: [{ loan_id: 99, amount: 9990 }] })
    open([loan(1), loan(2, 10)])
    fireEvent.click(screen.getByRole('button', { name: 'Add a bunch!' }))
    expect(useLoanStore.getState().basket.slice(1)).toEqual([])
    cleanup()
    open([loan(2, 10), loan(1)])
    fireEvent.click(screen.getByRole('button', { name: 'Add a bunch!' }))
    expect(useLoanStore.getState().basket.slice(1)).toEqual([{ loan_id: 2, amount: 10 }])
  })

  it('stops at the total chosen', () => {
    const { container } = open([1, 2, 3, 4, 5].map((id) => loan(id)))
    fireEvent.change(container.querySelector('input[type="range"]')!, { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a bunch!' }))
    expect(useLoanStore.getState().basket.map((b) => b.loan_id)).toEqual([1, 2])
  })
})
