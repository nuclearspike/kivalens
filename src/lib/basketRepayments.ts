import type { BasketEntry } from '../stores/loanStore'
import { seriesColor } from './chartColors'

/** One month of the basket's repayment forecast. */
export interface BasketRepaymentMonth {
  label: string
  /** The whole month, and the sum of every loan's share of it. */
  amount: number
  cumulativeAmount: number
  date: number
  /** What each loan pays back that month, keyed as the series is. */
  byLoan: Record<string, number>
}

/** One loan's contribution across the forecast. */
export interface BasketRepaymentSeries {
  id: number
  /** The data key its stacked bar reads. */
  key: string
  /** The borrower, which is what the lender recognises. */
  name: string
  color: string
  total: number
}

export interface BasketRepayments {
  months: BasketRepaymentMonth[]
  series: BasketRepaymentSeries[]
  /** Basket loans with no repayment schedule yet, so nothing to forecast. */
  skippedCount: number
}

export const loanSeriesKey = (loanId: number) => `loan_${loanId}`

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * The basket's repayment forecast, month by month and loan by loan.
 *
 * A month's total is the sum of the per-loan figures AFTER each is rounded, so
 * the one bar and the stack of segments are the same length — a stack that came
 * to a different total than the bar it replaces would look like a bug.
 */
export function buildBasketRepayments(
  entries: BasketEntry[],
  formatMonth: (date: number) => string,
): BasketRepayments {
  const months = new Map<string, { date: number; byLoan: Map<number, number> }>()
  const names = new Map<number, string>()
  let skipped = 0

  for (const entry of entries) {
    const loan = entry.loan
    if (!loan?.kl_still_needed || !loan.kl_repayments?.length || !loan.loan_amount) {
      skipped += 1
      continue
    }
    names.set(loan.id, loan.name)
    const share = entry.amount / loan.loan_amount
    for (const rep of loan.kl_repayments) {
      const month = months.get(rep.display) ?? {
        date: new Date(rep.date).getTime(),
        byLoan: new Map<number, number>(),
      }
      month.byLoan.set(loan.id, (month.byLoan.get(loan.id) ?? 0) + rep.amount * share)
      months.set(rep.display, month)
    }
  }

  if (months.size === 0) return { months: [], series: [], skippedCount: skipped }

  const totals = new Map<number, number>()
  for (const month of months.values()) {
    for (const [id, amount] of month.byLoan) totals.set(id, (totals.get(id) ?? 0) + cents(amount))
  }

  // Biggest contributor first, so the stack reads the same way in every month;
  // the id breaks a tie so the order never depends on map iteration.
  const series: BasketRepaymentSeries[] = [...totals.entries()]
    .sort(([idA, a], [idB, b]) => b - a || idA - idB)
    .map(([id, total], index) => ({
      id,
      key: loanSeriesKey(id),
      name: names.get(id) ?? String(id),
      color: seriesColor(index),
      total: cents(total),
    }))

  let cumulative = 0
  const ordered = [...months.entries()].sort(([, a], [, b]) => a.date - b.date)
  const rows = ordered.map(([, month]) => {
    const byLoan: Record<string, number> = {}
    let amount = 0
    for (const s of series) {
      const raw = month.byLoan.get(s.id)
      if (raw === undefined) continue
      const value = cents(raw)
      if (value === 0) continue
      byLoan[s.key] = value
      amount += value
    }
    amount = cents(amount)
    cumulative = cents(cumulative + amount)
    return {
      label: formatMonth(month.date),
      amount,
      cumulativeAmount: cumulative,
      date: month.date,
      byLoan,
    }
  })

  return { months: rows, series, skippedCount: skipped }
}
