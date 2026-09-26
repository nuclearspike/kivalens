import { create } from 'zustand'
import type { Criteria } from '../types'
import { EMPTY_HISTORY, MAX_ENTRIES, recordChange, recordStart, restoreEntry, type HistoryEntry, type HistoryState } from '../lib/criteriaHistory'
import { useCriteriaStore } from './criteriaStore'

/**
 * The criteria history, kept in this browser (it is the lender's own trail, not
 * something to share or sync) and recorded from every change to the search,
 * wherever it comes from: the criteria panel, Reset, a saved search, a partner's
 * Show loans, a link, the assistant. See src/lib/criteriaHistory.ts for how
 * typing and dragging become one entry each.
 */

const STORAGE_KEY = 'kl_criteria_history'
const SAVE_DELAY_MS = 400

function load(): HistoryState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as { version?: number; entries?: unknown } | null
    if (raw?.version !== 1 || !Array.isArray(raw.entries)) return EMPTY_HISTORY
    const entries = raw.entries.filter(
      (e): e is HistoryEntry =>
        !!e && typeof e === 'object' && typeof (e as HistoryEntry).id === 'string' &&
        Number.isFinite((e as HistoryEntry).at) && !!(e as HistoryEntry).criteria && typeof (e as HistoryEntry).criteria === 'object',
    )
    return { entries: entries.slice(0, MAX_ENTRIES), live: null }
  } catch {
    return EMPTY_HISTORY
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: HistoryState | null = null

function write() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (!pending) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: pending.entries }))
  } catch {
    // Storage full or blocked: the history still works for this visit.
  }
  pending = null
}

function save(state: HistoryState) {
  pending = state
  if (saveTimer) clearTimeout(saveTimer)
  // Not on every keystroke: the entry being typed is rewritten many times a second.
  saveTimer = setTimeout(write, SAVE_DELAY_MS)
}

interface CriteriaHistoryStore {
  history: HistoryState
  /**
   * The history as it was before the last Clear, while that can still be undone: in
   * memory only, and dropped at the next change, so an undo never loses a newer entry.
   */
  cleared: HistoryState | null
  /** Go back to an entry: it becomes the search, and the newest entry. */
  restore: (id: string) => void
  clear: () => void
  /** Undo the last Clear. */
  undoClear: () => void
}

export const useCriteriaHistory = create<CriteriaHistoryStore>((set, get) => ({
  history: typeof window === 'undefined' ? EMPTY_HISTORY : load(),
  cleared: null,
  restore: (id) => {
    const entry = get().history.entries.find((e) => e.id === id)
    if (!entry) return
    const history = restoreEntry(get().history, id, Date.now())
    set({ history, cleared: null })
    save(history)
    const criteria = useCriteriaStore.getState()
    // Criteria from the history are not the saved search the switcher last named;
    // its Re-save must not write them over that search.
    criteria.clearLastSwitch()
    criteria.setCriteria(structuredClone(entry.criteria) as Criteria)
  },
  clear: () => {
    // What is on screen stays, as the one entry: clearing the trail is not a reset.
    const current = useCriteriaStore.getState().lastKnown
    const history = recordStart(EMPTY_HISTORY, current, Date.now())
    set({ history, cleared: get().history })
    save(history)
  },
  undoClear: () => {
    const before = get().cleared
    if (!before) return
    set({ history: before, cleared: null })
    save(before)
  },
}))

/**
 * Starts recording. Returns the unsubscribe. The search the lender arrived with
 * is recorded first, so there is always a way back to it.
 */
export function startCriteriaHistory(): () => void {
  const initial = recordStart(useCriteriaHistory.getState().history, useCriteriaStore.getState().lastKnown, Date.now())
  if (initial !== useCriteriaHistory.getState().history) {
    useCriteriaHistory.setState({ history: initial })
    save(initial)
  }
  // A page closed within the write delay still keeps its last change.
  window.addEventListener('pagehide', write)
  const unsubscribe = useCriteriaStore.subscribe((state, previous) => {
    if (state.lastKnown === previous.lastKnown) return
    const current = useCriteriaHistory.getState().history
    const next = recordChange(current, previous.lastKnown, state.lastKnown, Date.now())
    if (next === current) return
    useCriteriaHistory.setState({ history: next, cleared: null })
    save(next)
  })
  return () => {
    window.removeEventListener('pagehide', write)
    unsubscribe()
  }
}

/** Tests only: forget recorded state. */
export function resetCriteriaHistoryForTests() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  pending = null
  useCriteriaHistory.setState({ history: EMPTY_HISTORY, cleared: null })
}
