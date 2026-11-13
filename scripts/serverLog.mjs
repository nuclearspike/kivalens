// Reads the server log that Heroku returns after a release: crashes, errors to read, RSS warm-up, and
// whether the log is complete enough to say "no errors".
//
// A new server process has no data for RSS until it has published its first own batch, a few minutes
// after it starts; an RSS request still waiting for it after 25 seconds is answered 503. For each such
// answer server/klCore.mjs (serveRssFeed) logs "[rss] warming up: answered 503 to request <id>", the id
// being the X-Request-ID that Heroku's router gave the request and logs as request_id. A router line is
// warm-up only when it is an RSS request answered 503 with the warm-up answer's own size (WARMUP_BYTES,
// or 0 for a HEAD request, whose body the router does not relay; logged at=info, or as an H27 hang-up that
// carries the 503), and a mark from the same dyno names its request_id within MARK_TO_ROUTER_US of it.
// Each mark excuses at most one router line: within one request id and dyno, as many answers are excused
// as there are marks for them, the closest pairs first. The size and the time bound are both needed
// because a client may send its own X-Request-ID, so one id can name several requests: the size tells the
// warm-up answer from the portfolio feed's 503 (55 bytes), the bound keeps a mark near its own answer.
// Marks are paired across every stamped line, so an answer from before the release time uses up its mark. Nothing is inferred from process starts or restarts. A router 503 the
// server did not mark, because its line was dropped or the server answered 503 for another reason, is an
// error.
//
// Errors to read: any 5xx or router error (at=error) other than warm-up, among them an H12 on RSS (RSS
// answers a waiting reader itself after 25 seconds, RSS_READY_TIMEOUT_MS, inside Heroku's 30), a proxy
// refusal, a thrown Error, and a Heroku runtime error (R10, R14, ...). Router lines are read field by field
// with quoted values whole: a request path can hold spaces and the text "status=503" (a feed named
// "4mo repayment" was recorded on 2026-10-27), and is never read as a field of the router's own.

const STAMP = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d) /

/** A log line's timestamp in microseconds since the epoch (Heroku writes six decimals); NaN without one. */
export function stampOf(line) {
  const m = line.match(STAMP)
  if (!m) return NaN
  return Date.parse(m[1] + m[3]) * 1000 + Number((m[2] ?? '').padEnd(6, '0').slice(0, 6))
}

// The body of a log line, after its timestamp: "heroku[router]: at=info ...", "app[web.1]: [KL] ...".
const bodyOf = (line) => line.slice(line.indexOf(' ') + 1)
/** A timestamp in microseconds as UTC, to the second: 2026-11-11T23:23:24. */
const utc = (us) => new Date(Math.floor(us / 1000)).toISOString().slice(0, 19)

const FIELD = /(\w+)=("(?:[^"\\]|\\.)*"|\S*)/g

/** The fields of a Heroku router line, with quoted values unquoted; null for any other line. */
export function routerFields(line) {
  const body = bodyOf(line)
  if (!body.startsWith('heroku[router]: ')) return null
  const fields = {}
  for (const [, key, raw] of body.slice('heroku[router]: '.length).matchAll(FIELD)) {
    if (!(key in fields)) fields[key] = raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(.)/g, '$1') : raw
  }
  return fields
}

// The routes server/klCore.mjs serves as feeds: /rss/<criteria>, /rss?<parameters> and /rss.
const RSS_ROUTE = /^\/rss(\/|\?|$)/
/** The server's line for an RSS request it answered 503 while warming up, after Heroku's timestamp. */
export const WARMUP_MARK = /^app\[(?<dyno>web\.\d+)\]: \[rss\] warming up: answered 503 to request (?<id>\S+)$/
/** The size of the warm-up answer's body, "RSS filter data is still loading; retry shortly" (src/lib/rss.test.ts holds the two together). */
export const WARMUP_BYTES = 47
// How far apart a mark and the router line of its answer may be stamped, either way: the server writes
// the mark as it returns the answer, but Heroku stamps an app line when its log shuttle reads it, so the
// mark can carry the later time. Provisional, not measured: a pair further apart counts as an error, the
// safe direction.
const MARK_TO_ROUTER_US = 5_000_000
const CRASHED = /^heroku\[[\w.]+\]: State changed from \w+ to crashed/
const OTHER_ERROR = /status=5\d\d|at=error|\[proxy\] (refused|error)|Error:|Error R\d\d/
// Heroku's notices that it dropped log lines, from Logplex or the dyno's log shuttle, in the shapes its
// error-codes page gives: "Error L10 (output buffer overflow)", "L11 (Tail buffer overflow)", "Error L12:",
// "Error L13:". The same words in the app's own lines are not a notice.
const LOST = /^(?:(?:heroku\[logplex\]|app\[log-shuttle\]):|\S+ heroku logplex - -) (?:Error )?L1[0-3]\b/

/** Sorts the stamped lines from `since` (epoch milliseconds) on. Lines come back in timestamp order. */
export function readServerLog(text, { since }) {
  const stamped = text.split('\n').filter((l) => Number.isFinite(stampOf(l)))
  const sinceUs = since * 1000
  const all = [...stamped].sort((a, b) => stampOf(a) - stampOf(b))

  const marks = all
    .map((l) => ({ m: bodyOf(l).match(WARMUP_MARK), us: stampOf(l) }))
    .filter(({ m }) => m)
    .map(({ m, us }) => ({ dyno: m.groups.dyno, id: m.groups.id, us }))
  const answers = []
  all.forEach((l, i) => {
    const f = routerFields(l)
    const size = f?.method === 'HEAD' ? '0' : String(WARMUP_BYTES)
    if (!f || f.status !== '503' || f.bytes !== size || !RSS_ROUTE.test(f.path ?? '')) return
    if (!(f.at === 'info' || (f.at === 'warning' && f.code === 'H27'))) return
    answers.push({ i, us: stampOf(l), id: f.request_id, dyno: f.dyno })
  })
  // A maximum matching of answers to marks within reach, each answer trying its closest mark first
  // (Kuhn's augmenting paths; a request id rarely has more than one answer and one mark).
  const reach = answers.map((a) => marks
    .map((k, m) => ({ m, d: Math.abs(a.us - k.us) }))
    .filter(({ m, d }) => marks[m].id === a.id && marks[m].dyno === a.dyno && d <= MARK_TO_ROUTER_US)
    .sort((x, y) => x.d - y.d)
    .map(({ m }) => m))
  const owner = new Map()
  const claim = (a, seen) => reach[a].some((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    if (!owner.has(m) || claim(owner.get(m), seen)) {
      owner.set(m, a)
      return true
    }
    return false
  })
  const order = answers.map((_, a) => a).sort((x, y) => (Math.abs(answers[x].us - (marks[reach[x][0]]?.us ?? Infinity)) - Math.abs(answers[y].us - (marks[reach[y][0]]?.us ?? Infinity))))
  for (const a of order) claim(a, new Set())
  const warmAt = new Set([...owner.values()].map((a) => answers[a].i))
  const after = all.map((l, i) => ({ l, i })).filter(({ l }) => stampOf(l) >= sinceUs)
  const lines = after.map(({ l }) => l)
  const rssWarmup = after.filter(({ i }) => warmAt.has(i)).map(({ l }) => l)
  const warm = new Set(after.map(({ i }, n) => (warmAt.has(i) ? n : -1)).filter((n) => n >= 0))
  const isError = (l) => {
    const f = routerFields(l)
    if (f) return Number(f.status) >= 500 || f.at === 'error'
    // A mark is never an error, whatever text its request id holds.
    const body = bodyOf(l)
    return !WARMUP_MARK.test(body) && OTHER_ERROR.test(body)
  }
  const isCrash = (l) => {
    const f = routerFields(l)
    return f ? f.code === 'H10' : CRASHED.test(bodyOf(l))
  }

  return {
    stamped,
    lines,
    crashed: lines.filter(isCrash),
    lost: lines.filter((l) => LOST.test(bodyOf(l))),
    rssWarmup,
    errors: lines.filter((l, i) => !warm.has(i) && isError(l)),
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * What the deploy reports about the log: `heroku logs`' exit status and output, and the release time in
 * epoch milliseconds. Whatever was read is judged even when the read failed, so a crash in a partial log
 * still fails the deploy; a log that is incomplete is never reported as "no errors".
 */
export function judgeServerLog({ status, text }, { since }) {
  const log = readServerLog(text, { since })
  const notes = []
  const incomplete = []
  if (status !== 0) incomplete.push(`heroku logs ${status === null ? 'was stopped' : `exited ${status}`}: ${text.trim().split('\n').at(-1)?.slice(0, 160) ?? ''}`)
  if (!log.lines.length) {
    incomplete.push(log.stamped.length ? `none of the ${log.stamped.length} lines Heroku returned is from after the release` : 'Heroku returned no log lines')
  } else {
    const earliest = log.stamped.reduce((a, b) => (stampOf(b) < stampOf(a) ? b : a))
    // Heroku hands back at most 1,500 lines; on a busy server they may start after the release.
    if (stampOf(earliest) > since * 1000) incomplete.push(`the ${log.stamped.length} lines Heroku returned start at ${utc(stampOf(earliest))} UTC, after the release`)
  }
  if (log.lost.length) incomplete.push(`Heroku dropped log lines: ${bodyOf(log.lost[0]).slice(0, 160)}`)

  if (log.rssWarmup.length) {
    const from = utc(stampOf(log.rssWarmup[0])).slice(11)
    const to = utc(stampOf(log.rssWarmup.at(-1))).slice(11)
    notes.push(`${plural(log.rssWarmup.length, 'RSS request')} answered 503 while the server built its first batch (${from === to ? from : `${from}-${to}`} UTC), the warm-up after a restart`)
  }

  return {
    log,
    notes,
    incomplete,
    crashed: log.crashed[0] ?? null,
    errors: log.errors,
    summary: {
      lines: log.lines.length, crashed: log.crashed.length, errors: log.errors.length, rssWarmup: log.rssWarmup.length,
      ...(incomplete.length ? { incomplete } : {}),
    },
    // Appended to the final DEPLOYED line.
    tail: [
      log.errors.length ? `with ${plural(log.errors.length, 'error line')} in the server log to read` : '',
      incomplete.length ? 'and the server log not read in full' : '',
    ].filter(Boolean).join(' ').replace(/^and /, 'with '),
  }
}
