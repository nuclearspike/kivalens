import { describe, it, expect } from 'vitest'
// The shared filter is plain JS in server/ so the prod server can import it too.
import { filterLoans, filterPartners, sortLoans } from '../../server/loanFilter.mjs'

// Minimal but representative fixtures exercising the criteria the filter reads.
const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising',
  funded_amount: 0,
  loan_amount: 1000,
  location: { country_code: 'KE', country: 'Kenya' },
  terms: { repayment_interval: 'monthly' },
  kls_tags: [],
  themes: [],
  borrower_count: 1,
  kl_percent_women: 100,
  kl_still_needed: 500,
  kl_percent_funded: 50,
  kl_name_arr: [],
  kls_use_or_descr_arr: [],
  kl_newest_sort: 0,
  posted_date: '2026-06-01',
  ...o,
})

const loans = [
  mkLoan({ id: 1, sector: 'Agriculture', partner_id: 10, kl_still_needed: 500, kl_newest_sort: 300 }),
  mkLoan({ id: 2, sector: 'Retail', partner_id: 20, location: { country_code: 'PH', country: 'Philippines' }, kl_still_needed: 100, kl_newest_sort: 200 }),
  // fully funded -> always excluded (funded >= loan_amount)
  mkLoan({ id: 3, sector: 'Agriculture', partner_id: 10, funded_amount: 1000, kl_newest_sort: 100 }),
  // not fundraising -> always excluded
  mkLoan({ id: 4, sector: 'Retail', partner_id: 20, status: 'funded', kl_newest_sort: 50 }),
]

const activePartners = [
  { id: 10, status: 'active', kl_regions: ['af'], kl_sp: [], countries: [{ iso_code: 'KE' }], rating: 5 },
  { id: 20, status: 'active', kl_regions: ['as'], kl_sp: [], countries: [{ iso_code: 'PH' }], rating: 3 },
]

const run = (criteria: Record<string, unknown>) =>
  filterLoans(criteria, { loans, activePartners, atheistListProcessed: false })
    .map((l: { id: number }) => l.id)

describe('shared loanFilter.filterLoans', () => {
  it('excludes non-fundraising and fully-funded loans by default', () => {
    expect(run({}).sort()).toEqual([1, 2])
  })

  it('filters by loan sector (any)', () => {
    expect(run({ loan: { sector: 'Agriculture' } })).toEqual([1]) // 3 is funded
  })

  it('filters by country_code', () => {
    expect(run({ loan: { country_code: 'PH' } })).toEqual([2])
  })

  it('applies range criteria (still_needed_min)', () => {
    expect(run({ loan: { still_needed_min: 300 } })).toEqual([1])
  })

  it('filters loans by partner criteria (region)', () => {
    expect(run({ partner: { region: 'as' } })).toEqual([2]) // partner 20 is region as
  })

  it('honors sort=newest (desc by kl_newest_sort)', () => {
    expect(run({ loan: { sort: 'newest' } })).toEqual([1, 2]) // 300 then 200
  })

  it('honors limit_results', () => {
    expect(run({ loan: { sort: 'newest', limit_results: 1 } })).toEqual([1])
  })

  it('direct=direct keeps only loans with no partner', () => {
    expect(run({ partner: { direct: 'direct' } })).toEqual([])
  })

  it('excludes the lender portfolio loans when exclude_portfolio_loans is set', () => {
    const ids = filterLoans(
      { portfolio: { exclude_portfolio_loans: 'true' } },
      { loans, activePartners, lenderId: 'me', lenderLoans: { me: [1] } },
    ).map((l: { id: number }) => l.id)
    expect(ids.sort()).toEqual([2]) // loan 1 is in the lender's portfolio
  })

  it('applies a pb_sector balancer (hide over-represented sectors)', () => {
    const ids = run({ portfolio: { pb_sector: { enabled: true, hideshow: 'hide', values: ['Retail'] } } })
    expect(ids).toEqual([1]) // loan 2 (Retail) hidden
  })

  it('applies a pb_sector balancer (show only listed sectors)', () => {
    const ids = run({ portfolio: { pb_sector: { enabled: true, hideshow: 'show', values: ['Retail'] } } })
    expect(ids).toEqual([2]) // only Retail kept
  })
})

describe('shared loanFilter borrower_count', () => {
  // Loans read straight from Kiva's API have the borrowers but no borrower_count.
  const direct = [
    mkLoan({ id: 11, partner_id: 10, borrower_count: undefined, borrowers: [{ gender: 'F' }] }),
    mkLoan({ id: 12, partner_id: 10, borrower_count: undefined, borrowers: [{ gender: 'F' }, { gender: 'M' }, { gender: 'F' }] }),
  ]
  const ids = (criteria: Record<string, unknown>) =>
    filterLoans(criteria, { loans: direct, activePartners, atheistListProcessed: false }).map((l) => (l as { id: number }).id).sort()

  it('counts the borrowers when the loan has no borrower_count', () => {
    expect(ids({ loan: { borrower_count_min: 2 } })).toEqual([12])
    expect(ids({ loan: { borrower_count_max: 1 } })).toEqual([11])
    expect(ids({})).toEqual([11, 12])
  })
})

describe('shared loanFilter retired criteria', () => {
  it('ignores a saved average-loan-size range: Kiva sends 0 for every partner, so a minimum used to exclude them all', () => {
    const before = run({}).length
    expect(before).toBeGreaterThan(0)
    expect(run({ partner: { average_loan_size_percent_per_capita_income_min: 50 } }).length).toBe(before)
  })
})

describe('shared loanFilter.sortLoans', () => {
  it('sorts newest by kl_newest_sort desc', () => {
    const out = sortLoans(
      [{ id: 1, kl_newest_sort: 100 }, { id: 2, kl_newest_sort: 300 }, { id: 3, kl_newest_sort: 200 }],
      'newest',
    )
    expect(out.map((l: { id: number }) => l.id)).toEqual([2, 3, 1])
  })
})

// ---------------------------------------------------------------------------
// rangeDistributions — the histograms behind the range sliders
// ---------------------------------------------------------------------------
import { rangeDistributions, binIndex } from '../../server/loanFilter.mjs'

describe('shared loanFilter.rangeDistributions', () => {
  const spec = (min: number, max: number, count: number, discrete = false) => ({ min, max, count, discrete })
  const pool = [
    mkLoan({ id: 1, sector: 'Agriculture', partner_id: 10, borrower_count: 1, loan_amount: 200, kl_still_needed: 100 }),
    mkLoan({ id: 2, sector: 'Agriculture', partner_id: 10, borrower_count: 3, loan_amount: 900, kl_still_needed: 100 }),
    mkLoan({ id: 3, sector: 'Retail', partner_id: 20, borrower_count: 5, loan_amount: 900, kl_still_needed: 100 }),
    mkLoan({ id: 4, sector: 'Retail', partner_id: 20, borrower_count: 5, loan_amount: 5000, kl_still_needed: 100 }),
    mkLoan({ id: 5, sector: 'Retail', partner_id: 20, status: 'funded' }),
  ]
  const specs = {
    loan: { borrower_count: spec(1, 5, 5, true), loan_amount: spec(0, 1000, 4) },
    partner: { partner_risk_rating: spec(0, 5, 11, true) },
  }
  const dist = (criteria: Record<string, unknown>) =>
    rangeDistributions(criteria, { loans: pool, activePartners, atheistListProcessed: false }, specs)
  const total = (bins: number[]) => bins.reduce((a, b) => a + b, 0)

  it('bins every matching loan when nothing is filtered, and never the funded one', () => {
    const d = dist({})
    expect(d.loan.borrower_count).toEqual([1, 0, 1, 0, 2])
    expect(d.loan.loan_amount).toEqual([1, 0, 0, 3]) // 5000 lands in the end bin: the open end includes it
    expect(total(d.partner.partner_risk_rating)).toBe(4)
  })

  it("leaves a slider's own range out of its own histogram, but applies it to the others", () => {
    const d = dist({ loan: { borrower_count_min: 3 } })
    expect(d.loan.borrower_count).toEqual([1, 0, 1, 0, 2]) // unchanged: you can see what widening regains
    expect(d.loan.loan_amount).toEqual([0, 0, 0, 3]) // loan 1 (1 borrower) is gone here
  })

  it('applies non-range criteria to every histogram', () => {
    const d = dist({ loan: { sector: 'Retail' } })
    expect(d.loan.borrower_count).toEqual([0, 0, 0, 0, 2])
    expect(total(d.partner.partner_risk_rating)).toBe(2)
  })

  it('drops a loan that two different ranges keep out', () => {
    const d = dist({ loan: { borrower_count_min: 3, loan_amount_max: 500 } })
    // loan 1 fails borrower_count only -> counted there; loans 2-4 fail loan_amount only -> counted there
    expect(d.loan.borrower_count).toEqual([1, 0, 0, 0, 0])
    expect(d.loan.loan_amount).toEqual([0, 0, 0, 3])
  })

  it('judges partner ranges through the loan\'s partner and counts loans', () => {
    const d = dist({ partner: { partner_risk_rating_min: 4 } })
    expect(total(d.partner.partner_risk_rating)).toBe(4) // own range left out
    expect(d.partner.partner_risk_rating[10]).toBe(2) // two loans at the 5-star partner
    expect(d.partner.partner_risk_rating[6]).toBe(2) // two at the 3-star partner
    expect(d.loan.borrower_count).toEqual([1, 0, 1, 0, 0]) // loan histograms lose the 3-star partner's loans
  })

  it('agrees with filterLoans: each histogram totals the matches with that one range removed', () => {
    const criteria = { loan: { borrower_count_min: 2, loan_amount_max: 1000, sector: 'Agriculture,Retail' }, partner: { partner_risk_rating_min: 2 } }
    const d = dist(criteria)
    const without = (group: 'loan' | 'partner', key: string) => {
      const c = JSON.parse(JSON.stringify(criteria))
      delete c[group][`${key}_min`]
      delete c[group][`${key}_max`]
      return filterLoans(c, { loans: pool, activePartners, atheistListProcessed: false }).length
    }
    expect(total(d.loan.borrower_count)).toBe(without('loan', 'borrower_count'))
    expect(total(d.loan.loan_amount)).toBe(without('loan', 'loan_amount'))
    expect(total(d.partner.partner_risk_rating)).toBe(without('partner', 'partner_risk_rating'))
  })

  it('binIndex: nearest stop when discrete, equal-width otherwise, ends absorb the overflow, no number -> -1', () => {
    expect(binIndex(3, spec(1, 5, 5, true))).toBe(2)
    expect(binIndex(999, spec(1, 5, 5, true))).toBe(4)
    expect(binIndex(-7, spec(0, 100, 10))).toBe(0)
    expect(binIndex(100, spec(0, 100, 10))).toBe(9)
    expect(binIndex(55, spec(0, 100, 10))).toBe(5)
    expect(binIndex('3.5', spec(0, 5, 11, true))).toBe(7)
    expect(binIndex(1.45, spec(0, 12, 49, true))).toBe(5) // 1.45 years -> the 1.25 stop, not 1.5
    expect(binIndex(1.5, spec(0, 12, 49, true))).toBe(6)
    expect(binIndex(undefined, spec(0, 5, 11, true))).toBe(-1)
    expect(binIndex('Not Rated', spec(0, 5, 11, true))).toBe(-1)
  })
})

import { partnerRangeDistributions } from '../../server/loanFilter.mjs'

describe('shared loanFilter.partnerRangeDistributions', () => {
  const pool = [
    { id: 1, name: 'Alpha', status: 'active', rating: '4.5', default_rate: 1, kl_regions: ['af'], kl_sp: [], countries: [], kl_name_arr: ['ALPHA'] },
    { id: 2, name: 'Beta', status: 'active', rating: '2', default_rate: 9, kl_regions: ['as'], kl_sp: [], countries: [], kl_name_arr: ['BETA'] },
    { id: 3, name: 'Gamma', status: 'closed', rating: 'Not Rated', default_rate: 20, kl_regions: ['as'], kl_sp: [], countries: [], kl_name_arr: ['GAMMA'] },
  ]
  const specs = { partner_risk_rating: { min: 0, max: 5, count: 11, discrete: true }, partner_default: { min: 0, max: 30, count: 30, discrete: false } }
  const dist = (partner: Record<string, unknown>, accept?: (p: never) => boolean) =>
    partnerRangeDistributions({ partner }, { loans: [], activePartners: [], partnerPool: pool, atheistListProcessed: false }, specs, accept)
  const total = (bins: number[]) => bins.reduce((a, b) => a + b, 0)

  it('counts partners, leaving an unrated partner out of the rating histogram only', () => {
    const d = dist({})
    expect(total(d.partner_risk_rating)).toBe(2)
    expect(d.partner_risk_rating[9]).toBe(1) // 4.5 stars
    expect(total(d.partner_default)).toBe(3)
  })

  it("keeps a slider's own range out of its own histogram and applies the other filters", () => {
    const d = dist({ partner_default_max: 5, status: 'active', status_all_any_none: 'any' })
    expect(total(d.partner_default)).toBe(2) // both active partners, whatever their default rate
    expect(total(d.partner_risk_rating)).toBe(1) // only Alpha survives the default-rate range
  })

  it('applies the caller\'s extra test, such as the page\'s name search', () => {
    const d = dist({}, ((p: { name: string }) => p.name.startsWith('B')) as never)
    expect(total(d.partner_default)).toBe(1)
  })
})

import { partnerOptionCounts } from '../../server/loanFilter.mjs'

describe('shared loanFilter.partnerOptionCounts', () => {
  const pool = [
    { id: 1, status: 'active', kl_regions: ['af'], kl_sp: [1, 3], countries: [{ iso_code: 'KE' }, { iso_code: 'UG' }], normalizedReligions: ['Secular'], charges_fees_and_interest: true, default_rate: 1 },
    { id: 2, status: 'active', kl_regions: ['af', 'as'], kl_sp: [1], countries: [{ iso_code: 'KE' }], normalizedReligions: ['Christian'], charges_fees_and_interest: false, default_rate: 9 },
    { id: 3, status: 'closed', kl_regions: ['as'], kl_sp: [], countries: [{ iso_code: 'PH' }], charges_fees_and_interest: true, default_rate: 2 },
  ]
  const counts = (partner: Record<string, unknown>, keys: string[], accept?: (p: never) => boolean) =>
    partnerOptionCounts({ partner }, { loans: [], activePartners: [], partnerPool: pool, atheistListProcessed: false }, keys, accept)

  it('counts partners per option, once per partner even when a partner has several values', () => {
    const c = counts({}, ['status', 'region', 'country_code', 'social_performance', 'religion', 'charges_fees_and_interest'])
    expect(c.status).toEqual({ active: 2, closed: 1 })
    expect(c.region).toEqual({ af: 2, as: 2 })
    expect(c.country_code).toEqual({ KE: 2, UG: 1, PH: 1 })
    expect(c.social_performance).toEqual({ '1': 2, '3': 1 })
    expect(c.religion).toEqual({ Secular: 1, Christian: 1, Unknown: 1 })
    expect(c.charges_fees_and_interest).toEqual({ true: 2, false: 1 })
  })

  it("leaves a dropdown's own selection out of its own counts, and applies every other filter", () => {
    const c = counts({ status: 'active', status_all_any_none: 'any', region: 'as', region_all_any_none: 'any' }, ['status', 'region'])
    expect(c.status).toEqual({ active: 1, closed: 1 }) // region=as applied; status itself not
    expect(c.region).toEqual({ af: 2, as: 1 }) // status=active applied; region itself not
  })

  it('agrees with filterPartners: an option\'s count is what choosing only that option returns', () => {
    const base = { status: 'active', status_all_any_none: 'any', partner_default_max: 5 }
    const c = counts(base, ['region'])
    for (const [value, n] of Object.entries(c.region)) {
      const chosen = filterPartners({ partner: { ...base, region: value, region_all_any_none: 'any' } }, { loans: [], activePartners: [], partnerPool: pool, atheistListProcessed: false })
      expect(chosen.length, `region ${value}`).toBe(n)
    }
  })

  it('in "all" mode keeps the selection in force, because each added option narrows the current results', () => {
    const c = counts({ social_performance: '3', social_performance_all_any_none: 'all' }, ['social_performance'])
    expect(c.social_performance).toEqual({ '1': 1, '3': 1 }) // only partner 1 has strength 3
  })

  it('treats an untouched mode as the engine does: Social Performance starts in "all"', () => {
    const c = counts({ social_performance: '3' }, ['social_performance'])
    expect(c.social_performance).toEqual({ '1': 1, '3': 1 })
    // …and that is what adding the option really returns.
    const ctx = { loans: [], activePartners: [], partnerPool: pool, atheistListProcessed: false }
    expect(filterPartners({ partner: { social_performance: '3,1' } }, ctx).length).toBe(c.social_performance['1'])
    // A dropdown that starts in "any" still leaves its own selection out.
    expect(counts({ region: 'as' }, ['region']).region).toEqual({ af: 2, as: 2 })
  })

  it('survives empty and ragged data: no criteria, no pool, partners missing fields, unknown keys', () => {
    const ctx = (partnerPool: unknown[]) => ({ loans: [], activePartners: [], partnerPool, atheistListProcessed: false })
    expect(partnerOptionCounts({}, ctx([]), ['status', 'region'])).toEqual({ status: {}, region: {} })
    expect(partnerOptionCounts(undefined as never, ctx(pool), [])).toEqual({})
    expect(partnerOptionCounts({ partner: {} }, ctx(pool), ['no_such_key'])).toEqual({ no_such_key: {} })
    const ragged = partnerOptionCounts({ partner: {} }, ctx([{ id: 9, status: 'active' }]), ['country_code', 'region', 'social_performance', 'religion', 'charges_fees_and_interest'])
    expect(ragged).toEqual({ country_code: {}, region: {}, social_performance: {}, religion: { Unknown: 1 }, charges_fees_and_interest: { false: 1 } })
  })

  it('counts a "none" dropdown by what each option holds, not by what excluding it leaves', () => {
    const c = counts({ region: 'as', region_all_any_none: 'none' }, ['region'])
    expect(c.region).toEqual({ af: 2, as: 2 })
  })

  it('applies the page\'s name search through accept', () => {
    expect(counts({}, ['status'], ((p: { id: number }) => p.id !== 3) as never).status).toEqual({ active: 2 })
  })
})
