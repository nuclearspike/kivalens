import { describe, it, expect } from 'vitest'
import { buildBasketRepayments, loanSeriesKey } from './basketRepayments'
import { SERIES_PALETTE, seriesColor } from './chartColors'
import type { BasketEntry } from '../stores/loanStore'

/**
 * Paul: "i'd like to have an option (check box) that then breaks each bar into a
 * stacked bar chart" — so the forecast has to know which loan pays back what, in
 * each month, not only the month's total.
 */

const month = (when: number) => `M${when}`

function entry(
  id: number,
  name: string,
  amount: number,
  loanAmount: number,
  repayments: Array<{ display: string; date: string; amount: number }>,
): BasketEntry {
  return {
    id,
    amount,
    loan: {
      id,
      name,
      loan_amount: loanAmount,
      kl_still_needed: 100,
      kl_repayments: repayments,
    },
  } as unknown as BasketEntry
}

const jan = { display: 'Jan', date: '2027-01-15', amount: 0 }
const feb = { display: 'Feb', date: '2027-02-15', amount: 0 }

describe('the forecast, loan by loan', () => {
  // Deliberately awkward: a third of a repayment so rounding shows; the smaller
  // contributor first in the basket and with the lower id, so neither basket
  // order nor id order can pass for size order; and a month where one loan pays
  // nothing while the other does.
  const basket = [
    entry(2, 'Bakary', 10, 30, [
      { ...jan, amount: 10 },
      { ...feb, amount: 0 },
    ]),
    entry(9, 'Amara', 10, 30, [
      { ...jan, amount: 10 },
      { ...feb, amount: 30 },
    ]),
  ]

  it('splits each month by the loan that pays it', () => {
    const { months } = buildBasketRepayments(basket, month)
    expect(months).toHaveLength(2)
    // A lender's share of a repayment is their stake over the loan amount:
    // 10/30 of 10 is 3.33 each.
    expect(months[0].byLoan).toEqual({ [loanSeriesKey(9)]: 3.33, [loanSeriesKey(2)]: 3.33 })
    expect(months[1].byLoan).toEqual({ [loanSeriesKey(9)]: 10 })
  })

  it('makes the stack add up to exactly the bar it replaces', () => {
    // Rounded per loan and THEN summed, never the other way about: summing first
    // gives 6.67 for a stack that draws 6.66, which looks like a bug.
    const { months } = buildBasketRepayments(basket, month)
    expect(months[0].amount).toBe(6.66)
    for (const m of months) {
      const stacked = Object.values(m.byLoan).reduce((a, b) => a + b, 0)
      expect(Math.round(stacked * 100) / 100).toBe(m.amount)
    }
  })

  it('still runs the cumulative total it always did', () => {
    const { months } = buildBasketRepayments(basket, month)
    expect(months.map((m) => m.amount)).toEqual([6.66, 10])
    expect(months.map((m) => m.cumulativeAmount)).toEqual([6.66, 16.66])
  })

  it('names each band after the borrower, which is what the lender recognises', () => {
    const { series } = buildBasketRepayments(basket, month)
    expect(series.map((s) => s.name)).toEqual(['Amara', 'Bakary'])
  })

  it('puts the biggest contributor first, whatever order the basket is in', () => {
    const { series } = buildBasketRepayments(basket, month)
    expect(series.map((s) => s.id)).toEqual([9, 2])
    expect(series.map((s) => s.total)).toEqual([13.33, 3.33])
    // Neither the basket's order nor the ids run that way, so only size can.
    expect(basket.map((e) => e.id)).toEqual([2, 9])
    const reversed = buildBasketRepayments([...basket].reverse(), month)
    expect(reversed.series.map((s) => s.id)).toEqual([9, 2])
  })

  it('gives each band its own colour, and cycles rather than running out', () => {
    const { series } = buildBasketRepayments(basket, month)
    expect(series[0].color).toBe(seriesColor(0))
    expect(series[1].color).toBe(seriesColor(1))
    expect(seriesColor(SERIES_PALETTE.length)).toBe(SERIES_PALETTE[0])
  })

  it('leaves a loan out of a month it pays nothing into', () => {
    const { months } = buildBasketRepayments(basket, month)
    // An empty band is a click target that does nothing and a colour that means
    // nothing.
    expect(months[1].byLoan[loanSeriesKey(2)]).toBeUndefined()
    expect(Object.keys(months[1].byLoan)).toEqual([loanSeriesKey(9)])
  })
})

describe('what the forecast cannot see', () => {
  it('counts a loan with no repayment schedule instead of guessing at one', () => {
    const { months, series, skippedCount } = buildBasketRepayments(
      [
        entry(1, 'Amara', 25, 100, [{ ...jan, amount: 60 }]),
        entry(2, 'Bakary', 25, 100, []),
      ],
      month,
    )
    expect(skippedCount).toBe(1)
    expect(series.map((s) => s.id)).toEqual([1])
    expect(months).toHaveLength(1)
  })

  it('has nothing to draw when no basket loan has a schedule', () => {
    const { months, series, skippedCount } = buildBasketRepayments(
      [entry(1, 'Amara', 25, 100, [])],
      month,
    )
    expect(months).toEqual([])
    expect(series).toEqual([])
    expect(skippedCount).toBe(1)
  })

  it('is empty, not broken, for an empty basket', () => {
    expect(buildBasketRepayments([], month)).toEqual({ months: [], series: [], skippedCount: 0 })
  })
})
