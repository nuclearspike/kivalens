// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIELD_GROUP } from '../../../server/criteriaFields.mjs'
import { ROUTES } from '../../../server/routeMap.mjs'
import { CRITERIA, EVENTS, PAGES, PRESET_KEYS } from '../../../cloudflare/rum/src/labels'
import { useCriteriaHistory } from '../../stores/criteriaHistoryStore'
import { DEFAULT_SAVED_SEARCH_NAMES, useCriteriaStore } from '../../stores/criteriaStore'
import { useLoanStore } from '../../stores/loanStore'
import { useUtilsStore } from '../../stores/utilsStore'
import type { Criteria } from '../../types'
import { freshCriteria } from '../freshCriteria'
import {
  ID_LIFETIME_DAYS, USAGE_CHOICE_KEY, USAGE_ID_KEY, forgetLegacyInstallId, readUsageChoice, sendsGlobalPrivacyControl,
  setUsageChoice, usageAllowed, usageIdentity,
} from './identity'
import { criteriaTokens, readUsage, startUsageTracking, usagePayload } from './usage'
import { MAX_SEARCHES, USAGE_EVENTS, noteEvent, noteRoute, noteSearch, resetUsageEventsForTests } from './usageEvents'

/**
 * Usage statistics on the page. Paul, 2026-09-26: know how many people use
 * KivaLens each month, how many separate browsers and lender IDs, how many
 * searches they run and which criteria they use, to design basic / medium /
 * advanced from what people actually do. What is sent must never include what a
 * lender searched for.
 */

const crit = (loan: Record<string, unknown> = {}, partner: Record<string, unknown> = {}, portfolio: Record<string, unknown> = {}) =>
  ({ loan, partner, portfolio }) as unknown as Criteria
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 10, 12)

beforeEach(() => {
  localStorage.clear()
  resetUsageEventsForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the browser number', () => {
  it('is made once, kept, and read back the same', () => {
    const a = usageIdentity(NOW)
    expect(a?.id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(a?.born).toBe('2026-10-10')
    expect(usageIdentity(NOW + 30 * DAY)).toEqual(a)
  })

  it('is replaced, not extended, once it is 13 months old', () => {
    const a = usageIdentity(NOW)!
    expect(usageIdentity(NOW + (ID_LIFETIME_DAYS - 1) * DAY)).toEqual(a)
    const b = usageIdentity(NOW + ID_LIFETIME_DAYS * DAY)!
    expect(b.id).not.toBe(a.id)
    expect(b.born).toBe(new Date(NOW + ID_LIFETIME_DAYS * DAY).toISOString().slice(0, 10))
  })

  it('is replaced when what is stored is not one', () => {
    localStorage.setItem(USAGE_ID_KEY, JSON.stringify({ id: 'lender-jane', born: '2026-10-01', ts: NOW }))
    expect(usageIdentity(NOW)?.id).not.toBe('lender-jane')
  })

  it('does not exist when storage cannot keep it: a number made per page load would count every load as a browser', () => {
    const broken = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    expect(usageIdentity(NOW, broken)).toBeNull()
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => undefined }
    expect(usageIdentity(NOW, throwing)).toBeNull()
    expect(usageIdentity(NOW, null)).toBeNull()
  })
})

describe('the lender’s choice', () => {
  it('is on unless the browser sends Global Privacy Control; an explicit choice wins either way', () => {
    expect(usageAllowed(null, false)).toBe(true)
    expect(usageAllowed(null, true)).toBe(false)
    expect(usageAllowed('on', true)).toBe(true)
    expect(usageAllowed('off', false)).toBe(false)
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true })
    expect(sendsGlobalPrivacyControl()).toBe(true)
  })

  it('turned off, forgets the number; turned back on, starts a new one with no link to the old', () => {
    const a = usageIdentity(NOW)!
    setUsageChoice(false)
    expect(readUsageChoice()).toBe('off')
    expect(localStorage.getItem(USAGE_ID_KEY)).toBeNull()
    setUsageChoice(true)
    expect(localStorage.getItem(USAGE_CHOICE_KEY)).toBe('on')
    expect(usageIdentity(NOW)!.id).not.toBe(a.id)
  })

  it('removes the install number the old heartbeat kept, and nothing else', () => {
    localStorage.setItem('Extras', JSON.stringify({ install_id: 'i_123456', other: 1 }))
    forgetLegacyInstallId()
    expect(JSON.parse(localStorage.getItem('Extras')!)).toEqual({ other: 1 })
  })
})

describe('which criteria a search used', () => {
  it('names the criteria, never their values', () => {
    const tokens = criteriaTokens(crit({ sector: 'Retail,Food', sector_all_any_none: 'none', country_code: 'KE', name: 'jane', use: 'goats', age_min: 18, age_max: 40, sort: 'newest' }))
    expect(tokens).toEqual(['age', 'country_code', 'mode:both', 'name', 'sector', 'sector:none', 'sort', 'sort:newest', 'use'])
    for (const secret of ['Retail', 'Food', 'KE', 'jane', 'goats', '18', '40']) expect(tokens.join(' ')).not.toContain(secret)
  })

  it('an untouched search uses nothing but its mode', () => {
    expect(criteriaTokens(crit())).toEqual(['mode:both'])
  })

  it('does not credit the lender with what Reset sets; changing it is a choice', () => {
    expect(criteriaTokens(freshCriteria())).toEqual(['mode:both'])
    const fresh = freshCriteria()
    expect(criteriaTokens({ ...fresh, portfolio: { ...fresh.portfolio, exclude_portfolio_loans: 'false' } } as Criteria)).toEqual(['exclude_portfolio_loans', 'mode:both'])
  })

  it('counts partner criteria only in MFI Only, where they apply', () => {
    const partner = { partner_risk_rating_min: 3, region: 'af', region_all_any_none: 'all' }
    expect(criteriaTokens(crit({}, { ...partner, direct: 'both' }))).toEqual(['mode:both'])
    expect(criteriaTokens(crit({}, { ...partner, direct: 'mfi' }))).toEqual(['mode:mfi', 'partner_risk_rating', 'region', 'region:all'])
    // Balance by partner means MFI Only, and is kept out of a deliberate Both.
    const balance = { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active' } }
    expect(criteriaTokens(crit({}, {}, balance))).toEqual(['mode:mfi', 'pb_partner'])
    expect(criteriaTokens(crit({}, { direct: 'both' }, balance))).toEqual(['mode:both'])
  })

  it('names a limit by what it groups by, and a balancer by what it balances', () => {
    expect(criteriaTokens(crit({ limit_to: { enabled: true, count: 1, limit_by: 'Country' } }))).toEqual(['limit_to', 'limit_to:country', 'mode:both'])
    const pb = { pb_country: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } }
    expect(criteriaTokens(crit({}, {}, pb))).toEqual(['mode:both', 'pb_country'])
  })
})

describe('what a page load reports', () => {
  it('counts searches and, per criterion, the searches that used it; a refined search counts once', () => {
    noteSearch('h1', crit({ sector: 'Retail' }))
    noteSearch('h2', crit({ sector: 'Food', age_min: 20 }))
    noteSearch('h2', crit({ sector: 'Food', age_min: 25 })) // the same search, refined
    noteRoute('loan')
    noteRoute('loan')
    noteEvent('basket_add', 2)
    const u = readUsage()
    expect(u.searches).toBe(2)
    expect(u.c).toEqual({ 'mode:both': 2, sector: 2, age: 1 })
    expect(u.p).toEqual({ loan: 2 })
    expect(u.e).toEqual({ basket_add: 2 })
  })

  it('never counts a name of the wrong shape, and stops at the caps', () => {
    noteRoute('/loans/123')
    noteEvent('Basket Add' as never)
    for (let i = 0; i < MAX_SEARCHES + 10; i++) noteSearch(`h${i}`, crit())
    const u = readUsage()
    expect(u.p).toEqual({})
    expect(u.e).toEqual({})
    expect(u.searches).toBe(MAX_SEARCHES)
  })

  it('follows the criteria history, the basket and checkout', () => {
    useCriteriaHistory.setState({ history: { entries: [{ id: 'arrived', at: NOW, criteria: crit({ sector: 'Retail' }) }], live: null }, cleared: null })
    useLoanStore.setState({ basket: [{ loan_id: 1, amount: 25 }], pendingCheckout: null })
    const stop = startUsageTracking()
    try {
      // A new entry is a new search; the same entry refined is not.
      const e1 = { id: 'next', at: NOW, criteria: crit({ age_min: 30 }) }
      useCriteriaHistory.setState({ history: { entries: [e1, ...useCriteriaHistory.getState().history.entries], live: null } })
      useCriteriaHistory.setState({ history: { entries: [{ ...e1, criteria: crit({ age_min: 31 }) }, ...useCriteriaHistory.getState().history.entries.slice(1)], live: null } })
      // Clearing the history keeps the same search on top under a new id: not a search.
      useCriteriaHistory.setState({ history: { entries: [{ id: 'cleared', at: NOW, criteria: crit({ age_min: 31 }) }], live: null } })
      useLoanStore.setState({ basket: [{ loan_id: 1, amount: 25 }, { loan_id: 2, amount: 25 }, { loan_id: 3, amount: 25 }] })
      useLoanStore.setState({ pendingCheckout: { ids: [1, 2, 3], at: NOW } })
      const u = readUsage()
      expect(u.searches).toBe(2)
      expect(u.c).toEqual({ 'mode:both': 2, sector: 1, age: 1 })
      expect(u.e).toEqual({ basket_add: 2, checkout: 1, checkout_loans: 3 })
    } finally {
      stop()
    }
  })

  it('carries the usage part only when this browser shares it, with whether a lender ID is set and never the ID', () => {
    useUtilsStore.setState({ lenderId: 'jane1987' })
    const own = { loan: {}, partner: {}, portfolio: {} }
    useCriteriaStore.setState({ savedSearches: { popular: own, 'My goats': own, 'Women in Kenya': own } as never })
    noteSearch('h1', crit({ sector: 'Retail' }))
    const u = usagePayload(NOW)!
    expect(u).toMatchObject({ lender: 1, saved: 2, searches: 1, born: '2026-10-10' })
    expect(JSON.stringify(u)).not.toContain('jane1987')
    expect(JSON.stringify(u)).not.toContain('goats')
    expect(JSON.stringify(u)).not.toContain('Retail')
    setUsageChoice(false)
    expect(usagePayload(NOW)).toBeUndefined()
  })
})

describe('the dashboard can name everything the page reports', () => {
  it('every criterion field, page and action has a name', () => {
    for (const field of FIELD_GROUP.keys()) {
      if (field.endsWith('_all_any_none') || field === 'direct') continue
      expect(CRITERIA[field], field).toBeTruthy()
    }
    for (const route of ROUTES) expect(PAGES[route.id], route.id).toBeTruthy()
    for (const extra of ['root', 'other']) expect(PAGES[extra], extra).toBeTruthy()
    for (const event of USAGE_EVENTS) expect(EVENTS[event], event).toBeTruthy()
    expect([...PRESET_KEYS].sort()).toEqual([...DEFAULT_SAVED_SEARCH_NAMES].sort())
  })
})
