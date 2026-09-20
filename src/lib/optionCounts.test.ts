import { describe, expect, it } from 'vitest'
import { filterLoans } from '../../server/loanFilter.mjs'
import { LOAN_FACET_KEYS, loanOptionCounts } from './optionCounts'
import type { KivaLoan, Partner } from '../types'

const mkLoan = (o: Record<string, unknown>) =>
  ({
    status: 'fundraising',
    funded_amount: 0,
    loan_amount: 1000,
    location: { country_code: 'KE', country: 'Kenya' },
    terms: { repayment_interval: 'Monthly', loss_liability: { currency_exchange: 'shared' } },
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
  }) as unknown as KivaLoan

const partners = [
  { id: 10, name: 'Juhudi', status: 'active', kl_regions: ['af'], kl_sp: [1, 3], countries: [{ iso_code: 'KE' }], normalizedReligions: ['Secular'], rating: 5 },
  { id: 20, name: 'NWTF', status: 'active', kl_regions: ['as', 'oc'], kl_sp: [1], countries: [{ iso_code: 'PH' }], rating: 3 },
] as unknown as Partner[]

const loans = [
  mkLoan({ id: 1, sector: 'Agriculture', activity: 'Farming', partner_id: 10, themes: ['Green', 'Youth'], kls_tags: ['#Vegan', '#Eco-friendly'] }),
  mkLoan({ id: 2, sector: 'Agriculture', activity: 'Dairy', partner_id: 10, themes: ['Green'], kls_tags: ['#Vegan'] }),
  mkLoan({ id: 3, sector: 'Retail', activity: 'Retail', partner_id: 20, location: { country_code: 'PH', country: 'Philippines' }, terms: { repayment_interval: 'Irregularly', loss_liability: { currency_exchange: 'none' } }, kls_tags: ['user_favorite'] }),
]

const partnerOf = (loan: KivaLoan) => partners.find((p) => p.id === loan.partner_id)
const count = (key: string) => loanOptionCounts(loans, key, partnerOf)

describe('loanOptionCounts', () => {
  it('counts each loan under the option values it matches, never under a label', () => {
    expect(count('country_code')).toEqual({ KE: 2, PH: 1 }) // codes, not "Kenya"
    expect(count('sector')).toEqual({ Agriculture: 2, Retail: 1 })
    expect(count('activity')).toEqual({ Farming: 1, Dairy: 1, Retail: 1 })
    expect(count('repayment_interval')).toEqual({ Monthly: 2, Irregularly: 1 })
    expect(count('currency_exchange_loss_liability')).toEqual({ shared: 2, none: 1 }) // raw values, not "Shared"
    expect(count('partners')).toEqual({ '10': 2, '20': 1 }) // partner ids, not names
    expect(count('tags')).toEqual({ '#Vegan': 2, '#Eco-friendly': 1, user_favorite: 1 }) // raw tags, not humanized
  })

  it('counts a loan once under each of several values', () => {
    expect(count('themes')).toEqual({ Green: 2, Youth: 1 })
    expect(count('region')).toEqual({ af: 2, as: 1, oc: 1 })
    expect(count('social_performance')).toEqual({ '1': 3, '3': 2 })
  })

  it('reads a partner with no religion on record as Unknown, as the filter does', () => {
    expect(count('religion')).toEqual({ Secular: 2, Unknown: 1 })
  })

  it('agrees with the filter: an option counts what choosing only it returns', () => {
    const ctx = { loans, activePartners: partners, atheistListProcessed: true }
    const groupOf = (key: string) => (['partners', 'region', 'social_performance', 'religion'].includes(key) ? 'partner' : 'loan')
    for (const key of LOAN_FACET_KEYS) {
      const counts = count(key)!
      expect(Object.keys(counts).length, key).toBeGreaterThan(0)
      for (const [value, n] of Object.entries(counts)) {
        const criteria = { [groupOf(key)]: { [key]: value, [`${key}_all_any_none`]: 'any' } }
        expect(filterLoans(criteria, ctx).length, `${key}=${value}`).toBe(n)
      }
    }
  })

  it('ignores loans with nothing to count, and keys it does not know', () => {
    const bare = [mkLoan({ id: 9, partner_id: null, location: undefined, terms: undefined, themes: undefined, kls_tags: undefined })]
    for (const key of LOAN_FACET_KEYS) expect(loanOptionCounts(bare, key, () => null), key).toEqual({})
    expect(loanOptionCounts(loans, 'bonus_credit_eligibility', partnerOf)).toBeNull()
    expect(loanOptionCounts([], 'sector', partnerOf)).toEqual({})
  })
})
