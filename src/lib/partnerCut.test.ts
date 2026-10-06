// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filtersSearchCanShow, partnerCutSearch } from './partnerCut'
import { getKivaLoans } from '../api/kiva'
import type { Partner } from '../types'

/**
 * From the Partners page's list to the search that shows those partners' loans,
 * judged by the real partner filter: the one both pages run.
 */

const partner = (id: number, name: string, status: string, defaultRate: number, country: [string, string], region: string): Partner =>
  ({
    id,
    name,
    status,
    default_rate: defaultRate,
    countries: [{ iso_code: country[0], name: country[1] }],
    kl_regions: [region],
    start_date: '2015-01-01',
  }) as unknown as Partner

const PARTNERS = () => [
  partner(1, 'Alpha Kenya', 'active', 0.5, ['KE', 'Kenya'], 'af'),
  partner(2, 'Beta Peru', 'active', 6, ['PE', 'Peru'], 'sa'),
  partner(3, 'Gamma Uganda', 'active', 1, ['UG', 'Uganda'], 'af'),
  partner(4, 'Delta Paused', 'paused', 0.2, ['KE', 'Kenya'], 'af'),
]

const kl = getKivaLoans()
const saved = { partners: kl.partnersFromKiva, active: kl.activePartners }
const ACTIVE = { status: 'active', status_all_any_none: 'any' }

/** What the page lists for these filters and this name search, and the search made from it. */
const listed = (filters: Record<string, unknown>, name = '') => kl.filterAllPartners({ ...filters, name })
const cut = (filters: Record<string, unknown>, name = '') =>
  partnerCutSearch(filters, listed(filters, name), (f) => kl.filterAllPartners(f))

beforeEach(() => {
  kl.partnersFromKiva = []
  kl.processPartners(PARTNERS())
})

afterEach(() => {
  kl.partnersFromKiva = saved.partners
  kl.activePartners = saved.active
})

describe('the search for the partners the Partners page lists', () => {
  it('carries a slider over as the same slider, in MFI Only', () => {
    const filters = { ...ACTIVE, partner_default_max: 2 }
    expect(listed(filters).map((p) => p.id)).toEqual([1, 3])
    expect(cut(filters)).toEqual({ loan: {}, partner: { direct: 'mfi', partner_default_max: 2 }, portfolio: {} })
  })

  it('carries a dropdown with its mode', () => {
    const filters = { ...ACTIVE, region: 'af', region_all_any_none: 'none' }
    expect(listed(filters).map((p) => p.id)).toEqual([2])
    expect(cut(filters)?.partner).toEqual({ direct: 'mfi', region: 'af', region_all_any_none: 'none' })
  })

  it('is MFI Only and nothing more when the list is every active partner', () => {
    expect(cut({ ...ACTIVE })?.partner).toEqual({ direct: 'mfi' })
  })

  it('names the partners when a name search narrowed the list, which Search cannot show', () => {
    const filters = { ...ACTIVE, partner_default_max: 2 }
    expect(listed(filters, 'alpha').map((p) => p.id)).toEqual([1])
    expect(cut(filters, 'alpha')?.partner).toEqual({ direct: 'mfi', partners: '1' })
  })

  it('names the partners when the countries they work in narrowed the list', () => {
    const filters = { ...ACTIVE, country_code: 'UG' }
    expect(cut(filters)?.partner).toEqual({ direct: 'mfi', partners: '3' })
  })

  it('never carries a filter Search has no control for', () => {
    for (const filters of [{ ...ACTIVE, country_code: 'KE' }, { status: 'active,paused', status_all_any_none: 'any', country_code: 'KE' }]) {
      const keys = Object.keys(cut(filters)!.partner)
      expect(keys).not.toContain('country_code')
      expect(keys).not.toContain('status')
      expect(keys).not.toContain('name')
    }
  })

  it('leaves out the partners that are not active: only active partners have loans to show', () => {
    // Listed with paused ones too. The active ones are exactly what the slider gives, so the slider goes over.
    const withPaused = { status: 'active,paused', status_all_any_none: 'any', partner_default_max: 2 }
    expect(listed(withPaused).map((p) => p.id).sort()).toEqual([1, 3, 4])
    expect(cut(withPaused)?.partner).toEqual({ direct: 'mfi', partner_default_max: 2 })
    // Named one by one, the paused partner is not among them.
    expect(cut({ status: 'active,paused', status_all_any_none: 'any', country_code: 'KE' })?.partner).toEqual({ direct: 'mfi', partners: '1' })
  })

  it('is nothing when no listed partner is active', () => {
    expect(listed({ status: 'paused', status_all_any_none: 'any' }).map((p) => p.id)).toEqual([4])
    expect(cut({ status: 'paused', status_all_any_none: 'any' })).toBeNull()
    expect(cut({ ...ACTIVE }, 'nobody by this name')).toBeNull()
  })

  it('finds, run as a search, exactly the active partners that were listed', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...ACTIVE, partner_default_max: 2 }, ''],
      [{ ...ACTIVE, partner_default_max: 2 }, 'gamma'],
      [{ ...ACTIVE, region: 'af' }, ''],
      [{ status: 'active,paused', status_all_any_none: 'any', country_code: 'KE' }, ''],
      [{ ...ACTIVE }, ''],
    ]
    for (const [filters, name] of cases) {
      const wanted = listed(filters, name).filter((p) => p.status === 'active').map((p) => p.id).sort()
      const search = cut(filters, name)!
      // The Search page filters the active partners by the search's partner criteria.
      const found = kl.filterAllPartners({ ...search.partner, direct: undefined, ...ACTIVE }).map((p) => p.id).sort()
      expect(found).toEqual(wanted)
    }
  })
})

describe('the filters the Search page can show', () => {
  it('keeps sliders and the shared dropdowns, a zero included', () => {
    expect(filtersSearchCanShow({ profit_min: 0, partner_risk_rating_max: 4.5, religion: 'Secular', charges_fees_and_interest: 'true' })).toEqual({
      profit_min: 0, partner_risk_rating_max: 4.5, religion: 'Secular', charges_fees_and_interest: 'true',
    })
  })

  it('drops what Search has no control for, what is empty, and the mode of an empty dropdown', () => {
    expect(
      filtersSearchCanShow({
        status: 'active', status_all_any_none: 'any', country_code: 'KE', country_code_all_any_none: 'all', name: 'x', anything_else: 1,
        partner_default_min: null, partner_default_max: '', religion_all_any_none: 'none', region: '', region_all_any_none: 'any',
      }),
    ).toEqual({})
  })
})
