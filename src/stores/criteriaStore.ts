import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { PORTFOLIO_BALANCERS } from '../types'
import type { KivaLoan, BalancerConfig } from '../types'
import type { Criteria } from '../types'
import { lsj } from '../lib/localStorage'
import { cl, wait } from '../lib/utils'
import { getKivaLoans } from '../api/kiva'
import { useLoanStore } from './loanStore'
import { useUtilsStore } from './utilsStore'
import { balancesByPartner, partnerCriteriaSet, resolvePartnerMode } from '../../server/loanFilter.mjs'
import { freshCriteria } from '../lib/freshCriteria'

/**
 * The criteria with the MFI/Direct mode written in. A search saved before the
 * three modes existed has no value, and the engine reads one off what it filters
 * on (see resolvePartnerMode). Writing it in as criteria enter the store means no
 * later step can change it by accident: measuring a slider lifts that slider's
 * range, and on an old search whose only partner filter it is, an unwritten mode
 * would flip from MFI to Both mid-measurement. Returns the same object when the
 * mode is already written, so the store-to-panel sync settles instead of looping.
 */
export function withPartnerMode(criteria: Criteria): Criteria {
  const mode = resolvePartnerMode(criteria)
  if ((criteria.partner as Record<string, unknown> | undefined)?.direct === mode) return criteria
  return { ...criteria, partner: { ...criteria.partner, direct: mode } }
}

/**
 * A saved search with partner criteria runs in MFI Only, whatever mode was stored
 * with it. Its partner filters, or its balance by partner, apply only to loans
 * with a field partner: in Both they would be kept and do nothing, and "Balance
 * Partner Risk" would balance nothing (Paul, 2026-09-25). Both is the default, so
 * it is usually what happened to be in force when the search was saved, not a
 * choice. This does not replace a stored Direct Only: that is the other side,
 * chosen on purpose.
 */
export function inSavedSearchMode(criteria: Criteria): Criteria {
  const direct = (criteria.partner as Record<string, unknown> | undefined)?.direct
  if (direct === 'mfi' || direct === 'direct') return criteria
  if (!partnerCriteriaSet(criteria) && !balancesByPartner(criteria)) return criteria
  return { ...criteria, partner: { ...criteria.partner, direct: 'mfi' } }
}

/** How many loans a saved search finds, in the mode it runs in; 0 when it cannot be run. */
export function countSavedSearch(
  kl: { filter: (criteria: Partial<Criteria>, cacheResults?: boolean) => unknown[] },
  criteria: Criteria,
): number {
  try {
    return kl.filter(inSavedSearchMode(criteria), false).length
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedSearch extends Criteria {
  notifyOnNew?: boolean
}

export interface BalancerSlice {
  id: string | number
  name: string | null
  value: number
  percent: number
}

export interface BalancerResult {
  slices: BalancerSlice[]
  total_sum: number
  last_updated?: string
}

/** Static option lists for the criteria dropdowns */
export interface AllOptions {
  countries: Array<{ value: string; label: string }>
  sectors: Array<{ value: string; label: string }>
  activities: Array<{ value: string; label: string }>
  themes: Array<{ value: string; label: string }>
  tags: Array<{ value: string; label: string }>
  socialPerformance: Array<{ value: string | number; label: string }>
  sortOptions: Array<{ value: string; label: string }>
  currencies: Array<{ value: string; label: string }>
  repaymentIntervals: Array<{ value: string; label: string }>
  regions: Array<{ value: string; label: string }>
}

export interface CriteriaState {
  /** The most recently applied criteria */
  lastKnown: Criteria
  /** All saved searches keyed by name */
  savedSearches: Record<string, SavedSearch>
  /** Name of the last saved-search that was loaded */
  lastSwitch: string | null
  /** Static option data for select dropdowns */
  allOptions: Partial<AllOptions>
}

export interface CriteriaActions {
  // ---- Criteria ---------------------------------------------------------
  setCriteria: (criteria: Criteria) => void
  reloadCriteria: (criteria: Criteria) => void
  /**
   * Reset: the fresh defaults, plus `then` when given — one change, so a caller
   * that means "reset, then show this partner" leaves one step in history.
   */
  startFresh: (then?: Criteria) => void
  getLastCriteria: () => Criteria
  blankCriteria: () => Criteria

  // ---- Saved searches ---------------------------------------------------
  saveSearch: (name: string) => void
  importSearches: (searches: Record<string, SavedSearch>) => string[]
  clearLastSwitch: () => void
  deleteSearch: (name: string) => void
  renameSearch: (oldName: string, newName: string) => void
  loadSearch: (name: string) => void
  toggleNotifyOnNew: (name: string) => boolean | undefined
  getSavedSearchNames: () => string[]
  getSavedSearch: (name: string) => SavedSearch | undefined

  // ---- Criteria helpers -------------------------------------------------
  fixUpgrades: (criteria: Criteria) => Criteria
  stripNullValues: (criteria: Criteria | undefined) => Criteria | undefined
  prepForRSS: (criteria: Criteria) => Partial<Criteria>
  getMatchingCriteria: (loan: KivaLoan, onlyMarkedForNotice?: boolean) => string[]

  // ---- Portfolio balancing ----------------------------------------------
  updateBalancers: () => void
  /** Drops what a lender's portfolio put into the balancers, when that lender goes. */
  releasePortfolioBalancers: () => void
  fetchBalancerData: (
    sliceBy: string,
    config: BalancerConfig,
  ) => Promise<BalancerResult>

  // ---- Options ----------------------------------------------------------
  setAllOptions: (options: Partial<AllOptions>) => void
}

// ---------------------------------------------------------------------------
// Default saved searches
// ---------------------------------------------------------------------------

// Object keys here double as the saved-search's persistence identity (zustand
// `persist` stores `savedSearches` keyed by these strings verbatim) AND its
// t()-translated display name (SavedSearches.tsx calls t(name) on whatever's
// in this map, dynamically) — see the `migrate` step below for how an existing
// user's already-persisted English-keyed defaults are carried forward onto
// these symbol keys.
const DEFAULT_SAVED_SEARCHES: Record<string, SavedSearch> = {
  expiring_soon: {
    loan: { sort: 'expiring', still_needed_min: 25, expiring_in_days_max: 3 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  pays_back_fast_ex_short: {
    loan: { repaid_in_max: 6, still_needed_min: 25 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  popular: {
    loan: { sort: 'popularity', still_needed_min: 25, dollars_per_hour_min: 50 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  only_one_more_lender_needed: {
    loan: { still_needed_min: 25, still_needed_max: 25 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  large_groups_evenly_men_women: {
    loan: {
      sort: 'popularity',
      percent_female_min: 40,
      percent_female_max: 60,
      borrower_count_min: 12,
      still_needed_min: 25,
    },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  countries_i_dont_have: {
    loan: { limit_to: { enabled: true, count: 1, limit_by: 'Country' } },
    partner: {},
    portfolio: {
      exclude_portfolio_loans: 'true',
      pb_country: {
        enabled: true,
        hideshow: 'hide',
        ltgt: 'gt',
        percent: 0,
        allactive: 'all',
        values: [],
      } as BalancerConfig,
    },
  },
  balance_partner_risk: {
    loan: { limit_to: { enabled: true, count: 1, limit_by: 'Partner' } },
    partner: {},
    portfolio: {
      exclude_portfolio_loans: 'true',
      pb_partner: {
        enabled: true,
        hideshow: 'hide',
        ltgt: 'gt',
        percent: 0,
        allactive: 'active',
        values: [],
      } as BalancerConfig,
    },
  },
  young_parent: {
    loan: {
      age_min: 20,
      age_max: 23,
      borrower_max_count: 1,
      sort: 'popularity',
      still_needed_min: 25,
      tags: '#Parent,#SingleParent',
      tags_all_any_none: 'any',
    },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
}

// Maps each pre-rekey default's English name (its persisted key before this
// migration) to its new symbol key, so `migrate` below can rename an existing
// user's untouched defaults without disturbing any search they've renamed,
// deleted, or added themselves.
const LEGACY_DEFAULT_NAME_TO_KEY: Record<string, string> = {
  'Expiring Soon': 'expiring_soon',
  'Pays Back Fast (ex: Short term, pre-disbursed, posted awhile ago)': 'pays_back_fast_ex_short',
  Popular: 'popular',
  'Only one more lender needed': 'only_one_more_lender_needed',
  'Large Groups: Evenly Men & Women': 'large_groups_evenly_men_women',
  "Countries I Don't Have": 'countries_i_dont_have',
  'Balance Partner Risk': 'balance_partner_risk',
  'Young Parent': 'young_parent',
}

/**
 * Renames any of the 8 built-in defaults still keyed by its pre-rekey English
 * name to its new symbol key, leaving every other entry (a search the user
 * renamed, deleted, or added themselves) untouched. Never overwrites an entry
 * already present under the new key. Returns the mapping actually applied
 * (old name -> new key) alongside the renamed set, so a caller can also fix up
 * a `lastSwitch` pointer that referenced the old name.
 */
function renameLegacyDefaultNames(
  searches: Record<string, SavedSearch>,
): Record<string, SavedSearch> {
  const { renamed } = renameLegacyDefaultNamesWithLog(searches)
  return renamed
}

function renameLegacyDefaultNamesWithLog(
  searches: Record<string, SavedSearch>,
): { renamed: Record<string, SavedSearch>; nameChanges: Record<string, string> } {
  const renamed: Record<string, SavedSearch> = {}
  const nameChanges: Record<string, string> = {}
  for (const [name, search] of Object.entries(searches)) {
    const newKey = LEGACY_DEFAULT_NAME_TO_KEY[name]
    const targetKey = newKey && !(newKey in searches) ? newKey : name
    if (targetKey !== name) nameChanges[name] = targetKey
    renamed[targetKey] = search
  }
  return { renamed, nameChanges }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * LRU + TTL cache for balancer API results. Each BalancerResult can hold up to
 * ~1000 slices, so we bound the entry COUNT (not just age): the TTL only evicts
 * on a read of an already-expired key, which left cold entries resident for the
 * whole tab session. CACHE_MAX caps distinct entries; a Map preserves insertion
 * order, so the oldest key is the least-recently-used.
 */
const balancerCache = new Map<string, { value: BalancerResult; time: number }>()
const CACHE_TTL = 60 * 60 * 1000
const CACHE_MAX = 50

function getCached(key: string): BalancerResult | null {
  const entry = balancerCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.time > CACHE_TTL) {
    balancerCache.delete(key)
    return null
  }
  // Mark most-recently-used: re-insert moves the key to the end of the Map.
  balancerCache.delete(key)
  balancerCache.set(key, entry)
  return entry.value
}

function setCache(key: string, value: BalancerResult): void {
  balancerCache.delete(key) // re-insert at the end (most-recently-used)
  balancerCache.set(key, { value, time: Date.now() })
  // Evict least-recently-used entries (oldest insertion order) beyond the cap.
  while (balancerCache.size > CACHE_MAX) {
    const lru = balancerCache.keys().next().value
    if (lru === undefined) break
    balancerCache.delete(lru)
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCriteriaStore = create<CriteriaState & CriteriaActions>()(
  persist(
    immer((set, get) => {
      // LEGACY MIGRATION (added 2026-06; safe to remove ~2027-06 once the long
      // tail of infrequent lenders has loaded at least once): seed from the
      // pre-persist localStorage keys. zustand persist ('kivalens-criteria') wins
      // via merge when present, so this only matters for data that predates it.
      const storedAll = lsj.get<Record<string, SavedSearch>>('all_criteria')
      const initialSavedSearches =
        Object.keys(storedAll).length > 0 ? renameLegacyDefaultNames(storedAll) : { ...DEFAULT_SAVED_SEARCHES }

      // Load last criteria from localStorage
      const storedLast = lsj.get<Criteria>('last_criteria')
      const initialLastKnown =
        storedLast && storedLast.loan
          ? storedLast
          : // Default a fresh visitor to excluding loans they've funded. This
            // only takes effect once a Lender ID is set (the filter no-ops
            // without it), matching the Portfolio tab's behavior.
            { loan: {}, partner: {}, portfolio: { exclude_portfolio_loans: 'true' } }

      return {
        // -- state --
        lastKnown: initialLastKnown,
        savedSearches: initialSavedSearches,
        lastSwitch: null,
        allOptions: {},

        // -------------------------------------------------------------
        // Criteria actions
        // -------------------------------------------------------------

        setCriteria: (incoming: Criteria) => {
          const criteria = withPartnerMode(incoming)
          cl('criteriaStore:setCriteria', criteria)
          set((state) => {
            state.lastKnown = criteria as never
          })
          // Trigger loan filtering
          useLoanStore.getState().filterLoans(criteria)
        },

        reloadCriteria: (incoming: Criteria) => {
          const criteria = withPartnerMode(incoming)
          set((state) => {
            state.lastKnown = criteria as never
          })
        },

        startFresh: (then?: Criteria) => {
          const fresh = freshCriteria()
          const next: Criteria = then
            ? {
                loan: { ...fresh.loan, ...then.loan },
                partner: { ...fresh.partner, ...then.partner },
                portfolio: { ...fresh.portfolio, ...then.portfolio },
              }
            : fresh
          // A reset is no longer the saved search it replaced: the switcher stops
          // naming it, or its Re-save would overwrite that search with this one.
          set((state) => {
            state.lastSwitch = null
          })
          get().setCriteria(next)
        },

        getLastCriteria: (): Criteria => {
          const blank: Criteria = { loan: {}, partner: {}, portfolio: {} }
          const last = get().lastKnown
          return {
            loan: { ...blank.loan, ...last.loan },
            partner: { ...blank.partner, ...last.partner },
            portfolio: { ...blank.portfolio, ...last.portfolio },
          }
        },

        blankCriteria: (): Criteria => ({
          loan: {},
          partner: {},
          portfolio: {},
        }),

        // -------------------------------------------------------------
        // Saved search actions
        // -------------------------------------------------------------

        saveSearch: (name: string) => {
          if (!name) return
          set((state) => {
            const stripped = get().stripNullValues({ ...get().lastKnown })
            state.savedSearches[name] = (stripped ?? get().lastKnown) as never
            state.lastSwitch = name
          })
        },

        // Takes in searches from a file, a pasted document or a shared link, and
        // returns the names it stored. It goes through set(), which is what makes
        // the searches outlive the tab: writing into savedSearches directly leaves
        // the browser's copy untouched until some unrelated action happens to save.
        importSearches: (searches: Record<string, SavedSearch>) => {
          const names = Object.keys(searches).filter((name) => name && searches[name])
          if (names.length === 0) return []
          set((state) => {
            for (const name of names) state.savedSearches[name] = searches[name] as never
          })
          return names
        },

        // The saved-search button names the search the criteria came from. When
        // they came from somewhere else — a link — it must stop claiming them,
        // or its Re-save and Delete act on a search the lender never chose.
        clearLastSwitch: () => {
          if (get().lastSwitch === null) return
          set((state) => {
            state.lastSwitch = null
          })
        },

        deleteSearch: (name: string) => {
          set((state) => {
            delete state.savedSearches[name]
            if (state.lastSwitch === name) state.lastSwitch = null
          })
        },

        // Atomic rename: move the saved criteria from oldName to newName in a
        // single immer update. (The old UI mutated store state directly and then
        // called saveSearch, which clobbered the criteria with whatever was being
        // edited — so renaming a non-active search saved the wrong filters.)
        renameSearch: (oldName: string, newName: string) => {
          const trimmed = newName.trim()
          if (!trimmed || !oldName || trimmed === oldName) return
          set((state) => {
            const crit = state.savedSearches[oldName]
            if (!crit) return
            state.savedSearches[trimmed] = crit
            delete state.savedSearches[oldName]
            if (state.lastSwitch === oldName) state.lastSwitch = trimmed
          })
        },

        loadSearch: (name: string) => {
          const crit = get().savedSearches[name]
          if (!crit) return
          const fixed = inSavedSearchMode(get().fixUpgrades({ ...crit }))
          set((state) => {
            state.lastSwitch = name
            state.lastKnown = fixed as never
          })
          get().setCriteria(fixed)
        },

        toggleNotifyOnNew: (name: string): boolean | undefined => {
          if (!name || !get().savedSearches[name]) return undefined
          let newValue = false
          set((state) => {
            const search = state.savedSearches[name]
            if (search) {
              search.notifyOnNew = !search.notifyOnNew
              newValue = !!search.notifyOnNew
            }
          })
          return newValue
        },

        getSavedSearchNames: (): string[] => {
          return Object.keys(get().savedSearches)
        },

        // The search as it runs (inSavedSearchMode), so its summary, count, share link
        // and export say what loading it does.
        getSavedSearch: (name: string): SavedSearch | undefined => {
          const s = get().savedSearches[name]
          return s ? (inSavedSearchMode(get().stripNullValues({ ...s }) as SavedSearch) as SavedSearch) : undefined
        },

        // -------------------------------------------------------------
        // Criteria helpers
        // -------------------------------------------------------------

        fixUpgrades: (crit: Criteria): Criteria => {
          const c = { ...crit, loan: { ...crit.loan }, partner: { ...crit.partner }, portfolio: { ...crit.portfolio } }
          if (c.partner && c.partner.social_performance && Array.isArray(c.partner.social_performance)) {
            c.partner.social_performance = (c.partner.social_performance as string[]).join(',')
          }
          if (c.portfolio.exclude_portfolio_loans === true as unknown) {
            c.portfolio.exclude_portfolio_loans = 'true'
          }
          if (c.portfolio.exclude_portfolio_loans === false as unknown) {
            c.portfolio.exclude_portfolio_loans = 'false'
          }
          // A slider that no longer exists: Kiva sends 0 for every partner, so the
          // filter engine ignores it. Drop it from loaded criteria so it does not
          // linger in saved searches and RSS settings.
          const partnerCriteria = c.partner as Record<string, unknown>
          delete partnerCriteria.average_loan_size_percent_per_capita_income_min
          delete partnerCriteria.average_loan_size_percent_per_capita_income_max
          return withPartnerMode(c)
        },

        stripNullValues: (crit: Criteria | undefined): Criteria | undefined => {
          if (!crit) return crit
          const groups = ['loan', 'partner', 'portfolio'] as const
          for (const group of groups) {
            const obj = crit[group]
            if (obj) {
              for (const key of Object.keys(obj)) {
                const val = (obj as Record<string, unknown>)[key]
                if (val === null || val === undefined || val === '') {
                  delete (obj as Record<string, unknown>)[key]
                }
              }
            }
          }
          return crit
        },

        prepForRSS: (c: Criteria): Partial<Criteria> => {
          const crit = structuredClone(c)
          get().stripNullValues(crit)
          const result: Partial<Criteria> & { loan?: Record<string, unknown>; partner?: Record<string, unknown> } = {}
          if (crit.loan) {
            const loan = { ...crit.loan }
            if (loan.limit_to && !(loan.limit_to as { enabled?: boolean }).enabled) {
              delete loan.limit_to
            }
            if (Object.keys(loan).length > 0) result.loan = loan
          }
          // Partner criteria apply only in MFI Only. In Both and Direct Only they are
          // kept on screen but change nothing, so a feed leaves them out. Both is then
          // written as no partner group at all — a search with no partner criteria reads
          // as Both, so the link cannot turn into an MFI-only feed however it is carried.
          const mode = resolvePartnerMode(crit)
          if (mode === 'mfi') result.partner = { ...crit.partner, direct: 'mfi' }
          else if (mode === 'direct') result.partner = { direct: 'direct' }
          // portfolio is intentionally excluded from RSS
          delete (result as Record<string, unknown>).notifyOnNew
          return result
        },

        getMatchingCriteria: (loan: KivaLoan, onlyMarkedForNotice = false): string[] => {
          const kl = getKivaLoans()
          if (!kl) return []

          const state = get()
          const names = state.getSavedSearchNames()
          const filtered = onlyMarkedForNotice
            ? names.filter((n) => state.savedSearches[n]?.notifyOnNew)
            : names

          const results: string[] = []
          const lenderId = useUtilsStore.getState().lenderId

          for (const name of filtered) {
            try {
              const crit = state.savedSearches[name]
              if (!crit) continue
              // Matched in the mode it loads in, so a saved search means one thing.
              if (kl.filter(inSavedSearchMode(crit), false, [loan]).length) {
                const BALANCER_SLICES = ['sector', 'activity', 'partner', 'country'] as const
                const hasBalancer = BALANCER_SLICES.some(
                  (slice) =>
                    crit.portfolio[`pb_${slice}` as keyof typeof crit.portfolio] &&
                    (crit.portfolio[`pb_${slice}` as keyof typeof crit.portfolio] as BalancerConfig)?.enabled,
                )
                if (!hasBalancer || (hasBalancer && lenderId)) {
                  results.push(name)
                }
              }
            } catch (e) {
              console.warn('getMatchingCriteria error for', name, e)
            }
          }
          return results
        },

        // -------------------------------------------------------------
        // Portfolio balancing
        // -------------------------------------------------------------

        // A balancer holds partner ids, countries, sectors … worked out from ONE lender's
        // portfolio. With the lender gone those values would keep filtering, invisibly and
        // wrongly, so clearing the lender ID switches the balancers off and drops the
        // values — in the live criteria and in every saved search. Setting an ID again
        // refreshes them once they are switched back on (updateBalancers).
        releasePortfolioBalancers: () => {
          const release = (crit: { portfolio: Record<string, unknown> }) => {
            for (const key of PORTFOLIO_BALANCERS) {
              const bal = crit.portfolio[key] as
                | (BalancerConfig & { values?: unknown[] })
                | undefined
              if (!bal) continue
              bal.enabled = false
              delete bal.values
            }
          }
          set((state) => {
            release(state.lastKnown as unknown as { portfolio: Record<string, unknown> })
            for (const name of Object.keys(state.savedSearches)) {
              const saved = state.savedSearches[name]
              if (saved) release(saved as unknown as { portfolio: Record<string, unknown> })
            }
          })
          useLoanStore.getState().filterLoans(get().lastKnown)
        },

        updateBalancers: () => {
          const lenderId = useUtilsStore.getState().lenderId
          if (!lenderId) return

          const state = get()
          const SLICES = ['sector', 'activity', 'partner', 'country', 'region', 'gender'] as const

          for (const name of state.getSavedSearchNames()) {
            const crit = state.savedSearches[name]
            if (!crit) continue

            for (const slice of SLICES) {
              const bal = crit.portfolio[`pb_${slice}` as keyof typeof crit.portfolio] as
                | (BalancerConfig & { values?: unknown[] })
                | undefined
              if (!bal?.enabled) continue

              // Delay to avoid blocking startup
              void wait(1000).then(async () => {
                try {
                  const result = await get().fetchBalancerData(slice, bal)
                  const filteredSlices =
                    bal.ltgt === 'gt'
                      ? result.slices.filter((s) => s.percent > (bal.percent ?? 0))
                      : result.slices.filter((s) => s.percent < (bal.percent ?? 0))

                  const values =
                    slice === 'partner'
                      ? filteredSlices.map((s) => parseInt(String(s.id))).filter((v) => v != null)
                      : filteredSlices.map((s) => s.name).filter((v) => v != null)

                  set((draft) => {
                    const draftBal = draft.savedSearches[name]?.portfolio[
                      `pb_${slice}` as keyof typeof crit.portfolio
                    ] as (BalancerConfig & { values?: unknown[] }) | undefined
                    if (draftBal) {
                      draftBal.values = values
                    }
                  })
                } catch (e) {
                  console.warn('updateBalancers error', slice, name, e)
                }
              })
            }
          }
        },

        fetchBalancerData: async (
          sliceBy: string,
          config: BalancerConfig,
        ): Promise<BalancerResult> => {
          const lenderId = useUtilsStore.getState().lenderId
          if (!lenderId) return { slices: [], total_sum: 0 }

          const cacheKey = `balancer_lender_${lenderId}_${sliceBy}_${config.allactive ?? 'all'}`
          const cached = getCached(cacheKey)
          if (cached) return cached

          const kl = getKivaLoans()
          if (!kl) return { slices: [], total_sum: 0 }

          const raw = await kl.fetchSuperGraphData({
            sliceBy,
            include: config.allactive ?? 'all',
            measure: 'count',
            subject_id: lenderId,
            type: 'lender',
            granularity: 'cumulative',
          }) as {
            data?: Array<{ name: string; value: string }>
            lookup?: Record<string, string>
            last_updated?: string
          }

          const dataArr = raw.data ?? []
          const totalSum = dataArr.reduce((sum: number, d: { value: string }) => sum + parseInt(d.value), 0)
          const slices: BalancerSlice[] = dataArr.map((d: { name: string; value: string }) => ({
            id: d.name,
            name: raw.lookup?.[d.name] ?? d.name,
            value: parseInt(d.value),
            percent: (parseInt(d.value) * 100) / totalSum,
          }))

          const result: BalancerResult = {
            slices,
            total_sum: totalSum,
            last_updated: raw.last_updated,
          }
          setCache(cacheKey, result)
          return result
        },

        // -------------------------------------------------------------
        // Options
        // -------------------------------------------------------------

        setAllOptions: (options: Partial<AllOptions>) => {
          set((state) => {
            state.allOptions = { ...state.allOptions, ...options } as never
          })
        },
      }
    }),
    {
      name: 'kivalens-criteria',
      version: 2,
      partialize: (state) => ({
        lastKnown: state.lastKnown,
        savedSearches: state.savedSearches,
        lastSwitch: state.lastSwitch,
      }),
      // Recover saved searches orphaned when an early rewrite build persisted an
      // empty/default `savedSearches` over (and then ignored, via merge) the
      // legacy `all_criteria` key. Runs once per pre-v1 blob and ONLY when the
      // blob has no saved searches, so it never clobbers searches a user still has.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<CriteriaState>
        if (version < 1) {
          // Recover saved searches orphaned in the legacy `all_criteria` key when an
          // early rewrite build seeded the built-in defaults over them. UNION the old
          // ones back in (not only when the blob is empty) — a user whose blob now
          // holds just the defaults must still get their custom searches. The persisted
          // blob wins on a name collision, so this never downgrades a search they've
          // since edited; it only ADDS back ones that are missing.
          const storedAll = lsj.get<Record<string, SavedSearch>>('all_criteria')
          if (Object.keys(storedAll).length > 0) {
            p.savedSearches = { ...storedAll, ...(p.savedSearches ?? {}) }
          } else if (!p.savedSearches || Object.keys(p.savedSearches).length === 0) {
            p.savedSearches = { ...DEFAULT_SAVED_SEARCHES }
          }
        }
        if (version < 2 && p.savedSearches) {
          // The i18n rekey (2026-09) moved default saved-search names from raw
          // English text to symbol keys (see LEGACY_DEFAULT_NAME_TO_KEY above).
          // Rename any of the 8 built-in defaults an existing user still has
          // under its old English name, so it keeps translating correctly
          // instead of silently falling back to English. Only renames an EXACT,
          // untouched legacy name, and only if the new key isn't already
          // present — a search the user renamed, or already has under the new
          // key, is left alone.
          const { renamed, nameChanges } = renameLegacyDefaultNamesWithLog(p.savedSearches)
          p.savedSearches = renamed
          if (p.lastSwitch && nameChanges[p.lastSwitch]) {
            p.lastSwitch = nameChanges[p.lastSwitch]
          }
        }
        return p as CriteriaState & CriteriaActions
      },
      // Guard the data-loss bug: the bare `{ ...current, ...persisted }` spread let
      // an empty/missing persisted `savedSearches` wipe out the recovered/default
      // set seeded into the initial state. Keep `current` when persisted is empty.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CriteriaState>
        const merged = { ...current, ...p }
        const cur = current as CriteriaState & CriteriaActions
        if (
          (!p.savedSearches || Object.keys(p.savedSearches).length === 0) &&
          cur.savedSearches &&
          Object.keys(cur.savedSearches).length > 0
        ) {
          merged.savedSearches = cur.savedSearches
        }
        return merged
      },
    },
  ),
)
