/**
 * aiUsage.mjs — OpenAI cost tracking + interaction logging for Ask KivaLens.
 *
 * - Monthly cost counter with a hard cutoff (default $20) to prevent abuse.
 * - A capped log of interactions (what users asked + how the AI responded +
 *   which tools it called + token usage) for review/refinement.
 *
 * Persisted in Redis (shared connection from klCache) so it survives dyno
 * restarts; falls back to in-memory (per-process) when Redis isn't configured.
 */
import { getRedisClient } from './klCache.mjs'

export const BUDGET_USD = Number(process.env.OPENAI_MONTHLY_BUDGET_USD) || 20
const LOG_CAP = 500
const COST_TTL_SECONDS = 70 * 24 * 60 * 60 // keep a month's counter ~70 days

// Per-1,000,000-token prices (USD). Keep in sync with the model you run
// (OPENAI_CHAT_MODEL). Falls back to gpt-4o-mini pricing for unknown models.
const PRICING = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4.1': { in: 2.0, out: 8 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-4.1-nano': { in: 0.1, out: 0.4 },
}
const DEFAULT_PRICE = { in: 0.15, out: 0.6 }

export function costOf(model, promptTokens = 0, completionTokens = 0) {
  const p = PRICING[model] || DEFAULT_PRICE
  return (promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out
}

export function monthKey() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM (UTC)
}
const costKey = () => `kl:ai:cost:${monthKey()}`
const LOG_KEY = 'kl:ai:log'

// In-memory fallback (dev / Redis down). Per-process only.
const mem = { cost: {}, log: [] }

export async function getMonthlySpend() {
  const client = await getRedisClient()
  if (!client) return mem.cost[monthKey()] || 0
  try {
    const v = await client.get(costKey())
    return v ? parseFloat(v) : 0
  } catch {
    return mem.cost[monthKey()] || 0
  }
}

export async function budgetExceeded() {
  return (await getMonthlySpend()) >= BUDGET_USD
}

export async function addSpend(usd) {
  if (!(usd > 0)) return
  const client = await getRedisClient()
  if (!client) {
    mem.cost[monthKey()] = (mem.cost[monthKey()] || 0) + usd
    return
  }
  try {
    await client.incrByFloat(costKey(), usd)
    await client.expire(costKey(), COST_TTL_SECONDS)
  } catch {
    mem.cost[monthKey()] = (mem.cost[monthKey()] || 0) + usd
  }
}

/**
 * Record one chat turn. entry = { at, lenderId, page, selectedLoanId,
 * userMessage, response, tools, model, promptTokens, completionTokens, costUsd }.
 */
export async function logInteraction(entry) {
  const line = JSON.stringify(entry)
  console.log('[ai-chat]', line.length > 2000 ? line.slice(0, 2000) + '…' : line)
  const client = await getRedisClient()
  if (!client) {
    mem.log.unshift(entry)
    if (mem.log.length > LOG_CAP) mem.log.length = LOG_CAP
    return
  }
  try {
    await client.lPush(LOG_KEY, line)
    await client.lTrim(LOG_KEY, 0, LOG_CAP - 1)
    // Per-day list for the daily digest (kept ~4 days).
    const day = (entry.at || new Date().toISOString()).slice(0, 10)
    await client.lPush(`kl:ai:log:${day}`, line)
    await client.expire(`kl:ai:log:${day}`, 4 * 24 * 60 * 60)
  } catch {
    mem.log.unshift(entry)
    if (mem.log.length > LOG_CAP) mem.log.length = LOG_CAP
  }
}

// All interactions for one UTC day (YYYY-MM-DD), oldest-first not guaranteed.
export async function getDayLogs(day) {
  const client = await getRedisClient()
  if (!client) return mem.log.filter((e) => (e.at || '').slice(0, 10) === day)
  try {
    const rows = await client.lRange(`kl:ai:log:${day}`, 0, -1)
    return rows.map((r) => {
      try {
        return JSON.parse(r)
      } catch {
        return { raw: r }
      }
    })
  } catch {
    return []
  }
}

// Idempotent, multi-dyno-safe claim so the daily digest is sent exactly once.
// Returns true only for the process that wins the SET NX. No Redis -> false.
export async function claimDigest(day) {
  const client = await getRedisClient()
  if (!client) return false
  try {
    const ok = await client.set(`kl:ai:digest:${day}`, '1', { NX: true, EX: 4 * 24 * 60 * 60 })
    return ok === 'OK' || ok === true
  } catch {
    return false
  }
}

export async function getRecentLogs(n = 100) {
  const client = await getRedisClient()
  if (!client) return mem.log.slice(0, n)
  try {
    const rows = await client.lRange(LOG_KEY, 0, n - 1)
    return rows.map((r) => {
      try {
        return JSON.parse(r)
      } catch {
        return { raw: r }
      }
    })
  } catch {
    return mem.log.slice(0, n)
  }
}
