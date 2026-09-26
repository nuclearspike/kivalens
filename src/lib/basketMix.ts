import type { Partner } from '../types'
import type { BasketEntry } from '../stores'

/**
 * How a basket is spread, and where it leans too hard: the whole calculation
 * behind the basket's breakdown and its concentration warnings, kept apart from
 * the drawing (src/components/BasketMix.tsx).
 *
 * A field partner that folds can stop repayments on every loan it holds, and a
 * country-wide crisis can hit every loan in that country, so those two are
 * warned about. Sector and activity are shown but never warned about: all
 * Retail is not dangerous when partners and countries are spread.
 */

export type MixDimension = 'partner' | 'rating' | 'country' | 'sector' | 'activity'

/** The order the breakdown reads in: the risks first, then the rest. */
export const MIX_DIMENSIONS: readonly MixDimension[] = ['partner', 'rating', 'country', 'sector', 'activity']

/** The group of loans that have no field partner. */
export const DIRECT_KEY = 'direct'
/** The rating group of partners Kiva has not rated. */
export const UNRATED_KEY = 'unrated'

/**
 * Below this many stars a partner counts as low rated: the middle of Kiva's 0.5
 * to 5 scale. On 2026-09-26, 22% of fundraising partner loans were below it.
 */
export const LOW_RATING_BELOW = 3

export interface ConcentrationLimits {
  /** Warn when the lender would hold MORE than this many loans with one field partner. */
  partner: number
  /** Warn when the lender would hold MORE than this many loans in one country. */
  country: number
}

/**
 * Nobody chose these numbers for the lender, so they are the lender's to change
 * (Options, Basket warnings). At $25 a loan, more than 5 is more than $125 riding
 * on one institution; a country holds many partners, so its limit is five times
 * the partner's.
 */
export const DEFAULT_LIMITS: ConcentrationLimits = { partner: 5, country: 25 }

/** The limits stored in the Options blob, each a whole number of at least 1, or the default. */
export function sanitizeLimits(stored: { basket_partner_limit?: unknown; basket_country_limit?: unknown } | null | undefined): ConcentrationLimits {
  const read = (value: unknown, fallback: number) => {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    return Number.isInteger(n) && n >= 1 ? n : fallback
  }
  return {
    partner: read(stored?.basket_partner_limit, DEFAULT_LIMITS.partner),
    country: read(stored?.basket_country_limit, DEFAULT_LIMITS.country),
  }
}

export interface MixGroup {
  /** Identity within its dimension: `p<id>`, a rating `r<stars>`, DIRECT_KEY, UNRATED_KEY, or Kiva's English name. */
  key: string
  /** Kiva's own name: the partner's name, or the English country, sector or activity. Empty where the UI names it. */
  name: string
  count: number
  amount: number
  /** Share of the basket's dollars, 0-100. */
  share: number
  loanIds: number[]
  partnerId?: number
  /** Partner and rating dimensions: Kiva's stars, or null when it has not rated the partner. */
  rating?: number | null
  /** The loans have no field partner. */
  direct?: boolean
}

export interface BasketMix {
  count: number
  amount: number
  dimensions: Record<MixDimension, MixGroup[]>
}

/** Kiva's star rating as a number (it sends strings such as "3.5"), or null when the partner is not rated. */
export function partnerRating(partner: Pick<Partner, 'rating'> | null | undefined): number | null {
  const stars = parseFloat(String(partner?.rating ?? ''))
  return Number.isFinite(stars) && stars > 0 ? stars : null
}

export function isLowRating(rating: number | null | undefined): boolean {
  return rating == null || rating < LOW_RATING_BELOW
}

type Slot = Omit<MixGroup, 'share'>

function add(groups: Map<string, Slot>, key: string, entry: BasketEntry, fields: Omit<Slot, 'key' | 'count' | 'amount' | 'loanIds'>) {
  let group = groups.get(key)
  if (!group) {
    group = { key, count: 0, amount: 0, loanIds: [], ...fields }
    groups.set(key, group)
  }
  group.count += 1
  group.amount += entry.amount
  group.loanIds.push(entry.id)
}

const byAmount = (a: MixGroup, b: MixGroup) =>
  b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name) || a.key.localeCompare(b.key)

// Ratings read as a scale, best first; the partners Kiva has not rated follow
// the rated ones, and direct loans, which have no partner to rate, come last.
const rank = (g: MixGroup) => (g.direct ? -2 : g.rating == null ? -1 : g.rating)
const byRating = (a: MixGroup, b: MixGroup) => rank(b) - rank(a)

/**
 * The basket grouped every way the breakdown shows it. `partnerOf` resolves a
 * loan's partner id; a partner it cannot find keeps its id and an empty name.
 */
export function buildBasketMix(entries: readonly BasketEntry[], partnerOf: (id: number) => Partner | null | undefined): BasketMix {
  const maps: Record<MixDimension, Map<string, Slot>> = {
    partner: new Map(),
    rating: new Map(),
    country: new Map(),
    sector: new Map(),
    activity: new Map(),
  }
  let count = 0
  let amount = 0
  for (const entry of entries) {
    const loan = entry.loan
    if (!loan) continue
    count += 1
    amount += entry.amount
    const partnerId = loan.partner_id
    if (partnerId) {
      const partner = partnerOf(partnerId)
      const rating = partnerRating(partner)
      add(maps.partner, `p${partnerId}`, entry, { name: partner?.name ?? '', partnerId, rating })
      add(maps.rating, rating == null ? UNRATED_KEY : `r${rating}`, entry, { name: '', rating })
    } else {
      add(maps.partner, DIRECT_KEY, entry, { name: '', direct: true })
      add(maps.rating, DIRECT_KEY, entry, { name: '', direct: true })
    }
    add(maps.country, loan.location?.country ?? '', entry, { name: loan.location?.country ?? '' })
    add(maps.sector, loan.sector ?? '', entry, { name: loan.sector ?? '' })
    add(maps.activity, loan.activity ?? '', entry, { name: loan.activity ?? '' })
  }
  const withShare = (slot: Slot): MixGroup => ({
    ...slot,
    share: amount > 0 ? (slot.amount / amount) * 100 : count > 0 ? (slot.count / count) * 100 : 0,
  })
  const dimensions = {} as Record<MixDimension, MixGroup[]>
  for (const dimension of MIX_DIMENSIONS) {
    const groups = [...maps[dimension].values()].map(withShare)
    dimensions[dimension] = groups.sort(dimension === 'rating' ? byRating : byAmount)
  }
  return { count, amount, dimensions }
}

/** Distinct field partners and countries in the basket, for the line under Checkout. */
export function spreadCounts(mix: BasketMix): { partners: number; countries: number; direct: boolean } {
  const partners = mix.dimensions.partner.filter((g) => !g.direct).length
  return { partners, countries: mix.dimensions.country.length, direct: mix.dimensions.partner.some((g) => g.direct) }
}

/**
 * The lender's active Kiva loans (still fundraising or repaying), from Kiva's
 * lender SuperGraph: by partner id, and by the country's English name.
 */
export interface ActiveExposure {
  partner: ReadonlyMap<string, number>
  country: ReadonlyMap<string, number>
}

/** The per-slice counts Kiva's SuperGraph returns (criteriaStore.fetchBalancerData). */
export interface SliceCounts {
  slices: ReadonlyArray<{ id: string | number; name: string | null; value: number }>
}

/** Partner slices are keyed by partner id; country slices by Kiva's own number, with the English name in `name`. */
export function exposureFrom(partner: SliceCounts, country: SliceCounts): ActiveExposure {
  const byPartner = new Map<string, number>()
  for (const slice of partner.slices) byPartner.set(String(slice.id), (byPartner.get(String(slice.id)) ?? 0) + slice.value)
  const byCountry = new Map<string, number>()
  for (const slice of country.slices) {
    if (!slice.name) continue
    byCountry.set(slice.name, (byCountry.get(slice.name) ?? 0) + slice.value)
  }
  return { partner: byPartner, country: byCountry }
}

export interface ConcentrationWarning {
  dimension: 'partner' | 'country'
  /** The group's key in its dimension, so a warning can narrow the basket list to its loans. */
  key: string
  name: string
  partnerId?: number
  rating?: number | null
  /** Loans in this basket. */
  inBasket: number
  /** The lender's active Kiva loans there; 0 when not known. */
  active: number
  total: number
  /** The limit crossed: the lender would hold more than this many. */
  limit: number
  /** Red for a partner Kiva rates low or has not rated; amber otherwise. */
  severity: 'danger' | 'caution'
  loanIds: number[]
}

/**
 * Where the basket, with the lender's active loans when known, holds more loans
 * than the limits allow: partners first (red before amber), then countries,
 * each by how many loans ride on it. Direct loans have no partner to fail, and
 * sectors and activities are never warned about.
 */
export function concentrationWarnings(
  mix: BasketMix,
  active: ActiveExposure | null,
  limits: ConcentrationLimits,
): ConcentrationWarning[] {
  const partners: ConcentrationWarning[] = []
  for (const group of mix.dimensions.partner) {
    if (group.direct || group.partnerId == null) continue
    const held = active?.partner.get(String(group.partnerId)) ?? 0
    const total = group.count + held
    if (total <= limits.partner) continue
    partners.push({
      dimension: 'partner',
      key: group.key,
      name: group.name,
      partnerId: group.partnerId,
      rating: group.rating ?? null,
      inBasket: group.count,
      active: held,
      total,
      limit: limits.partner,
      severity: isLowRating(group.rating) ? 'danger' : 'caution',
      loanIds: group.loanIds,
    })
  }
  partners.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1) || b.total - a.total)

  const countries: ConcentrationWarning[] = []
  for (const group of mix.dimensions.country) {
    const held = active?.country.get(group.name) ?? 0
    const total = group.count + held
    if (total <= limits.country) continue
    countries.push({
      dimension: 'country',
      key: group.key,
      name: group.name,
      inBasket: group.count,
      active: held,
      total,
      limit: limits.country,
      severity: 'caution',
      loanIds: group.loanIds,
    })
  }
  countries.sort((a, b) => b.total - a.total)
  return [...partners, ...countries]
}

/** A breakdown row the basket list is narrowed to. */
export interface MixFilter {
  dimension: MixDimension
  key: string
}

/**
 * The narrowing as the address carries it (/basket?show=partner.p20): the dimension,
 * a dot, then the group's key. The dot is one of the few characters a query keeps
 * unescaped, and no dimension name contains one, so the first dot is the split.
 */
export function formatMixFilter(filter: MixFilter): string {
  return `${filter.dimension}.${filter.key}`
}

export function parseMixFilter(value: string | null | undefined): MixFilter | null {
  if (!value) return null
  const dot = value.indexOf('.')
  if (dot < 0) return null
  const dimension = value.slice(0, dot) as MixDimension
  if (!MIX_DIMENSIONS.includes(dimension)) return null
  return { dimension, key: value.slice(dot + 1) }
}

export function findGroup(mix: BasketMix, filter: MixFilter | null): MixGroup | null {
  if (!filter) return null
  return mix.dimensions[filter.dimension].find((g) => g.key === filter.key) ?? null
}
