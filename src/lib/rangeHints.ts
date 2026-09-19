// What the hover hint over a slider's histogram bar says about that bar's
// values: their unit and context ("5 borrowers", "50–51% female", "$400–$575",
// "3.5 stars"), so the hint reads on its own. Kept apart from the slider tables
// in sliderConfig.ts because the i18n checker treats every string in a
// *_SLIDERS table as a catalog key.
import type { BinSpec } from '../../server/loanFilter.mjs'
import { binRange } from './sliderConfig'

export interface RangeHint {
  /** How a value is written: plain number, US dollars, or percent. */
  kind: 'number' | 'money' | 'percent'
  /** Catalog key of a "{range} …" template that adds the unit or context. */
  unit?: string
  /** The unit has singular and plural forms: `${unit}_one` / `${unit}_other`. */
  plural?: boolean
}

export const LOAN_RANGE_HINTS: Record<string, RangeHint> = {
  repaid_in: { kind: 'number', unit: 'hint_months', plural: true },
  borrower_count: { kind: 'number', unit: 'hint_borrowers', plural: true },
  percent_female: { kind: 'percent', unit: 'hint_percent_female' },
  age: { kind: 'number', unit: 'hint_age' },
  still_needed: { kind: 'money' },
  loan_amount: { kind: 'money' },
  dollars_per_hour: { kind: 'money', unit: 'hint_per_hour' },
  percent_funded: { kind: 'percent', unit: 'hint_percent_funded' },
  expiring_in_days: { kind: 'number', unit: 'hint_days', plural: true },
  disbursal_in_days: { kind: 'number', unit: 'hint_days', plural: true },
}

export const PARTNER_RANGE_HINTS: Record<string, RangeHint> = {
  partner_risk_rating: { kind: 'number', unit: 'hint_stars', plural: true },
  partner_arrears: { kind: 'percent' },
  loans_at_risk_rate: { kind: 'percent' },
  partner_default: { kind: 'percent' },
  portfolio_yield: { kind: 'percent' },
  profit: { kind: 'percent' },
  currency_exchange_loss_rate: { kind: 'percent' },
  years_on_kiva: { kind: 'number', unit: 'hint_years', plural: true },
  loans_posted: { kind: 'number', unit: 'hint_loans_posted' },
  fundraising_loan_count: { kind: 'number', unit: 'hint_fundraising_loans' },
  secular_rating: { kind: 'number', unit: 'hint_score' },
  social_rating: { kind: 'number', unit: 'hint_score' },
}

/** Digits after the point a slider's values need: 0.5 -> 1, 0.25 -> 2, 25 -> 0. */
export function decimalsOf(step: number): number {
  const text = String(step)
  const point = text.indexOf('.')
  return point < 0 ? 0 : text.length - point - 1
}

type Digits = number | { min: number; max: number }

export interface HintFormatters {
  number: (value: unknown, fraction?: Digits) => string
  currency: (value: unknown, fraction?: Digits) => string
  percent: (value: unknown, fraction?: Digits) => string
  t: (key: string, values?: Record<string, string | number>) => string
  /** Plural category of a number in the lender's language ("one", "other", ...). */
  pluralOf: (value: number) => string
}

/** "5 borrowers", "50–51% female", "$400–$575", "≥ $9,800", "3.5 stars" for bar `index`. */
export function hintRangeText(spec: BinSpec, index: number, step: number, hint: RangeHint | undefined, f: HintFormatters): string {
  const kind = hint?.kind ?? 'number'
  // Up to the decimals the slider moves in, without padding: "3 stars", "3.5 stars", "1.25 years".
  const digits = { min: 0, max: decimalsOf(step) }
  const write = (value: number) => (kind === 'money' ? f.currency(value, digits) : kind === 'percent' ? f.percent(value, digits) : f.number(value, digits))

  const [from, to] = binRange(spec, index)
  // A bar's upper edge is the next bar's first value: the last value it holds is one step below.
  const last = Number((to - step).toFixed(6))
  let range: string
  let single: number | null = null
  if (index === spec.count - 1) {
    // The last bar also holds everything past the scale: a handle at the end means "no limit".
    range = `≥ ${write(from)}`
  } else if (spec.discrete || last <= from) {
    range = write(from)
    single = from
  } else {
    // The percent sign is written once, after the second value: "50–51%".
    const first = kind === 'percent' ? f.number(from, digits) : write(from)
    // A dash between negative numbers reads as a run of minus signs ("-90–-87"): spell the range out.
    range = from < 0 ? f.t('hint_range_to', { from: first, to: write(last) }) : `${first}–${write(last)}`
  }

  if (!hint?.unit) return range
  if (!hint.plural) return f.t(hint.unit, { range })
  const form = single !== null && f.pluralOf(single) === 'one' ? 'one' : 'other'
  return f.t(`${hint.unit}_${form}`, { range })
}
