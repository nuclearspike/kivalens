import { describe, expect, it } from 'vitest'
import { filterLoans, filterPartners, rangeCounter } from '../../server/loanFilter.mjs'

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising',
  funded_amount: 0,
  loan_amount: 1000,
  location: { country_code: 'KE', country: 'Kenya' },
  terms: { repayment_interval: 'Monthly' },
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

const partners = [
  { id: 10, name: 'A', status: 'active', rating: 5, default_rate: 1, kl_regions: ['af'], kl_sp: [], countries: [{ iso_code: 'KE' }] },
  { id: 20, name: 'B', status: 'active', rating: 3.5, default_rate: 4, kl_regions: ['as'], kl_sp: [], countries: [{ iso_code: 'PH' }] },
  { id: 30, name: 'C', status: 'active', rating: 2, default_rate: 12, kl_regions: ['af'], kl_sp: [], countries: [{ iso_code: 'UG' }] },
  { id: 40, name: 'D', status: 'closed', rating: 4, default_rate: 0, kl_regions: ['sa'], kl_sp: [], countries: [{ iso_code: 'PE' }] },
]
const loans = [
  mkLoan({ id: 1, sector: 'Agriculture', partner_id: 10, loan_amount: 300, borrower_count: 1 }),
  mkLoan({ id: 2, sector: 'Agriculture', partner_id: 10, loan_amount: 900, borrower_count: 4 }),
  mkLoan({ id: 3, sector: 'Retail', partner_id: 20, loan_amount: 1500, borrower_count: 9 }),
  mkLoan({ id: 4, sector: 'Retail', partner_id: 20, loan_amount: 5000, borrower_count: 12 }),
  mkLoan({ id: 5, sector: 'Food', partner_id: 30, loan_amount: 12000, borrower_count: 30 }), // past the slider's end
  mkLoan({ id: 6, sector: 'Food', partner_id: 30, loan_amount: 700, borrower_count: 2 }),
  mkLoan({ id: 7, sector: 'Food', partner_id: null, loan_amount: 600, borrower_count: 1 }), // direct loan
]
const ctx = { loans, activePartners: partners.filter((p) => p.status === 'active'), atheistListProcessed: false }
const SPANS: [number | null, number | null][] = [[null, null], [500, null], [null, 1000], [600, 1500], [900, 900], [20000, null], [null, 0]]

describe('shared loanFilter.rangeCounter', () => {
  it('a loan range: every total is what the search returns with that range', () => {
    for (const other of [{}, { sector: 'Agriculture,Food' }, { borrower_count_min: 2 }]) {
      const count = rangeCounter({ loan: { ...other, loan_amount_min: 100, loan_amount_max: 400 } }, ctx, 'loan', 'loan_amount')
      for (const [min, max] of SPANS) {
        const loan: Record<string, unknown> = { ...other }
        if (min != null) loan.loan_amount_min = min
        if (max != null) loan.loan_amount_max = max
        expect(count(min, max), `${JSON.stringify(other)} ${min}..${max}`).toBe(filterLoans({ loan }, ctx).length)
      }
    }
  })

  it("leaves the slider's own saved range out of the population, and no limit means no limit", () => {
    const count = rangeCounter({ loan: { loan_amount_min: 100, loan_amount_max: 400 } }, ctx, 'loan', 'loan_amount')
    expect(count(null, null)).toBe(6) // every MFI loan, the 12,000 one included
    expect(count(null, 10000)).toBe(5)
  })

  it('a partner range on the loan search counts loans through their partner', () => {
    const base = { loan: { sector: 'Agriculture,Retail,Food' }, partner: { partner_risk_rating_min: 4 } }
    const count = rangeCounter(base, ctx, 'partner', 'partner_risk_rating')
    for (const [min, max] of [[null, null], [3.5, null], [null, 3.5], [2, 3.5], [5, 5], [4.5, 4.5]] as [number | null, number | null][]) {
      const partner: Record<string, unknown> = {}
      if (min != null) partner.partner_risk_rating_min = min
      if (max != null) partner.partner_risk_rating_max = max
      expect(count(min, max), `${min}..${max}`).toBe(filterLoans({ loan: base.loan, partner }, ctx).length)
    }
    expect(count(3.5, null)).toBe(4)
  })

  it('direct-only search: a partner range changes nothing', () => {
    const count = rangeCounter({ partner: { direct: 'direct' } }, ctx, 'partner', 'partner_risk_rating')
    expect(count(4, 5)).toBe(filterLoans({ partner: { direct: 'direct', partner_risk_rating_min: 4 } }, ctx).length)
    expect(count(4, 5)).toBe(1)
  })

  it('the Partners page: counts partners in the pool, with the name search applied', () => {
    const pool = { loans, activePartners: ctx.activePartners, partnerPool: partners, atheistListProcessed: false }
    const base = { partner: { status: 'active,closed', status_all_any_none: 'any', partner_default_max: 3 } }
    const count = rangeCounter(base, pool, 'partner', 'partner_default', { unit: 'partners' })
    for (const [min, max] of [[null, null], [1, null], [null, 4], [1, 4], [50, null]] as [number | null, number | null][]) {
      const partner: Record<string, unknown> = { status: 'active,closed', status_all_any_none: 'any' }
      if (min != null) partner.partner_default_min = min
      if (max != null) partner.partner_default_max = max
      expect(count(min, max), `${min}..${max}`).toBe(filterPartners({ partner }, pool).length)
    }
    const named = rangeCounter(base, pool, 'partner', 'partner_default', { unit: 'partners', accept: ((p: { name: string }) => p.name !== 'A') as never })
    expect(named(null, null)).toBe(3)
  })

  it('survives no criteria and no data', () => {
    expect(rangeCounter(undefined, { loans: [], activePartners: [] }, 'loan', 'loan_amount')(1, 2)).toBe(0)
    expect(rangeCounter({}, ctx, 'loan', 'no_such_range')(1, 2)).toBe(6)
  })
})
