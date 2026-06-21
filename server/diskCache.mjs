/**
 * diskCache.mjs — a tiny JSON/text cache on the (ephemeral) local filesystem.
 * Used by the prod server to keep the A+ spreadsheet and per-lender portfolio
 * data across the process lifetime without re-fetching, since the dyno's disk
 * survives until the next restart. Restarts can be rare, so cleanupCache()
 * evicts stale + space-hogging entries (Redis is too small at 30MB for this).
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const CACHE_DIR = path.join(os.tmpdir(), 'kivalens-cache')

const filePath = (key) => path.join(CACHE_DIR, key)
const ensureDir = () => fs.mkdir(CACHE_DIR, { recursive: true })

/** Read a cached entry, or null if missing / older than maxAgeMs. */
export async function readCache(key, maxAgeMs) {
  try {
    const fp = filePath(key)
    const stat = await fs.stat(fp)
    if (maxAgeMs && Date.now() - stat.mtimeMs > maxAgeMs) return null
    return await fs.readFile(fp, 'utf8')
  } catch {
    return null
  }
}

/** Write a cache entry (creates the dir). Returns true on success. */
export async function writeCache(key, data) {
  try {
    await ensureDir()
    await fs.writeFile(filePath(key), data, 'utf8')
    return true
  } catch {
    return false
  }
}

async function rm(name) {
  try {
    await fs.unlink(filePath(name))
  } catch {
    /* ignore */
  }
}

/**
 * Evict entries (optionally only those whose name starts with `prefix`):
 *   - older than maxAgeMs, then
 *   - beyond maxFiles (keep newest by mtime), then
 *   - beyond maxBytes total (keep newest by mtime).
 * Returns the list of removed file names.
 */
export async function cleanupCache({ prefix = '', maxAgeMs, maxFiles, maxBytes } = {}) {
  const removed = []
  try {
    await ensureDir()
    const names = (await fs.readdir(CACHE_DIR)).filter((n) => n.startsWith(prefix))
    let stats = []
    for (const n of names) {
      try {
        const s = await fs.stat(filePath(n))
        stats.push({ n, mtime: s.mtimeMs, size: s.size })
      } catch {
        /* skip vanished file */
      }
    }
    const now = Date.now()
    if (maxAgeMs) {
      const fresh = []
      for (const f of stats) {
        if (now - f.mtime > maxAgeMs) {
          await rm(f.n)
          removed.push(f.n)
        } else {
          fresh.push(f)
        }
      }
      stats = fresh
    }
    stats.sort((a, b) => b.mtime - a.mtime) // newest first
    if (maxFiles && stats.length > maxFiles) {
      for (const f of stats.slice(maxFiles)) {
        await rm(f.n)
        removed.push(f.n)
      }
      stats = stats.slice(0, maxFiles)
    }
    if (maxBytes) {
      let total = 0
      for (const f of stats) {
        total += f.size
        if (total > maxBytes) {
          await rm(f.n)
          removed.push(f.n)
        }
      }
    }
  } catch {
    /* ignore cleanup errors */
  }
  return removed
}
