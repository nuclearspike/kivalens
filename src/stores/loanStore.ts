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
  /** Adjust every basket item amount to the lesser of current amount and kl_still_needed */
  adjustBasketAmountsToWhatsLeft: () => void
  /** Return hydrated basket entries (with loan objects attached) */
  getBasket: () => BasketEntry[]
  /** Check whether a loan is in the basket */
  inBasket: (loanId: number) => boolean

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
          state.filteredLoans = next as never
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
