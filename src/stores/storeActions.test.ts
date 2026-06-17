// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useLoanStore } from './loanStore'
import { useCriteriaStore } from './criteriaStore'
import type { Criteria } from '../types'

// Store-action tests run under jsdom because the stores touch localStorage.
// They lock in the T1.6 (batch dedup) and T1.3 (atomic rename) fixes.

const blankCrit = (): Criteria => ({ loan: {}, partner: {}, portfolio: {} })

describe('loanStore.batchAddToBasket dedup (T1.6)', () => {
  beforeEach(() => {
    useLoanStore.setState({ basket: [] })
  })

  it('skips loans already in the basket and preserves their amount', () => {
    useLoanStore.getState().addToBasket(1, 25)
    useLoanStore.getState().batchAddToBasket([
      { loan_id: 1, amount: 50 },
      { loan_id: 2, amount: 50 },
    ])
    const basket = useLoanStore.getState().basket
    expect(basket.map((b) => b.loan_id)).toEqual([1, 2])
    expect(basket.find((b) => b.loan_id === 1)?.amount).toBe(25)
  })

  it('dedups duplicates within the incoming items', () => {
    useLoanStore.getState().batchAddToBasket([
      { loan_id: 3, amount: 25 },
      { loan_id: 3, amount: 99 },
    ])
    expect(useLoanStore.getState().basket.filter((b) => b.loan_id === 3)).toHaveLength(1)
  })
})

describe('loanStore checkout snapshot (T1.1)', () => {
  beforeEach(() => {
    useLoanStore.setState({ basket: [], pendingCheckout: null })
  })

  it('records the in-flight checkout ids with a timestamp', () => {
    useLoanStore.getState().beginCheckout([10, 20])
    const pc = useLoanStore.getState().pendingCheckout
    expect(pc?.ids).toEqual([10, 20])
    expect(typeof pc?.at).toBe('number')
  })

  it('clears the pending checkout', () => {
    useLoanStore.getState().beginCheckout([1])
    useLoanStore.getState().clearPendingCheckout()
    expect(useLoanStore.getState().pendingCheckout).toBeNull()
  })
})

describe('criteriaStore.renameSearch (T1.3)', () => {
  beforeEach(() => {
    useCriteriaStore.setState({
      savedSearches: { Old: { ...blankCrit() } },
      lastSwitch: 'Old',
    })
  })

  it('moves criteria from old to new name and updates lastSwitch', () => {
    useCriteriaStore.getState().renameSearch('Old', 'New')
    const ss = useCriteriaStore.getState().savedSearches
    expect(ss.New).toBeDefined()
    expect(ss.Old).toBeUndefined()
    expect(useCriteriaStore.getState().lastSwitch).toBe('New')
  })

  it('no-ops on a blank or unchanged name', () => {
    useCriteriaStore.getState().renameSearch('Old', '   ')
    expect(useCriteriaStore.getState().savedSearches.Old).toBeDefined()
    useCriteriaStore.getState().renameSearch('Old', 'Old')
    expect(useCriteriaStore.getState().savedSearches.Old).toBeDefined()
  })

  it('preserves the renamed search\'s own criteria (does not clobber with edited lastKnown)', () => {
    const distinctCrit = { loan: { sort: 'newest' }, partner: {}, portfolio: {} } as Criteria
    useCriteriaStore.setState({
      savedSearches: { A: distinctCrit },
      lastKnown: blankCrit(),
    })
    useCriteriaStore.getState().renameSearch('A', 'B')
    const renamed = useCriteriaStore.getState().savedSearches.B as Criteria
    expect(renamed.loan.sort).toBe('newest')
  })
})
