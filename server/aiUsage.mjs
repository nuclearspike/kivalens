/**
 * aiUsage.mjs — OpenAI cost tracking + interaction logging for Ask KivaLens.
 *
 * - Monthly cost counter with a hard cutoff (default $20) to prevent abuse.
 * - A capped log of interactions (what users asked + how the AI responded +
 *   which tools it called + token usage) for review/refinement.
 *
 * Stored by the host (runtime.mjs `usage`): Redis on the Node server
 * (redisUsage.mjs, so it survives dyno restarts), SQLite on Cloudflare, and
 * memory when nothing is configured.
 */
import { usage } from './runtime.mjs'

export const BUDGET_USD = Number(process.env.OPENAI_MONTHLY_BUDGET_USD) || 20

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
/**
 * The month's spend so far, in USD. Stored by the host (runtime.mjs `usage`):
 * Redis on the Node server, SQLite on Cloudflare, memory in tests.
 */
export async function getMonthlySpend() {
  try {
    return (await usage.getSpend(monthKey())) || 0
  } catch {
    return 0
  }
}

export async function budgetExceeded() {
  return (await getMonthlySpend()) >= BUDGET_USD
}

export async function addSpend(usd) {
  if (!(usd > 0)) return
  try {
    await usage.addSpend(monthKey(), usd)
  } catch {
    // A lost increment under-counts one call; it never breaks the chat.
  }
}

/**
 * Record one chat turn. entry = { at, lenderId, page, selectedLoanId,
 * userMessage, response, tools, model, promptTokens, completionTokens, costUsd }.
 */
export async function logInteraction(entry) {
  const line = JSON.stringify(entry)
  console.log('[ai-chat]', line.length > 2000 ? line.slice(0, 2000) + '…' : line)
  try {
    await usage.pushLog(entry)
  } catch {
    // best-effort
  }
}

/** All interactions for one UTC day (YYYY-MM-DD), oldest-first not guaranteed. */
export async function getDayLogs(day) {
  try {
    return await usage.dayLogs(day)
  } catch {
    return []
  }
}

/** True only for the one process that claims the day's digest, so it is sent once. */
export async function claimDigest(day) {
  try {
    return await usage.claimDigest(day)
  } catch {
    return false
  }
}

/** After a day's digest is emailed, the chats it covered are removed. */
export async function clearLogsThrough(day) {
  try {
    await usage.clearThrough(day)
  } catch {
    // best-effort
  }
}

export async function getRecentLogs(n = 100) {
  try {
    return await usage.recent(n)
  } catch {
    return []
  }
}
