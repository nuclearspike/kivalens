// The range sliders of the Search criteria tabs: their scale, and the layout of
// the distribution histogram drawn behind each one. Shared by the criteria UI
// and by the store that computes the histograms, so the two cannot drift.
import type { BinSpec } from '../../server/loanFilter.mjs'

export interface SliderConfig {
  min: number
  /** The slider's upper end. For a slider that follows the data (dataMaxPercentile)
   *  this is only the value used until the partner data has loaded. */
  max: number
  step?: number
  label: string
  helpText?: string
  /** The upper end follows the partners' own values instead of a number fixed
   *  when the slider was written: 1 = their maximum, 0.95 = their 95th
   *  percentile. Use the maximum for a light-tailed value (years on Kiva: the
   *  oldest partner is only a few years past the median) and a percentile for a
   *  heavy-tailed one (loans posted: median 1,200, maximum 530,000 - a linear
   *  scale to the maximum would squeeze nearly every partner into the first few
   *  pixels). The last stop always means "no limit", so partners past it are
   *  still included when the handle rests there. */
  dataMaxPercentile?: number
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
  years_on_kiva: { min: 0, max: 12, step: 0.25, label: 'years_kiva', helpText: 'how_long_partner_has_been', dataMaxPercentile: 1 },
  loans_posted: { min: 0, max: 20000, step: 50, label: 'loans_posted', helpText: 'how_many_loans_partner_has', dataMaxPercentile: 0.95 },
  fundraising_loan_count: { min: 0, max: 200, step: 1, label: 'fundraising_loans', helpText: 'how_many_loans_partner_currently', dataMaxPercentile: 0.95 },
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

// --- sliders whose upper end follows the data ---

/** Partner sliders whose max is derived from the partners' values. */
export const DATA_MAX_KEYS = Object.keys(PARTNER_SLIDERS).filter((key) => PARTNER_SLIDERS[key].dataMaxPercentile)

// Too few partners to describe a distribution (data still loading): keep the configured max.
const MIN_VALUES = 10

/** Rounds up to a number that reads well as the end of a scale: 20.1 -> 21, 359 -> 400, 43,654 -> 50,000. */
export function niceCeil(value: number): number {
  if (value <= 30) return Math.ceil(value)
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * magnitude >= value) return m * magnitude
  return 10 * magnitude
}

/** The upper end a data-following slider should have for these values; config.max when it does not follow the data. */
export function dataMaxFor(config: SliderConfig, values: readonly number[]): number {
  const p = config.dataMaxPercentile
  if (!p) return config.max
  // Partners sitting at the bottom of the scale say nothing about where it should
  // end: most partners have no fundraising loans at all, and while the loans are
  // still loading every partner has none.
  const usable = values.filter((v) => v > config.min)
  if (usable.length < MIN_VALUES) return config.max
  const sorted = usable.sort((a, b) => a - b)
  // Nearest-rank percentile: the smallest value with at least p of the values at or below it.
  const at = sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
  const step = config.step ?? 1
  const nice = niceCeil(at)
  // Whole steps only, so the top stop is reachable and bins stay aligned.
  return Math.max(config.min + step, Math.ceil((nice - config.min) / step) * step + config.min)
}

/** Upper ends for the data-following partner sliders, from partnerRangeValues(). */
export function partnerSliderMaxima(valuesByKey: Record<string, readonly number[]>): Record<string, number> {
  return Object.fromEntries(DATA_MAX_KEYS.map((key) => [key, dataMaxFor(PARTNER_SLIDERS[key], valuesByKey[key] ?? [])]))
}

/** `config` with its data-derived max, when one is known. */
export function withDataMax(config: SliderConfig, max: number | undefined): SliderConfig {
  return max === undefined || max === config.max ? config : { ...config, max }
}

const specsOf = (sliders: Record<string, SliderConfig>, maxima: Record<string, number> = {}): Record<string, BinSpec> =>
  Object.fromEntries(Object.entries(sliders).map(([key, config]) => [key, binSpecFor(withDataMax(config, maxima[key]))]))

/** Histogram layouts for every slider, with the data-derived maxima applied to the partner sliders. */
export const rangeBinSpecs = (maxima: Record<string, number> = {}) => ({ loan: specsOf(LOAN_SLIDERS), partner: specsOf(PARTNER_SLIDERS, maxima) })

export const RANGE_BIN_SPECS = rangeBinSpecs()

/** The values a bar stands for: [from, to]; equal for a one-stop bar. */
export function binRange(spec: BinSpec, index: number): [number, number] {
  const span = spec.max - spec.min
  if (spec.discrete) {
    const value = spec.min + (span * index) / (spec.count - 1)
    return [value, value]
  }
  return [spec.min + (span * index) / spec.count, spec.min + (span * (index + 1)) / spec.count]
}
