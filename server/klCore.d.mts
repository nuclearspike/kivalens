/** Mutable server state holding the prepared, batched loan dataset. */
export interface KLState {
  ready: boolean
  rssReady: boolean
  rssReadyPromise: Promise<void>
  resolveRssReady: () => void
  batch: number
  klStart: unknown
  batches: Map<number, unknown>
  partnersGz: Buffer | null
  optionsGz: Buffer | null
  allLoans: unknown[]
  recentlyFunded: Array<{ id: number; fundedAt: string }>
  loanDetailRequests: Map<string, Promise<unknown>>
  partners: unknown[]
  activePartners: unknown[]
  atheistListProcessed: boolean
  aplusMerged: number
  newestTime: number
  building: boolean
  stopped: boolean
  snapshotTimer: ReturnType<typeof setTimeout> | null
}

export const REFRESH_INTERVAL_MS: number

export function createState(): KLState

export function prepareData(state: KLState, log?: (msg: string) => void): Promise<void>

/** Starts the refresh and upkeep timers; stop() clears every one of them. */
export function startRefresh(state: KLState, log?: (msg: string) => void): { stop(): void }

/** /api/* and /graphql: a Response, or null when the request is not theirs. */
export function handleApi(state: KLState, request: Request): Promise<Response | null>

/** /proxy/kiva and /proxy/gdocs: a Response, or null when the request is not theirs. */
export function handleProxy(request: Request): Promise<Response | null>

/** /rss/<criteria>, /rss?<search> and /rss_click/<go_to>/<id>: a Response, or null. */
export function handleRss(state: KLState, request: Request): Promise<Response | null>

/** One page of Kiva's fundraising listing, and how many pages there are. */
export function fetchSearchPage(page: number): Promise<{ loans: Array<Record<string, unknown>>; pages: number }>

/** Full details for up to 50 loans. */
export function fetchDetailBatch(ids: number[]): Promise<Array<Record<string, unknown>>>

/** Listing loans merged with their details and processed; keeps those still raising money. */
export function processListed(
  searchLoans: Array<Record<string, unknown>>,
  details: Array<Record<string, unknown>>,
): { kept: Array<{ loan: Record<string, unknown>; keywords: unknown }>; processed: number }

/** The published batch as the snapshot store keeps it, or null before anything is published. */
export function snapshotOf(state: KLState): unknown | null
