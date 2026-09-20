// The second opinion on a borrower's age, for the few descriptions the text alone
// cannot settle (borrowerAge.read() -> confidence 'ambiguous').
//
// Why a model at all: almost every description is decided by the patterns in
// borrowerAge.mjs, but a handful say only "Zhamalaim is 48 and married" or spell
// the age in words beside a child's age in digits. Guessing there is how a child's
// age ends up shown as the borrower's, which is the one outcome to avoid. So the
// regex publishes nothing for those and this asks instead.
//
// What this costs: ~54 descriptions out of 8,007 (0.7%), asked ONCE each — the
// answer is cached by the text itself, so a re-read of the same story, and every
// later refresh, is free. It runs on the server during a data refresh, never in a
// lender's request, and it shares the chat's monthly budget. If the key is absent,
// the budget is spent, or the model is unreachable, the age simply stays unset:
// no age is better than the wrong person's age.

import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { readCache, writeCache } from './diskCache.mjs'
import { budgetExceeded, addSpend, costOf } from './aiUsage.mjs'
import { read } from './borrowerAge.mjs'

const MODEL = process.env.OPENAI_AGE_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
// A refresh should never be able to run up an unbounded bill, however odd the feed.
const MAX_CALLS_PER_REFRESH = Number(process.env.AGE_AI_MAX_CALLS) || 150
const CONCURRENCY = 4
// The answer depends only on the text, so a cached answer never goes stale.
const CACHE_PREFIX = 'age-ai-'

let _client
function client() {
  if (_client !== undefined) return _client
  const apiKey = process.env.OPENAI_API_KEY
  _client = apiKey ? new OpenAI({ apiKey }) : null
  return _client
}

const keyFor = (text) => CACHE_PREFIX + createHash('sha256').update(text).digest('hex').slice(0, 32)

const PROMPT = `You are reading a Kiva loan description to find the age of THE BORROWER — the person the loan is for.

Rules:
- Descriptions often give other people's ages: children, a spouse, a parent, a nephew. Never return one of those.
- Return the borrower's CURRENT age, not an age from their past ("at age 19 she married" is not their age now).
- An age may be written in words ("fifty-five-year-old").
- The description may contain a typo ("25 ears old" means 25).
- If the borrower's own current age is not stated, or you are not sure which age is theirs, return null.
- A loan may be for a group; if the description is about a group rather than one person, return null.

Answer with JSON only: {"age": <integer 18-95>} or {"age": null}`

async function askOne(text) {
  const api = client()
  if (!api) return { age: null, asked: false }
  const response = await api.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: text.slice(0, 4000) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 20,
  })
  const usage = response.usage || {}
  void addSpend(costOf(MODEL, usage.prompt_tokens || 0, usage.completion_tokens || 0))

  let age = null
  try {
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}')
    // Trust the shape, not the model: anything outside Kiva's lending range is dropped.
    if (Number.isInteger(parsed.age) && parsed.age >= 18 && parsed.age <= 95) age = parsed.age
  } catch { /* an unparseable answer means no age, same as a refusal */ }
  return { age, asked: true }
}

/** The cached answer for this text, or undefined when it has never been asked. */
async function cached(text) {
  const raw = await readCache(keyFor(text))
  if (raw === null) return undefined
  try {
    const value = JSON.parse(raw)
    return value === null || Number.isInteger(value) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Fills in kls_age for the loans whose description the patterns could not settle.
 *
 * Mutates each loan it can answer for and leaves the rest untouched (kls_age stays
 * null). Never throws: a refresh must finish whatever the model does.
 *
 * @param {Array<{ description?: any, kls_age?: number|null }>} loans processed loans
 * @param {(msg: string) => void} log
 */
export async function resolveAmbiguousAges(loans, log = () => {}) {
  const pending = []
  for (const loan of loans) {
    const text = loan?.description?.texts?.en
    if (!text || loan.kls_age != null) continue
    if (read(text).confidence === 'ambiguous') pending.push({ loan, text })
  }
  if (!pending.length) return { considered: 0, fromCache: 0, asked: 0, resolved: 0 }

  const stats = { considered: pending.length, fromCache: 0, asked: 0, resolved: 0 }

  // The cache is the cheap pass, and on a warm dyno it answers nearly all of them.
  const unanswered = []
  for (const item of pending) {
    let hit
    try { hit = await cached(item.text) } catch { hit = undefined }
    if (hit === undefined) { unanswered.push(item); continue }
    stats.fromCache += 1
    if (hit != null) { item.loan.kls_age = hit; stats.resolved += 1 }
  }

  if (!unanswered.length) {
    log(`Ages: ${stats.considered} ambiguous, all cached, ${stats.resolved} resolved`)
    return stats
  }
  if (!client()) {
    log(`Ages: ${unanswered.length} ambiguous and unresolved (no OPENAI_API_KEY)`)
    return stats
  }
  let overBudget = false
  try { overBudget = await budgetExceeded() } catch { overBudget = false }
  if (overBudget) {
    log(`Ages: ${unanswered.length} ambiguous left unresolved (monthly AI budget reached)`)
    return stats
  }

  const queue = unanswered.slice(0, MAX_CALLS_PER_REFRESH)
  if (unanswered.length > queue.length) {
    log(`Ages: ${unanswered.length} ambiguous, asking about the first ${queue.length} this refresh`)
  }
  let next = 0
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (next < queue.length) {
      const item = queue[next++]
      try {
        const { age, asked } = await askOne(item.text)
        if (!asked) return
        stats.asked += 1
        await writeCache(keyFor(item.text), JSON.stringify(age))
        if (age != null) { item.loan.kls_age = age; stats.resolved += 1 }
      } catch (error) {
        // One failed lookup must not take down a refresh, and must not be cached:
        // the next refresh should be free to try again.
        log(`Ages: lookup failed (${error?.message || error})`)
      }
    }
  }))

  log(`Ages: ${stats.considered} ambiguous — ${stats.fromCache} cached, ${stats.asked} asked, ${stats.resolved} resolved`)
  return stats
}
