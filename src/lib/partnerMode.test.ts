import { describe, expect, it } from 'vitest'
import {
  filterLoans, isFundraising, partnerCriteriaSet, resolvePartnerMode, partnerModeGaps, rangeCounter, rangeDistributions,
} from '../../server/loanFilter.mjs'

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising', funded_amount: 0, loan_amount: 1000,
  location: { country_code: 'KE', country: 'Kenya' }, terms: { repayment_interval: 'Monthly' },
  kls_tags: [], themes: [], borrower_count: 1, kl_percent_women: 100, kl_still_needed: 500,
  kl_percent_funded: 50, kl_name_arr: [], kls_use_or_descr_arr: [], kl_newest_sort: 0,
  posted_date: '2026-06-01', ...o,
})

const partners = [
  { id: 10, status: 'active', rating: 5, default_rate: 1, kl_regions: ['af'], kl_sp: [1], countries: [{ iso_code: 'KE' }] },
  { id: 20, status: 'active', rating: 2, default_rate: 9, kl_regions: ['as'], kl_sp: [], countries: [{ iso_code: 'PH' }] },
]
const loans = [
  mkLoan({ id: 1, partner_id: 10, sector: 'Agriculture' }),
  mkLoan({ id: 2, partner_id: 10, sector: 'Retail' }),
  mkLoan({ id: 3, partner_id: 20, sector: 'Agriculture' }),
  mkLoan({ id: 4, partner_id: null, sector: 'Agriculture', location: { country_code: 'US', country: 'United States' } }), // Direct
  mkLoan({ id: 5, partner_id: null, sector: 'Retail', location: { country_code: 'US', country: 'United States' } }),      // Direct
]
const ctx = { loans, activePartners: partners, atheistListProcessed: false }
const ids = (criteria: Record<string, unknown>) =>
  filterLoans(criteria, ctx).map((l: { id: number }) => l.id).sort((a: number, b: number) => a - b)

describe('MFI or Direct: the three modes partition the loans', () => {
  it('Both is every loan, MFI the ones with a partner, Direct the ones without', () => {
    expect(ids({ partner: { direct: 'both' } })).toEqual([1, 2, 3, 4, 5])
    expect(ids({ partner: { direct: 'mfi' } })).toEqual([1, 2, 3])
    expect(ids({ partner: { direct: 'direct' } })).toEqual([4, 5])
  })

  it('with no partner filter, Both = MFI + Direct by construction', () => {
    const both = ids({ partner: { direct: 'both' } }).length
    expect(both).toBe(ids({ partner: { direct: 'mfi' } }).length + ids({ partner: { direct: 'direct' } }).length)
  })

  it("counts a loan whose partner is not in the pool as MFI, so it is never lost", () => {
    const orphan = { loans: [...loans, mkLoan({ id: 6, partner_id: 99 })], activePartners: partners, atheistListProcessed: false }
    const got = (d: string) => filterLoans({ partner: { direct: d } }, orphan).map((l: { id: number }) => l.id)
    expect(got('both')).toContain(6)
    expect(got('mfi')).toContain(6)
    expect(got('direct')).not.toContain(6)
    // A partner filter tests the partner, and this one's partner is unknown.
    expect(filterLoans({ partner: { direct: 'mfi', partner_risk_rating_min: 1 } }, orphan).map((l: { id: number }) => l.id)).not.toContain(6)
  })

  it('applies partner filters only in MFI mode; in Both and Direct they are kept but not applied', () => {
    const fourStars = { partner_risk_rating_min: 4 }
    expect(ids({ partner: { direct: 'mfi', ...fourStars } })).toEqual([1, 2])
    expect(ids({ partner: { direct: 'both', ...fourStars } })).toEqual([1, 2, 3, 4, 5])
    expect(ids({ partner: { direct: 'direct', ...fourStars } })).toEqual([4, 5])
  })

  it('combines with the loan criteria in every mode', () => {
    expect(ids({ loan: { sector: 'Agriculture' }, partner: { direct: 'both' } })).toEqual([1, 3, 4])
    expect(ids({ loan: { sector: 'Agriculture' }, partner: { direct: 'mfi' } })).toEqual([1, 3])
    expect(ids({ loan: { sector: 'Agriculture' }, partner: { direct: 'direct' } })).toEqual([4])
  })

  it('shows nothing when MFI partner filters match no partner', () => {
    expect(ids({ partner: { direct: 'mfi', partner_risk_rating_min: 5, partner_default_min: 50 } })).toEqual([])
  })
})

describe('an old search, saved before the modes existed', () => {
  it('with no partner filter is read as Both — it gains the Direct loans', () => {
    expect(resolvePartnerMode({})).toBe('both')
    expect(resolvePartnerMode({ partner: {} })).toBe('both')
    expect(resolvePartnerMode({ loan: { sector: 'Retail' }, partner: {} })).toBe('both')
    expect(ids({ partner: {} })).toEqual([1, 2, 3, 4, 5])
  })

  it('with any partner filter is read as MFI only — it behaves exactly as it always did', () => {
    expect(resolvePartnerMode({ partner: { partner_risk_rating_min: 4 } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { region: 'af' } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { partners: '10' } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { charges_fees_and_interest: 'true' } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { country_code: 'KE' } })).toBe('mfi')
    expect(resolvePartnerMode({ portfolio: { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 5, values: [10] } } })).toBe('mfi')
    expect(ids({ partner: { partner_risk_rating_min: 4 } })).toEqual([1, 2])
  })

  it('reads the A+ ratings as partner filters even before that list has loaded', () => {
    // The tests for these only exist once the list is in; the mode must not flip when it arrives.
    expect(resolvePartnerMode({ partner: { secular_rating_min: 3 } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { social_rating_max: 2 } })).toBe('mfi')
  })

  it('treats an empty or unknown stored value like a missing one', () => {
    expect(resolvePartnerMode({ partner: { direct: '' } })).toBe('both')
    expect(resolvePartnerMode({ partner: { direct: '', region: 'af' } })).toBe('mfi')
    expect(resolvePartnerMode({ partner: { direct: 'MFI' } })).toBe('both')
    expect(resolvePartnerMode({ partner: { direct: 'yes please', partners: '10' } })).toBe('mfi')
  })

  it('lets a stored value win over the old rule', () => {
    expect(resolvePartnerMode({ partner: { direct: 'both', partner_risk_rating_min: 4 } })).toBe('both')
    expect(resolvePartnerMode({ partner: { direct: 'direct', region: 'af' } })).toBe('direct')
  })
})

describe('partnerCriteriaSet: only a real partner filter counts', () => {
  it('finds none in every default, cleared or no-op state', () => {
    const noOps: Record<string, unknown>[] = [
      {}, { partner: {} },
      { partner: { direct: 'both' } }, { partner: { direct: 'mfi' } }, { partner: { direct: 'direct' } },
      { partner: { region: '' } }, { partner: { region: '', region_all_any_none: 'none' } },
      { partner: { social_performance: '' } }, { partner: { social_performance: '', social_performance_all_any_none: 'all' } },
      { partner: { partners: '' } }, { partner: { religion: '' } }, { partner: { country_code: '' } },
      { partner: { charges_fees_and_interest: '' } },
      { partner: { partner_risk_rating_min: null, partner_risk_rating_max: null } },
      { portfolio: { pb_partner: { enabled: false } } },
      // Enabled but hiding nobody: it filters nothing, so it is not a partner filter.
      { portfolio: { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 5, values: [] } } },
      // What Reset writes.
      { loan: { name: '', use: '' }, partner: { direct: 'both' }, portfolio: { exclude_portfolio_loans: 'true', pb_partner: { enabled: false } } },
    ]
    for (const c of noOps) expect(partnerCriteriaSet(c), JSON.stringify(c)).toBe(false)
  })

  it('finds one for each kind of partner filter', () => {
    const real: Record<string, unknown>[] = [
      { partner: { region: 'af' } }, { partner: { social_performance: '1' } }, { partner: { partners: '10' } },
      { partner: { religion: 'Secular' } }, { partner: { country_code: 'KE' } },
      { partner: { charges_fees_and_interest: 'false' } },
      { partner: { partner_risk_rating_min: 3 } }, { partner: { partner_default_max: 5 } },
      { partner: { years_on_kiva_min: 2 } }, { partner: { fundraising_loan_count_min: 1 } },
      { portfolio: { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 5, values: [10] } } },
    ]
    for (const c of real) expect(partnerCriteriaSet(c), JSON.stringify(c)).toBe(true)
  })
})

describe('the histograms and the drag totals agree with the search in every mode', () => {
  const partnerSpec = { partner_risk_rating: { min: 0, max: 5, count: 11, discrete: true } }
  const loanSpec = { loan_amount: { min: 0, max: 10000, count: 40, discrete: false } }

  for (const direct of ['both', 'mfi', 'direct', undefined] as const) {
    it(`rangeCounter equals filterLoans for a partner slider (mode ${direct ?? 'unset'})`, () => {
      const base = { partner: { ...(direct ? { direct } : {}), partner_risk_rating_min: 4 } }
      const count = rangeCounter(base, ctx, 'partner', 'partner_risk_rating')
      for (const [min, max] of [[null, null], [4, null], [null, 2], [2, 5]] as [number | null, number | null][]) {
        const partner: Record<string, unknown> = { ...(direct ? { direct } : {}) }
        if (min != null) partner.partner_risk_rating_min = min
        if (max != null) partner.partner_risk_rating_max = max
        // An old search is judged in the mode its ORIGINAL criteria implied.
        if (!direct) partner.direct = resolvePartnerMode(base)
        expect(count(min, max), `${min}..${max}`).toBe(filterLoans({ partner }, ctx).length)
      }
    })

    it(`rangeCounter equals filterLoans for a loan slider (mode ${direct ?? 'unset'})`, () => {
      const partner = direct ? { direct } : {}
      const count = rangeCounter({ partner }, ctx, 'loan', 'loan_amount')
      expect(count(null, null)).toBe(filterLoans({ partner }, ctx).length)
    })
  }

  it("an old search's only partner filter, lifted to measure it, does not turn it into Both", () => {
    // Legacy {star >= 4}: MFI. Measuring the star slider lifts the star range; the Direct
    // loans must not appear in the total just because nothing partner-side is left.
    const count = rangeCounter({ partner: { partner_risk_rating_min: 4 } }, ctx, 'partner', 'partner_risk_rating')
    expect(count(null, null)).toBe(3) // the three MFI loans, not all five
  })

  it('in Both, loan histograms include Direct loans; partner histograms bin only loans with a partner', () => {
    const d = rangeDistributions({ partner: { direct: 'both' } }, ctx, { loan: loanSpec, partner: partnerSpec })
    const sum = (a: number[]) => a.reduce((s, n) => s + n, 0)
    expect(sum(d.loan.loan_amount)).toBe(5)
    expect(sum(d.partner.partner_risk_rating)).toBe(3)
  })

  it('in Direct only, partner histograms are empty (no loan has a partner value)', () => {
    const d = rangeDistributions({ partner: { direct: 'direct' } }, ctx, { loan: loanSpec, partner: partnerSpec })
    const sum = (a: number[]) => a.reduce((s, n) => s + n, 0)
    expect(sum(d.loan.loan_amount)).toBe(2)
    expect(sum(d.partner.partner_risk_rating)).toBe(0)
  })
})

describe('partnerModeGaps: what the count bar can say', () => {
  it('reports the Direct loans MFI only keeps out, counted within the other criteria', () => {
    expect(partnerModeGaps({ partner: { direct: 'mfi' } }, ctx)).toMatchObject({ mode: 'mfi', directNotShown: 2, mfiNotShown: 0 })
    expect(partnerModeGaps({ loan: { sector: 'Retail' }, partner: { direct: 'mfi' } }, ctx).directNotShown).toBe(1)
    // A filter that excludes every Direct loan leaves nothing to report.
    expect(partnerModeGaps({ loan: { country_code: 'KE' }, partner: { direct: 'mfi' } }, ctx).directNotShown).toBe(0)
  })

  it('reports the MFI loans Direct only keeps out, with the kept partner filters applied', () => {
    expect(partnerModeGaps({ partner: { direct: 'direct' } }, ctx).mfiNotShown).toBe(3)
    expect(partnerModeGaps({ partner: { direct: 'direct', partner_risk_rating_min: 4 } }, ctx).mfiNotShown).toBe(2)
  })

  it('has nothing to report in Both', () => {
    expect(partnerModeGaps({ partner: { direct: 'both' } }, ctx)).toMatchObject({ directNotShown: 0, mfiNotShown: 0 })
  })

  it('reports loans hidden because the lender already lent to them', () => {
    const lent = { ...ctx, lenderId: 'me', lenderLoans: { me: [1, 4] } }
    const on = { partner: { direct: 'both' }, portfolio: { exclude_portfolio_loans: 'true' } }
    expect(partnerModeGaps(on, lent).alreadyLentHidden).toBe(2)
    expect(partnerModeGaps({ ...on, loan: { sector: 'Retail' } }, lent).alreadyLentHidden).toBe(0)
    expect(partnerModeGaps({ ...on, portfolio: { exclude_portfolio_loans: 'false' } }, lent).alreadyLentHidden).toBe(0)
  })
})

describe('Reset: "Showing X of Y" with X = Y', () => {
  it('shows every loan the total counts, even after some fund while the page is open', () => {
    // Two loans funded after loading: still held in memory (an open loan's detail must
    // survive), but no longer lendable — so neither the search nor the total counts them.
    const session = [
      ...loans,
      mkLoan({ id: 7, partner_id: 10, status: 'funded', funded_amount: 1000 }),
      mkLoan({ id: 8, partner_id: null, funded_amount: 1000 }), // fundraising but fully funded
    ]
    const total = session.filter(isFundraising).length
    const reset = { loan: { name: '', use: '' }, partner: { direct: 'both' }, portfolio: { exclude_portfolio_loans: 'true' } }
    const shown = filterLoans(reset, { loans: session, activePartners: partners, atheistListProcessed: false }).length
    expect(total).toBe(5)
    expect(shown).toBe(total)
  })

  it('isFundraising is exactly what every search requires', () => {
    expect(isFundraising(mkLoan({ id: 1 }))).toBe(true)
    expect(isFundraising(mkLoan({ id: 1, status: 'funded' }))).toBe(false)
    expect(isFundraising(mkLoan({ id: 1, status: 'expired' }))).toBe(false)
    expect(isFundraising(mkLoan({ id: 1, funded_amount: 1000 }))).toBe(false)
    expect(isFundraising(mkLoan({ id: 1, funded_amount: 999 }))).toBe(true)
  })
})

describe('sorting: an unknown value never outranks a known one', () => {
  // Kiva U.S. loans carry no repayment schedule, so they have no final-repayment date.
  // "Soonest repayment first" must not put them ahead of loans that do repay soon.
  const withDates = [
    mkLoan({ id: 1, partner_id: 10, kls_final_repayment: '2026-12-01' }),
    mkLoan({ id: 2, partner_id: null }), // no schedule
    mkLoan({ id: 3, partner_id: 10, kls_final_repayment: '2026-10-01' }),
    mkLoan({ id: 4, partner_id: null, kls_final_repayment: 'not a date' }), // unparseable
  ]
  const order = (sort?: string) =>
    filterLoans({ partner: { direct: 'both' }, loan: sort ? { sort } : {} }, { loans: withDates, activePartners: partners, atheistListProcessed: false })
      .map((l: { id: number }) => l.id)

  it('puts loans with no final-repayment date last in the default sort', () => {
    expect(order()).toEqual([3, 1, 2, 4])
  })

  it('keeps unknowns last in a descending sort too', () => {
    const popular = [
      mkLoan({ id: 1, partner_id: 10, kl_dollars_per_hour: 5 }),
      mkLoan({ id: 2, partner_id: null, kl_dollars_per_hour: undefined, kl_posted_date: undefined, posted_date: undefined }),
      mkLoan({ id: 3, partner_id: 10, kl_dollars_per_hour: 50 }),
    ]
    const ids = filterLoans({ partner: { direct: 'both' }, loan: { sort: 'popularity' } }, { loans: popular, activePartners: partners, atheistListProcessed: false })
      .map((l: { id: number }) => l.id)
    expect(ids).toEqual([3, 1, 2])
  })
})
