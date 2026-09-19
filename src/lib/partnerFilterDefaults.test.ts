import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTNER_FILTERS, partnerFiltersArePristine } from './partnerFilterDefaults'

describe('partnerFiltersArePristine', () => {
  it('is true for the page as it opens, and for fields set and then cleared', () => {
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS }, '')).toBe(true)
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS, region: '', partner_default_min: null, religion: undefined }, '  ')).toBe(true)
  })

  it('is false once anything differs: a filter, a range, the status, or the name search', () => {
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS, region: 'Africa' }, '')).toBe(false)
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS, partner_risk_rating_min: 0 }, '')).toBe(false)
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS, status: 'active,paused' }, '')).toBe(false)
    expect(partnerFiltersArePristine({ status_all_any_none: 'any' }, '')).toBe(false) // status itself was cleared
    expect(partnerFiltersArePristine({ ...DEFAULT_PARTNER_FILTERS }, 'kiva')).toBe(false)
  })
})
