// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sortLoans } from '../kiva'

// sortLoans is the user-facing ordering of results. It is exported from kiva.ts;
// this file runs under jsdom because importing kiva.ts pulls in browser globals.
// Loans are minimal `any` shapes carrying only the fields each mode reads.

const ids = (loans: any[]) => loans.map((l) => l.id)

describe('sortLoans', () => {
  it('returns the array unchanged when it has 0 or 1 items', () => {
    const one = [{ id: 1 }] as any
    expect(sortLoans(one, 'newest')).toHaveLength(1)
  })

  it('"none" preserves the original order', () => {
    const loans = [{ id: 3 }, { id: 1 }, { id: 2 }] as any
    expect(ids(sortLoans(loans, 'none'))).toEqual([3, 1, 2])
  })

  it('"newest" sorts by kl_newest_sort desc, then id desc', () => {
    const loans = [
      { id: 1, kl_newest_sort: 100 },
      { id: 2, kl_newest_sort: 300 },
      { id: 3, kl_newest_sort: 200 },
    ] as any
    expect(ids(sortLoans(loans, 'newest'))).toEqual([2, 3, 1])
  })

  it('"newest" breaks ties on id (desc)', () => {
    const loans = [
      { id: 1, kl_newest_sort: 100 },
      { id: 2, kl_newest_sort: 100 },
    ] as any
    expect(ids(sortLoans(loans, 'newest'))).toEqual([2, 1])
  })

  it('"still_needed" sorts ascending', () => {
    const loans = [
      { id: 1, kl_still_needed: 300 },
      { id: 2, kl_still_needed: 100 },
      { id: 3, kl_still_needed: 200 },
    ] as any
    expect(ids(sortLoans(loans, 'still_needed'))).toEqual([2, 3, 1])
  })

  it('"expiring" sorts by expiration time ascending (soonest first)', () => {
    const loans = [
      { id: 1, kl_planned_expiration_date: new Date('2027-03-01') },
      { id: 2, kl_planned_expiration_date: new Date('2027-01-01') },
      { id: 3, kl_planned_expiration_date: new Date('2027-02-01') },
    ] as any
    expect(ids(sortLoans(loans, 'expiring'))).toEqual([2, 3, 1])
  })

  it('"popularity" sorts by kl_dollars_per_hour() descending', () => {
    const loans = [
      { id: 1, kl_dollars_per_hour: () => 5 },
      { id: 2, kl_dollars_per_hour: () => 15 },
      { id: 3, kl_dollars_per_hour: () => 10 },
    ] as any
    expect(ids(sortLoans(loans, 'popularity'))).toEqual([2, 3, 1])
  })

  it('"half_back" sorts by kls_half_back ascending', () => {
    const loans = [
      { id: 1, kls_half_back: new Date('2027-03-01') },
      { id: 2, kls_half_back: new Date('2027-01-01') },
      { id: 3, kls_half_back: new Date('2027-02-01') },
    ] as any
    expect(ids(sortLoans(loans, 'half_back'))).toEqual([2, 3, 1])
  })

  it('default (no/unknown sort) orders by final repayment ascending', () => {
    const loans = [
      { id: 1, kls_final_repayment: new Date('2027-03-01') },
      { id: 2, kls_final_repayment: new Date('2027-01-01') },
    ] as any
    expect(ids(sortLoans(loans, undefined))).toEqual([2, 1])
  })
})
