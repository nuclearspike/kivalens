import { describe, expect, it } from 'vitest'
import type { Criteria } from '../types'
import {
  COALESCE_MS,
  EMPTY_HISTORY,
  MAX_ENTRIES,
  changedPaths,
  criteriaKey,
  recordChange,
  recordStart,
  restoreEntry,
  type HistoryState,
} from './criteriaHistory'

/**
 * Paul, 2026-09-25: "if someone is typing 'j' 'a' 'n' 'e' our search is so fast
 * that we wouldn't want to have separate entries for each of those. each new one
 * replaces the previous so long as the text is building on it. if they delete
 * back to 'j' and then add 'jen' there would be a 'jane' entry and a 'jen' entry
 * without any in-between".
 */

const crit = (loan: Record<string, unknown> = {}, partner: Record<string, unknown> = {}): Criteria =>
  ({ loan, partner, portfolio: {} }) as Criteria

/** Plays a sequence of searches through the recorder, one second apart unless told otherwise. */
function play(steps: Array<Criteria | [Criteria, number]>, start: HistoryState = EMPTY_HISTORY, t0 = 1_000_000) {
  let state = start
  let previous: Criteria = crit()
  let now = t0
  for (const step of steps) {
    const [next, gap] = Array.isArray(step) ? step : [step, 1000]
    now += gap
    state = recordChange(state, previous, next, now)
    previous = next
  }
  return state
}

const names = (state: HistoryState) => state.entries.map((e) => (e.criteria.loan as Record<string, unknown>).name ?? '')

describe('typing a name', () => {
  it('is one entry while the text grows', () => {
    const state = play(['j', 'ja', 'jan', 'jane'].map((name) => crit({ name })))
    expect(names(state)).toEqual(['jane'])
  })

  it('records nothing while deleting, and a new entry when typing again: jane, then jen, nothing between', () => {
    const state = play(['j', 'ja', 'jan', 'jane', 'jan', 'ja', 'j', 'je', 'jen'].map((name) => crit({ name })))
    expect(names(state)).toEqual(['jen', 'jane'])
  })

  it('replaces its entry however long the pause, while the text builds on it', () => {
    const state = play([crit({ name: 'jane' }), [crit({ name: 'jane d' }), 10 * 60_000], crit({ name: 'jane doe' })])
    expect(names(state)).toEqual(['jane doe'])
  })

  it('starts a new entry for text that does not build on the last (a paste over it)', () => {
    const state = play([crit({ name: 'jane' }), crit({ name: 'maria' })])
    expect(names(state)).toEqual(['maria', 'jane'])
  })

  it('starts a new entry for the same text after another control was changed', () => {
    const state = play([crit({ name: 'jane' }), crit({ name: 'jane', sector: 'Food' }), crit({ name: 'jane doe', sector: 'Food' })])
    expect(state.entries).toHaveLength(3)
  })

  it('treats Use the same way as Name', () => {
    const state = play(['f', 'fa', 'far', 'farm'].map((use) => crit({ use })))
    expect(state.entries).toHaveLength(1)
  })
})

describe('other controls', () => {
  it('make one entry of one gesture: a slider dragged', () => {
    const drag = [100, 200, 300, 450].map((min) => [crit({ loan_amount_min: min }), 50] as [Criteria, number])
    expect(play(drag).entries).toHaveLength(1)
  })

  it('make separate entries when changed again after a pause', () => {
    const state = play([crit({ loan_amount_min: 100 }), [crit({ loan_amount_min: 500 }), COALESCE_MS + 1]])
    expect(state.entries).toHaveLength(2)
  })

  it('never merge a change to one control into a change to another', () => {
    const state = play([[crit({ sector: 'Food' }), 50], [crit({ sector: 'Food', country_code: 'KE' }), 50]])
    expect(state.entries).toHaveLength(2)
  })

  it('always record a change to several things at once as its own entry (a saved search, Reset, a link)', () => {
    const state = play([[crit({ sector: 'Food' }), 50], [crit({ sector: 'Retail', country_code: 'KE' }), 50]])
    expect(state.entries).toHaveLength(2)
  })
})

describe('the list', () => {
  it('holds each search once: coming back to one moves it to the top', () => {
    const food = crit({ sector: 'Food' })
    const retail = crit({ sector: 'Retail' })
    const state = play([food, [retail, COALESCE_MS + 1], [food, COALESCE_MS + 1]])
    expect(state.entries.map((e) => (e.criteria.loan as Record<string, unknown>).sector)).toEqual(['Food', 'Retail'])
  })

  it('keeps the newest fifty', () => {
    const steps = Array.from({ length: 60 }, (_, i) => [crit({ loan_amount_min: i + 1 }), COALESCE_MS + 1] as [Criteria, number])
    const state = play(steps)
    expect(state.entries).toHaveLength(MAX_ENTRIES)
    expect((state.entries[0].criteria.loan as Record<string, unknown>).loan_amount_min).toBe(60)
  })

  it('starts with the search the lender arrived with, so there is a way back to it', () => {
    const start = recordStart(EMPTY_HISTORY, crit({ sector: 'Food' }), 1)
    expect(start.entries).toHaveLength(1)
    expect(recordStart(start, crit({ sector: 'Food' }), 2)).toBe(start)
  })

  it('makes a search it goes back to the newest, dated now', () => {
    const state = play([crit({ sector: 'Food' }), [crit({ sector: 'Retail' }), COALESCE_MS + 1]])
    const older = state.entries[1]
    const restored = restoreEntry(state, older.id, 9_999_999)
    expect(restored.entries[0]).toMatchObject({ id: older.id, at: 9_999_999 })
    expect(restored.entries).toHaveLength(2)
    // And applying it adds nothing: the top already is that search.
    expect(recordChange(restored, state.entries[0].criteria, older.criteria, 10_000_000).entries).toEqual(restored.entries)
  })
})

describe('what counts as a change', () => {
  it('is what a search sets, not how it is written down', () => {
    expect(criteriaKey(crit({ sector: 'Food', name: '' }, { region: undefined }))).toBe(criteriaKey(crit({ sector: 'Food' })))
    expect(criteriaKey({ portfolio: {}, partner: {}, loan: { b: 1, a: 2 } } as unknown as Criteria)).toBe(criteriaKey(crit({ a: 2, b: 1 })))
    expect(changedPaths(crit({ sector: 'Food' }), crit({ sector: 'Food', name: '' }))).toEqual([])
    expect(changedPaths(crit({ sector: 'Food' }), crit({ sector: 'Retail' }, { partners: '5' }))).toEqual(['loan.sector', 'partner.partners'])
  })
})
