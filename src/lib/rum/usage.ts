import { criteriaToParams } from '../../../server/criteriaUrl.mjs'
import { BALANCER_SET, FIELD_GROUP, LIMIT_BY_VALUES } from '../../../server/criteriaFields.mjs'
import { resolvePartnerMode } from '../../../server/loanFilter.mjs'
import { useCriteriaHistory } from '../../stores/criteriaHistoryStore'
import { DEFAULT_SAVED_SEARCH_NAMES, useCriteriaStore } from '../../stores/criteriaStore'
import { useLoanStore } from '../../stores/loanStore'
import { useUtilsStore } from '../../stores/utilsStore'
import type { Criteria } from '../../types'
import { criteriaKey } from '../criteriaHistory'
import { SORT_OPTIONS } from '../criteriaOptions'
import { freshCriteria } from '../freshCriteria'
import { usageAllowed, usageIdentity } from './identity'
import type { UsagePayload } from './payload'
import { MAX_NAMES, noteEvent, noteSearch, readUsageEvents } from './usageEvents'

/**
 * Usage statistics for this page load: how many searches the lender had and
 * which criteria each one used, which pages they went to, and a few actions
 * (basket adds, checkouts, saved searches loaded). They say how KivaLens is used
 * well enough to decide which filters belong to a basic, a medium and an
 * advanced view (Paul, 2026-09-26), without ever saying what anyone searched for.
 *
 * A criterion is reported by its name only ("sector", "age"), with the list's
 * mode when it is All or None ("sector:none"), the sort chosen and the grouping
 * of a Limit to, because those are choices among KivaLens's own options. Never a
 * value the lender typed or picked: no country, sector, partner, name or use.
 */

const SORT_VALUES: ReadonlySet<string> = new Set(SORT_OPTIONS.map((o) => String(o.value)).filter(Boolean))
const LIMIT_BY: ReadonlySet<string> = new Set(LIMIT_BY_VALUES)

/** The same search with its partner criteria out: they apply only in MFI Only, and anywhere else they are kept but not in use. */
function withoutPartnerCriteria(c: Criteria): Criteria {
  const partner = (c.partner ?? {}) as Record<string, unknown>
  const portfolio = { ...((c.portfolio ?? {}) as Record<string, unknown>) }
  delete portfolio.pb_partner
  return { ...c, partner: { direct: partner.direct }, portfolio } as unknown as Criteria
}

const tokenCache = new WeakMap<object, string[]>()

/**
 * What Reset sets (freshCriteria), as parameters. A setting Reset itself makes, such
 * as leaving the lender's own loans out, is not a criterion the lender chose; the
 * criteria history describes a search against the same baseline.
 */
let resetParams: Map<string, string> | null = null
function isResetDefault(name: string, value: string): boolean {
  if (!resetParams) {
    try {
      resetParams = new Map(criteriaToParams(freshCriteria()))
    } catch {
      resetParams = new Map()
    }
  }
  return resetParams.get(name) === value
}

/** The names of the criteria a search uses, as the report carries them. */
export function criteriaTokens(criteria: Criteria): string[] {
  if (!criteria || typeof criteria !== 'object') return []
  const cached = tokenCache.get(criteria)
  if (cached) return cached
  const out = new Set<string>()
  let mode = 'both'
  try {
    mode = resolvePartnerMode(criteria)
  } catch {
    // an unreadable search is reported as Both
  }
  out.add(`mode:${mode}`)
  let params: URLSearchParams | null
  try {
    params = criteriaToParams(mode === 'mfi' ? criteria : withoutPartnerCriteria(criteria))
  } catch {
    params = null
  }
  for (const [name, value] of params ?? []) {
    if (name === 'direct' || !FIELD_GROUP.has(name) || isResetDefault(name, value)) continue
    out.add(name)
    if (name === 'sort') {
      if (SORT_VALUES.has(value)) out.add(`sort:${value}`)
    } else if (name === 'limit_to') {
      const by = value.split(':')[1]
      if (by && LIMIT_BY.has(by)) out.add(`limit_to:${by.toLowerCase()}`)
    } else if (!BALANCER_SET.has(name)) {
      const listMode = /^(all|none):/.exec(value)
      if (listMode) out.add(`${name}:${listMode[1]}`)
    }
  }
  const tokens = [...out].sort()
  tokenCache.set(criteria, tokens)
  return tokens
}

/** The page load's counts: searches, and for each criterion the number of searches that used it. */
export function readUsage(): Pick<UsagePayload, 'searches' | 'c' | 'p' | 'e'> {
  const { events, pages, searches } = readUsageEvents()
  const c: Record<string, number> = {}
  let names = 0
  for (const criteria of searches) {
    for (const token of criteriaTokens(criteria)) {
      if (!(token in c)) {
        if (names >= MAX_NAMES) continue
        names++
        c[token] = 0
      }
      c[token]++
    }
  }
  return { searches: searches.length, c, p: pages, e: events }
}

/**
 * Starts counting. The search the lender arrived with is the first search; each
 * new entry at the top of the criteria history is another, and an entry that
 * replaces the top (typing a name, dragging a slider) refines the same one.
 * Clearing the history, or undoing that, leaves the same search on top and counts
 * nothing. Loans added to the basket are counted however they were added, and a
 * checkout when the basket is handed to Kiva. Returns the stop.
 */
export function startUsageTracking(): () => void {
  const stops: Array<() => void> = []
  try {
    const top = useCriteriaHistory.getState().history.entries[0]
    if (top) noteSearch(top.id, top.criteria)
    stops.push(
      useCriteriaHistory.subscribe((state, previous) => {
        const now = state.history.entries[0]
        const was = previous.history.entries[0]
        if (!now || now === was) return
        if (was && now.id !== was.id && criteriaKey(now.criteria) === criteriaKey(was.criteria)) return
        noteSearch(now.id, now.criteria)
      }),
    )
    let inBasket = new Set(useLoanStore.getState().basket.map((b) => b.loan_id))
    stops.push(
      useLoanStore.subscribe((state, previous) => {
        if (state.basket !== previous.basket) {
          const ids = new Set(state.basket.map((b) => b.loan_id))
          let added = 0
          for (const id of ids) if (!inBasket.has(id)) added++
          inBasket = ids
          if (added) noteEvent('basket_add', added)
        }
        if (state.pendingCheckout && state.pendingCheckout !== previous.pendingCheckout) {
          noteEvent('checkout')
          noteEvent('checkout_loans', state.pendingCheckout.ids.length)
        }
      }),
    )
  } catch {
    // Counting never breaks the page.
  }
  return () => {
    for (const stop of stops) stop()
  }
}

/**
 * The usage part of a report, or nothing when this browser does not share it (its
 * own choice, Global Privacy Control, or storage that cannot keep a number).
 */
export function usagePayload(now: number = Date.now()): UsagePayload | undefined {
  try {
    if (!usageAllowed()) return undefined
    const identity = usageIdentity(now)
    if (!identity) return undefined
    const saved = Object.keys(useCriteriaStore.getState().savedSearches ?? {}).filter((n) => !DEFAULT_SAVED_SEARCH_NAMES.has(n)).length
    return {
      id: identity.id,
      born: identity.born,
      // Whether a lender ID is set, never the ID.
      lender: useUtilsStore.getState().lenderId ? 1 : 0,
      saved: Math.min(saved, 1000),
      ...readUsage(),
    }
  } catch {
    return undefined
  }
}
