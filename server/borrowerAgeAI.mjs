// The second opinion on a borrower's age, for the few descriptions the text alone
// cannot settle (borrowerAge.read() -> confidence 'ambiguous').
//
// Why a model at all: almost every description is decided by the patterns in
// borrowerAge.mjs, but a handful say only "Zhamalaim is 48 and married" or spell
// the age in words beside a child's age in digits. Guessing there is how a child's
// age ends up shown as the borrower's, which is the one outcome to avoid. So the
// regex publishes nothing for those and this asks instead.
//
// What this costs: about 20 descriptions of ~6,800 (0.3%), each asked about once. The
// answer is kept on the loan itself (kl_age_answer: the age or null, and a fingerprint of
// the story it answered), carried from one refresh to the next and saved with the loan's
// details in the warm-start snapshot (Redis, klCache.mjs), so a restart or a deploy asks
// nothing again (Paul, 2026-09-30: "the borrower ages should be (OF COURSE) added to the
// loan details, not stored on ephemeral storage with heroku"). Only a new loan, or a story
// Kiva has since edited, is asked about. It runs on the server during a data refresh, never
// in a lender's request, and it shares the chat's monthly budget. If the key is absent, the
// budget is spent, or the model is unreachable, the age simply stays unset: no age is better
// than the wrong person's age.

import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { budgetExceeded, addSpend, costOf } from './aiUsage.mjs'
import { read } from './borrowerAge.mjs'

const MODEL = process.env.OPENAI_AGE_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
// A refresh should never be able to run up an unbounded bill, however odd the feed.
const MAX_CALLS_PER_REFRESH = Number(process.env.AGE_AI_MAX_CALLS) || 150
const CONCURRENCY = 4

let _client
function client() {
  if (_client !== undefined) return _client
  const apiKey = process.env.OPENAI_API_KEY
  _client = apiKey ? new OpenAI({ apiKey }) : null
  return _client
}

/** A fingerprint of the story an answer was given for: a story Kiva edits is asked about again. */
export const storyPrint = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

const isAnswer = (a) => !!a && typeof a.of === 'string' && (a.age === null || Number.isInteger(a.age))

/**
 * The model's answers, by loan id, on the loans a refresh is about to replace: the previous
 * batch, or the details a warm start restored from the snapshot.
 */
export function lastAgeAnswers(loans) {
  const answers = new Map()
  for (const loan of loans || []) if (loan && isAnswer(loan.kl_age_answer)) answers.set(loan.id, loan.kl_age_answer)
  return answers
}

const PROMPT = `You are reading a Kiva loan description to find the age of THE BORROWER — the person the loan is for.

Rules:
- The name on the loan comes before the description. An age the description ties to that name is the borrower's.
- Descriptions often give other people's ages: children (adult children too), a spouse, a parent, a nephew. Never return one of those.
- Return the borrower's CURRENT age, not an age from their past ("at age 19 she married" is not their age now).
- An age may be written in words ("fifty-five-year-old").
- The description may contain a typo ("25 ears old" means 25).
- If the borrower's own current age is not stated, or you are not sure which age is theirs, return null.
- A loan may be for a group; if the description is about a group rather than one person, return null.

Answer with JSON only: {"age": <integer 18-95>} or {"age": null}`

async function askOne(text, name) {
  const api = client()
  if (!api) return { age: null, asked: false }
  const response = await api.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: `${name ? `Name on the loan: ${name}\n\n` : ''}${text.slice(0, 4000)}` },
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

/**
 * Fills in kls_age for the loans whose description the patterns could not settle, and records
 * the model's answer on each loan it asked about (kl_age_answer), "no age" included.
 *
 * `lastAnswers` (lastAgeAnswers() of the loans being replaced) are reused while the story is the
 * same, so a loan is asked about once for as long as it is listed. Mutates only the loans it can
 * answer for. Never throws: a refresh must finish whatever the model does.
 *
 * @param {Array<{ id?: number, name?: string, posted_date?: string, description?: any, kls_age?: number|null, kl_age_answer?: { age: number|null, of: string } }>} loans processed loans
 * @param {(msg: string) => void} log
 * @param {Map<number, { age: number|null, of: string }>} [lastAnswers]
 */
export async function resolveAmbiguousAges(loans, log = () => {}, lastAnswers = new Map()) {
  const stats = { considered: 0, kept: 0, asked: 0, resolved: 0 }
  const unanswered = []
  for (const loan of loans) {
    const text = loan?.description?.texts?.en
    if (!text || loan.kls_age != null) continue
    if (read(text, loan.name, loan.posted_date).confidence !== 'ambiguous') continue
    stats.considered += 1
    const of = storyPrint(text)
    const last = [loan.kl_age_answer, lastAnswers.get(loan.id)].find((a) => isAnswer(a) && a.of === of)
    if (last) {
      loan.kl_age_answer = last
      stats.kept += 1
      if (last.age != null) { loan.kls_age = last.age; stats.resolved += 1 }
    } else {
      unanswered.push({ loan, text, of })
    }
  }
  if (!stats.considered) return stats

  if (!unanswered.length) {
    log(`Ages: ${stats.considered} ambiguous, all answered before, ${stats.resolved} resolved`)
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
        const { age, asked } = await askOne(item.text, item.loan.name)
        if (!asked) return
        stats.asked += 1
        item.loan.kl_age_answer = { age, of: item.of }
        if (age != null) { item.loan.kls_age = age; stats.resolved += 1 }
      } catch (error) {
        // One failed lookup must not take down a refresh, and must not be recorded:
        // the next refresh should be free to try again.
        log(`Ages: lookup failed (${error?.message || error})`)
      }
    }
  }))

  log(`Ages: ${stats.considered} ambiguous — ${stats.kept} answered before, ${stats.asked} asked, ${stats.resolved} resolved`)
  return stats
}
