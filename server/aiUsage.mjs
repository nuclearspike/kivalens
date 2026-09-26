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

/**
 * Bytes (UTF-8) per input token, for a round OpenAI never reported usage for. The
 * instructions and tool definitions KivaLens writes are most of a request, in
 * English: OpenAI's own count put a real Ask KivaLens request (2026-09-25) at 11,834
 * tokens for 53,940 characters, 4.56 each, so counting 4 overstates them by about an
 * eighth, the side a budget should err on, and that margin also covers the few
 * output tokens generated after the last one that arrived. Everything the lender
 * controls (the conversation, tool results, and the share of the instructions that
 * came from the lender, measured by aiChat's lenderPromptShare) is counted at 1: a
 * token always covers at least one byte, so no text, however it is written, can cost
 * more.
 */
const PROMPT_BYTES_PER_TOKEN = 4
const LENDER_BYTES_PER_TOKEN = 1
// Reply text runs about four bytes per token in English.
const OUTPUT_BYTES_PER_TOKEN = 4

const encoder = new TextEncoder()
/** The UTF-8 length of a string. */
export function utf8Length(text) {
  return encoder.encode(text).length
}

function serializedLength(value) {
  try {
    const json = JSON.stringify(value)
    return json === undefined ? 0 : utf8Length(json)
  } catch {
    return 0 // what cannot be serialized was never sent
  }
}

/**
 * Input tokens of a request that was sent but never reported on. lenderShareBytes is
 * how much of its instructions came from the lender, counted at a token per byte.
 */
export function estimateInputTokens(request, lenderShareBytes = 0) {
  const { input, ...prompt } = request ?? {}
  const promptBytes = serializedLength(prompt)
  const lenderShare = Math.min(Math.max(0, lenderShareBytes), promptBytes)
  return (
    Math.ceil((promptBytes - lenderShare) / PROMPT_BYTES_PER_TOKEN) +
    Math.ceil((lenderShare + serializedLength(input)) / LENDER_BYTES_PER_TOKEN)
  )
}


/**
 * Output tokens of a reply that stopped before OpenAI reported on it: each streamed
 * delta is about one token, and text never counts as fewer than one token per four
 * bytes.
 */
export function estimateOutputTokens(deltas, bytes) {
  return Math.max(deltas, Math.ceil(bytes / OUTPUT_BYTES_PER_TOKEN))
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
 * userMessage, response, tools, model, promptTokens, completionTokens, costUsd,
 * outcome, estimated, rounds, incompleteReason }: outcome is completed,
 * incomplete (OpenAI stopped the reply; incompleteReason says why, such as
 * max_output_tokens or content_filter), abandoned (the lender left), cut
 * (KivaLens stopped the reply) or failed; estimated says some of its tokens are an
 * estimate; rounds counts the rounds that reached OpenAI.
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
