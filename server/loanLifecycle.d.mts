import type { KLState } from './klCore.mjs'

export const RECENTLY_FUNDED_TTL_MS: number
export function recentlyFunded(state: KLState, now?: number): Array<{ id: number; fundedAt: string }>
export function observeFundedLoans(state: KLState, loans: Array<{ id: number; status?: string; funded_date?: string }>, now?: number): Array<{ id: number; fundedAt: string }>
