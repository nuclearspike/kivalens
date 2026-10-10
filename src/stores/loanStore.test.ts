/**
 * The basket holds real money the user is about to send to Kiva, so its
 * arithmetic and de-duplication are the highest-consequence logic in the client:
 * a double entry double-charges. Every loan is in it at the one amount it goes to
 * Kiva at ($25), or at what the loan still needs when that is less, and nothing
 * here can make it more.
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useLoanStore } from './loanStore'
import { createKivaLoans } from '../api/kiva'
import type { KivaLoan } from '../types'

const store = () => useLoanStore.getState()

const mk = (id: number, extra: Partial<KivaLoan> = {}) =>
  ({
    id,
    name: `Borrower ${id}`,
    status: 'fundraising',
    loan_amount: 1000,
    funded_amount: 0,
    basket_amount: 0,
    sector: 'Agriculture',
    activity: 'Farming',
    use: 'seed',
    location: { country_code: 'KE', country: 'Kenya' },
    terms: { repayment_interval: 'monthly' },
    kls_tags: [],
    themes: [],
    borrowers: [],
    kl_percent_women: 100,
    kl_still_needed: 500,
    kl_percent_funded: 50,
    kl_name_arr: [],
    kls_use_or_descr_arr: [],
    kl_newest_sort: 0,
    posted_date: '2026-06-01',
    kl_processed: new Date(),
    ...extra,
  }) as unknown as KivaLoan

/** getBasket()/adjust* resolve loans through the global Loans singleton. */
const seedLoans = (loans: KivaLoan[]) => createKivaLoans().setKivaLoans(loans, true, true)

beforeEach(() => {
  store().clearBasket()
  store().clearPendingCheckout()
  useLoanStore.setState({ basketNotice: null })
  // What a loan is added at depends on what the loaded loan still needs, so no
  // test inherits the loans another one loaded.
  seedLoans([])
})

describe('basket — adding', () => {
  it('adds a loan at $25', () => {
    store().addToBasket(1)
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }])
  })

  it('adds a loan with less than $25 left at what it still needs', () => {
    seedLoans([mk(1, { kl_still_needed: 10 }), mk(2, { kl_still_needed: 25 }), mk(3, { kl_still_needed: 0 })])
    for (const id of [1, 2, 3]) store().addToBasket(id)
    // A loan with nothing left counts $25 until the basket refreshes and drops it.
    expect(store().basket).toEqual([{ loan_id: 1, amount: 10 }, { loan_id: 2, amount: 25 }, { loan_id: 3, amount: 25 }])
  })

  it('takes no other amount: a second argument is not part of adding', () => {
    ;(store().addToBasket as (loanId: number, amount?: number) => void)(1, 100)
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }])
  })

  it('never adds the same loan twice', () => {
    store().addToBasket(1)
    store().addToBasket(1)
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }])
  })

  it('batch-add de-dupes against what is already in the basket', () => {
    store().addToBasket(1)
    store().batchAddToBasket([
      { loan_id: 1, amount: 25 },
      { loan_id: 2, amount: 25 },
    ])
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }])
  })

  it('batch-add never takes more than $25 for a loan, whoever asks, and keeps a smaller amount', () => {
    store().batchAddToBasket([
      { loan_id: 1, amount: 100 },
      { loan_id: 2, amount: 15 },
      { loan_id: 3, amount: 0 },
      { loan_id: 4, amount: Number.NaN },
    ])
    expect(store().basket.map((b) => b.amount)).toEqual([25, 15, 25, 25])
  })

  it('batch-add never takes more for a loan than it still needs', () => {
    seedLoans([mk(1, { kl_still_needed: 10 }), mk(2)])
    store().batchAddToBasket([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }])
    expect(store().basket).toEqual([{ loan_id: 1, amount: 10 }, { loan_id: 2, amount: 25 }])
  })

  it('batch-add de-dupes WITHIN its own payload', () => {
    store().batchAddToBasket([
      { loan_id: 7, amount: 25 },
      { loan_id: 7, amount: 25 },
      { loan_id: 8, amount: 25 },
    ])
    expect(store().basket.map((b) => b.loan_id)).toEqual([7, 8])
  })

  it('ignores an empty batch', () => {
    store().addToBasket(1)
    store().batchAddToBasket([])
    expect(store().basket).toHaveLength(1)
  })
})

describe('basket — removing and clearing', () => {
  it('removes one loan and leaves the rest', () => {
    store().batchAddToBasket([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }])
    store().removeFromBasket(1)
    expect(store().basket.map((b) => b.loan_id)).toEqual([2])
  })

  it('removing a loan that is not there is a no-op', () => {
    store().addToBasket(1)
    store().removeFromBasket(999)
    expect(store().basket).toHaveLength(1)
  })

  it('batch-removes several at once', () => {
    store().batchAddToBasket([1, 2, 3].map((id) => ({ loan_id: id, amount: 25 })))
    store().batchRemoveFromBasket([1, 3])
    expect(store().basket.map((b) => b.loan_id)).toEqual([2])
  })

  it('clears everything', () => {
    store().batchAddToBasket([1, 2].map((id) => ({ loan_id: id, amount: 25 })))
    store().clearBasket()
    expect(store().basket).toEqual([])
  })
})

describe('basket — amounts', () => {
  it('has no way to set another amount', () => {
    expect('setBasketAmount' in store()).toBe(false)
    expect('setAllBasketAmounts' in store()).toBe(false)
  })

  it('reads a basket stored while amounts could be chosen at $25, and keeps a smaller amount', async () => {
    localStorage.setItem(
      'kivalens-basket',
      JSON.stringify({
        state: { basket: [{ loan_id: 1, amount: 100 }, { loan_id: 2, amount: 25 }, { loan_id: 3, amount: 10 }], pendingCheckout: { ids: [9], at: 1 } },
        version: 0,
      }),
    )
    await useLoanStore.persist.rehydrate()
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }, { loan_id: 3, amount: 10 }])
    // The rest of what was stored comes back as it was.
    expect(store().pendingCheckout).toEqual({ ids: [9], at: 1 })
  })
})

describe('basket — adjustBasketAmountsToWhatsLeft', () => {
  it('lowers an amount to what the loan still needs now', () => {
    seedLoans([mk(1)])
    store().addToBasket(1)
    expect(store().basket[0].amount).toBe(25)
    seedLoans([mk(1, { kl_still_needed: 15 })])
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket[0].amount).toBe(15)
    expect(store().basketNotice).toEqual({ funded: 0, lowered: 1 })
  })

  it('raises an amount back when the loan needs more again: there is no control to raise it with', () => {
    // Both were lowered to $10 while someone else's basket at Kiva held the rest.
    useLoanStore.setState({ basket: [{ loan_id: 1, amount: 10 }, { loan_id: 2, amount: 10 }] })
    seedLoans([mk(1, { kl_still_needed: 300 }), mk(2, { kl_still_needed: 20 })])
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket).toEqual([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 20 }])
    // Raising is not something to warn about.
    expect(store().basketNotice).toBeNull()
  })

  it('leaves alone a loan whose need is not known', () => {
    seedLoans([mk(1, { kl_still_needed: undefined })])
    useLoanStore.setState({ basket: [{ loan_id: 1, amount: 10 }] })
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket).toEqual([{ loan_id: 1, amount: 10 }])
  })

  it('leaves an amount already within what is needed', () => {
    seedLoans([mk(1, { kl_still_needed: 500 })])
    store().addToBasket(1)
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket[0].amount).toBe(25)
  })

  it('drops a loan that no longer needs anything', () => {
    seedLoans([mk(1, { kl_still_needed: 0 }), mk(2, { kl_still_needed: 300 })])
    store().batchAddToBasket([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }])
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket.map((b) => b.loan_id)).toEqual([2])
  })

  it('drops a loan that stopped fundraising', () => {
    seedLoans([mk(1, { status: 'funded', kl_still_needed: 100 }), mk(2)])
    store().batchAddToBasket([{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }])
    store().adjustBasketAmountsToWhatsLeft()
    expect(store().basket.map((b) => b.loan_id)).toEqual([2])
  })
})

describe('basket — queries', () => {
  it('inBasket reflects membership', () => {
    store().addToBasket(5)
    expect(store().inBasket(5)).toBe(true)
    expect(store().inBasket(6)).toBe(false)
  })

  it('getBasket joins amounts to loans and skips ones not loaded', () => {
    seedLoans([mk(1)])
    store().batchAddToBasket([{ loan_id: 1, amount: 25 }, { loan_id: 404, amount: 25 }])
    const entries = store().getBasket()
    expect(entries.map((e) => e.id)).toEqual([1])
    expect(entries[0].loan!.id).toBe(1)
  })
})

describe('checkout hand-off', () => {
  it('records the ids being checked out, then clears them', () => {
    store().beginCheckout([1, 2])
    expect(store().pendingCheckout!.ids).toEqual([1, 2])
    store().clearPendingCheckout()
    expect(store().pendingCheckout).toBeNull()
  })
})
