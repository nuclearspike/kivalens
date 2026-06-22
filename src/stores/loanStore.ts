import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { setAutoFreeze } from 'immer'

// The Loans singleton mutates loan objects in-place (Object.assign in
// mergeExtraLoanData, mergeLoanAndNotify, etc.).  Immer's auto-freeze would
// make those objects read-only and break mutations, so we disable it.
setAutoFreeze(false)
import type { BasketItem, Criteria, KivaLoan, ProgressEvent, RunningTotals } from '../types'
import { lsj } from '../lib/localStorage'
import { getKivaLoans } from '../api/kiva'
import { useCriteriaStore } from './criteriaStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BasketEntry {
  id: number
  amount: number
  loan: KivaLoan | undefined
}

/**
 * Outcome of verifying one orphan basket id against Kiva.
 *  - loan present + fundraising  -> keep (hydrate; it was just missing locally)
 *  - loan present, not fundraising -> remove (funded/expired/in_repayment/...)
 *  - loan === null               -> remove (Kiva reports the id invalid/gone)
 *  - transientError === true     -> keep (couldn't verify; retry later)
 */
export type OrphanProbe = {
  id: number
  loan?: { status?: string } | null
  transientError?: boolean
}

/**
 * Pure decision logic for reconcileBasketOrphans (exported for testing).
 * Safety rule: only confirmed-fundraising loans are kept, and loans we could
 * not verify (transientError) are left alone. Everything else — confirmed
 * non-fundraising or confirmed gone — is removable.
 */
export function partitionBasketOrphans(
  probes: OrphanProbe[],
): { removeIds: number[]; fundraising: number[] } {
  const removeIds: number[] = []
  const fundraising: number[] = []
  for (const p of probes) {
    if (p.transientError) continue // couldn't verify — never destroy on doubt
    if (p.loan?.status === 'fundraising') fundraising.push(p.id)
    else removeIds.push(p.id) // non-fundraising, or confirmed gone (loan null)
  }
  return { removeIds, fundraising }
}

export interface LoanState {
  /** All loans loaded from Kiva */
  loans: KivaLoan[]
  /** Last filtered result set */
  filteredLoans: KivaLoan[]
  /** Whether a filter pass returned the same result as last time */
  filteredSameAsLast: boolean
  /** Basket items persisted to localStorage */
  basket: BasketItem[]
  /** Total loan count in the Kiva dataset */
  loanCount: number
  /** Download / initial-load progress */
  downloading: boolean
  downloadProgress: ProgressEvent | null
  /** Currently selected loan id (for detail view) */
  selectedId: number | null
  /** Live running totals from the websocket channel */
  runningTotals: RunningTotals | null
  /** Secondary-load status label */
  secondaryStatus: string | null
  /** Background resync state label */
  backgroundResyncState: string | null
  /** Transient notice shown when the basket is auto-adjusted (loans removed/capped) */
  basketNotice: string | null
  /** True while the lender's funded-loan list is downloading (portfolio exclusion pending) */
  lenderLoansLoading: boolean
  /** Snapshot of loan ids sent to Kiva at checkout, awaiting outcome confirmation (T1.1) */
  pendingCheckout: { ids: number[]; at: number } | null
}

export interface LoanActions {
  // ---- Basket -----------------------------------------------------------
  addToBasket: (loanId: number, amount?: number) => void
  removeFromBasket: (loanId: number) => void
  batchAddToBasket: (items: BasketItem[]) => void
  batchRemoveFromBasket: (loanIds: number[]) => void
  clearBasket: () => void
  setBasketAmount: (loanId: number, amount: number) => void
  /** Set the same lend amount on every loan in the basket */
  setAllBasketAmounts: (amount: number) => void
  /** Adjust every basket item amount to the lesser of current amount and kl_still_needed */
  adjustBasketAmountsToWhatsLeft: () => void
  /** Return hydrated basket entries (with loan objects attached) */
  getBasket: () => BasketEntry[]
  /** Check whether a loan is in the basket */
  inBasket: (loanId: number) => boolean
  /** Verify basket ids that have no local loan data against Kiva and drop the
   *  ones that are no longer fundraising (funded/expired/refunded/gone). */
  reconcileBasketOrphans: () => Promise<void>

  // ---- Loans ------------------------------------------------------------
  setLoans: (loans: KivaLoan[]) => void
  setFilteredLoans: (loans: KivaLoan[], sameAsLast: boolean) => void
  filterLoans: (criteria?: Criteria) => void
  setSelectedId: (id: number | null) => void
  setDownloading: (downloading: boolean) => void
  setDownloadProgress: (progress: ProgressEvent | null) => void
  setRunningTotals: (totals: RunningTotals | null) => void
  setSecondaryStatus: (label: string | null) => void
  setBackgroundResyncState: (state: string | null) => void
  setBasketNotice: (msg: string | null) => void
  setLenderLoansLoading: (loading: boolean) => void
  /** Record the loan ids sent to Kiva so the outcome can be reconciled on return */
  beginCheckout: (ids: number[]) => void
  clearPendingCheckout: () => void
  getLoan: (id: number) => KivaLoan | undefined

  // ---- Refresh ----------------------------------------------------------
  refreshBasketLoans: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLoanStore = create<LoanState & LoanActions>()(
  persist(
    immer((set, get) => ({
      // -- state --
      loans: [],
      filteredLoans: [],
      filteredSameAsLast: false,
      basket: lsj.getA<BasketItem>('basket'),
      loanCount: 0,
      downloading: true,
      downloadProgress: null,
      selectedId: null,
      runningTotals: null,
      secondaryStatus: null,
      backgroundResyncState: null,
      basketNotice: null,
      lenderLoansLoading: false,
      pendingCheckout: null,

      // ---------------------------------------------------------------
      // Basket actions
      // ---------------------------------------------------------------

      addToBasket: (loanId: number, amount = 25) => {
        set((state) => {
          if (state.basket.some((bi) => bi.loan_id === loanId)) return
          state.basket.push({ loan_id: loanId, amount })
        })
      },

      removeFromBasket: (loanId: number) => {
        set((state) => {
          state.basket = state.basket.filter((bi) => bi.loan_id !== loanId)
        })
      },

      batchAddToBasket: (items: BasketItem[]) => {
        set((state) => {
          // Dedup against what's already in the basket AND within `items` itself,
          // mirroring addToBasket's single-item guard so no caller can create
          // duplicate basket entries.
          const seen = new Set(state.basket.map((bi) => bi.loan_id))
          const toAdd: BasketItem[] = []
          for (const it of items) {
            if (seen.has(it.loan_id)) continue
            seen.add(it.loan_id)
            toAdd.push(it)
          }
          if (toAdd.length) state.basket = state.basket.concat(toAdd)
        })
      },

      batchRemoveFromBasket: (loanIds: number[]) => {
        if (!loanIds.length) return
        set((state) => {
          state.basket = state.basket.filter(
            (bi) => !loanIds.includes(bi.loan_id),
          )
        })
      },

      clearBasket: () => {
        set((state) => {
          state.basket = []
        })
      },

      setBasketAmount: (loanId: number, amount: number) => {
        set((state) => {
          const item = state.basket.find((bi) => bi.loan_id === loanId)
          if (item) item.amount = amount
        })
      },

      setAllBasketAmounts: (amount: number) => {
        set((state) => {
          for (const bi of state.basket) bi.amount = amount
        })
      },

      adjustBasketAmountsToWhatsLeft: () => {
        const entries = get().getBasket()
        const originalAmounts = new Map(get().basket.map((bi) => [bi.loan_id, bi.amount]))
        set((state) => {
          // Cap each basket item amount to what the loan still needs
          for (const entry of entries) {
            if (!entry.loan) continue
            const bi = state.basket.find((b) => b.loan_id === entry.id)
            if (bi) {
              bi.amount = Math.min(bi.amount, entry.loan.kl_still_needed ?? bi.amount)
            }
          }
          const before = state.basket.length
          // Remove items with zero amount (fully funded)
          state.basket = state.basket.filter((bi) => bi.amount > 0)
          // Remove non-fundraising loans
          const nonFundraising = entries
            .filter((e) => e.loan && e.loan.status !== 'fundraising')
            .map((e) => e.id)
          if (nonFundraising.length) {
            state.basket = state.basket.filter(
              (bi) => !nonFundraising.includes(bi.loan_id),
            )
          }
          // T1.5: tell the user what silently changed. Count removals and
          // amount reductions (among surviving items) and surface a notice.
          const removed = before - state.basket.length
          let reduced = 0
          for (const bi of state.basket) {
            const orig = originalAmounts.get(bi.loan_id)
            if (orig != null && bi.amount < orig) reduced++
          }
          if (removed > 0 || reduced > 0) {
            const parts: string[] = []
            if (removed > 0)
              parts.push(`${removed} loan${removed === 1 ? '' : 's'} removed (finished funding)`)
            if (reduced > 0)
              parts.push(`${reduced} amount${reduced === 1 ? '' : 's'} lowered to what's still needed`)
            state.basketNotice = `Basket updated: ${parts.join('; ')}.`
          }
        })
      },

      getBasket: (): BasketEntry[] => {
        const { basket } = get()
        const kl = getKivaLoans()
        return basket
          .map((bi) => ({
            id: bi.loan_id,
            amount: bi.amount,
            loan: kl?.getById(bi.loan_id),
          }))
          .filter((bi) => bi.loan !== undefined)
      },

      inBasket: (loanId: number): boolean => {
        return get().basket.some((bi) => bi.loan_id === loanId)
      },

      reconcileBasketOrphans: async (): Promise<void> => {
        const kl = getKivaLoans()
        const state = get()
        // Only after the dataset has loaded; otherwise a missing loan just means
        // "not downloaded yet" and we'd wrongly purge still-fundraising loans.
        if (!kl || state.downloading || state.loans.length === 0) return
        const orphanIds = state.basket
          .map((bi) => bi.loan_id)
          .filter((id) => !kl.getById(id))
        if (!orphanIds.length) return
        // Verify each orphan independently. Kiva's batch loans() endpoint 404s
        // the WHOLE request if any single id is invalid, so one dead id would
        // mask the status of the others. Per-id isolates each outcome.
        const probes: OrphanProbe[] = await Promise.all(
          orphanIds.map(async (id): Promise<OrphanProbe> => {
            try {
              const loans = await kl.fetchLoansByIds([id])
              const loan = loans.find((l) => l.id === id)
              // Only act on the loan we actually asked for. A success that
              // didn't return it is ambiguous — keep rather than destroy.
              return loan ? { id, loan } : { id, transientError: true }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              // "Invalid loan ID" => the loan is gone (removable). Anything
              // else (network / 5xx) is transient => keep and retry later.
              const gone = /InvalidIdentifier|Invalid loan ID/i.test(msg)
              return { id, loan: gone ? null : undefined, transientError: !gone }
            }
          }),
        )
        const { removeIds, fundraising } = partitionBasketOrphans(probes)
        // Still-fundraising orphans were merely absent from the local set;
        // hydrate them so they display instead of vanishing from the basket.
        const loanById = new Map(
          probes.filter((p) => p.loan).map((p) => [p.id, p.loan as unknown as KivaLoan]),
        )
        const fundraisingLoans = fundraising
          .map((id) => loanById.get(id))
          .filter((l): l is KivaLoan => Boolean(l))
        if (fundraisingLoans.length) kl.setKivaLoans(fundraisingLoans, false)
        if (!fundraisingLoans.length && !removeIds.length) return
        set((s) => {
          if (fundraisingLoans.length) {
            // Sync the store's reactive loan array with the singleton so basket
            // entries recompute and the newly hydrated loans show.
            s.loans = kl.loansFromKiva as never
            s.loanCount = kl.loansFromKiva.length
          }
          if (removeIds.length) {
            s.basket = s.basket.filter((bi) => !removeIds.includes(bi.loan_id))
            s.basketNotice =
              `${removeIds.length} loan${removeIds.length === 1 ? '' : 's'} removed from your ` +
              `basket (no longer available on Kiva).`
          }
        })
      },

      // ---------------------------------------------------------------
      // Loan actions
      // ---------------------------------------------------------------

      setLoans: (loans: KivaLoan[]) => {
        set((state) => {
          state.loans = loans as never
          state.loanCount = loans.length
          state.downloading = false
        })
      },

      setFilteredLoans: (loans: KivaLoan[], sameAsLast: boolean) => {
        set((state) => {
          state.filteredLoans = loans as never
          state.filteredSameAsLast = sameAsLast
        })
      },

      filterLoans: (criteria?: Criteria) => {
        const kl = getKivaLoans()
        if (!kl || !kl.isReady()) return

        // If no criteria supplied, pull from criteria store
        if (!criteria) {
          criteria = useCriteriaStore.getState().getLastCriteria()
        }

        const prev = get().filteredLoans
        const next = kl.filter(criteria, true)
        const same =
          prev === next ||
          (prev != null &&
            next != null &&
            prev.length === next.length &&
            prev.every((v, i) => v.id === next[i]?.id))

        set((state) => {
          // kl.filter() always returns a fresh array. When the result is
          // identical to last time (a no-op re-filter, e.g. a background resync
          // that changed nothing, or an echoed criteria push), keep the SAME
          // reference so filteredLoans subscribers (Search, the loan list, Live)
          // don't re-render and re-persist on every such pass.
          if (!same) state.filteredLoans = next as never
          state.filteredSameAsLast = same
          state.loanCount = kl.loansFromKiva.length
        })
      },

      setSelectedId: (id: number | null) => {
        set((state) => {
          state.selectedId = id
        })
      },

      setDownloading: (downloading: boolean) => {
        set((state) => {
          state.downloading = downloading
        })
      },

      setDownloadProgress: (progress: ProgressEvent | null) => {
        set((state) => {
          state.downloadProgress = progress as never
        })
      },

      setRunningTotals: (totals: RunningTotals | null) => {
        set((state) => {
          state.runningTotals = totals as never
        })
      },

      setSecondaryStatus: (label: string | null) => {
        set((state) => {
          state.secondaryStatus = label
        })
      },

      setBackgroundResyncState: (state_label: string | null) => {
        set((s) => {
          s.backgroundResyncState = state_label
        })
      },

      setBasketNotice: (msg: string | null) => {
        set((state) => {
          state.basketNotice = msg
        })
      },

      setLenderLoansLoading: (loading: boolean) => {
        set((state) => {
          state.lenderLoansLoading = loading
        })
      },

      beginCheckout: (ids: number[]) => {
        set((state) => {
          state.pendingCheckout = { ids, at: Date.now() }
        })
      },

      clearPendingCheckout: () => {
        set((state) => {
          state.pendingCheckout = null
        })
      },

      getLoan: (id: number): KivaLoan | undefined => {
        return getKivaLoans()?.getById(id)
      },

      // ---------------------------------------------------------------
      // Refresh
      // ---------------------------------------------------------------

      refreshBasketLoans: async () => {
        const kl = getKivaLoans()
        if (!kl) return
        const ids = get().basket.map((bi) => bi.loan_id)
        await kl.refreshLoans(ids)
        get().adjustBasketAmountsToWhatsLeft()
      },
    })),
    {
      name: 'kivalens-basket',
      // Persist the basket and any in-flight checkout so the outcome can be
      // reconciled after the user returns (even via the checkout tab / a reload).
      partialize: (state) => ({ basket: state.basket, pendingCheckout: state.pendingCheckout }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<LoanState>),
      }),
    },
  ),
)
