/**
 * Visits: when the lender was last here, so the Search page can say what changed
 * since (src/lib/searchStages.ts). Kept in this browser only (localStorage
 * kl_visits), never sent anywhere.
 *
 * A visit ends when the lender has been away for NEW_VISIT_GAP_MS. A reload, or a
 * second tab, a few minutes later is the same visit, so "since your last visit" never
 * means "since a minute ago". While a tab is open and visible, `seen` is refreshed
 * every few minutes and when it is hidden, so a long session is one visit however it
 * ends.
 */

export const VISITS_KEY = 'kl_visits'
/** Away this long, and the next page load is a new visit. The usual web-analytics session gap. */
export const NEW_VISIT_GAP_MS = 30 * 60_000
const SEEN_EVERY_MS = 5 * 60_000

export interface VisitRecord {
  /** When this visit began (ms). */
  start: number
  /** The last moment a page of this visit was known to be open (ms). */
  seen: number
  /** When the lender's previous visit ended, or null when this browser has no earlier visit on record. */
  previousEnd: number | null
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

function storage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function read(store: KeyValueStorage | null): VisitRecord | null {
  try {
    const raw = JSON.parse(store?.getItem(VISITS_KEY) ?? 'null') as Partial<VisitRecord> | null
    if (!raw || typeof raw.start !== 'number' || typeof raw.seen !== 'number') return null
    const previousEnd = typeof raw.previousEnd === 'number' ? raw.previousEnd : null
    return { start: raw.start, seen: raw.seen, previousEnd }
  } catch {
    return null
  }
}

function write(store: KeyValueStorage | null, record: VisitRecord): void {
  try {
    store?.setItem(VISITS_KEY, JSON.stringify(record))
  } catch {
    // Storage full or blocked: this visit is simply not remembered.
  }
}

/** The visit a page load belongs to: the same one continued, or a new one after a gap. */
export function nextVisit(stored: VisitRecord | null, now: number): VisitRecord {
  // A record from the future (the clock was changed) says nothing about when the
  // lender was last here.
  if (!stored || stored.seen > now) return { start: now, seen: now, previousEnd: null }
  if (now - stored.seen > NEW_VISIT_GAP_MS) return { start: now, seen: now, previousEnd: stored.seen }
  return { ...stored, seen: now }
}

let current: VisitRecord | null = null

/** This page load's visit, worked out on first use and remembered for the page's life. */
export function currentVisit(now: number = Date.now(), store: KeyValueStorage | null = storage()): VisitRecord {
  if (!current) {
    current = nextVisit(read(store), now)
    write(store, current)
    startSeenUpdates(store)
  }
  return current
}

let updating = false
function startSeenUpdates(store: KeyValueStorage | null): void {
  if (updating || typeof window === 'undefined') return
  updating = true
  const touch = () => {
    if (!current) return
    current = { ...current, seen: Date.now() }
    write(store, current)
  }
  try {
    setInterval(() => {
      if (document.visibilityState === 'visible') touch()
    }, SEEN_EVERY_MS)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') touch()
    })
    addEventListener('pagehide', touch)
  } catch {
    // no timers or events: the visit is remembered from its start only
  }
}

/** Tests only. */
export function resetVisitForTests(): void {
  current = null
}
