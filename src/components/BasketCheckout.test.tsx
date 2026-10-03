// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { I18nProvider } from '../i18n'
import Basket from './Basket'
import { useLoanStore, useUtilsStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import type { KivaLoan, Partner } from '../types'

vi.mock('./Loan', () => ({ default: ({ loanId }: { loanId: number }) => <div data-testid="loan-panel">{loanId}</div> }))

/**
 * Checkout at Kiva on the basket page: where it goes, what it tells the lender
 * first, and what it notes for their return.
 */

const PARTNERS = [{ id: 40, name: 'Five Star', rating: '5.0', status: 'active' }] as unknown as Partner[]

const loan = (id: number, stillNeeded = 500): KivaLoan =>
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
    kl_still_needed: stillNeeded,
    kl_repayments: [{ date: new Date(2026, 10, 1), display: 'Nov 2026', amount: 5 }],
  }) as unknown as KivaLoan

const kl = getKivaLoans()
const saved = { loans: kl.indexedLoans, partners: kl.partnersFromKiva, fetchRepay: kl.fetchDescrAndRepayments }

function openBasket(items: Array<[id: number, amount: number]>, loans = items.map(([id]) => loan(id))) {
  kl.indexedLoans = Object.fromEntries(loans.map((l) => [l.id, l]))
  act(() =>
    useLoanStore.setState({
      basket: items.map(([id, amount]) => ({ loan_id: id, amount })),
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
          <Route path="/basket/:id" element={<Basket />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

const checkout = () => screen.getByText('Checkout at Kiva')
const notes = () => document.getElementById('kl-checkout-note')
const amounts = () => document.querySelector('.kl-checkout-amounts')

beforeEach(() => {
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
  useLoanStore.setState({ basket: [], pendingCheckout: null })
  lsj.set('Options', {})
})

describe('Checkout at Kiva', () => {
  it('is a link to the Kiva address that adds these loans, opening in a new tab', () => {
    openBasket([[11, 25], [12, 25]])
    const link = checkout()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://www.kiva.org/add-loan-bundle?loanIds=11,12&app_id=org.kiva.kivalens')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    // The note it is described by says where it goes and what Kiva adds to the total.
    expect(link).toHaveAttribute('aria-describedby', 'kl-checkout-note')
    expect(notes()).toHaveTextContent('Opens Kiva in a new tab and adds these loans to your basket there.')
    expect(notes()).toHaveTextContent('Kiva suggests a donation at checkout, which you can change.')
    expect(amounts()).toBeNull()
  })

  it('posts nothing: the page holds no form for Kiva and opens no window itself', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = openBasket([[11, 25], [12, 25]])
    expect(container.querySelector('form')).toBeNull()
    fireEvent.click(checkout())
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
    const source = readFileSync(path.join(process.cwd(), 'src/components/Basket.tsx'), 'utf8')
    expect(source).not.toMatch(/basket\/set/)
    expect(source).not.toMatch(/window\.open\(/)
    expect(source).not.toMatch(/\.submit\(\)/)
  })

  it('notes what went when the link is pressed, so the return can be reconciled', () => {
    openBasket([[11, 25], [12, 50]])
    expect(useLoanStore.getState().pendingCheckout).toBeNull()
    fireEvent.click(checkout())
    expect(useLoanStore.getState().pendingCheckout?.ids).toEqual([11, 12])
  })

  it('notes it for a middle click too, which opens the link without a click event', () => {
    openBasket([[11, 25], [12, 25]])
    fireEvent(checkout(), new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    expect(useLoanStore.getState().pendingCheckout).toBeNull()
    fireEvent(checkout(), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(useLoanStore.getState().pendingCheckout?.ids).toEqual([11, 12])
  })

  it('sends one loan with the amount chosen, and has nothing to explain about amounts', () => {
    openBasket([[11, 75]])
    expect(checkout()).toHaveAttribute('href', 'https://www.kiva.org/process-instant-lending/11/75?app_id=org.kiva.kivalens')
    expect(amounts()).toBeNull()
  })

  it('lists the loans whose amount has to be set at Kiva, each with what was chosen', () => {
    openBasket([[11, 25], [12, 50], [13, 100]])
    const box = amounts()!
    expect(box).toHaveAttribute('role', 'note')
    expect(box).toHaveTextContent('Kiva adds each loan at $25, whatever you chose here. Set your amount for these at Kiva’s checkout:')
    const rows = [...box.querySelectorAll('li')].map((li) => li.textContent)
    expect(rows).toEqual(['Borrower 12$50', 'Borrower 13$100'])
    expect(box).not.toHaveTextContent('Borrower 11')
  })

  it('says it in one sentence when every loan was chosen at the same other amount', () => {
    openBasket([[11, 50], [12, 50], [13, 50]])
    const box = amounts()!
    expect(box).toHaveTextContent('Kiva adds each loan at $25, whatever you chose here. You chose $50 for each of these 3 loans, so set that at Kiva’s checkout.')
    expect(box.querySelector('li')).toBeNull()
  })

  it('goes through Kiva’s sign-in for a basket over $150, and says so first', () => {
    openBasket([11, 12, 13, 14, 15, 16, 17].map((id) => [id, 25]))
    const url = new URL(checkout().getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://www.kiva.org/ui-login')
    expect(url.searchParams.get('doneUrl')).toBe('/add-loan-bundle?loanIds=11,12,13,14,15,16,17&app_id=org.kiva.kivalens')
    expect(notes()).toHaveTextContent('This basket is over $150.')
    expect(notes()).toHaveTextContent('it asks you to sign in first if you aren’t')
  })

  it('stays direct, and says nothing about signing in, at $150 or less', () => {
    openBasket([11, 12, 13, 14, 15, 16].map((id) => [id, 25]))
    expect(checkout()).toHaveAttribute('href', 'https://www.kiva.org/add-loan-bundle?loanIds=11,12,13,14,15,16&app_id=org.kiva.kivalens')
    expect(notes()).not.toHaveTextContent('sign in')
  })

  it('warns that Kiva needs a while only for a basket large enough to look stuck', () => {
    const many = Array.from({ length: 20 }, (_, i) => [100 + i, 25] as [number, number])
    openBasket(many.slice(0, 19))
    expect(notes()).not.toHaveTextContent('one at a time')
    cleanup()
    openBasket(many)
    expect(notes()).toHaveTextContent('Kiva adds the loans one at a time, so allow it about 1 min for this basket.')
    expect(notes()).toHaveTextContent('Keep the Kiva tab open until its checkout shows.')
    expect(notes()).not.toHaveTextContent('at a time from KivaLens')
  })

  it('sends a very large basket a part at a time, and says how many loans stay for the next', () => {
    const many = Array.from({ length: 700 }, (_, i) => [3_000_000 + i, 25] as [number, number])
    openBasket(many)
    const sent = new URL(checkout().getAttribute('href')!).searchParams.get('doneUrl')!.match(/\d{7}/g)!
    expect(sent.length).toBeGreaterThan(500)
    expect(sent.length).toBeLessThan(700)
    expect(notes()).toHaveTextContent(`Kiva takes ${sent.length} loans at a time from KivaLens. This sends the first ${sent.length}; the rest (${700 - sent.length}) stay in your basket for your next checkout.`)
    expect(notes()).toHaveTextContent(`allow it about ${Math.round((sent.length * 1.5) / 60)} min`)
    // Only the loans that went are noted, so the return removes those and leaves the rest.
    fireEvent.click(checkout())
    expect(useLoanStore.getState().pendingCheckout?.ids).toHaveLength(sent.length)
  })

  it('leaves out a loan that has stopped raising money', () => {
    openBasket([[11, 25], [12, 25], [13, 25]], [loan(11), loan(12, 0), loan(13)])
    expect(checkout()).toHaveAttribute('href', 'https://www.kiva.org/add-loan-bundle?loanIds=11,13&app_id=org.kiva.kivalens')
    fireEvent.click(checkout())
    expect(useLoanStore.getState().pendingCheckout?.ids).toEqual([11, 13])
  })

  it('is disabled with the reason beside it when no loan in the basket is still raising money', () => {
    openBasket([[11, 25], [12, 25]], [loan(11, 0), loan(12, 0)])
    const button = checkout()
    expect(button.tagName).toBe('BUTTON')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-describedby', 'kl-checkout-note')
    expect(notes()).toHaveTextContent('None of these loans is still raising money, so there is nothing to send to Kiva.')
  })

  it('is disabled and says nothing more when the basket is empty', () => {
    openBasket([])
    expect(checkout()).toBeDisabled()
    expect(checkout()).not.toHaveAttribute('aria-describedby')
    expect(notes()).toBeNull()
    expect(amounts()).toBeNull()
  })
})
