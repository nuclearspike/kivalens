import { describe, expect, it } from 'vitest'
import {
  buildBasketMix,
  concentrationWarnings,
  DEFAULT_LIMITS,
  DIRECT_KEY,
  findGroup,
  formatMixFilter,
  isLowRating,
  parseMixFilter,
  partnerRating,
  sanitizeLimits,
  spreadCounts,
  UNRATED_KEY,
  exposureFrom,
  type ActiveExposure,
} from './basketMix'
import type { BasketEntry } from '../stores'
import type { KivaLoan, Partner } from '../types'

/**
 * Paul, 2026-09-26: the basket shows sector, country, activity, partner and more,
 * a graph only where it holds more than one value; partner-heavy lending is
 * dangerous past X loans (more so with a low star rating), country-heavy past Y,
 * and 100% in one sector is NOT dangerous.
 */

const partners: Record<number, Partial<Partner>> = {
  10: { id: 10, name: 'Juhudi Kilimo', rating: '3.5' },
  20: { id: 20, name: 'Low Stars MFI', rating: '1.5' },
  30: { id: 30, name: 'Unrated MFI', rating: 'Not Rated' },
  40: { id: 40, name: 'Five Star', rating: '5.0' },
}
const partnerOf = (id: number) => partners[id] as Partner | undefined

let nextId = 1
function entry(
  partnerId: number | null,
  country = 'Kenya',
  sector = 'Retail',
  activity = 'Clothing Sales',
  amount = 25,
): BasketEntry {
  const id = nextId++
  const loan = { id, partner_id: partnerId, sector, activity, location: { country, country_code: 'XX' } } as unknown as KivaLoan
  return { id, amount, loan }
}

const noActive: ActiveExposure = { partner: new Map(), country: new Map() }

describe('the basket grouped every way the breakdown shows it', () => {
  it('groups by partner, rating, country, sector and activity, largest first, with dollar shares', () => {
    const entries = [entry(10), entry(10), entry(20, 'Uganda', 'Food', 'Farming', 50), entry(null, 'United States', 'Food', 'Farming')]
    const mix = buildBasketMix(entries, partnerOf)
    expect(mix.count).toBe(4)
    expect(mix.amount).toBe(125)
    expect(mix.dimensions.partner.map((g) => [g.key, g.name, g.count, g.amount])).toEqual([
      ['p10', 'Juhudi Kilimo', 2, 50],
      ['p20', 'Low Stars MFI', 1, 50],
      [DIRECT_KEY, '', 1, 25],
    ])
    expect(mix.dimensions.partner[0].share).toBeCloseTo(40)
    expect(mix.dimensions.partner.find((g) => g.direct)?.loanIds).toEqual([entries[3].id])
    expect(mix.dimensions.country.map((g) => g.name)).toEqual(['Kenya', 'Uganda', 'United States'])
    expect(mix.dimensions.sector.map((g) => [g.name, g.count])).toEqual([['Food', 2], ['Retail', 2]])
    expect(mix.dimensions.activity.map((g) => g.name)).toEqual(['Farming', 'Clothing Sales'])
  })

  it('reads ratings as a scale, best first, then partners Kiva has not rated, then direct loans', () => {
    const mix = buildBasketMix([entry(20), entry(30), entry(null), entry(40), entry(10), entry(10), entry(10)], partnerOf)
    expect(mix.dimensions.rating.map((g) => g.key)).toEqual(['r5', 'r3.5', 'r1.5', UNRATED_KEY, DIRECT_KEY])
    expect(mix.dimensions.rating.map((g) => g.rating ?? null)).toEqual([5, 3.5, 1.5, null, null])
  })

  it('keeps a partner it cannot find by its id, with no name, rather than dropping its loans', () => {
    const mix = buildBasketMix([entry(99), entry(99)], partnerOf)
    expect(mix.dimensions.partner).toMatchObject([{ key: 'p99', name: '', partnerId: 99, count: 2, rating: null }])
    expect(mix.dimensions.rating).toMatchObject([{ key: UNRATED_KEY, count: 2 }])
  })

  it('shows one value as one group, which the breakdown draws as a single line', () => {
    const mix = buildBasketMix([entry(10), entry(20, 'Uganda')], partnerOf)
    expect(mix.dimensions.sector).toHaveLength(1)
    expect(mix.dimensions.sector[0]).toMatchObject({ name: 'Retail', count: 2, share: 100 })
    expect(mix.dimensions.country).toHaveLength(2)
  })

  it('skips entries whose loan has not arrived', () => {
    const mix = buildBasketMix([{ id: 5, amount: 25, loan: undefined }, entry(10)], partnerOf)
    expect(mix.count).toBe(1)
    expect(mix.dimensions.partner).toHaveLength(1)
  })

  it('counts the partners and countries the line under Checkout names', () => {
    const mix = buildBasketMix([entry(10), entry(20, 'Uganda'), entry(null, 'United States')], partnerOf)
    expect(spreadCounts(mix)).toEqual({ partners: 2, countries: 3, direct: true })
    expect(spreadCounts(buildBasketMix([entry(null), entry(null)], partnerOf))).toEqual({ partners: 0, countries: 1, direct: true })
  })

  it('finds the group a breakdown row stands for, and nothing once it is gone', () => {
    const mix = buildBasketMix([entry(10), entry(20)], partnerOf)
    expect(findGroup(mix, { dimension: 'partner', key: 'p20' })?.name).toBe('Low Stars MFI')
    expect(findGroup(mix, { dimension: 'partner', key: 'p40' })).toBeNull()
    expect(findGroup(mix, null)).toBeNull()
  })
})

describe('the narrowing as the address carries it', () => {
  it('writes the dimension, a dot and the key, and reads it back splitting at the first dot', () => {
    expect(formatMixFilter({ dimension: 'partner', key: 'p20' })).toBe('partner.p20')
    expect(parseMixFilter('partner.p20')).toEqual({ dimension: 'partner', key: 'p20' })
    expect(parseMixFilter('rating.r3.5')).toEqual({ dimension: 'rating', key: 'r3.5' })
    expect(parseMixFilter('country.United States')).toEqual({ dimension: 'country', key: 'United States' })
    expect(parseMixFilter(formatMixFilter({ dimension: 'activity', key: 'Food Production/Sales' }))).toEqual({
      dimension: 'activity',
      key: 'Food Production/Sales',
    })
  })

  it('ignores anything that is not one of its dimensions', () => {
    for (const bad of [null, undefined, '', 'partner', 'region.Africa', 'p20']) expect(parseMixFilter(bad)).toBeNull()
  })
})

describe('Kiva ratings', () => {
  it('reads the strings Kiva sends, and treats anything that is not a positive number as not rated', () => {
    expect(partnerRating({ rating: '3.5' })).toBe(3.5)
    expect(partnerRating({ rating: 4 })).toBe(4)
    expect(partnerRating({ rating: 'Not Rated' })).toBeNull()
    expect(partnerRating({ rating: '0.0' })).toBeNull()
    expect(partnerRating({})).toBeNull()
    expect(partnerRating(undefined)).toBeNull()
  })

  it('counts below 3 stars, and no rating at all, as low', () => {
    expect([0.5, 2.5, null, undefined].map(isLowRating)).toEqual([true, true, true, true])
    expect([3, 3.5, 5].map(isLowRating)).toEqual([false, false, false])
  })
})

describe('concentration warnings', () => {
  const limits = { partner: 5, country: 25 }
  const six = (partnerId: number | null, country = 'Kenya') => Array.from({ length: 6 }, () => entry(partnerId, country))

  it('flags a field partner past the limit, and not at it', () => {
    const atLimit = buildBasketMix(Array.from({ length: 5 }, () => entry(10)), partnerOf)
    expect(concentrationWarnings(atLimit, noActive, limits)).toEqual([])
    const past = buildBasketMix(six(10), partnerOf)
    expect(concentrationWarnings(past, noActive, limits)).toMatchObject([
      { dimension: 'partner', key: 'p10', name: 'Juhudi Kilimo', inBasket: 6, active: 0, total: 6, limit: 5, severity: 'caution' },
    ])
  })

  it('counts the loans the lender already has with that partner', () => {
    const mix = buildBasketMix([entry(10), entry(10)], partnerOf)
    const active: ActiveExposure = { partner: new Map([['10', 4]]), country: new Map() }
    expect(concentrationWarnings(mix, active, limits)).toMatchObject([{ inBasket: 2, active: 4, total: 6 }])
    // Without them, two loans are no concentration at all.
    expect(concentrationWarnings(mix, null, limits)).toEqual([])
  })

  it('is red for a partner Kiva rates below 3 stars or has not rated, amber otherwise', () => {
    const mix = buildBasketMix([...six(10, 'Kenya'), ...six(20, 'Peru'), ...six(30, 'Chile')], partnerOf)
    const warnings = concentrationWarnings(mix, noActive, limits)
    expect(warnings.map((w) => [w.key, w.severity, w.rating])).toEqual([
      ['p20', 'danger', 1.5],
      ['p30', 'danger', null],
      ['p10', 'caution', 3.5],
    ])
  })

  it('never flags direct loans by partner: they have no partner to fail', () => {
    const mix = buildBasketMix(six(null, 'United States'), partnerOf)
    expect(concentrationWarnings(mix, noActive, limits)).toEqual([])
  })

  it('flags a country past its limit, after the partners (each by how many loans ride on it), counting the lender’s active loans there by name', () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(i < 6 ? 10 : 40, 'Kenya'))
    const mix = buildBasketMix(entries, partnerOf)
    const active: ActiveExposure = { partner: new Map(), country: new Map([['Kenya', 6]]) }
    expect(concentrationWarnings(mix, active, limits).map((w) => [w.dimension, w.key, w.total, w.severity])).toEqual([
      ['partner', 'p40', 14, 'caution'],
      ['partner', 'p10', 6, 'caution'],
      ['country', 'Kenya', 26, 'caution'],
    ])
  })

  it('never flags a sector or an activity, even when the whole basket is one', () => {
    const mix = buildBasketMix(Array.from({ length: 30 }, (_, i) => entry(i % 10 === 0 ? 10 : 40 + i, `Country ${i}`)), (id) =>
      id === 10 ? (partners[10] as Partner) : ({ id, name: `P${id}`, rating: '4.0' } as unknown as Partner),
    )
    expect(mix.dimensions.sector).toHaveLength(1)
    expect(concentrationWarnings(mix, noActive, limits)).toEqual([])
  })

  it('carries the loans each warning is about, so Show these loans can narrow the list to them', () => {
    const entries = six(20)
    const [warning] = concentrationWarnings(buildBasketMix(entries, partnerOf), noActive, limits)
    expect(warning.loanIds).toEqual(entries.map((e) => e.id))
  })
})

describe('the lender’s limits', () => {
  it('defaults to 5 loans with one partner and 25 in one country', () => {
    expect(DEFAULT_LIMITS).toEqual({ partner: 5, country: 25 })
    expect(sanitizeLimits(undefined)).toEqual(DEFAULT_LIMITS)
    expect(sanitizeLimits({})).toEqual(DEFAULT_LIMITS)
  })

  it('takes whole numbers of at least 1, and ignores anything else', () => {
    expect(sanitizeLimits({ basket_partner_limit: 3, basket_country_limit: '40' })).toEqual({ partner: 3, country: 40 })
    for (const bad of [0, -2, 2.5, 'abc', '', null, true]) {
      expect(sanitizeLimits({ basket_partner_limit: bad, basket_country_limit: bad })).toEqual(DEFAULT_LIMITS)
    }
  })
})

describe('the lender’s active loans, as Kiva’s SuperGraph reports them', () => {
  it('keys partners by id and countries by the English name in the lookup', () => {
    const partner = { slices: [{ id: '218', name: 'Strathmore University', value: 3, percent: 60 }, { id: 448, name: 'COCAFCAL', value: 2, percent: 40 }], total_sum: 5 }
    const country = { slices: [{ id: '2', name: 'Kenya', value: 4, percent: 80 }, { id: '8', name: null, value: 1, percent: 20 }], total_sum: 5 }
    const exposure = exposureFrom(partner, country)
    expect([...exposure.partner]).toEqual([['218', 3], ['448', 2]])
    expect([...exposure.country]).toEqual([['Kenya', 4]])
  })
})
