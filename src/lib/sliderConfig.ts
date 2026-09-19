// The range sliders of the Search criteria tabs: their scale, and the layout of
// the distribution histogram drawn behind each one. Shared by the criteria UI
// and by the store that computes the histograms, so the two cannot drift.
import type { BinSpec } from '../../server/loanFilter.mjs'

export interface SliderConfig {
  min: number
  max: number
  step?: number
  label: string
  helpText?: string
}

export const LOAN_SLIDERS: Record<string, SliderConfig> = {
  repaid_in: { min: 2, max: 90, label: 'repaid_months', helpText: 'number_months_between_today_final' },
  borrower_count: { min: 1, max: 20, label: 'borrower_count', helpText: 'number_borrowers_included_loan' },
  percent_female: { min: 0, max: 100, label: 'percent_female', helpText: 'what_percentage_borrowers_female' },
  age: { min: 19, max: 100, label: 'age_mentioned', helpText: 'age_found_loan_description_set' },
  still_needed: { min: 0, max: 5000, step: 25, label: 'still_needed_dollar_2', helpText: 'how_much_still_needed_fully' },
  loan_amount: { min: 0, max: 10000, step: 25, label: 'loan_amount_dollar_2', helpText: 'how_much_loan' },
  dollars_per_hour: { min: 0, max: 500, label: 'dollar_hour_2', helpText: 'funded_amounts_time_since_posting' },
  percent_funded: { min: 0, max: 100, step: 1, label: 'funded_percent', helpText: 'what_percent_loan_has_been' },
  expiring_in_days: { min: 0, max: 35, label: 'expiring_days_2', helpText: 'days_left_before_loan_expires' },
  disbursal_in_days: { min: -90, max: 90, label: 'disbursal_days', helpText: 'when_borrower_get_money_relative' },
}

export const PARTNER_SLIDERS: Record<string, SliderConfig> = {
  partner_risk_rating: { min: 0, max: 5, step: 0.5, label: 'risk_rating_stars', helpText: '5_star_very_low_probability' },
  partner_arrears: { min: 0, max: 100, step: 0.1, label: 'delinq_rate_percent', helpText: 'amount_late_payments_total_outstanding' },
  loans_at_risk_rate: { min: 0, max: 100, label: 'loans_risk_percent', helpText: 'percentage_loans_past_due_least' },
  partner_default: { min: 0, max: 30, step: 0.1, label: 'default_rate_percent', helpText: 'percentage_ended_loans_defaulted' },
  portfolio_yield: { min: 0, max: 100, step: 0.1, label: 'portfolio_yield_percent', helpText: 'interest_fees_charged_field_partner' },
  profit: { min: -100, max: 100, step: 0.1, label: 'profit_percent', helpText: 'return_assets_indicator' },
  currency_exchange_loss_rate: { min: 0, max: 10, step: 0.1, label: 'currency_exchange_loss_percent', helpText: 'currency_exchange_loss_rate' },
  average_loan_size_percent_per_capita_income: { min: 0, max: 300, label: 'average_loan_capita_income', helpText: 'average_loan_percentage_national_income' },
  years_on_kiva: { min: 0, max: 12, step: 0.25, label: 'years_kiva', helpText: 'how_long_partner_has_been' },
  loans_posted: { min: 0, max: 20000, step: 50, label: 'loans_posted', helpText: 'how_many_loans_partner_has' },
  fundraising_loan_count: { min: 0, max: 200, step: 1, label: 'fundraising_loans', helpText: 'how_many_loans_partner_currently' },
  // A+ Team research scores (1-4). Only meaningful once the A+ data is merged
  // (Options > "Merge A+ Team's data"); the panel hides them until then. Dropped
  // in the rewrite — restored so loan & partner search can filter on them again.
  secular_rating: { min: 1, max: 4, step: 1, label: 'secular_score_team', helpText: '4_completely_secular_3_secular' },
  social_rating: { min: 1, max: 4, step: 1, label: 'social_score_team', helpText: '4_excellent_proactive_social_programs' },
}

// How many bars a slider's histogram has. Up to MAX_BINS stops: one bar per
// stop, so a bar is exactly one selectable value. More stops than that: the
// largest whole number of stops per bar that leaves MIN_BINS..MAX_BINS bars, so
// every bar covers the same number of stops and bar edges are selectable values.
const MAX_BINS = 50
const MIN_BINS = 25

export function binSpecFor(config: SliderConfig): BinSpec {
  const stops = Math.round((config.max - config.min) / (config.step ?? 1))
  if (stops <= MAX_BINS) return { min: config.min, max: config.max, count: stops + 1, discrete: true }
  let count = 40
  for (let n = MAX_BINS; n >= MIN_BINS; n--) {
    if (stops % n === 0) {
      count = n
      break
    }
  }
  return { min: config.min, max: config.max, count, discrete: false }
}

const specsOf = (sliders: Record<string, SliderConfig>): Record<string, BinSpec> =>
  Object.fromEntries(Object.entries(sliders).map(([key, config]) => [key, binSpecFor(config)]))

export const RANGE_BIN_SPECS = { loan: specsOf(LOAN_SLIDERS), partner: specsOf(PARTNER_SLIDERS) }

/** The values a bar stands for: [from, to]; equal for a one-stop bar. */
export function binRange(spec: BinSpec, index: number): [number, number] {
  const span = spec.max - spec.min
  if (spec.discrete) {
    const value = spec.min + (span * index) / (spec.count - 1)
    return [value, value]
  }
  return [spec.min + (span * index) / spec.count, spec.min + (span * (index + 1)) / spec.count]
}
