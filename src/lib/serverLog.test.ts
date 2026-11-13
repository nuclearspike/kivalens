import { describe, expect, it } from 'vitest'
import { judgeServerLog, readServerLog, routerFields, stampOf } from '../../scripts/serverLog.mjs'

// The release log of v709 (2026-11-11, analysis/deploys/2026-11-11T23-22-26_448b95d8/heroku-logs.log),
// line for line except the reader's address, which is a documentation address here. The v709 server
// did not mark its warm-up answers; MARKED adds the line the server writes from this change on, for each
// of its five RSS 503s, a moment before the router logs the answer. Heroku created the release at
// 23:23:17.
const SINCE = Date.parse('2026-11-11T23:23:17Z')

const router = (stamp: string, fields: string) => `${stamp} heroku[router]: ${fields}`
const tail = (requestId: string, service: string, status: number, bytes = 47) =>
  `host=www.kivalens.org request_id=${requestId} fwd="203.0.113.7" dyno=web.1 connect=0ms service=${service} status=${status} bytes=${bytes} protocol=http1.1 tls=true tls_version=tls1.3`
const FEED = '/rss/{\\"feed\\":{\\"link_to\\":\\"kiva\\"},\\"loan\\":{\\"repaid_in_max\\":6}}'
const rss503 = (stamp: string, service: string, requestId: string) =>
  router(stamp, `at=info method=GET path="${FEED}" ${tail(requestId, service, 503)}`)
const mark = (stamp: string, requestId: string) => `${stamp} app[web.1]: [rss] warming up: answered 503 to request ${requestId}`

const IDS = ['c7ce92a0-8e9f-d344-6ed0-e07a7f430c60', 'd4f7231d-948d-5931-fbe7-8c81aaf66034', '6bfdae51-c670-0c5e-6028-b7a3944a9f31', '7c2328bf-6809-dcb1-1eee-92705e4ea3b0', '2705ab9c-cd2d-4cfe-2f62-731b4b4198a4']
const V709_WARMUP = [
  rss503('2026-11-11T23:23:56.451450+00:00', '25003ms', IDS[0]),
  rss503('2026-11-11T23:24:36.815502+00:00', '25003ms', IDS[1]),
  rss503('2026-11-11T23:25:17.141078+00:00', '25002ms', IDS[2]),
  rss503('2026-11-11T23:25:57.478895+00:00', '25002ms', IDS[3]),
  rss503('2026-11-11T23:26:37.810342+00:00', '25003ms', IDS[4]),
]
// Each mark about 2 ms before its router line (2 to 3 ms: Date keeps milliseconds).
const MARKS = V709_WARMUP.map((l, i) => mark(new Date(stampOf(l) / 1000 - 2).toISOString().replace('Z', '000+00:00'), IDS[i]))
const BEFORE_RELEASE = '2026-11-11T23:22:32.175826+00:00 app[web.1]: [KL] [mem] rss=477 heapTotal=135 heapUsed=127 external=6 arrayBuffers=3'
const V709 = [
  BEFORE_RELEASE,
  '2026-11-11T23:23:18.035936+00:00 heroku[web.1]: Restarting',
  '2026-11-11T23:23:18.055492+00:00 heroku[web.1]: State changed from up to starting',
  '2026-11-11T23:23:24.243854+00:00 heroku[web.1]: Starting process with command `MALLOC_ARENA_MAX=2 node --max-old-space-size=320 server/prod.mjs`',
  '2026-11-11T23:23:26.128852+00:00 heroku[web.1]: State changed from starting to up',
  '2026-11-11T23:23:26.189468+00:00 app[web.1]: [KL] Warm start from cache: batch 17249, 4 pages (322s old)',
  ...V709_WARMUP,
  '2026-11-11T23:27:15.582330+00:00 app[web.1]: [KL] Data ready! 7132 loans in 230.0s',
]
const MARKED = [...V709, ...MARKS]

// A reader of an RSS feed who hung up while the server was still building its first batch: an H27
// warning that carries the server's 503 (recorded 2026-10-23, analysis/deploys).
const H27_ID = 'ce8cbe6c-a161-84fa-e5d1-d0129250c134'
const h27 = (stamp: string, status = 503) =>
  router(stamp, `sock=client at=warning code=H27 desc="Client Request Interrupted" method=GET path="/rss/{\\"feed\\":{\\"link_to\\":\\"kiva\\"},\\"loan\\":{\\"repaid_in_max\\":7,\\"repayment_interval\\":\\"Monthly\\"},\\"partner\\":{\\"partner_risk_rating_min\\":3,\\"partner_arrears_max\\":1.6,\\"partner_default_max\\":0.3}}" ${tail(H27_ID, '25025ms', status)}`)

const answered = (stamp: string, path: string, status: number, requestId = '60b6b880-6955-fa88-fabd-5cbba0916139', service = '1ms', bytes = 145) =>
  router(stamp, `at=info method=GET path="${path}" ${tail(requestId, service, status, bytes)}`)
// The warm-up answer: 503 with its 47-byte body, after the 25-second wait.
const warmAnswer = (stamp: string, path: string, requestId: string) => answered(stamp, path, 503, requestId, '25001ms', 47)
// The portfolio feed's 503 when its lender data fails: "RSS portfolio filter data is unavailable; retry shortly".
const portfolio503 = (stamp: string, path: string, requestId: string) => answered(stamp, path, 503, requestId, '412ms', 55)

const DURING = '2026-11-11T23:25:00.000000+00:00'
const AFTER = '2026-11-11T23:28:00.000000+00:00'
const read = (lines: string[]) => readServerLog(lines.join('\n'), { since: SINCE })
const judge = (lines: string[], status: number | null = 0) => judgeServerLog({ status, text: lines.join('\n') }, { since: SINCE })

describe('reading the server log after a release', () => {
  it('keeps the microseconds of a timestamp, whatever offset it is written in', () => {
    expect(stampOf('2026-11-11T23:27:15.582330+00:00 x') - stampOf('2026-11-11T23:27:15.582300+00:00 x')).toBe(30)
    expect(stampOf('2026-11-11T16:27:15.582330-07:00 x')).toBe(stampOf('2026-11-11T23:27:15.582330Z x'))
    expect(Number.isNaN(stampOf(' ›   Warning: heroku update available'))).toBe(true)
  })

  it("reads v709's five RSS 503s as warm-up when the server marked each one, and nothing as an error", () => {
    const log = read(MARKED)
    expect(log.rssWarmup).toEqual(V709_WARMUP)
    expect(log.errors).toEqual([])
    expect(log.crashed).toEqual([])
  })

  it('counts an RSS 503 the server did not mark as an error, as every one in the logs before this change', () => {
    expect(read(V709).errors).toEqual(V709_WARMUP)
    // A feed whose lender data failed is answered 503 after the server is ready, and is not marked.
    const portfolio = answered('2026-11-11T23:30:00.000000+00:00', '/rss/%7B%22portfolio%22%3A%7B%22exclude_portfolio_loans%22%3A%22true%22%7D%7D', 503, 'f1e2d3c4-b5a6-4789-8abc-def012345678', '412ms')
    expect(read([...MARKED, portfolio]).errors).toEqual([portfolio])
  })

  it('lets each mark excuse one router line only', () => {
    // A client may choose its own X-Request-ID, so two warm-up answers can share one and one mark.
    const second = rss503('2026-11-11T23:23:57.000000+00:00', '25003ms', IDS[0])
    const log = read([...MARKED, second])
    expect(log.rssWarmup).toEqual(V709_WARMUP)
    expect(log.errors).toEqual([second])
  })

  it('lets a mark excuse only the answer it was written for, when a client reuses its request id', () => {
    // Heroku takes a client's own X-Request-ID (20 to 200 characters), so one id can name several requests.
    const id = 'client-retry-id-00000001'
    const portfolioFeed = '/rss/%7B%22feed%22%3A%7B%22lender_id%22%3A%22review-fixture%22%7D%2C%22portfolio%22%3A%7B%22pb_sector%22%3A%7B%22enabled%22%3Atrue%7D%7D%7D'
    // Codex's case: a reader hangs up (H27, 499), the server still writes its mark, then the client
    // retries with the same id and that answer is a portfolio failure after the server is ready.
    const hungUp = router('2026-11-11T23:24:00.000000+00:00', `sock=client at=warning code=H27 desc="Client Request Interrupted" method=GET path="${portfolioFeed}" ${tail(id, '20000ms', 499)}`)
    const orphan = mark('2026-11-11T23:24:05.000000+00:00', id)
    for (const at of ['2026-11-11T23:24:07.412000+00:00', '2026-11-11T23:25:01.000000+00:00']) {
      const retried = portfolio503(at, portfolioFeed, id)
      expect(read([...MARKED, hungUp, orphan, retried]).errors).toEqual([retried])
    }

    // Two answers with the same id right after one mark: the warm-up one is excused, whichever comes first.
    const markAt = '2026-11-11T23:24:30.000000+00:00'
    for (const [failureAt, warmAt] of [['2026-11-11T23:24:30.001000+00:00', '2026-11-11T23:24:30.002000+00:00'], ['2026-11-11T23:24:30.002000+00:00', '2026-11-11T23:24:30.001000+00:00']]) {
      const failure = portfolio503(failureAt, portfolioFeed, id)
      const warmOne = warmAnswer(warmAt, FEED, id)
      const log = read([...MARKED, mark(markAt, id), failure, warmOne])
      expect(log.errors).toEqual([failure])
      expect(log.rssWarmup).toContain(warmOne)
    }
    const warm = warmAnswer('2026-11-11T23:24:30.002000+00:00', FEED, id)

    // And on another dyno, not at all.
    const onWeb2 = warm.replace('dyno=web.1', 'dyno=web.2')
    expect(read([...MARKED, mark(markAt, id), onWeb2]).errors).toEqual([onWeb2])
  })

  it('excuses as many answers as there are marks within reach, the closest pairs first', () => {
    const id = 'matching-id-0000000001'
    // Codex's cases. A lost mark: the answer 2 ms from the one mark is excused, not the one 4 s away.
    const lostOwn = rss503('2026-11-11T23:24:06.000000+00:00', '25003ms', id)
    const marked = rss503('2026-11-11T23:24:10.002000+00:00', '25003ms', id)
    let log = read([...MARKED, lostOwn, mark('2026-11-11T23:24:10.000000+00:00', id), marked])
    expect(log.rssWarmup).toContain(marked)
    expect(log.errors).toEqual([lostOwn])

    // Two answers, two marks, each pair 4.9 s apart, with B's mark 1 ms from A's answer: both are excused.
    const answerA = rss503('2026-11-11T23:24:05.000000+00:00', '29900ms', id)
    const answerB = rss503('2026-11-11T23:24:09.900000+00:00', '29899ms', id)
    log = read([...MARKED, mark('2026-11-11T23:24:00.100000+00:00', id), answerA, mark('2026-11-11T23:24:05.001000+00:00', id), answerB])
    expect(log.rssWarmup).toEqual(expect.arrayContaining([answerA, answerB]))
    expect(log.errors).toEqual([])
  })

  it('excuses an answer only with a mark naming its own request id', () => {
    const answer = rss503('2026-11-11T23:24:30.002000+00:00', '25003ms', 'own-id-check-000000001')
    expect(read([...MARKED, mark('2026-11-11T23:24:30.000000+00:00', 'other-id-check-00000001'), answer]).errors).toEqual([answer])
  })

  it('excuses a HEAD warm-up answer, whose body the router does not relay (bytes=0)', () => {
    const head = router('2026-11-11T23:24:30.002000+00:00', `at=info method=HEAD path="/rss" ${tail('head-check-id-00000001', '25002ms', 503, 0)}`)
    expect(read([...MARKED, mark('2026-11-11T23:24:30.000000+00:00', 'head-check-id-00000001'), head]).errors).toEqual([])
    const headWithBody = head.replace('bytes=0', 'bytes=47')
    expect(read([...MARKED, mark('2026-11-11T23:24:30.000000+00:00', 'head-check-id-00000001'), headWithBody]).errors).toEqual([headWithBody])
    const getWithout = head.replace('method=HEAD', 'method=GET')
    expect(read([...MARKED, mark('2026-11-11T23:24:30.000000+00:00', 'head-check-id-00000001'), getWithout]).errors).toEqual([getWithout])
  })

  it('excuses only a 503 of the warm-up answer\'s own size (47 bytes)', () => {
    for (const bytes of [0, 46, 48, 55]) {
      const answer = answered(DURING, FEED, 503, 'size-check-id-00000001', '25001ms', bytes)
      expect(read([...MARKED, mark(DURING, 'size-check-id-00000001'), answer]).errors).toEqual([answer])
    }
  })

  it('pairs a mark stamped after its answer, as Heroku stamps an app line when it reads it', () => {
    const answer = rss503('2026-11-11T23:24:30.000000+00:00', '25003ms', 'stamped-late-id-000001')
    const log = read([...MARKED, answer, mark('2026-11-11T23:24:31.000000+00:00', 'stamped-late-id-000001')])
    expect(log.rssWarmup).toContain(answer)
    expect(log.errors).toEqual([])
  })

  it('reads an answer more than 5 s from its mark, either way, as an error', () => {
    const at = '2026-11-11T23:24:30.000000+00:00'
    const late = rss503('2026-11-11T23:24:35.000001+00:00', '25003ms', 'far-answer-id-00000001')
    const early = rss503('2026-11-11T23:24:24.999999+00:00', '25003ms', 'far-answer-id-00000002')
    expect(read([...MARKED, mark(at, 'far-answer-id-00000001'), late, mark(at, 'far-answer-id-00000002'), early]).errors).toEqual([early, late])
    const inTime = rss503('2026-11-11T23:24:35.000000+00:00', '25003ms', 'far-answer-id-00000003')
    const inTimeBefore = rss503('2026-11-11T23:24:25.000000+00:00', '25003ms', 'far-answer-id-00000004')
    expect(read([...MARKED, mark(at, 'far-answer-id-00000003'), inTime, mark(at, 'far-answer-id-00000004'), inTimeBefore]).errors).toEqual([])
  })

  it('pairs a mark written just before the release time with its answer just after', () => {
    const before = mark('2026-11-11T23:23:16.999999+00:00', 'cutoff-id-000000000001')
    const after = rss503('2026-11-11T23:23:17.000001+00:00', '25003ms', 'cutoff-id-000000000001')
    const log = read([...MARKED, before, after])
    expect(log.rssWarmup).toContain(after)
    expect(log.errors).toEqual([])
  })

  it('lets an answer from before the release time use up its mark', () => {
    const itsMark = mark('2026-11-11T23:23:16.000000+00:00', 'cutoff-id-000000000002')
    const itsAnswer = rss503('2026-11-11T23:23:16.002000+00:00', '25003ms', 'cutoff-id-000000000002')
    const another = rss503('2026-11-11T23:23:17.412000+00:00', '25003ms', 'cutoff-id-000000000002')
    expect(read([...MARKED, itsMark, itsAnswer, another]).errors).toEqual([another])
  })

  it('counts a line repeated word for word against one mark only once', () => {
    const log = read([...MARKED, V709_WARMUP[0]])
    expect(log.rssWarmup).toHaveLength(5)
    expect(log.errors).toEqual([V709_WARMUP[0]])
  })

  it('never counts a mark as an error, whatever a legal request id spells (letters, digits, + / = -)', () => {
    for (const id of ['status=503abcdefghijklmnop', 'at=errorabcdefghijklmnop']) {
      const lines = [...MARKED, mark(DURING, id), warmAnswer(DURING, '/rss', id)]
      const log = read(lines)
      expect(log.rssWarmup).toHaveLength(6)
      expect(log.errors).toEqual([])
    }
  })

  it('reads marks and router lines whatever order Heroku delivers them in', () => {
    const log = read([...MARKED].reverse())
    expect(log.rssWarmup).toEqual(V709_WARMUP)
    expect(log.lines[0]).toBe(V709[1])
  })

  it('takes a mark only from the server, in its own words', () => {
    // Each just before an answer it would otherwise excuse.
    const quoted = `${DURING} app[web.1]: [KL] title="[rss] warming up: answered 503 to request quoted-id-0000000000001"`
    const shuttle = `${DURING} app[log-shuttle]: [rss] warming up: answered 503 to request shuttle-id-000000000001`
    const answers = [rss503('2026-11-11T23:25:00.002000+00:00', '25003ms', 'quoted-id-0000000000001'), rss503('2026-11-11T23:25:00.002000+00:00', '25003ms', 'shuttle-id-000000000001')]
    const log = read([...V709, quoted, shuttle, ...answers])
    expect(log.rssWarmup).toEqual([])
    expect(log.errors).toEqual(expect.arrayContaining(answers))
  })

  it('reads an RSS reader who hung up during warm-up (H27 carrying the 503) as warm-up when marked', () => {
    const early = h27(DURING)
    const log = read([...MARKED, early, mark(DURING, H27_ID)])
    expect(log.rssWarmup).toContain(early)
    expect(log.errors).toEqual([])
    expect(read([...MARKED, early]).errors).toEqual([early])
  })

  it('counts a hang-up on an answer that was not a 5xx as nothing (an H27 with status 499, as Heroku documents it), and on any other 5xx as an error', () => {
    const on499 = h27(DURING, 499)
    const on502 = h27(DURING, 502)
    const log = read([...MARKED, on499, on502, mark(DURING, H27_ID)])
    expect(log.errors).toEqual([on502])
    expect(log.rssWarmup).toEqual(V709_WARMUP)
  })

  it('counts a router error on a marked RSS request as an error, whatever its size (H12, and H18 cut off at 47 bytes)', () => {
    const timeout = router('2026-11-11T23:25:00.002000+00:00', `at=error code=H12 desc="Request timeout" method=GET path="${FEED}" ${tail('h12-request-id-00000001', '30000ms', 503, 0)}`)
    const cutOff = router('2026-11-11T23:25:00.002000+00:00', `at=error code=H18 desc="Server Request Interrupted" method=GET path="${FEED}" ${tail('h18-request-id-00000001', '25001ms', 503, 47)}`)
    const log = read([...MARKED, mark(DURING, 'h12-request-id-00000001'), timeout, mark(DURING, 'h18-request-id-00000001'), cutOff])
    expect(log.errors).toEqual([timeout, cutOff])
  })

  it('counts a marked id on anything but an RSS 503 as an error', () => {
    // Even at the warm-up answer's size.
    const start = warmAnswer(DURING, '/api/start', 'a0000000-0000-4000-8000-000000000001')
    const click = warmAnswer(DURING, '/rss_click/kiva/3275309', 'a0000000-0000-4000-8000-000000000002')
    const broken = answered(DURING, FEED, 500, 'a0000000-0000-4000-8000-000000000003')
    const marks = ['1', '2', '3'].map((n) => mark(DURING, `a0000000-0000-4000-8000-00000000000${n}`))
    expect(read([...MARKED, start, click, broken, ...marks]).errors).toEqual([start, click, broken])
  })

  it('reads the query and bare forms of the feed route as RSS', () => {
    const query = warmAnswer(DURING, '/rss?link_to=kiva&repaid_in_max=6', 'b0000000-0000-4000-8000-000000000001')
    const bare = warmAnswer(DURING, '/rss', 'b0000000-0000-4000-8000-000000000002')
    const log = read([...MARKED, query, bare, mark(DURING, 'b0000000-0000-4000-8000-000000000001'), mark(DURING, 'b0000000-0000-4000-8000-000000000002')])
    expect(log.rssWarmup).toEqual(expect.arrayContaining([query, bare]))
    expect(log.errors).toEqual([])
  })

  it('never reads text inside a quoted path as a field of the router, spaces and all', () => {
    // The feed name from a line recorded on 2026-10-27 ("4mo repayment"), with fields written into it.
    const spoof = `/rss/{\\"feed\\":{\\"name\\":\\"4mo status=503 request_id=${IDS[0]} repayment\\",\\"link_to\\":\\"kiva\\"}}`
    const failed = answered(DURING, spoof, 500, 'c0000000-0000-4000-8000-000000000001')
    const fine = answered(AFTER, spoof, 200, 'c0000000-0000-4000-8000-000000000002')
    const log = read([...V709, failed, fine, MARKS[0]])
    expect(routerFields(failed)?.status).toBe('500')
    expect(routerFields(failed)?.request_id).toBe('c0000000-0000-4000-8000-000000000001')
    expect(routerFields(failed)?.path).toBe(`/rss/{"feed":{"name":"4mo status=503 request_id=${IDS[0]} repayment","link_to":"kiva"}}`)
    expect(log.rssWarmup).toEqual([V709_WARMUP[0]])
    expect(log.errors).toEqual([V709_WARMUP[1], failed, ...V709_WARMUP.slice(2)])
  })

  it('leaves out the lines from before the release', () => {
    const before = answered('2026-11-11T23:20:00.000000+00:00', '/api/start', 503)
    const log = read([before, ...MARKED])
    expect(log.stamped).toContain(before)
    expect(log.lines).not.toContain(before)
    expect(log.errors).toEqual([])
  })

  it('finds a crash of any process, and not in text a path carries', () => {
    const crash = `${DURING} heroku[web.1]: State changed from up to crashed`
    const worker = `${DURING} heroku[worker.1]: State changed from up to crashed`
    const h10 = router(DURING, `at=error code=H10 desc="App crashed" method=GET path="/" ${tail('b2', '0ms', 503, 0)}`)
    const spoof = answered(DURING, '/search?q=code=H10', 200)
    expect(read([...MARKED, crash, worker, h10, spoof]).crashed).toEqual([crash, worker, h10])
  })

  it("counts the proxy's refusals and failures, a thrown Error and a Heroku runtime error as errors", () => {
    const refused = `${DURING} app[web.1]: [proxy] refused /proxy/kiva/ajax/getGraphData: not JSON`
    const failed = `${DURING} app[web.1]: [proxy] error on /proxy/kiva/ajax/getGraphData: fetch failed`
    const thrown = `${DURING} app[web.1]: RSS required lender data failed: Error: kiva_500`
    const memory = `${DURING} heroku[web.1]: Error R14 (Memory quota exceeded)`
    expect(read([...MARKED, refused, failed, thrown, memory]).errors).toEqual([refused, failed, thrown, memory])
  })
})

describe('what the deploy reports about the log', () => {
  it('reports the warm-up in a note and nothing else for a clean release', () => {
    const j = judge(MARKED)
    expect(j.notes).toEqual(['5 RSS requests answered 503 while the server built its first batch (23:23:56-23:26:37 UTC), the warm-up after a restart'])
    expect(j.incomplete).toEqual([])
    expect(j.errors).toEqual([])
    expect(j.crashed).toBeNull()
    expect(j.tail).toBe('')
  })

  it('still fails on a crash in a log it could only partly read', () => {
    const crash = `${DURING} heroku[web.1]: State changed from up to crashed`
    for (const status of [1, null]) {
      const j = judge([...MARKED, crash, 'Error: log stream disconnected'], status)
      expect(j.crashed).toBe(crash)
      expect(j.incomplete).toEqual([`heroku logs ${status === null ? 'was stopped' : 'exited 1'}: Error: log stream disconnected`])
      expect(j.tail).toBe('with the server log not read in full')
    }
  })

  it('never says "no errors" about a log with nothing from after the release', () => {
    expect(judge([]).incomplete).toEqual(['Heroku returned no log lines'])
    expect(judge([BEFORE_RELEASE]).incomplete).toEqual(['none of the 1 lines Heroku returned is from after the release'])
    expect(judge([' ›   Error: Couldn\'t find that app.'], 1).incomplete[0]).toBe('heroku logs exited 1: ›   Error: Couldn\'t find that app.')
  })

  it('says the log is incomplete when it starts after the release, in UTC', () => {
    const j = judge(MARKED.slice(4))
    expect(j.incomplete).toEqual(['the 13 lines Heroku returned start at 2026-11-11T23:23:26 UTC, after the release'])
    expect(j.errors).toEqual([])
  })

  it('says the log is incomplete when Heroku dropped lines from it (L10 to L13, as its error-codes page writes them)', () => {
    const notices = [
      `${AFTER} heroku[logplex]: Error L10 (output buffer overflow): 500 messages dropped since 2026-11-11T23:27:00+00:00.`,
      `${AFTER} d.1234-drain-identifier-567 heroku logplex - - Error L10 (output buffer overflow): 500 messages dropped since 2026-11-11T23:27:00+00:00.`,
      `${AFTER} heroku[logplex]: L11 (Tail buffer overflow) -> This tail session dropped 1101 messages since 2026-11-11T23:27:00+00:00`,
      `${AFTER} app[log-shuttle]: Error L12: 222 messages dropped since 2026-11-11T23:27:00+00:00.`,
      `${AFTER} app[log-shuttle]: Error L13: 111 messages lost since 2026-11-11T23:27:00+00:00.`,
    ]
    for (const dropped of notices) {
      const j = judge([...MARKED, dropped])
      expect(j.log.lost).toEqual([dropped])
      expect(j.incomplete).toEqual([`Heroku dropped log lines: ${dropped.slice(33, 193)}`])
      expect(j.tail).toBe('with the server log not read in full')
    }
  })

  it("does not take the app's own words for a dropped-lines notice", () => {
    for (const line of ['[KL] loan L12 checked', '[KL] title="L11 (Tail buffer overflow)" saved', '[KL] error L12 recovered', '[KL] note: Error L12: quoted']) {
      expect(judge([...MARKED, `${AFTER} app[web.1]: ${line}`]).incomplete).toEqual([])
    }
  })

  it('reports errors and an incomplete log together', () => {
    const broken = answered(DURING, FEED, 500)
    expect(judge([...MARKED, broken], 1).tail).toBe('with 1 error line in the server log to read and the server log not read in full')
  })
})
