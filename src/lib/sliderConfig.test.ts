import { describe, expect, it } from 'vitest'
import { binIndex, rangeDistributions } from '../../server/loanFilter.mjs'
import { DATA_MAX_KEYS, LOAN_SLIDERS, PARTNER_SLIDERS, RANGE_BIN_SPECS, binRange, binSpecFor, dataMaxFor, niceCeil, partnerSliderMaxima, rangeBinSpecs, withDataMax } from './sliderConfig'

describe('binSpecFor', () => {
  it('gives a slider with few stops one bar per stop', () => {
    expect(binSpecFor({ min: 1, max: 20, label: 'x' })).toEqual({ min: 1, max: 20, count: 20, discrete: true })
    expect(binSpecFor({ min: 0, max: 5, step: 0.5, label: 'x' })).toEqual({ min: 0, max: 5, count: 11, discrete: true })
  })

  it('groups a long slider into bars that each hold a whole number of stops', () => {
    expect(binSpecFor({ min: 0, max: 10000, step: 25, label: 'x' })).toMatchObject({ count: 50, discrete: false }) // 8 stops a bar
    expect(binSpecFor({ min: 2, max: 90, label: 'x' })).toMatchObject({ count: 44, discrete: false }) // 2 months a bar
    expect(binSpecFor({ min: 19, max: 100, label: 'x' })).toMatchObject({ count: 27, discrete: false }) // 3 years a bar
  })

  it('binRange names the values a bar stands for', () => {
    expect(binRange({ min: 1, max: 20, count: 20, discrete: true }, 4)).toEqual([5, 5])
    expect(binRange({ min: 0, max: 10000, count: 50, discrete: false }, 1)).toEqual([200, 400])
  })
})

describe('slider keys and the filter engine', () => {
  // A slider whose key the engine has no range for would draw an empty
  // histogram and say nothing. One loan with every field, at one partner with
  // every field, must therefore land in every slider's histogram exactly once.
  it('every slider is a range the engine can read a value for', () => {
    const loan = {
      id: 1, status: 'fundraising', funded_amount: 100, loan_amount: 1000, partner_id: 7,
      location: { country_code: 'KE', country: 'Kenya' }, terms: { repayment_interval: 'monthly' },
      kls_tags: [], themes: [], kl_name_arr: [], kls_use_or_descr_arr: [],
      kls_repaid_in: 12, borrower_count: 3, kl_percent_women: 66, kls_age: 40, kl_still_needed: 900,
      kl_dollars_per_hour: 4, kl_percent_funded: 10, kl_expiring_in_days: 20, kl_disbursal_in_days: -5,
    }
    const partner = {
      id: 7, status: 'active', rating: '4.5', delinquency_rate: 2, loans_at_risk_rate: 3, default_rate: 1,
      portfolio_yield: 30, profitability: 5, currency_exchange_loss_rate: 0.2,
      kl_years_on_kiva: 6, loans_posted: 5000,
      kl_regions: [], kl_sp: [], countries: [], atheistScore: { secularRating: 3, socialRating: 4 },
    }
    const d = rangeDistributions({}, { loans: [loan], activePartners: [partner], atheistListProcessed: true }, RANGE_BIN_SPECS)
    const total = (bins: number[]) => bins.reduce((a, b) => a + b, 0)
    for (const key of Object.keys(LOAN_SLIDERS)) expect(total(d.loan[key]), `loan slider ${key}`).toBe(1)
    for (const key of Object.keys(PARTNER_SLIDERS)) expect(total(d.partner[key]), `partner slider ${key}`).toBe(1)
  })
})

describe('every selectable value lands in its own bar', () => {
  // Bar edges are selectable values, and floating point puts some of them a hair
  // under the edge (5800 / 10000 * 50 = 28.999999999999996). Walk every stop of
  // every real slider and compare with exact integer arithmetic.
  it.each([...Object.entries(LOAN_SLIDERS), ...Object.entries(PARTNER_SLIDERS)])('%s', (_key, config) => {
    const spec = binSpecFor(config)
    const step = config.step ?? 1
    const stops = Math.round((config.max - config.min) / step)
    const wrong: string[] = []
    for (let s = 0; s <= stops; s++) {
      const value = Number((config.min + s * step).toFixed(6))
      const expected = spec.discrete ? s : Math.min(spec.count - 1, Math.floor((s * spec.count) / stops))
      if (binIndex(value, spec) !== expected) wrong.push(`${value} -> ${binIndex(value, spec)}, expected ${expected}`)
    }
    expect(wrong).toEqual([])
  })
})

describe('sliders whose upper end follows the data', () => {
  const years = PARTNER_SLIDERS.years_on_kiva
  const posted = PARTNER_SLIDERS.loans_posted
  const many = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i))

  it('years on Kiva reaches the oldest partner, rounded up to a whole year', () => {
    expect(dataMaxFor(years, many(187, (i) => (i / 186) * 20.13))).toBe(21)
    expect(dataMaxFor(years, many(646, (i) => (i / 645) * 21.43))).toBe(22)
  })

  it('a heavy-tailed value stops at a round 95th percentile, not at the one giant partner', () => {
    const values = [...many(180, (i) => i * 240), 156097, 531920] // p95 ~ 41,000
    const max = dataMaxFor(posted, values)
    expect(max).toBe(50000)
    expect((max - posted.min) % (posted.step ?? 1)).toBe(0) // the top stop is reachable
  })

  it('keeps the configured max until enough partners have loaded, and for sliders that do not follow the data', () => {
    expect(dataMaxFor(years, [3, 19.5])).toBe(years.max)
    expect(dataMaxFor(PARTNER_SLIDERS.partner_default, many(200, (i) => i))).toBe(PARTNER_SLIDERS.partner_default.max)
  })

  it('ignores partners sitting at the bottom of the scale, so loading data or idle partners cannot collapse it', () => {
    const fundraising = PARTNER_SLIDERS.fundraising_loan_count
    expect(dataMaxFor(fundraising, many(187, () => 0))).toBe(fundraising.max) // loans not loaded yet
    const idleMajority = [...many(546, () => 0), ...many(100, (i) => 4 + i * 3.6)] // 100 fundraising partners, p95 ~ 346
    expect(dataMaxFor(fundraising, idleMajority)).toBe(400)
  })

  it('takes the nearest-rank percentile: of 20 partners, the 95th percentile is the 19th, not the largest', () => {
    const fundraising = PARTNER_SLIDERS.fundraising_loan_count
    const twenty = [...many(19, (i) => 10 + i), 5000] // 10..28, then one giant
    expect(dataMaxFor(fundraising, twenty)).toBe(28)
  })

  it('niceCeil gives scale ends that read well', () => {
    expect([20.13, 30, 359, 1118, 43654, 531920].map(niceCeil)).toEqual([21, 30, 400, 1200, 50000, 600000])
  })

  it('publishes a max for exactly the sliders marked as following the data, and lays the histogram out to it', () => {
    expect(DATA_MAX_KEYS.sort()).toEqual(['fundraising_loan_count', 'loans_posted', 'years_on_kiva'])
    const maxima = partnerSliderMaxima({ years_on_kiva: many(187, (i) => (i / 186) * 20.13), loans_posted: [], fundraising_loan_count: [] })
    expect(maxima).toEqual({ years_on_kiva: 21, loans_posted: posted.max, fundraising_loan_count: PARTNER_SLIDERS.fundraising_loan_count.max })
    expect(rangeBinSpecs(maxima).partner.years_on_kiva.max).toBe(21)
    expect(withDataMax(years, 21)).toEqual({ ...years, max: 21 })
    expect(withDataMax(years, undefined)).toBe(years)
  })
})
