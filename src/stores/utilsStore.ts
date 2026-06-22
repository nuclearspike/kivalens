import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { lsj } from '../lib/localStorage'
import { getKivaLoans } from '../api/kiva'
import { useCriteriaStore } from './criteriaStore'
import { useLoanStore } from './loanStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LenderObj {
  lender_id: string
  name?: string
  whereabouts?: string
  country_code?: string
  uid?: string
  member_since?: string
  personal_url?: string
  occupation?: string
  loan_because?: string
  occupational_info?: string
  loan_count?: number
  invitee_count?: number
  image?: { id: number; template_id?: number }
}

export interface UtilsState {
  /** Kiva lender ID from Options */
  lenderId: string
  /** Full lender object fetched from the Kiva API */
  lenderObj: LenderObj | null
  /** Bumps when lender-dependent data should reload */
  lenderDataVersion: number
  /** Global lender-ID modal visibility */
  lenderModalOpen: boolean
  /** Whether the Ask KivaLens widget panel is open */
  askKlOpen: boolean
  /** A seed prompt to auto-send when the widget opens (consumed once) */
  askKlSeed: string | null
  /** User preference: hide the Ask KivaLens AI widget entirely */
  aiWidgetDisabled: boolean
  /** Server global switch (ASK_KIVALENS_ENABLED + key present); null until checked. */
  aiServerEnabled: boolean | null
  /** AI spotlight: point a bouncing arrow + callout at a UI element (by data-aikl). */
  aiCallout: { target: string; message: string; nonce: number } | null
  /** AI request to switch the Search criteria tab (borrower/partner/portfolio/rss). */
  aiCriteriaTab: { tab: string; nonce: number } | null
  /** Whether the heartbeat interval is active */
  heartbeatActive: boolean
  /** Timestamp of last heartbeat */
  lastHeartbeat: number | null
  /** Shared variables (legacy compat for var.get / var.set pattern) */
  sharedVars: Record<string, unknown>
}

export interface UtilsActions {
  setLenderId: (id: string, lenderObj?: LenderObj | null) => void
  setLenderObj: (obj: LenderObj | null) => void
  fetchLenderObj: (lenderId: string, displayError?: boolean) => Promise<void>
  openLenderIdModal: () => void
  closeLenderIdModal: () => void
  openAskKl: (seed?: string) => void
  closeAskKl: () => void
  consumeAskKlSeed: () => string | null
  setAiWidgetDisabled: (disabled: boolean) => void
  setAiServerEnabled: (enabled: boolean) => void
  showCallout: (target: string, message: string) => void
  clearCallout: () => void
  setAiCriteriaTab: (tab: string) => void
  doHeartbeat: () => Promise<void>
  startHeartbeat: () => void
  stopHeartbeat: () => void
  getVar: (name: string) => unknown
  setVar: (name: string, value: unknown) => void
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUtilsStore = create<UtilsState & UtilsActions>()(
  persist(
    immer((set, get) => ({
      // -- state --
      // LEGACY MIGRATION (added 2026-06; remove ~2027-06): seed lenderId from the
      // pre-persist Options blob. persist ('kivalens-utils') wins via merge once set.
      lenderId: lsj.get<{ kiva_lender_id?: string }>('Options').kiva_lender_id ?? '',
      lenderObj: null,
      lenderDataVersion: 0,
      lenderModalOpen: false,
      askKlOpen: false,
      askKlSeed: null,
      aiWidgetDisabled: false,
      aiServerEnabled: null,
      aiCallout: null,
      aiCriteriaTab: null,
      heartbeatActive: false,
      lastHeartbeat: null,
      sharedVars: {},

      // ---------------------------------------------------------------
      // Actions
      // ---------------------------------------------------------------

      setLenderId: (id: string, lenderObj: LenderObj | null = null) => {
        const nextId = id.trim()
        set((state) => {
          state.lenderId = nextId
          state.lenderObj = nextId ? lenderObj as never : null
          state.lenderDataVersion += 1
        })
        // lenderId is persisted by zustand ('kivalens-utils'); no legacy Options
        // write, and no synthetic 'storage' event — zustand re-renders consumers.

        // Propagate to kivaloans singleton
        const kl = getKivaLoans()
        kl?.setLender(nextId)

        if (nextId) {
          if (!lenderObj) {
            void get().fetchLenderObj(nextId, true)
          }
          useCriteriaStore.getState().updateBalancers()
        } else {
          useLoanStore.getState().filterLoans()
        }
      },

      setLenderObj: (obj: LenderObj | null) => {
        set((state) => {
          state.lenderObj = obj as never
        })
        if (obj) {
          lsj.set('lenderObj', obj)
        }
      },

      openLenderIdModal: () => {
        set((state) => {
          state.lenderModalOpen = true
        })
      },

      closeLenderIdModal: () => {
        set((state) => {
          state.lenderModalOpen = false
        })
      },

      openAskKl: (seed?: string) => {
        set((state) => {
          state.askKlOpen = true
          if (seed) state.askKlSeed = seed
        })
      },

      closeAskKl: () => {
        set((state) => {
          state.askKlOpen = false
        })
      },

      consumeAskKlSeed: () => {
        const seed = get().askKlSeed
        if (seed) {
          set((state) => {
            state.askKlSeed = null
          })
        }
        return seed
      },

      setAiWidgetDisabled: (disabled: boolean) => {
        set((state) => {
          state.aiWidgetDisabled = disabled
          if (disabled) state.askKlOpen = false
        })
      },

      setAiServerEnabled: (enabled: boolean) => {
        set((state) => {
          state.aiServerEnabled = enabled
        })
      },

      showCallout: (target: string, message: string) => {
        const nonce = (get().aiCallout?.nonce ?? 0) + 1
        set((state) => {
          state.aiCallout = { target, message, nonce }
        })
      },

      clearCallout: () => {
        set((state) => {
          state.aiCallout = null
        })
      },

      setAiCriteriaTab: (tab: string) => {
        const nonce = (get().aiCriteriaTab?.nonce ?? 0) + 1
        set((state) => {
          state.aiCriteriaTab = { tab, nonce }
        })
      },

      fetchLenderObj: async (lenderId: string, displayError = false) => {
        if (!lenderId) return
        try {
          const kl = getKivaLoans()
          if (!kl) return

          const lender = await kl.fetchLender(lenderId)
          get().setLenderObj(lender)
        } catch (err: unknown) {
          const error = err as { status?: number; message?: string }
          console.warn('fetchLenderObj failed', lenderId, error)
          if (displayError && (error.status === 400 || error.status === 404)) {
            const hint =
              error.status === 400
                ? 'Maybe you used your email address by mistake?'
                : 'Did you change it on Kiva recently?'
            console.error(
              `Invalid Lender ID: ${lenderId}. ${hint} It has been cleared out. Set it again to continue.`,
            )
            // Clear invalid lender id (store is the source of truth now)
            set((state) => {
              state.lenderId = ''
              state.lenderObj = null
              state.lenderDataVersion += 1
            })
            getKivaLoans()?.setLender('')
            useLoanStore.getState().filterLoans()
          }
        }
      },

      doHeartbeat: async () => {
        const lenderId = get().lenderObj?.lender_id ?? get().lenderId ?? 'unknown'
        const extras = lsj.get<{ install_id?: string }>('Extras')

        // Ensure install_id exists
        let installId = extras.install_id
        if (!installId) {
          installId = 'i_' + Math.round(Math.random() * 1000000)
          lsj.setMerge('Extras', { install_id: installId })
        }

        const pageStarted = (window as unknown as { pageStarted?: number }).pageStarted ?? Date.now()
        const uptime = Math.floor((Date.now() - pageStarted) / 60000)

        try {
          await getKivaLoans()?.heartbeat(installId, lenderId, uptime)
        } catch (err: unknown) {
          const error = err as { status?: number }
          if (error.status === 205) {
            window.location.reload()
          }
        }

        set((state) => {
          state.lastHeartbeat = Date.now()
        })
      },

      startHeartbeat: () => {
        if (heartbeatIntervalId) return
        // Initial heartbeat after 10 seconds, then every 5 minutes
        setTimeout(() => void get().doHeartbeat(), 10_000)
        heartbeatIntervalId = setInterval(() => void get().doHeartbeat(), 5 * 60_000)
        set((state) => {
          state.heartbeatActive = true
        })
      },

      stopHeartbeat: () => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId)
          heartbeatIntervalId = null
        }
        set((state) => {
          state.heartbeatActive = false
        })
      },

      getVar: (name: string): unknown => {
        return get().sharedVars[name]
      },

      setVar: (name: string, value: unknown) => {
        set((state) => {
          state.sharedVars[name] = value
        })
      },
    })),
    {
      name: 'kivalens-utils',
      partialize: (state) => ({
        lenderId: state.lenderId,
        aiWidgetDisabled: state.aiWidgetDisabled,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<UtilsState>),
      }),
    },
  ),
)
