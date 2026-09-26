/**
 * runtime.mjs — what the server needs from the machine it runs on, supplied by
 * the host at startup: the Node server (prod.mjs and the Vite dev plugin) or the
 * Cloudflare Worker (cloudflare/kivalens).
 *
 *   cache      small text entries with an age (the A+ spreadsheet, a lender's loans,
 *              translations, borrower ages). Node: files in the OS temp directory
 *              (diskCache.mjs). Cloudflare: a SQLite table in the Durable Object.
 *   snapshots  the last published batch, so a restart can serve before its first
 *              refresh finishes. Node: Redis (klCache.mjs). Cloudflare: R2.
 *   usage      the Ask KivaLens spend counter and conversation log. Node: Redis
 *              (redisUsage.mjs). Cloudflare: SQLite.
 *
 * Every part defaults to memory, so tests and a bare import work without setup,
 * and the server modules never import a host's storage themselves: the Worker
 * bundle then contains no Redis or file-system code.
 */

/** Entries kept in memory for the life of the process. */
export function memoryCache() {
  const entries = new Map()
  return {
    async get(key, maxAgeMs) {
      const e = entries.get(key)
      if (!e) return null
      if (maxAgeMs && Date.now() - e.at > maxAgeMs) return null
      return e.value
    },
    async set(key, value) {
      entries.set(key, { value: String(value), at: Date.now() })
      return true
    },
    async cleanup({ prefix = '', maxAgeMs, maxFiles, maxBytes } = {}) {
      const removed = []
      let kept = [...entries].filter(([k]) => k.startsWith(prefix))
      const now = Date.now()
      if (maxAgeMs) {
        for (const [k, e] of kept) if (now - e.at > maxAgeMs) removed.push(k)
        kept = kept.filter(([k]) => !removed.includes(k))
      }
      kept.sort((a, b) => b[1].at - a[1].at) // newest first
      if (maxFiles && kept.length > maxFiles) {
        for (const [k] of kept.slice(maxFiles)) removed.push(k)
        kept = kept.slice(0, maxFiles)
      }
      if (maxBytes) {
        let total = 0
        for (const [k, e] of kept) {
          total += e.value.length
          if (total > maxBytes) removed.push(k)
        }
      }
      for (const k of removed) entries.delete(k)
      return removed
    },
  }
}

/** No snapshot store: nothing is saved and every load is a miss. */
export const noSnapshots = {
  async save() {},
  async load() {
    return null
  },
}

/** The spend counter and conversation log, in memory for the life of the process. */
export function memoryUsage() {
  const cost = {}
  let log = []
  const claimed = new Set()
  const LOG_CAP = 500
  return {
    async getSpend(month) {
      return cost[month] || 0
    },
    async addSpend(month, usd) {
      cost[month] = (cost[month] || 0) + usd
    },
    async pushLog(entry) {
      log.unshift(entry)
      if (log.length > LOG_CAP) log.length = LOG_CAP
    },
    async dayLogs(day) {
      return log.filter((e) => (e.at || '').slice(0, 10) === day)
    },
    // Only a shared store can say which process won; in memory nobody claims.
    async claimDigest() {
      return false
    },
    async clearThrough(day) {
      log = log.filter((e) => (e.at || '').slice(0, 10) > day)
    },
    async recent(n) {
      return log.slice(0, n)
    },
    // Test support: what claimDigest would need to remember.
    claimed,
  }
}

let parts = { cache: memoryCache(), snapshots: noSnapshots, usage: memoryUsage() }

/** Set by the host once, at startup, before the server does any work. */
export function configureRuntime(overrides) {
  parts = { ...parts, ...overrides }
}

/** Test support: back to memory for everything. */
export function resetRuntime() {
  parts = { cache: memoryCache(), snapshots: noSnapshots, usage: memoryUsage() }
}

// Every call through a facade returns a promise, whatever the store does: one
// that throws, or returns a plain value, reaches the caller as a rejection or a
// resolved value that the caller's own await and catch already handle.
export const cache = {
  get: async (key, maxAgeMs) => parts.cache.get(key, maxAgeMs),
  set: async (key, value) => parts.cache.set(key, value),
  cleanup: async (options) => parts.cache.cleanup(options),
}

export const snapshots = {
  save: async (snapshot, log) => parts.snapshots.save(snapshot, log),
  load: async (log) => parts.snapshots.load(log),
}

export const usage = {
  getSpend: async (month) => parts.usage.getSpend(month),
  addSpend: async (month, usd) => parts.usage.addSpend(month, usd),
  pushLog: async (entry) => parts.usage.pushLog(entry),
  dayLogs: async (day) => parts.usage.dayLogs(day),
  claimDigest: async (day) => parts.usage.claimDigest(day),
  clearThrough: async (day) => parts.usage.clearThrough(day),
  recent: async (n) => parts.usage.recent(n),
}
