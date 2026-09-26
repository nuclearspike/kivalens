import type { Criteria } from '../types'

/**
 * The criteria history: every search the lender has had, newest first, each
 * with when it began. Paul, 2026-09-25.
 *
 * Typing is one change, not one per key. The search is fast enough to run on
 * every keystroke, so "j", "ja", "jan", "jane" would otherwise be four entries.
 * While a Name or Use text grows, it replaces its own entry; deleting records
 * nothing; typing again after deleting starts a new entry. Typing "jane",
 * deleting back to "j" and typing "jen" leaves "jane" and "jen", nothing between.
 *
 * Other controls coalesce the same way while one of them is changed repeatedly
 * in quick succession (a slider dragged, several sectors picked in a row), so a
 * single gesture is a single entry. A change to several things at once — a
 * saved search loaded, Reset, a link — is always its own entry.
 *
 * The list holds each search once: returning to a search moves it to the top.
 */

export interface HistoryEntry {
  id: string
  /** When the lender arrived at this search, ms since epoch. */
  at: number
  criteria: Criteria
}

export interface HistoryState {
  entries: HistoryEntry[]
  /** The field whose changes currently replace the newest entry, and when it last changed. */
  live: { path: string; at: number } | null
}

export const MAX_ENTRIES = 50
/** How close together repeated changes to one control must be to count as one gesture. */
export const COALESCE_MS = 1500
/** Free text: grows letter by letter, and follows the typing rule above. */
export const TEXT_PATHS: ReadonlySet<string> = new Set(['loan.name', 'loan.use'])

export const EMPTY_HISTORY: HistoryState = { entries: [], live: null }

type Leaves = Map<string, unknown>

/** Every set value by its path ("loan.sector"), ignoring what is empty. */
function leaves(value: unknown, prefix = '', out: Leaves = new Map()): Leaves {
  if (value === null || value === undefined || value === '') return out
  if (Array.isArray(value)) {
    if (value.length) out.set(prefix, value.join(','))
    return out
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) leaves(v, prefix ? `${prefix}.${k}` : k, out)
    return out
  }
  out.set(prefix, String(value))
  return out
}

/** A search's identity: what it sets, regardless of key order or empty values. */
export function criteriaKey(c: Criteria): string {
  return JSON.stringify([...leaves(c)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

export function changedPaths(before: Criteria, after: Criteria): string[] {
  const a = leaves(before)
  const b = leaves(after)
  const paths = new Set([...a.keys(), ...b.keys()])
  return [...paths].filter((p) => a.get(p) !== b.get(p)).sort()
}

let counter = 0
const newId = (now: number) => `${now.toString(36)}-${(counter++).toString(36)}`

function withTop(state: HistoryState, criteria: Criteria, now: number, replaceTop: boolean, live: HistoryState['live']): HistoryState {
  const key = criteriaKey(criteria)
  const rest = (replaceTop ? state.entries.slice(1) : state.entries).filter((e) => criteriaKey(e.criteria) !== key)
  const top: HistoryEntry = replaceTop && state.entries[0]
    ? { ...state.entries[0], criteria }
    : { id: newId(now), at: now, criteria }
  return { entries: [top, ...rest].slice(0, MAX_ENTRIES), live }
}

/** The history after the criteria went from `before` to `after` at `now`. */
export function recordChange(state: HistoryState, before: Criteria, after: Criteria, now: number): HistoryState {
  const paths = changedPaths(before, after)
  if (paths.length === 0) return state
  const top = state.entries[0]
  if (top && criteriaKey(top.criteria) === criteriaKey(after)) return { ...state, live: null }

  if (paths.length === 1) {
    const path = paths[0]
    if (TEXT_PATHS.has(path)) {
      const was = String(leaves(before).get(path) ?? '')
      const is = String(leaves(after).get(path) ?? '')
      // Deleting records nothing, and ends the run: typing again is a new entry.
      if (is.length < was.length && was.startsWith(is)) return { ...state, live: null }
      const growing = is.startsWith(was)
      const replace = growing && state.live?.path === path && !!top
      return withTop(state, after, now, replace, { path, at: now })
    }
    const replace = !!top && state.live?.path === path && now - state.live.at <= COALESCE_MS
    return withTop(state, after, now, replace, { path, at: now })
  }
  return withTop(state, after, now, false, null)
}

/**
 * The search the lender started from, recorded before their first change when
 * the history does not already end with it — so the way back to it is there.
 */
export function recordStart(state: HistoryState, current: Criteria, now: number): HistoryState {
  const top = state.entries[0]
  if (top && criteriaKey(top.criteria) === criteriaKey(current)) return state
  return withTop(state, current, now, false, null)
}

/** Going back to an entry makes it the newest: it is the search in force from now. */
export function restoreEntry(state: HistoryState, id: string, now: number): HistoryState {
  const entry = state.entries.find((e) => e.id === id)
  if (!entry) return state
  return { entries: [{ ...entry, at: now }, ...state.entries.filter((e) => e.id !== id)], live: null }
}
