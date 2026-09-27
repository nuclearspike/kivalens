/**
 * Usage statistics: whether this browser shares them, and the random number that
 * lets the collector count a returning browser once.
 *
 * The number is 128 random bits kept in this browser's storage (never a cookie,
 * so no request carries it except the report that is meant to). It is replaced,
 * never extended, once it is ID_LIFETIME_DAYS old, so no browser is followed for
 * longer than that. It is not derived from anything about the browser or the
 * lender, and nothing else in KivaLens reads it.
 *
 * The lender's own choice wins. Without one, a browser that sends Global Privacy
 * Control does not share, and every other browser does. Turning sharing off
 * deletes the number, so turning it back on starts a new one with no link to the
 * old. Storage that is blocked or broken shares nothing: a number that could not
 * be kept would be a new browser on every page load.
 */

export const USAGE_CHOICE_KEY = 'kl_usage'
export const USAGE_ID_KEY = 'kl_usage_id'
/** Thirteen months: long enough to count a monthly lender across a year, and no longer. */
export const ID_LIFETIME_DAYS = 395

export type UsageChoice = 'on' | 'off' | null

export interface UsageIdentity {
  id: string
  /** The day this number was made (UTC), which makes the browser new or returning. */
  born: string
}

const DAY_MS = 86_400_000
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
function changed() {
  for (const l of listeners) {
    try {
      l()
    } catch {
      // a listener's failure is its own
    }
  }
}

/** For the switch: called when this browser's choice changes here or in another tab. */
export function subscribeUsageChoice(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === USAGE_CHOICE_KEY || e.key === null) listener()
  }
  addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    removeEventListener('storage', onStorage)
  }
}

export function readUsageChoice(store: KeyValueStorage | null = storage()): UsageChoice {
  try {
    const v = store?.getItem(USAGE_CHOICE_KEY)
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}

/** Global Privacy Control, the browser-wide "do not share" signal. */
export function sendsGlobalPrivacyControl(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  try {
    return (nav as (Navigator & { globalPrivacyControl?: unknown }) | undefined)?.globalPrivacyControl === true
  } catch {
    return false
  }
}

export function usageAllowed(choice: UsageChoice = readUsageChoice(), gpc: boolean = sendsGlobalPrivacyControl()): boolean {
  if (choice === 'on') return true
  if (choice === 'off') return false
  return !gpc
}

/** The lender's choice from the switch. Off also forgets this browser's number. */
export function setUsageChoice(on: boolean, store: KeyValueStorage | null = storage()): void {
  try {
    store?.setItem(USAGE_CHOICE_KEY, on ? 'on' : 'off')
    if (!on) store?.removeItem(USAGE_ID_KEY)
  } catch {
    // Storage blocked: nothing is shared anyway (usageIdentity returns null).
  }
  changed()
}

function randomId(): string | null {
  try {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    // No secure randomness: no number, rather than a guessable one.
    return null
  }
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * This browser's number, made on first use and replaced once it is too old. Read
 * when a report is sent rather than at startup, so two tabs opened together, each
 * making a number, settle on whichever was written last before either reports.
 * Null when storage is unavailable.
 */
export function usageIdentity(now: number = Date.now(), store: KeyValueStorage | null = storage()): UsageIdentity | null {
  if (!store) return null
  try {
    const raw = JSON.parse(store.getItem(USAGE_ID_KEY) ?? 'null') as { id?: unknown; born?: unknown; ts?: unknown } | null
    if (
      raw && typeof raw.id === 'string' && ID_PATTERN.test(raw.id) &&
      typeof raw.born === 'string' && DAY_PATTERN.test(raw.born) &&
      typeof raw.ts === 'number' && Number.isFinite(raw.ts) && raw.ts <= now && now - raw.ts < ID_LIFETIME_DAYS * DAY_MS
    ) {
      return { id: raw.id, born: raw.born }
    }
    const id = randomId()
    if (!id) return null
    const made = { id, born: dayOf(now), ts: now }
    store.setItem(USAGE_ID_KEY, JSON.stringify(made))
    // Only a number that was actually kept is a browser; one that could not be
    // stored would be a new browser on every page load.
    const kept = JSON.parse(store.getItem(USAGE_ID_KEY) ?? 'null') as { id?: unknown; born?: unknown } | null
    return kept && typeof kept.id === 'string' && ID_PATTERN.test(kept.id) && typeof kept.born === 'string' && DAY_PATTERN.test(kept.born)
      ? { id: kept.id, born: kept.born }
      : null
  } catch {
    return null
  }
}

/**
 * The install number (Extras.install_id) earlier versions sent with a five-minute
 * heartbeat. Nothing sends or reads it, so it is removed rather than left in the
 * browser as an identifier with no purpose.
 */
export function forgetLegacyInstallId(store: KeyValueStorage | null = storage()): void {
  try {
    const raw = store?.getItem('Extras')
    if (!raw) return
    const extras = JSON.parse(raw) as Record<string, unknown> | null
    if (!extras || typeof extras !== 'object' || !('install_id' in extras)) return
    delete extras.install_id
    store?.setItem('Extras', JSON.stringify(extras))
  } catch {
    // leave it: harmless, and nothing sends it
  }
}
