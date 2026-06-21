import { describe, it, expect } from 'vitest'
// The shared filter is plain JS in server/ so the prod server can import it too.
import { filterLoans, sortLoans } from '../../server/loanFilter.mjs'

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

describe('shared loanFilter.sortLoans', () => {
  it('sorts newest by kl_newest_sort desc', () => {
    const out = sortLoans(
      [{ id: 1, kl_newest_sort: 100 }, { id: 2, kl_newest_sort: 300 }, { id: 3, kl_newest_sort: 200 }],
      'newest',
    )
    expect(out.map((l: { id: number }) => l.id)).toEqual([2, 3, 1])
  })
})
