import { describe, expect, it, vi } from 'vitest'
import { filterLoans, portfolioBalancer, rangeCounter, resolveBalancerValues } from '../../server/loanFilter.mjs'
import { balancingState, enabledBalancers } from './balancingStatus'
import type { Criteria } from '../types'

/**
 * Paul, 2026-09-26: "when i selected the the preset "Countries I don't have" it looked
 * like it worked but when i investigated, it hadn't actually looked at my portfolio."
 * A balancer's list is derived from the lender's portfolio, and a search that arrived
 * without it (a reload, Back, a link, a saved search picked before the portfolio was
 * read) filtered nothing while looking applied. The filter works the list out from
 * the lender's portfolio itself (portfolioBalancer in server/loanFilter.mjs).
 */

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising', funded_amount: 0, loan_amount: 1000,
  location: { country_code: 'KE', country: 'Kenya' }, terms: { repayment_interval: 'Monthly' },
  kls_tags: [], themes: [], borrower_count: 1, kl_percent_women: 100, kl_still_needed: 500,
  kl_percent_funded: 50, kl_name_arr: [], kls_use_or_descr_arr: [], kl_newest_sort: 0,
  posted_date: '2026-06-01', sector: 'Retail', activity: 'Retail', ...o,
})
const where = (code: string, country: string) => ({ location: { country_code: code, country } })

const partners = [
  { id: 10, status: 'active', rating: 5, kl_regions: ['af'], kl_sp: [], countries: [{ iso_code: 'KE', region: 'Africa' }] },
  { id: 20, status: 'active', rating: 2, kl_regions: ['sa'], kl_sp: [], countries: [{ iso_code: 'PE', region: 'South America' }] },
]
const loans = [
  mkLoan({ id: 1, partner_id: 10, ...where('KE', 'Kenya') }),
  mkLoan({ id: 2, partner_id: 20, ...where('UG', 'Uganda'), kl_percent_women: 0 }),
  mkLoan({ id: 3, partner_id: 20, ...where('PE', 'Peru') }),
  mkLoan({ id: 4, partner_id: 10, ...where('KE', 'Kenya'), kl_percent_women: 0 }),
  mkLoan({ id: 5, partner_id: null, ...where('US', 'United States') }),
]

// What Kiva's SuperGraph says this lender has: Kenya and Uganda by country, partner 10.
const PORTFOLIO: Record<string, Array<{ id: string; name: string; value: number; percent: number }>> = {
  'country|all': [
    { id: '2', name: 'Kenya', value: 6, percent: 60 },
    { id: '5', name: 'Uganda', value: 4, percent: 40 },
  ],
  'partner|active': [{ id: '10', name: 'Partner Ten', value: 3, percent: 100 }],
  'gender|all': [{ id: 'f', name: 'Female', value: 5, percent: 100 }],
  'region|all': [{ id: 'af', name: 'Africa', value: 5, percent: 100 }],
}
const balancerSlices = vi.fn((sliceBy: string, include: string) => PORTFOLIO[`${sliceBy}|${include}`] ?? null)
const withPortfolio = { loans, activePartners: partners, atheistListProcessed: false, balancerSlices }
const withoutPortfolio = { loans, activePartners: partners, atheistListProcessed: false }
const ids = (criteria: Record<string, unknown>, ctx: Record<string, unknown>) =>
  filterLoans(criteria, ctx).map((l: { id: number }) => l.id).sort((a: number, b: number) => a - b)

// "Countries I Don't Have" as an address carries it: the settings, no list.
const countriesIDontHave = {
  partner: { direct: 'both' },
  portfolio: { pb_country: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } },
}

describe('a balancer works its list out from the lender’s portfolio', () => {
  it('hides the countries the lender has, however the search arrived', () => {
    expect(ids(countriesIDontHave, withPortfolio)).toEqual([3, 5])
    expect(balancerSlices).toHaveBeenCalledWith('country', 'all')
  })

  it('filters nothing without the portfolio, which is exactly why the page must say so', () => {
    expect(ids(countriesIDontHave, withoutPortfolio)).toEqual([1, 2, 3, 4, 5])
  })

  it('prefers the portfolio to a list stored in the search, which may be stale', () => {
    const stale = { ...countriesIDontHave, portfolio: { pb_country: { ...countriesIDontHave.portfolio.pb_country, values: ['Peru'] } } }
    expect(ids(stale, withPortfolio)).toEqual([3, 5])
  })

  it('uses a stored list as the stand-in while the portfolio is still being read', () => {
    const stored = { ...countriesIDontHave, portfolio: { pb_country: { ...countriesIDontHave.portfolio.pb_country, values: ['Kenya'] } } }
    expect(ids(stored, { ...withoutPortfolio, balancerSlices: () => null })).toEqual([2, 3, 5])
  })

  it('applies the threshold: below 50% hides only Uganda', () => {
    const under = { partner: { direct: 'both' }, portfolio: { pb_country: { enabled: true, hideshow: 'hide', ltgt: 'lt', percent: 50, allactive: 'all' } } }
    expect(ids(under, withPortfolio)).toEqual([1, 3, 4, 5])
  })

  it('shows only what the lender has when set to show', () => {
    const only = { partner: { direct: 'both' }, portfolio: { pb_country: { enabled: true, hideshow: 'show', ltgt: 'gt', percent: 0, allactive: 'all' } } }
    expect(ids(only, withPortfolio)).toEqual([1, 2, 4])
  })

  it('balances by partner from the active portfolio, by numeric partner id', () => {
    const balancePartnerRisk = { portfolio: { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active' } } }
    // MFI Only (balancing by partner means it), and partner 10's loans hidden.
    expect(ids(balancePartnerRisk, withPortfolio)).toEqual([2, 3])
    expect(balancerSlices).toHaveBeenCalledWith('partner', 'active')
  })

  it('balances by gender and by region the same way', () => {
    const gender = { partner: { direct: 'both' }, portfolio: { pb_gender: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } } }
    expect(ids(gender, withPortfolio)).toEqual([2, 4])
    const region = { partner: { direct: 'both' }, portfolio: { pb_region: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } } }
    expect(ids(region, withPortfolio)).toEqual([2, 3, 5])
  })

  it('reaches every count the engine gives, not only the result list', () => {
    const count = rangeCounter(countriesIDontHave, withPortfolio, 'loan', 'loan_amount')
    expect(count(null, null)).toBe(2)
  })

  it('leaves a balancer that is off alone', () => {
    const off = { enabled: false, values: ['Kenya'] }
    expect(portfolioBalancer(off, 'country', withPortfolio)).toBe(off)
  })
})

describe('the rule for a balancer’s list, shared by the site, the Portfolio tab and RSS', () => {
  it('keeps slices above (gt) or below (lt) the percent; partner ids as numbers', () => {
    const slices = [
      { id: '10', name: 'A', value: 1, percent: 60 },
      { id: 'x', name: 'B', value: 1, percent: 40 },
    ]
    expect(resolveBalancerValues({ ltgt: 'gt', percent: 50 }, slices, 'country')).toEqual(['A'])
    expect(resolveBalancerValues({ ltgt: 'lt', percent: 50 }, slices, 'country')).toEqual(['B'])
    // A partner id that is not a number is dropped, never kept as NaN.
    expect(resolveBalancerValues({ ltgt: 'gt', percent: 0 }, slices, 'partner')).toEqual([10])
  })
})

describe('what a balancer that is on is doing', () => {
  const failed = (sliceBy: string, include: string) => [{ sliceBy, include }]
  const criteria = countriesIDontHave as unknown as Criteria
  const held = () => true
  const missing = () => false

  it('lists the balancers that are on, with the part of the portfolio each reads', () => {
    expect(enabledBalancers(criteria)).toEqual([{ sliceBy: 'country', include: 'all' }])
    expect(enabledBalancers({ portfolio: {} } as Criteria)).toEqual([])
  })

  it('is applied once the portfolio it reads is on hand, and reading until then', () => {
    expect(balancingState(criteria, 'examplelender', [], held)).toBe('applied')
    expect(balancingState(criteria, 'examplelender', [], missing)).toBe('reading')
    // Only the part it reads counts.
    expect(balancingState(criteria, 'examplelender', [], (sliceBy, include) => sliceBy === 'country' && include === 'all')).toBe('applied')
  })

  it('needs a lender ID', () => {
    expect(balancingState(criteria, '', [], held)).toBe('needs-lender')
  })

  it('says when Kiva would not return the part of the portfolio it reads, and only that part', () => {
    expect(balancingState(criteria, 'examplelender', failed('country', 'all'), missing)).toBe('not-read')
    expect(balancingState(criteria, 'examplelender', failed('country', 'active'), held)).toBe('applied')
    expect(balancingState(criteria, 'examplelender', failed('partner', 'all'), held)).toBe('applied')
  })

  it('has nothing to say when no balancer is on', () => {
    expect(balancingState({ portfolio: {} } as Criteria, '', failed('country', 'all'), missing)).toBeNull()
  })
})
