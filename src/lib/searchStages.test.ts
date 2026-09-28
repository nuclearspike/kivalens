import { describe, expect, it } from 'vitest'
import { CHECKOUT_FRESH_MS, FEW_RESULTS, greeting, searchStages, type StageInput } from './searchStages'
import { NEW_VISIT_GAP_MS, nextVisit } from './visits'

/**
 * Paul, 2026-09-27: "for many users this isn't their first rodeo. So, let's come up
 * with at least 8 different stages a user could be in ... build pages for each one."
 * Each rule below is one stage; several apply at once, most pressing first.
 */

const NOW = Date.UTC(2026, 8, 27, 18)
const H = 3_600_000
const base: StageInput = {
  now: NOW, onLinkedSearch: false, pendingCheckout: null, basketCount: 0, loansReady: true, resultCount: 6000,
  searchIsDefault: true, searchUnchangedThisVisit: true, searchFromEarlierVisit: false, previousVisitEnd: null,
  ownSavedSearchCount: 0, historyBeforeVisit: false, lenderId: '',
}
const stages = (over: Partial<StageInput>) => searchStages({ ...base, ...over })

describe('the stages a lender can be in when Search opens', () => {
  it('first visit: nothing of theirs is here yet', () => {
    expect(stages({})).toEqual(['first_visit'])
    expect(greeting(stages({}))).toBe('welcome')
  })

  it('a search from a link leads, and a newcomer who followed it still gets the start card', () => {
    expect(stages({ onLinkedSearch: true, searchIsDefault: false })).toEqual(['link', 'first_visit'])
    expect(stages({ onLinkedSearch: true, searchIsDefault: false, previousVisitEnd: NOW - 48 * H })).toEqual(['link', 'new_since', 'lender_pitch'])
  })

  it('back from Kiva: a checkout handed over within the last day, and only then', () => {
    const at = NOW - 2 * H
    expect(stages({ pendingCheckout: { ids: [1, 2], at }, basketCount: 2 })).toEqual(['back_from_kiva', 'basket', 'lender_pitch'])
    expect(greeting(stages({ pendingCheckout: { ids: [1], at }, basketCount: 1 }))).toBe('back_from_kiva')
    expect(stages({ pendingCheckout: { ids: [1], at: NOW - CHECKOUT_FRESH_MS }, basketCount: 1 })).not.toContain('back_from_kiva')
    // A hand-off stamped in the future (a changed clock) is not news either.
    expect(stages({ pendingCheckout: { ids: [1], at: NOW + H }, basketCount: 1 })).not.toContain('back_from_kiva')
  })

  it('a basket waiting, whoever the lender is', () => {
    expect(stages({ basketCount: 3 })).toEqual(['basket', 'lender_pitch'])
    expect(stages({ basketCount: 3, lenderId: 'jane' })).toEqual(['basket', 'lender'])
  })

  it('a handful of results suggests widening; none has its own help in the list, and nothing before loans load', () => {
    expect(stages({ resultCount: FEW_RESULTS })).toContain('few_results')
    expect(stages({ resultCount: FEW_RESULTS + 1 })).not.toContain('few_results')
    expect(stages({ resultCount: 0 })).not.toContain('few_results')
    expect(stages({ resultCount: 2, loansReady: false })).not.toContain('few_results')
  })

  it('new since the last visit, once a previous visit is on record', () => {
    expect(stages({ previousVisitEnd: NOW - 30 * H })).toEqual(['new_since', 'lender_pitch'])
  })

  it('continuing: a search left here on an earlier visit and not touched yet', () => {
    const kept = { searchIsDefault: false, searchFromEarlierVisit: true, previousVisitEnd: NOW - 30 * H }
    expect(stages(kept)).toContain('continuing')
    expect(stages({ ...kept, searchUnchangedThisVisit: false })).not.toContain('continuing')
    expect(stages({ ...kept, searchIsDefault: true })).not.toContain('continuing')
    expect(stages({ ...kept, searchFromEarlierVisit: false })).not.toContain('continuing')
    // A linked search is not "where you left off", even when it happens to be old.
    expect(stages({ ...kept, onLinkedSearch: true })).not.toContain('continuing')
  })

  it('saved searches of their own', () => {
    expect(stages({ ownSavedSearchCount: 2 })).toEqual(['saved', 'lender_pitch'])
  })

  it('with a lender ID, their own portfolio; without one, only a returning lender is asked for it', () => {
    expect(stages({ lenderId: 'jane' })).toEqual(['lender'])
    expect(stages({ historyBeforeVisit: true })).toEqual(['lender_pitch'])
    expect(stages({})).not.toContain('lender_pitch')
  })

  it('everything at once, most pressing first', () => {
    expect(
      stages({
        onLinkedSearch: true, pendingCheckout: { ids: [1], at: NOW - H }, basketCount: 4, resultCount: 3, searchIsDefault: false,
        searchFromEarlierVisit: true, previousVisitEnd: NOW - 72 * H, ownSavedSearchCount: 5, historyBeforeVisit: true, lenderId: 'jane',
      }),
    ).toEqual(['link', 'back_from_kiva', 'basket', 'few_results', 'new_since', 'saved', 'lender'])
    expect(greeting(stages({ lenderId: 'jane' }))).toBe('welcome_back')
  })
})

describe('what counts as a visit', () => {
  it('the first page load in this browser has no previous visit', () => {
    expect(nextVisit(null, NOW)).toEqual({ start: NOW, seen: NOW, previousEnd: null })
  })

  it('a reload or another tab within half an hour is the same visit', () => {
    const v = { start: NOW - 10 * 60_000, seen: NOW - 5 * 60_000, previousEnd: NOW - 30 * H }
    expect(nextVisit(v, NOW)).toEqual({ ...v, seen: NOW })
  })

  it('after half an hour away, a new visit begins and the last one ended when it was last seen', () => {
    const v = { start: NOW - 5 * H, seen: NOW - NEW_VISIT_GAP_MS - 1, previousEnd: null }
    expect(nextVisit(v, NOW)).toEqual({ start: NOW, seen: NOW, previousEnd: NOW - NEW_VISIT_GAP_MS - 1 })
  })

  it('a record from the future says nothing about the last visit', () => {
    expect(nextVisit({ start: NOW + H, seen: NOW + H, previousEnd: null }, NOW).previousEnd).toBeNull()
  })
})
