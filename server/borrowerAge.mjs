// The borrower's age, read from the loan description.
//
// Kiva publishes no age field, so it is read out of the story. The story also
// contains other people's ages — "her three children, aged 26, 16, and 13", "her
// husband, who is 50" — and nobody lends on a relative's age, so an age that
// belongs to someone else must be left out rather than guessed at. An age the story
// ties to the borrower's own name ("Maria, 50," "Maria is 50 years old") is the
// borrower's, and then every other age in it is left out (Paul, 2026-09-29: "if we
// know that the borrower has age of X, then any mention of their children's ages
// (even if over 18) we ignore").
//
// One implementation, imported by the server (klCore.mjs) and the browser
// (src/api/kivajs/ResultProcessors.ts), so the age a lender filters on is the
// age the server binned. Measured against every description in the local loan
// archive; see analysis/age-extraction-2026-09-20/FINDINGS.md and
// analysis/age-2026-09-29/ for the corpora and the scores.
//
// `read()` returns a confidence as well as a number, because the honest answer
// for a handful of descriptions is "a person should look at this": those go to
// resolveAmbiguousAges() in borrowerAgeAI.mjs instead of being guessed.

// People other than the borrower, singular and plural. Matched in lower case only: capitalised,
// such a word is a name (the borrower "Baby Jane" is 44).
const RELATIONS = String.raw`(?:son|daughter|brother|sister|mother|father)s?-in-law|in-laws|sons?|daughters?|child|children|kids?|grand(?:sons?|daughters?|child|children|kids?|mothers?|fathers?|parents?|ma|pa)|step(?:sons?|daughters?|child|children)|boys?|girls?|bab(?:y|ies)|infants?|toddlers?|nephews?|nieces?|siblings?|brothers?|sisters?|twins?|cousins?|husband|wife|spouse|partner|mother|father|mom|mum|dad|parents?|aunts?|uncles?|eldest|oldest|youngest|firstborn|dependents?`
const RELATION = new RegExp(String.raw`\b(?:${RELATIONS})\b`, 'g')

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
// An age in words, as some partners write it: "fifty eight years old", "Fifty-five-year-old".
const WORD_NUM = String.raw`((?:twenty|thirty|fou?rty|fifty|sixty|seventy|eighty|ninety)(?:${D}(?:one|two|three|four|five|six|seven|eight|nine))?|eighteen|nineteen)`
const WORD_VALUES = { eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
// The tens and the units wherever they sit, run together too: "twentyone" is 21, not 20 plus nothing.
const wordValue = (words) => {
  const m = words.toLowerCase().match(/^(eighteen|nineteen|twenty|thirty|fou?rty|fifty|sixty|seventy|eighty|ninety)[\s‐-―-]*(one|two|three|four|five|six|seven|eight|nine)?$/)
  return m ? WORD_VALUES[m[1]] + (m[2] ? WORD_VALUES[m[2]] : 0) : NaN
}
const digits = (s) => parseInt(s, 10)

// [kind, pattern, what the captured text is worth]. A birth year is worth the age it gives in the
// year the story was written (read()'s asOf).
const PATTERNS = [
  // "45 years old", "45-year-old", "45 yrs old", "45 years of age"
  ['years-old', new RegExp(String.raw`\b${NUM}${D}(?:years?|yrs?)${D}(?:old|of age)\b`, 'gi'), digits],
  ['years-old', new RegExp(String.raw`\b${WORD_NUM}${D}(?:years?|yrs?)${D}(?:old|of age)\b`, 'gi'), wordValue],
  // "aged 45", "age 45", "age: 45", "(age 46)"
  ['aged', new RegExp(String.raw`\bage[d]?\s*:?\s*${NUM}\b`, 'gi'), digits],
  // "She was born in 1965", "born 1981", "born in the year 1970"
  ['born-in', /\bborn\s+(?:in\s+)?(?:the\s+year\s+)?(19[2-9]\d|20[0-2]\d)\b/gi, (year, asOfYear) => asOfYear - digits(year)],
  // "At 49, Ramón has dedicated...", "At 36 years, Milka is married" — the age opens the sentence.
  ['at-n', new RegExp(String.raw`(?:^|[.!?]\s+)At\s+${NUM}(?:\s+years?(?:\s+old)?)?\s*,`, 'g'), digits],
  // "Melody, 47, works hard..." — how Kiva writes it most often after a name.
  ['named-comma', new RegExp(String.raw`\b[A-ZÀ-ɏ][a-zÀ-ɏ]+\s*,\s*${NUM}\s*,`, 'g'), digits],
  // The same shape after a lower-case word.
  ['comma', new RegExp(String.raw`(?:^|[a-zÀ-ɏ])\s*,\s*${NUM}\s*,\s*(?=[a-z])`, 'gi'), digits],
  // "is 48", with no "years old" to confirm it.
  ['is-n', new RegExp(String.raw`\bis\s+(?:a\s+)?${NUM}\b`, 'gi'), digits],
]

// How explicitly an age is written. The first five say "this is an age" on their
// own; the last two are shapes that merely tend to be one.
const RANK = { 'years-old': 0, aged: 1, 'born-in': 2, 'at-n': 3, 'named-comma': 4, comma: 5, 'is-n': 6 }
const EXPLICIT = new Set(['years-old', 'aged', 'born-in', 'at-n', 'named-comma'])

// Kiva lends to adults; a 3-digit or teenage-and-below number is not a borrower's age.
const PLAUSIBLE = (n) => n >= 18 && n <= 95

// What may stand between a relation and the age that is theirs: "her mother is 70", "her
// husband, who is 50 years old", "three children, aged 26, 16 and 13", "her son (24)", "a son
// who is aged 24", "children between 12 and 23 years old", "her husband, a 50-year-old farmer",
// "her husband was born in 1960".
const OWNED_GAP = new RegExp(
  '^' +
  String.raw`[\s,(:–—-]*(?:(?:who|which|that)\s+)?(?:(?:is|was|are|were|turned|turns|being)\s+)?(?:born\s+(?:in\s+)?(?:the\s+year\s+)?)?` +
  String.raw`(?:(?:now|currently|just|only|about|around|approximately|roughly|nearly|almost|over|under|aged?|between|from|respectively)\s*:?\s+)*` +
  String.raw`(?:(?:a|an)\s+(?:[a-z-]+\s+)?)?` +
  String.raw`(?:\d{1,3}\s*(?:(?:years?|yrs?)(?:${D}old)?\s*)?(?:,|and|&|or|to|-|–)\s*)*` +
  '$',
  'i',
)
// Words that may describe a person between "a" and their age ("a resilient and hardworking
// 43-year-old"), and never a word that starts another phrase: "a single mother with a 30-year-old
// daughter" is not describing the borrower as a daughter.
const DESCRIBING = String.raw`(?:(?!(?:a|an|the|with|has|have|had|of|to|for|from|in|at|on|by|who|whose|which|that|her|his|their|its|my|our)\b)[a-z-]+,?\s+)`
// A relation named right after an age written "N-year-old": "his 19 year old nephew", "a
// 43-year-old single mother". Not "40 years old and mother of four": after "and" the relation is
// what the subject is, and the age is the subject's.
const RELATION_AFTER = new RegExp(String.raw`^\s+(?:(?!(?:and|or|but|with|of|to|in|at|from|for|who|whose|which|that|has|had|lives|living)\b)[a-z-]+\s+)?(?:${RELATIONS})\b`)
// ...which is the borrower when the words before the age describe them: "is a 36-year-old
// mother of two", "Evans, a devoted 31-year-old husband", "A 45-year-old widow, Rosa". "her
// 20-year-old daughter" and "has a 20-year-old daughter" are someone else.
const DESCRIBES_BORROWER = new RegExp(String.raw`(?:^|[,;:]\s*|\b(?:is|was|as|am|becomes|became)\s+)(?:a|an|the)\s+${DESCRIBING}{0,4}$`, 'i')
// "Maria, a mother of two, is 45", "Maria lives with her mother and is 45": the relation is not
// whose age this is...
const BORROWER_IS_THE_PARENT = /\b(?:a|an|is|was)\s*$/i
// ...unless a relation is what the sentence is about: "Her son works in Lima and is 24".
const RELATION_IS_THE_SUBJECT = new RegExp(String.raw`^\s*(?:(?:her|his|their|my|our|the|both|all|one\s+of\s+(?:her|his|their))\s+)(?:[a-z-]+\s+){0,2}?(?:${RELATIONS})\b`, 'i')

// Letters without their accents, one character for one, so a position in the folded text is the
// same position in the story: "Néstor" in a story matches "Nestor" on the loan.
const fold = (s) => s.replace(/[À-ɏḀ-ỿ]/g, (c) => c.normalize('NFD')[0])
const NAME_STOP = new Set(['group', 'grupo', 'groupe', 'gruppo', 'the', 'and', 'y', 'e', 'et', 'of', 'de', 'del', 'la', 'las', 'los', 'le', 'les', 'da', 'das', 'do', 'dos', 'di', 'du', 'van', 'von', 'der', 'den', 'bin', 'binti', 'bint', 'al', 'el', 'mr', 'mrs', 'ms', 'miss'])

/** The words of the name on the loan that the story may call the borrower by. */
export function nameTokens(name) {
  if (!name) return []
  const words = fold(String(name)).toLowerCase().split(/[^\p{L}'’-]+/u)
  return [...new Set(words.flatMap((w) => [w, ...w.split('-')]).filter((w) => w.length >= 2 && !NAME_STOP.has(w)))]
}

// The borrower's own name tied to an age: "Maria, 50,", "Maria (age 50)", "Maria, aged 50",
// "Maria is 50", "Maria is a 50-year-old", "Maria, a dedicated and hardworking 50-year-old", "Maria
// was born in 1975", "Maria, born in 1975,". Not "Maria was 19": a past tense is a past age.
const NAME_BEFORE_AGE = new RegExp(String.raw`(\p{Lu}[\p{L}'’-]*)(?:\s*,\s*(?:(?:who\s+is|aged?)\s+)?|\s*\(\s*(?:age[d]?\s*:?\s*)?|\s+is\s+(?:(?:now|currently|about|around|nearly|almost|over)\s+)?(?:(?:a|an)\s+(?:${DESCRIBING}){0,4})?|\s*,\s*(?:a|an)\s+(?:${DESCRIBING}){0,4}|\s+aged?\s+|(?:\s+was|\s*,)?\s+born\s+(?:in\s+)?(?:the\s+year\s+)?)$`, 'u')
// "50-year-old Maria", "the 50-year-old Mrs. Anh", "Fifty-five-year-old Lorenza" (read from where
// the number ends).
const AGE_BEFORE_NAME = new RegExp(String.raw`^${D}(?:years?|yrs?)${D}old\s+(?:(?:mr|mrs|ms|miss)\.?\s+)?(\p{Lu}[\p{L}'’-]*)`, 'u')
// "Maria is 48" alone is loose; tied to her name it counts only where it cannot be a measure
// ("is 48 kilometres from the market").
const ENDS_AN_AGE = /^\s*(?:[,.;:!?)]|and\b|years?\b|yrs?\b|$)/i

/** Every age-like mention in the text, most explicit spelling per mention. */
function mentions(text, asOfYear) {
  const found = []
  for (const [kind, re, value] of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const n = value(m[1], asOfYear)
      // Where the NUMBER sits, not where the phrase starts: "at age 19" is judged by
      // what comes before the 19, and the match itself has already eaten "age".
      const numAt = m.index + m[0].indexOf(m[1])
      if (Number.isFinite(n)) found.push({ n, at: m.index, end: re.lastIndex, numAt, numEnd: numAt + m[1].length, kind })
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
    const { numAt, numEnd } = prev
    if (RANK[m.kind] < RANK[prev.kind]) Object.assign(prev, m)
    prev.at = at
    prev.end = end
    prev.numAt = numAt
    prev.numEnd = numEnd
  }
  return merged.filter((m) => PLAUSIBLE(m.n))
}

/** Is this age tied to the borrower's name? */
function tiedToName(folded, m, tokens) {
  const before = folded.slice(Math.max(0, m.numAt - 60), m.numAt).match(NAME_BEFORE_AGE)
  if (before && tokens.includes(before[1].toLowerCase())) {
    return m.kind !== 'is-n' || ENDS_AN_AGE.test(folded.slice(m.numEnd, m.numEnd + 12))
  }
  const after = folded.slice(m.numEnd, m.numEnd + 60).match(AGE_BEFORE_NAME)
  return !!after && tokens.includes(after[1].toLowerCase())
}

/**
 * Whose age this is: 'named' (tied to the borrower's name), 'other' (someone else's, or a past
 * age), 'mine' (the borrower's as far as the text shows), or 'unsure' (a relative is named in
 * the same sentence in a way the patterns cannot settle, so a person, or the model, should look).
 */
function ownerOf(text, folded, m, tokens) {
  if (tokens.length && tiedToName(folded, m, tokens)) return 'named'
  // Only the current sentence can own it; a relation two sentences back cannot.
  const sentence = text.slice(Math.max(0, m.numAt - 200), m.numAt).split(/[.!?]\s/).pop() || ''

  // The last relation before the age owns it when little but a verb stands between them.
  let relationEnd = -1
  for (const r of sentence.matchAll(RELATION)) relationEnd = r.index + r[0].length
  if (relationEnd >= 0 && OWNED_GAP.test(sentence.slice(relationEnd))) return 'other'

  // A relation written right after "N-year-old" is someone else, unless it describes the borrower.
  if (m.kind === 'years-old' && /old$/i.test(text.slice(m.at, m.end)) && RELATION_AFTER.test(text.slice(m.end, m.end + 30))) {
    return DESCRIBES_BORROWER.test(sentence) ? 'mine' : 'other'
  }

  if (PAST_LIFE.test(text.slice(Math.max(0, m.numAt - 26), m.numAt)) &&
      !AGE_OPENS_THE_STORY.test(text.slice(m.numEnd))) return 'other'

  // A relation elsewhere in the sentence. "Maria lives with her mother and is 45" is Maria's age;
  // "Her son works in Lima and is 24" is not, and past that the patterns cannot read grammar, so
  // the reading goes to review rather than guessing.
  if (relationEnd >= 0 && (RELATION_IS_THE_SUBJECT.test(sentence) || !BORROWER_IS_THE_PARENT.test(sentence))) return 'unsure'
  return 'mine'
}

/**
 * The borrower's age and how sure we are.
 *
 *   certain   — tied to the borrower's name, or one explicitly written age with nobody else's in front of it
 *   likely    — an explicit age, but other ages are mentioned too
 *   ambiguous — only a loose shape ("is 48"), mentions that disagree, or a relative nearby in a
 *               sentence the patterns cannot settle
 *   none      — no age, or every age found belongs to someone else
 *
 * `name` is the name on the loan. With it, an age tied to that name wins and every other age is
 * left out; without it, ownership is judged from the words around each age alone. `asOf` is when
 * the story was written (the loan's posted date): a birth year counts as the age it gives that
 * year, since the story's other ages are as of then too. Without it, the current year.
 *
 * Only `certain` and `likely` are published as-is; the rest is the queue for
 * resolveAmbiguousAges(). `age` is still filled in for an ambiguous read so the
 * model has a starting point, but callers must not publish it unresolved.
 */
export function read(text, name, asOf) {
  if (!text) return { age: null, confidence: 'none', why: 'no description' }

  const asOfYear = typeof asOf === 'number' ? asOf : new Date(asOf ?? Date.now()).getUTCFullYear()
  const all = mentions(text, Number.isFinite(asOfYear) ? asOfYear : new Date().getUTCFullYear())
  if (!all.length) return { age: null, confidence: 'none', why: 'no age mentioned' }

  const tokens = nameTokens(name)
  const folded = tokens.length ? fold(text) : text
  const judged = all.map((m) => ({ ...m, owner: ownerOf(text, folded, m, tokens) }))

  const named = judged.filter((m) => m.owner === 'named')
  if (named.length) {
    const ages = [...new Set(named.map((m) => m.n))]
    if (ages.length === 1) return { age: ages[0], confidence: 'certain', why: `the borrower's name, ${named[0].kind}` }
    return { age: named[0].n, confidence: 'ambiguous', why: `the borrower's name with ${ages.length} different ages` }
  }

  const mine = judged.filter((m) => m.owner !== 'other')
  if (!mine.length) return { age: null, confidence: 'none', why: 'every age mentioned belongs to someone else' }
  if (mine[0].owner === 'unsure') {
    return { age: mine[0].n, confidence: 'ambiguous', why: `a relative is named in the sentence of ${mine[0].kind}; ${all.length} age(s) mentioned` }
  }

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
