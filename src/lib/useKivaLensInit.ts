import { useEffect, useRef } from 'react'
import { createKivaLoans, getKivaLoans } from '../api/kiva'
import type { Loans } from '../api/kiva'
import { useLoanStore } from '../stores/loanStore'
import { useCriteriaStore } from '../stores/criteriaStore'
import { useUtilsStore } from '../stores/utilsStore'
import { lsj } from './localStorage'

/**
 * Bootstrap hook — creates the KivaLoans singleton, starts the download,
 * and wires notification events to the Zustand stores.
 *
 * Call once from the root layout component.
 *
 * The singleton creation + init is guarded by a ref so it only runs once,
 * but the notification subscription runs on every mount.  This is critical
 * for React strict mode where the effect mounts → unmounts → remounts.
 */
export function useKivaLensInit() {
  const initialized = useRef(false)

  useEffect(() => {
    const criteria = useCriteriaStore.getState().getLastCriteria()
    let kl: Loans

    // Create & init the singleton only once
    if (!initialized.current) {
      initialized.current = true
      const options = lsj.get<Record<string, any>>('Options')
      kl = createKivaLoans(10 * 60_000) // 10 minute resync interval
      kl.init(criteria, () => lsj.get<Record<string, any>>('Options'), {
        maxConcurrent: options.maxConcurrent ?? 8,
      })
      useUtilsStore.getState().startHeartbeat()
      if (options.kiva_lender_id) {
        void useUtilsStore.getState().fetchLenderObj(options.kiva_lender_id, false)
      }

      // Load the authoritative facet taxonomy (sectors/activities/themes/tags)
      // the server pulls from Kiva's GraphQL — the dropdowns merge this with
      // their hard-coded baseline so the lists are always complete.
      void fetch('/api/options')
        .then((r) => (r.ok ? r.json() : null))
        .then((opts) => {
          if (opts) useCriteriaStore.getState().setAllOptions(opts)
        })
        .catch((err) => {
          // Non-fatal: dropdowns fall back to the hard-coded baseline. Surface
          // it rather than swallowing silently so failures are diagnosable.
          console.warn('KivaLens: failed to load facet options from /api/options', err)
        })
    } else {
      kl = getKivaLoans()
    }

    // Subscribe to notification events — must happen on every mount
    const unsubscribe = kl.onNotify((msg) => {
      const store = useLoanStore.getState()

      // Download progress
      if (msg.loan_load_progress) {
        store.setDownloadProgress(msg.loan_load_progress)
      }

      // Loans finished loading
      if (msg.loans_loaded) {
        store.setLoans(kl.loansFromKiva)
        store.setDownloading(false)
        // Trigger initial filter
        store.filterLoans(criteria)
      }

      // All descriptions loaded (secondary pass)
      if (msg.all_descriptions_loaded) {
        store.setLoans(kl.loansFromKiva)
        store.filterLoans()
      }

      // Background resync updates
      if (msg.backgroundResync) {
        const state = (msg.backgroundResync as { state?: string }).state
        store.setBackgroundResyncState(state ?? null)
      if (state === 'done') {
        store.setLoans(kl.loansFromKiva)
        store.filterLoans()
        // Clear the resync banner after a moment
        setTimeout(() => store.setBackgroundResyncState(null), 3000)
      }
      }

      // New loans discovered by the background resync
      if (msg.new_loans) {
        store.setLoans(kl.loansFromKiva)
        store.filterLoans()
      }

      // Background resync changed existing loans (funded amounts, etc.)
      if (msg.background_updated) {
        store.setLoans(kl.loansFromKiva)
        store.filterLoans()
      }

      // Loan no longer fundraising: drop it from the list AND prune it from
      // the basket (the original app's advertised "Basket Pruning")
      if (msg.loan_not_fundraising) {
        const gone = msg.loan_not_fundraising as { id: number }
        // T1.5: don't silently drop a basket loan — tell the user why.
        if (store.inBasket(gone.id)) {
          store.setBasketNotice('A loan in your basket finished funding and was removed.')
        }
        store.removeFromBasket(gone.id)
        store.setLoans(kl.loansFromKiva)
        store.filterLoans()
      }

      // Running totals
      if (msg.running_totals_change) {
        store.setRunningTotals(msg.running_totals_change as any)
      }

      // Secondary load status
      if (msg.secondary_load) {
        store.setSecondaryStatus(msg.secondary_load as string)
      }
      if (msg.secondary_load_label) {
        store.setSecondaryStatus(msg.secondary_load_label as string)
      }

      // Portfolio-exclusion (T1.4): track the load so the UI can reveal that
      // exclusion is pending instead of silently showing already-funded loans.
      if (msg.lender_loans_event === 'started') {
        store.setLenderLoansLoading(true)
      }
      if (msg.lender_loans_event === 'done') {
        store.setLenderLoansLoading(false)
        useCriteriaStore.getState().updateBalancers()
        store.filterLoans()
      }
    })

    // If the singleton already has data (strict-mode re-mount race), sync now
    if (kl.isReady()) {
      const store = useLoanStore.getState()
      store.setLoans(kl.loansFromKiva)
      store.setDownloading(false)
      store.filterLoans(criteria)
    }

    return () => {
      unsubscribe()
      // Don't kill the singleton — it must survive strict-mode remounts
    }
  }, [])
}
