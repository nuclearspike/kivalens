/**
 * Where a lender is when the Search page opens with no loan open, so the panel on
 * the right meets them there instead of welcoming everyone as if it were their first
 * time (Paul, 2026-09-27: "for many users this isn't their first rodeo").
 *
 * Each stage is worked out from what this browser already holds: the basket, a
 * checkout handed to Kiva, saved searches, the criteria history, the lender ID, the
 * last visit, and how the search on screen arrived. Several apply at once; they are
 * listed most pressing first, and the panel shows each as its own card in that order
 * (src/components/SearchHome.tsx). Pure, so every rule is pinned by a test
 * (src/lib/searchStages.test.ts).
 */

export type StageId =
  /** The search on screen came from a link or bookmark and replaced the browser's own. */
  | 'link'
  /** A basket was handed to Kiva's checkout within the last day and not yet reconciled. */
  | 'back_from_kiva'
  /** The basket holds loans. */
  | 'basket'
  /** The search finds a handful of loans: say which single change would widen it most. */
  | 'few_results'
  /** The lender has been here before: what is new since then. */
  | 'new_since'
  /** The search on screen is one the lender left here on an earlier visit, still untouched. */
  | 'continuing'
  /** The lender keeps saved searches of their own. */
  | 'saved'
  /** A Kiva lender ID is set: suggestions from their own portfolio. */
  | 'lender'
  /** A returning lender with no lender ID: what setting one unlocks. */
  | 'lender_pitch'
  /** Nothing of theirs is here yet: how to start. */
  | 'first_visit'

/** Every stage, in the order the panel shows them. */
export const STAGE_IDS: readonly StageId[] = ['link', 'back_from_kiva', 'basket', 'few_results', 'new_since', 'continuing', 'saved', 'lender', 'lender_pitch', 'first_visit']

export interface StageInput {
  now: number
  /** The address's search replaced the browser's, and is still the search on screen. */
  onLinkedSearch: boolean
  pendingCheckout: { ids: number[]; at: number } | null
  basketCount: number
  /** The loan set has loaded, so result counts mean something. */
  loansReady: boolean
  resultCount: number
  /** The search on screen sets nothing Reset does not (describeCriteria finds no line). */
  searchIsDefault: boolean
  /** The search on screen is the one this page opened with (nothing changed since). */
  searchUnchangedThisVisit: boolean
  /** The search on screen was reached on an earlier visit (its history entry predates this visit). */
  searchFromEarlierVisit: boolean
  /** When the previous visit ended, or null when none is on record. */
  previousVisitEnd: number | null
  ownSavedSearchCount: number
  /** Any criteria-history entry from before this visit. */
  historyBeforeVisit: boolean
  lenderId: string
}

/** How recent a checkout hand-off must be to still be news (the basket page drops older ones too). */
export const CHECKOUT_FRESH_MS = 24 * 60 * 60 * 1000
/** Up to this many results is "a handful": worth suggesting how to widen. Zero has its own help in the list. */
export const FEW_RESULTS = 5

/** Whether anything shows this browser has been used for KivaLens before. */
export function isReturning(i: StageInput): boolean {
  return i.previousVisitEnd !== null || i.historyBeforeVisit || i.ownSavedSearchCount > 0 || i.basketCount > 0 || !!i.lenderId
}

export function searchStages(i: StageInput): StageId[] {
  const out: StageId[] = []
  if (i.onLinkedSearch) out.push('link')
  if (i.pendingCheckout && i.now - i.pendingCheckout.at >= 0 && i.now - i.pendingCheckout.at < CHECKOUT_FRESH_MS) out.push('back_from_kiva')
  if (i.basketCount > 0) out.push('basket')
  if (i.loansReady && i.resultCount > 0 && i.resultCount <= FEW_RESULTS) out.push('few_results')
  if (i.previousVisitEnd !== null) out.push('new_since')
  if (!i.onLinkedSearch && !i.searchIsDefault && i.searchUnchangedThisVisit && i.searchFromEarlierVisit) out.push('continuing')
  if (i.ownSavedSearchCount > 0) out.push('saved')
  if (i.lenderId) out.push('lender')
  else if (isReturning(i)) out.push('lender_pitch')
  // A newcomer who followed a shared link is exactly who needs the start card; the link's card comes first.
  if (!isReturning(i)) out.push('first_visit')
  return out
}

/** The panel's heading: the most pressing thing to say on arrival. */
export type Greeting = 'back_from_kiva' | 'welcome' | 'welcome_back'

export function greeting(stages: readonly StageId[]): Greeting {
  if (stages.includes('back_from_kiva')) return 'back_from_kiva'
  if (stages.includes('first_visit')) return 'welcome'
  return 'welcome_back'
}
