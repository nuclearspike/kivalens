import type { IncomingMessage, ServerResponse } from 'node:http'

/** Mutable server state holding the prepared, batched loan dataset. */
export interface KLState {
  ready: boolean
  batch: number
  klStart: unknown
  batches: Map<number, unknown>
  partnersGz: Buffer | null
  optionsGz: Buffer | null
  allLoans: unknown[]
  newestTime: number
  building: boolean
}

export const REFRESH_INTERVAL_MS: number

export function createState(): KLState

export function prepareData(state: KLState, log?: (msg: string) => void): Promise<void>

/** Kick off the initial download and a refresh timer. Returns the timer id. */
export function startRefresh(state: KLState, log?: (msg: string) => void): NodeJS.Timeout

/** Handle /api/* and /graphql. Returns true if it handled the request. */
export function handleApi(
  state: KLState,
  req: IncomingMessage,
  res: ServerResponse,
): boolean

/** Handle /proxy/kiva and /proxy/gdocs. Returns true if it handled the request. */
export function handleProxy(req: IncomingMessage, res: ServerResponse): boolean
