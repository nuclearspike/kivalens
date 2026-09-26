/**
 * What this browser keeps for the shared support screens: its installation key
 * and the reports sent from it (each with its private receipt and the full text
 * the lender wrote), plus when status was last checked.
 *
 * IndexedDB, because the installation key is a non-extractable CryptoKey: it can
 * be stored as an object but never turned into a string, so localStorage cannot
 * hold it. A browser that keeps no data for the site (some private windows,
 * blocked storage) still gets a working key for the life of the page — Feedback
 * sends — while My Reports says it cannot keep reports here
 * (reports.storageUnavailable). Records carry the app id and are filtered by it,
 * so reports are this app's only (definition rules.reportAppScope).
 */

export type ReportKind = 'bug' | 'suggestion' | 'languageRequest'

export type OutcomeCode =
  | 'received'
  | 'beingLookedAt'
  | 'needsInformation'
  | 'waitingForReply'
  | 'fixPrepared'
  | 'fixedIn'
  | 'availableIn'
  | 'cantReproduce'
  | 'completed'
  | 'relatedReport'
  | 'unavailable'

export interface ContactState {
  state: 'none' | 'pending' | 'verified' | 'removed'
  email?: string
  pendingEmail?: string
  undoUntil?: string
}

export interface StoredReport {
  appId: string
  reportCode: string
  receipt: string
  kind: ReportKind
  /** Exactly what the lender wrote and sent. */
  message: string
  createdAt: string
  outcome?: OutcomeCode
  fixedVersion?: string
  /** Unknown until a status check says otherwise; never assumed to be none. */
  contact?: ContactState
  revision?: number
  checkedAt?: string
}

export interface Installation {
  keyId: string
  keyPair: CryptoKeyPair
}

export interface SupportStore {
  readonly persistent: boolean
  getInstallation(): Promise<Installation | undefined>
  setInstallation(value: Installation | undefined): Promise<void>
  listReports(appId: string): Promise<StoredReport[]>
  putReport(report: StoredReport): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}

const DB_NAME = 'kl-support'
const DB_VERSION = 1

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

class IndexedDbStore implements SupportStore {
  readonly persistent = true
  // A report the database refused (quota, a storage error mid-session) is kept
  // here for the page's life: it was accepted, and sending it again would only
  // file it twice.
  private readonly unsaved = new Map<string, StoredReport>()
  private readonly db: IDBDatabase
  constructor(db: IDBDatabase) {
    this.db = db
  }

  private store(name: string, mode: IDBTransactionMode) {
    return this.db.transaction(name, mode).objectStore(name)
  }

  getInstallation() {
    return request(this.store('installation', 'readonly').get('current')) as Promise<Installation | undefined>
  }
  async setInstallation(value: Installation | undefined) {
    const store = this.store('installation', 'readwrite')
    if (value) await request(store.put(value, 'current'))
    else await request(store.delete('current'))
  }
  async listReports(appId: string) {
    let saved: StoredReport[]
    try {
      saved = (await request(this.store('reports', 'readonly').getAll())) as StoredReport[]
    } catch {
      saved = []
    }
    const byCode = new Map(saved.map((r) => [r.reportCode, r]))
    for (const [code, report] of this.unsaved) byCode.set(code, report)
    return [...byCode.values()].filter((r) => r.appId === appId)
  }
  async putReport(report: StoredReport) {
    try {
      await request(this.store('reports', 'readwrite').put(report, report.reportCode))
      this.unsaved.delete(report.reportCode)
    } catch {
      this.unsaved.set(report.reportCode, report)
    }
  }
  getMeta<T>(key: string) {
    return request(this.store('meta', 'readonly').get(key)) as Promise<T | undefined>
  }
  async setMeta(key: string, value: unknown) {
    await request(this.store('meta', 'readwrite').put(value, key))
  }
}

/** For the life of the page only: used when the browser keeps no data for the site. */
export class MemoryStore implements SupportStore {
  readonly persistent: boolean
  private installation: Installation | undefined
  private readonly reports = new Map<string, StoredReport>()
  private readonly meta = new Map<string, unknown>()
  constructor(persistent = false) {
    this.persistent = persistent
  }
  async getInstallation() {
    return this.installation
  }
  async setInstallation(value: Installation | undefined) {
    this.installation = value
  }
  async listReports(appId: string) {
    return [...this.reports.values()].filter((r) => r.appId === appId)
  }
  async putReport(report: StoredReport) {
    this.reports.set(report.reportCode, report)
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined
  }
  async setMeta(key: string, value: unknown) {
    this.meta.set(key, value)
  }
}

let opened: Promise<SupportStore> | null = null

export function openSupportStore(): Promise<SupportStore> {
  opened ??= (async () => {
    try {
      if (typeof indexedDB === 'undefined') return new MemoryStore()
      const open = indexedDB.open(DB_NAME, DB_VERSION)
      open.onupgradeneeded = () => {
        const db = open.result
        for (const name of ['installation', 'reports', 'meta']) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
        }
      }
      return new IndexedDbStore(await request(open))
    } catch {
      return new MemoryStore()
    }
  })()
  return opened
}

/** Tests only: forget the opened store so the next open starts over. */
export function resetSupportStoreForTests(store?: SupportStore) {
  opened = store ? Promise.resolve(store) : null
}
