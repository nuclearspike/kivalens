import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { KivaLoan, BalancerConfig } from '../types'
import type { Criteria } from '../types'
import { lsj } from '../lib/localStorage'
import { cl, wait } from '../lib/utils'
import { getKivaLoans } from '../api/kiva'
import { useLoanStore } from './loanStore'
import { useUtilsStore } from './utilsStore'

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
  startFresh: () => void
  getLastCriteria: () => Criteria
  blankCriteria: () => Criteria

  // ---- Saved searches ---------------------------------------------------
  saveSearch: (name: string) => void
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

const DEFAULT_SAVED_SEARCHES: Record<string, SavedSearch> = {
  'Expiring Soon': {
    loan: { sort: 'expiring', still_needed_min: 25, expiring_in_days_max: 3 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  'Pays Back Fast (ex: Short term, pre-disbursed, posted awhile ago)': {
    loan: { repaid_in_max: 6, still_needed_min: 25 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  Popular: {
    loan: { sort: 'popularity', still_needed_min: 25, dollars_per_hour_min: 50 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  'Only one more lender needed': {
    loan: { still_needed_min: 25, still_needed_max: 25 },
    partner: {},
    portfolio: { exclude_portfolio_loans: 'true' },
  },
  'Large Groups: Evenly Men & Women': {
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
  "Countries I Don't Have": {
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
  'Balance Partner Risk': {
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
  'Young Parent': {
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
        Object.keys(storedAll).length > 0 ? storedAll : { ...DEFAULT_SAVED_SEARCHES }

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

        setCriteria: (criteria: Criteria) => {
          cl('criteriaStore:setCriteria', criteria)
          set((state) => {
            state.lastKnown = criteria as never
          })
          // Trigger loan filtering
          useLoanStore.getState().filterLoans(criteria)
        },

        reloadCriteria: (criteria: Criteria) => {
          set((state) => {
            state.lastKnown = criteria as never
          })
        },

        startFresh: () => {
          const fresh: Criteria = {
            loan: { name: '', use: '' },
            partner: {},
            portfolio: {
              exclude_portfolio_loans: 'true',
              pb_sector: { enabled: false },
              pb_country: { enabled: false },
              pb_activity: { enabled: false },
              pb_partner: { enabled: false },
            },
          }
          set((state) => {
            state.lastSwitch = null
            state.lastKnown = fresh as never
          })
          get().setCriteria(fresh)
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
          const fixed = get().fixUpgrades({ ...crit })
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

        getSavedSearch: (name: string): SavedSearch | undefined => {
          const s = get().savedSearches[name]
          return s ? (get().stripNullValues({ ...s }) as SavedSearch) : undefined
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
          return c
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
          if (crit.partner && Object.keys(crit.partner).length > 0) {
            result.partner = { ...crit.partner }
          }
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
              if (kl.filter(crit, false, [loan]).length) {
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

        updateBalancers: () => {
          const lenderId = useUtilsStore.getState().lenderId
          if (!lenderId) return

          const state = get()
          const SLICES = ['sector', 'activity', 'partner', 'country'] as const

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
      partialize: (state) => ({
        lastKnown: state.lastKnown,
        savedSearches: state.savedSearches,
        lastSwitch: state.lastSwitch,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<CriteriaState>),
      }),
    },
  ),
)
