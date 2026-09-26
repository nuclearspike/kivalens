/**
 * redisUsage.mjs — the Ask KivaLens spend counter and conversation log in Redis,
 * for the Node server (runtime.mjs `usage`). It shares klCache's connection and
 * its RESP2/password-only handshake. With Redis unconfigured or failing, each
 * operation falls back to memory for the life of the process, so the assistant
 * keeps working and a restart forgets.
 */
import { getRedisClient } from './klCache.mjs'
import { memoryUsage } from './runtime.mjs'

const LOG_CAP = 500
const COST_TTL_SECONDS = 70 * 24 * 60 * 60 // keep a month's counter ~70 days
const LOG_KEY = 'kl:ai:log'
const costKey = (month) => `kl:ai:cost:${month}`
const parse = (r) => {
  try {
    return JSON.parse(r)
  } catch {
    return { raw: r }
  }
}

export function redisUsage() {
  const mem = memoryUsage()
  return {
    async getSpend(month) {
      const client = await getRedisClient()
      if (!client) return mem.getSpend(month)
      try {
        const v = await client.get(costKey(month))
        return v ? parseFloat(v) : 0
      } catch {
        return mem.getSpend(month)
      }
    },
    async addSpend(month, usd) {
      const client = await getRedisClient()
      if (!client) return mem.addSpend(month, usd)
      try {
        await client.incrByFloat(costKey(month), usd)
        await client.expire(costKey(month), COST_TTL_SECONDS)
      } catch {
        await mem.addSpend(month, usd)
      }
    },
    async pushLog(entry) {
      const client = await getRedisClient()
      if (!client) return mem.pushLog(entry)
      try {
        const line = JSON.stringify(entry)
        await client.lPush(LOG_KEY, line)
        await client.lTrim(LOG_KEY, 0, LOG_CAP - 1)
        // Per-day list for the daily digest (kept ~4 days).
        const day = (entry.at || new Date().toISOString()).slice(0, 10)
        await client.lPush(`kl:ai:log:${day}`, line)
        await client.expire(`kl:ai:log:${day}`, 4 * 24 * 60 * 60)
      } catch {
        await mem.pushLog(entry)
      }
    },
    async dayLogs(day) {
      const client = await getRedisClient()
      if (!client) return mem.dayLogs(day)
      try {
        return (await client.lRange(`kl:ai:log:${day}`, 0, -1)).map(parse)
      } catch {
        return []
      }
    },
    // Idempotent and multi-dyno-safe: only the process that wins SET NX sends the digest.
    async claimDigest(day) {
      const client = await getRedisClient()
      if (!client) return false
      try {
        const ok = await client.set(`kl:ai:digest:${day}`, '1', { NX: true, EX: 4 * 24 * 60 * 60 })
        return ok === 'OK' || ok === true
      } catch {
        return false
      }
    },
    // After a day's digest is emailed, the chats it covered go: that day's list, and
    // entries on or before `day` in the rolling log. The emailed digest is the archive.
    async clearThrough(day) {
      const client = await getRedisClient()
      if (!client) return mem.clearThrough(day)
      try {
        await client.del(`kl:ai:log:${day}`)
        const rows = await client.lRange(LOG_KEY, 0, -1)
        const keep = rows.filter((r) => ((parse(r).at) || '').slice(0, 10) > day)
        const multi = client.multi()
        multi.del(LOG_KEY)
        if (keep.length) multi.rPush(LOG_KEY, keep)
        await multi.exec()
      } catch {
        // best-effort; the per-day key expires on its own
      }
    },
    async recent(n) {
      const client = await getRedisClient()
      if (!client) return mem.recent(n)
      try {
        return (await client.lRange(LOG_KEY, 0, n - 1)).map(parse)
      } catch {
        return mem.recent(n)
      }
    },
  }
}
