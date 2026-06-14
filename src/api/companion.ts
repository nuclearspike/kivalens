/**
 * companion.ts - Client for the optional KivaLens Companion browser extension.
 *
 * The whole integration is gated by ONE build-time env var, VITE_COMPANION_EXT_ID:
 *   - absent  -> `companionEnabled` is false; no UI references the extension anywhere.
 *   - present -> the id is used to message the extension and the companion UI appears.
 *
 * Set a dev id in .env.local / .env.development and the published id in .env.production,
 * or remove the var entirely to hide the integration. The Companion runs in the user's
 * logged-in kiva.org session and returns DATA only - the Kiva access token never reaches
 * KivaLens.
 */

const RAW_ID = import.meta.env.VITE_COMPANION_EXT_ID
const COMPANION_EXT_ID: string | null = (RAW_ID && RAW_ID.trim()) || null

/** True only when VITE_COMPANION_EXT_ID is set at build time. Gate ALL companion UI on this. */
export const companionEnabled: boolean = COMPANION_EXT_ID !== null

export interface CompanionStatus {
  ok: boolean
  hasToken: boolean
  source: string | null
  expiresAt: number | null
  expiresInSec: number
}

export interface CompanionFeatures {
  ok: boolean
  version?: string
  features?: string[]
}

export interface GraphQLResult<T = unknown> {
  ok: boolean
  data?: T
  errors?: unknown
  status?: number
  error?: string
}

export interface DetectedLender {
  lender_id: string
  name?: string
  loanCount?: number
  memberSince?: string
}

interface ChromeRuntimeLike {
  sendMessage?: (id: string, msg: unknown, cb: (resp: unknown) => void) => void
  lastError?: { message?: string }
}

function chromeRuntime(): ChromeRuntimeLike | undefined {
  const c = (window as unknown as { chrome?: { runtime?: ChromeRuntimeLike } }).chrome
  return c?.runtime
}

function rawSend<T>(msg: unknown, timeoutMs = 25_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const rt = chromeRuntime()
    if (!COMPANION_EXT_ID || !rt?.sendMessage) {
      reject(new Error('companion_unavailable'))
      return
    }
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('timeout'))
      }
    }, timeoutMs)
    try {
      rt.sendMessage(COMPANION_EXT_ID, msg, (resp: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const lastError = chromeRuntime()?.lastError
        if (lastError) {
          reject(new Error(lastError.message || 'runtime_error'))
          return
        }
        resolve(resp as T)
      })
    } catch (e) {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(e as Error)
      }
    }
  })
}

type MyPortfolioData = {
  my?: {
    id?: string
    lender?: { id?: string; name?: string; publicId?: string; loanCount?: number; memberSince?: string }
    loans?: { totalCount?: number }
  }
}

export const companion = {
  enabled: companionEnabled,

  /** Resolves true only if the extension is enabled AND actually responds. */
  async ping(): Promise<boolean> {
    if (!companionEnabled) return false
    try {
      const f = await rawSend<CompanionFeatures>({ getFeatures: true }, 4_000)
      return !!(f && (f.ok || f.features))
    } catch {
      return false
    }
  },

  getFeatures(): Promise<CompanionFeatures> {
    return rawSend<CompanionFeatures>({ getFeatures: true })
  },

  getStatus(): Promise<CompanionStatus> {
    return rawSend<CompanionStatus>({ getStatus: true })
  },

  getMyStats<T = unknown>(): Promise<GraphQLResult<T>> {
    return rawSend<GraphQLResult<T>>({ getMyStats: true })
  },

  getMyPortfolio<T = unknown>(): Promise<GraphQLResult<T>> {
    return rawSend<GraphQLResult<T>>({ getMyPortfolio: true })
  },

  /** Generic authenticated passthrough - KivaLens composes any my or shop query. */
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult<T>> {
    return rawSend<GraphQLResult<T>>({ graphql: { query, variables } })
  },

  /** Auto-detect the logged-in lender (no manual ID entry). Null if not authenticated. */
  async detectLender(): Promise<DetectedLender | null> {
    const r = await rawSend<GraphQLResult<MyPortfolioData>>({ getMyPortfolio: true })
    const lender = r?.data?.my?.lender
    if (!lender) return null
    const id = lender.publicId || lender.id
    if (!id) return null
    return { lender_id: id, name: lender.name, loanCount: lender.loanCount, memberSince: lender.memberSince }
  },
}

// Console handle for dev testing - only when the integration is enabled.
if (companionEnabled && typeof window !== 'undefined') {
  ;(window as unknown as { klCompanion?: typeof companion }).klCompanion = companion
}
