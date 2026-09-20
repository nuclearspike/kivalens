// The borrower's age, read from the loan description.
//
// Kiva publishes no age field, so it is read out of the story. The story also
// contains other people's ages — "her three children, aged 26, 16, and 13" — and
// nobody lends on a child's age, so an age that belongs to someone else must be
// left out rather than guessed at.
//
// One implementation, imported by the server (klCore.mjs) and the browser
// (src/api/kivajs/ResultProcessors.ts), so the age a lender filters on is the
// age the server binned. Measured against all 8,007 live descriptions; see
// analysis/age-extraction-2026-09-20/FINDINGS.md for the corpus and the scores.
//
// `read()` returns a confidence as well as a number, because the honest answer
// for a handful of descriptions is "a person should look at this": those go to
// resolveAmbiguousAges() in borrowerAgeAI.mjs instead of being guessed.

// Words that make a nearby age somebody else's.
const KIN = String.raw`son|daughter|child|children|kid|kids|grandson|granddaughter|grandchild|grandchildren|boy|girl|baby|infant|toddler|nephew|niece|sibling|brother|sister|twins?`

// A number that is an age but not the CURRENT age: "at age 19 she got married".
const PAST_LIFE = /\b(?:at (?:the )?age of|since (?:the )?age of|at age|when (?:he|she|they) (?:was|were|turned))\s*$/i
// ...except that Kiva opens stories with the borrower's CURRENT age in the same
// words — "At age 43, Luis has made growing cacao into much more than a job". The
// comma is what separates the two: a past event runs straight on ("At age 19 she
// got married"), the current-age framing is punctuated.
const AGE_OPENS_THE_STORY = /^\s*,/

const NUM = String.raw`(\d{1,3})`
// Kiva's feed carries stray spaces and every flavour of dash: "58-year- old".
const D = String.raw`[\s‐-―-]*`

const PATTERNS = [
  // "45 years old", "45-year-old", "45 yrs old", "45 years of age"
  ['years-old', new RegExp(String.raw`\b${NUM}${D}(?:years?|yrs?)${D}(?:old|of age)\b`, 'gi')],
  // "aged 45", "age 45", "age: 45", "(age 46)"
  ['aged', new RegExp(String.raw`\bage[d]?\s*:?\s*${NUM}\b`, 'gi')],
  // "At 49, Ramón has dedicated..." — the age opens the sentence.
  ['at-n', new RegExp(String.raw`(?:^|[.!?]\s+)At\s+${NUM}\s*,`, 'g')],
  // "Melody, 47, works hard..." — how Kiva writes it most often after a name.
  ['named-comma', new RegExp(String.raw`\b[A-ZÀ-ɏ][a-zÀ-ɏ]+\s*,\s*${NUM}\s*,`, 'g')],
  // The same shape after a lower-case word.
  ['comma', new RegExp(String.raw`(?:^|[a-zÀ-ɏ])\s*,\s*${NUM}\s*,\s*(?=[a-z])`, 'gi')],
  // "is 48", with no "years old" to confirm it.
  ['is-n', new RegExp(String.raw`\bis\s+(?:a\s+)?${NUM}\b`, 'gi')],
]

// How explicitly an age is written. The first four say "this is an age" on their
// own; the last two are shapes that merely tend to be one.
const RANK = { 'years-old': 0, aged: 1, 'at-n': 2, 'named-comma': 3, comma: 4, 'is-n': 5 }
const EXPLICIT = new Set(['years-old', 'aged', 'at-n', 'named-comma'])

// Kiva lends to adults; a 3-digit or teenage-and-below number is not a borrower's age.
const PLAUSIBLE = (n) => n >= 18 && n <= 95

// A kin word owns a nearby age only when it reads as a RELATION — "her daughter",
// "three children". Capitalised and unpossessed it is a name: the borrower "Baby
// Jane" is 44, and reading "Baby" as a relative threw her real age away.
const POSSESSED = new RegExp(
  String.raw`\b(?:her|his|their|its|my|our|the|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+` +
  String.raw`(?:(?:adult|eldest|oldest|youngest|second|third|fourth|other|own|only|dependent|school-aged|young)\s+)*` +
  String.raw`(?:${KIN})\b`, 'i')
const BARE_LOWER = new RegExp(String.raw`\b(?:${KIN})\b`) // case-sensitive on purpose
const KIN_AFTER = new RegExp(String.raw`^[\s,'’]*(?:${KIN})\b`, 'i')
// "a 36-year-old mother of two" — the borrower is the parent, the age is hers.
const BORROWER_IS_THE_PARENT = /\b(?:a|an|is|was)\s*$/i

/** Every age-like mention in the text, most explicit spelling per mention. */
function mentions(text) {
  const found = []
  for (const [kind, re] of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const n = parseInt(m[1], 10)
      // Where the DIGITS sit, not where the phrase starts: "at age 19" is judged by
      // what comes before the 19, and the match itself has already eaten "age".
      const numAt = m.index + m[0].indexOf(m[1])
      if (Number.isFinite(n)) found.push({ n, at: m.index, end: re.lastIndex, numAt, kind })
    }
  }
  // "Lira is 50 years old" is ONE age written once but matched by two patterns.
  // Fold overlapping matches of the same number and keep the clearest spelling,
  // or the weakest one would decide the confidence.
  found.sort((a, b) => a.at - b.at)
  const merged = []
  for (const m of found) {
    const prev = merged.find((p) => p.n === m.n && m.at <= p.end + 4 && m.end >= p.at - 4)
    if (!prev) { merged.push(m); continue }
    const at = Math.min(prev.at, m.at)
    const end = Math.max(prev.end, m.end)
    if (RANK[m.kind] < RANK[prev.kind]) Object.assign(prev, m)
    prev.at = at
    prev.end = end
  }
  return merged.filter((m) => PLAUSIBLE(m.n))
}

/** Does this age belong to someone other than the borrower? */
function belongsToSomeoneElse(text, m) {
  // The relative can follow the age as well as precede it: "His 19 year old nephew".
  if (KIN_AFTER.test(text.slice(m.end, m.end + 26))) return true

  const before = text.slice(Math.max(0, m.at - 60), m.at)
  // Only the current sentence can own it; a kin word two sentences back cannot.
  const sentence = before.split(/[.!?]\s/).pop() || ''
  if ((POSSESSED.test(sentence) || BARE_LOWER.test(sentence)) && !BORROWER_IS_THE_PARENT.test(before)) return true

  if (!PAST_LIFE.test(text.slice(Math.max(0, m.numAt - 26), m.numAt))) return false
  return !AGE_OPENS_THE_STORY.test(text.slice(m.numAt + String(m.n).length))
}

/**
 * The borrower's age and how sure we are.
 *
 *   certain   — one explicitly written age, nobody else's in front of it
 *   likely    — an explicit age, but other ages are mentioned too
 *   ambiguous — only a loose shape ("is 48"), or the mentions disagree
 *   none      — no age, or every age found belongs to someone else
 *
 * Only `certain` and `likely` are published as-is; the rest is the queue for
 * resolveAmbiguousAges(). `age` is still filled in for an ambiguous read so the
 * model has a starting point, but callers must not publish it unresolved.
 */
export function read(text) {
  if (!text) return { age: null, confidence: 'none', why: 'no description' }

  const all = mentions(text)
  if (!all.length) return { age: null, confidence: 'none', why: 'no age mentioned' }

  const mine = all.filter((m) => !belongsToSomeoneElse(text, m))
  if (!mine.length) return { age: null, confidence: 'none', why: 'every age mentioned belongs to someone else' }

  const explicit = mine.filter((m) => EXPLICIT.has(m.kind))
  if (explicit.length && explicit[0].at === mine[0].at) {
    const others = mine.filter((m) => m.n !== explicit[0].n)
    if (!others.length) return { age: explicit[0].n, confidence: 'certain', why: `single ${explicit[0].kind}` }
    return { age: explicit[0].n, confidence: 'likely', why: `${explicit[0].kind} first, ${others.length} other age(s) mentioned` }
  }
  return { age: mine[0].n, confidence: 'ambiguous', why: `only ${mine[0].kind}; ${all.length} age(s) mentioned` }
}

/** True when read() wants a second opinion before the age is published. */
export const needsReview = (result) => result.confidence === 'ambiguous'

/**
 * The age to publish from a regex read alone. An ambiguous read publishes nothing
 * until resolveAmbiguousAges() has had its say, so a child's age is never shown as
 * the borrower's.
 */
export function ageFrom(result) {
  return result.confidence === 'certain' || result.confidence === 'likely' ? result.age : null
}

/** What production ran before this module; kept so the harness can score against it. */
export function readLegacy(text) {
  if (!text) return null
  const m = /([2-9]\d)[ -]years?[ -](?:of age|old)/i.exec(text) || /(?:aged?|is) ([2-9]\d)/i.exec(text)
  return m ? parseInt(m[1], 10) : null
}
