/**
 * klCore.mjs — the KivaLens API server logic, shared by both the Vite dev
 * plugin (server/klDevPlugin.ts) and the production server (server/prod.mjs).
 *
 * It downloads all fundraising loans from Kiva's API, processes them into the
 * KLS compressed batch format, keeps the dataset fresh on a timer, and serves
 * the same-origin endpoints the client expects:
 *   GET  /api/start
 *   GET  /api/partners                      (gzip)
 *   GET  /api/loans/:batch/:page            (gzip)
 *   GET  /api/loans/:batch/keywords/:page   (gzip)
 *   GET  /api/since/:batch
 *   GET  /api/heartbeat/...
 *   POST /graphql
 *   GET  /proxy/kiva/ajax/...               (Kiva-WAF header recipe)
 *   GET  /proxy/gdocs/spreadsheets/...
 *
 * Plain JavaScript that runs on Node (Heroku) and in Cloudflare Workers with
 * nodejs_compat; klCore.d.ts gives the TS dev plugin its types. Storage (the
 * cache and the warm-start snapshot) is whatever the host configured in
 * runtime.mjs: files and Redis on Node, SQLite and R2 on Cloudflare.
 */

import zlib from 'node:zlib'
import { cache, snapshots } from './runtime.mjs'
import { gzipped, json, pathOf, readBody, redirect, text } from './http.mjs'
import { applyAtheistData } from './aplus.mjs'
import { filterLoans } from './loanFilter.mjs'
import { loadLenderRssData, BALANCER_SLICES } from './lenderData.mjs'
import { sendDailyDigest } from './digest.mjs'
import { recentlyFunded, observeFundedLoans, resolveLoanDetails } from './loanLifecycle.mjs'
import { criteriaFromParams } from './criteriaUrl.mjs'
import { read as readAge, ageFrom } from './borrowerAge.mjs'
import { resolveAmbiguousAges } from './borrowerAgeAI.mjs'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KL_PAGE_SPLITS = 4
// Re-download + re-batch like the original master (which re-searched Kiva
// every 5 min and re-packaged every 60s). One combined cycle is plenty.
export const REFRESH_INTERVAL_MS = 10 * 60_000
const RETAINED_BATCHES = 2
const RSS_READY_TIMEOUT_MS = 25_000
const KIVA_API = 'https://api.kivaws.org/v1'
const APP_ID = 'org.kiva.kivalens'

// Resident set size + live heap in MB — for diagnosing the dyno's R14 memory
// pressure (RSS is what Heroku's 512MB quota measures; heapUsed is live JS).
const memMB = () => Math.round(process.memoryUsage().rss / 1048576)
const heapMB = () => Math.round(process.memoryUsage().heapUsed / 1048576)
// A+ (Atheist Team) partner ratings spreadsheet, exported as CSV.
const APLUS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export?gid=1&format=csv'
const APLUS_CACHE_KEY = 'aplus.csv'
const APLUS_TTL_MS = 24 * 60 * 60_000

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function chunkArray(arr, n) {
  const size = Math.ceil(arr.length / n)
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function gzipAsync(data) {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, { level: 6 }, (err, result) => (err ? reject(err) : resolve(result)))
  })
}

// ---------------------------------------------------------------------------
// Kiva API fetching
// ---------------------------------------------------------------------------

const FETCH_HEADERS = {
  Accept: 'application/json,*/*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0',
  Referer: 'https://www.kiva.org/',
}

/**
 * What failed, for a log line ("TypeError: ..."; with messageOnly, the message
 * alone), whatever was thrown; never throws itself.
 */
function describeError(e, { messageOnly = false } = {}) {
  try {
    return messageOnly ? String(e?.message || e) : String(e)
  } catch {
    return 'an error that cannot be printed'
  }
}

/**
 * A failure path's log line: a logger that throws, or returns a promise that
 * rejects, must not turn the failure being reported into a new one.
 */
function logSafely(log, line) {
  try {
    const written = log(line)
    if (written && typeof written.then === 'function') written.then(undefined, () => {})
  } catch {
    // nothing left to tell
  }
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return res.json()
}

/** One page of Kiva's fundraising listing, and how many pages there are (capped at 100). */
export async function fetchSearchPage(page) {
  const data = await fetchJSON(
    `${KIVA_API}/loans/search.json?status=fundraising&page=${page}&per_page=100&app_id=${APP_ID}`,
  )
  return { loans: data.loans || [], pages: Math.min(data.paging.pages, 100) }
}

/**
 * Full details (description, repayment schedule, borrowers) for up to 50 loans.
 * An entry that is not a loan is dropped; that loan is served from the listing.
 */
export async function fetchDetailBatch(ids) {
  const data = await fetchJSON(`${KIVA_API}/loans/${ids.join(',')}.json?app_id=${APP_ID}`)
  return (data.loans || []).filter((d) => d && typeof d === 'object' && d.id != null)
}

/**
 * Listing loans merged with their details and processed, keeping those still
 * raising money: Kiva lists some loans as fundraising that are already fully
 * funded (funded_amount >= loan_amount). basket_amount is deliberately ignored:
 * Kiva's basket figures are unreliable and sometimes exceed the amount remaining.
 * A detail that cannot be processed costs only itself: that loan is served from
 * the listing's own data, and a loan whose listing data fails too is skipped.
 * Returns the kept { loan, keywords } and how many were processed at all.
 */
export function processListed(searchLoans, details) {
  const byId = new Map(details.map((d) => [d.id, d]))
  const kept = []
  let processed = 0
  for (const searchLoan of searchLoans) {
    const detail = byId.get(searchLoan.id)
    let merged
    let p
    try {
      merged = detail ? { ...searchLoan, ...detail } : searchLoan
      p = processLoan(merged)
    } catch {
      // The listing stands in only for a loan the detail itself shows still
      // raising money (status fundraising, amounts that are numbers and short of
      // the loan); a detail that says it closed, or cannot say, is believed or
      // left alone as before, so the listing never puts a funded loan back.
      if (!detail || !merged || merged.status !== 'fundraising') continue
      const { funded_amount: funded, loan_amount: amount } = merged
      if (!(typeof funded === 'number' && typeof amount === 'number' && funded < amount)) continue
      try {
        p = processLoan(searchLoan)
      } catch {
        continue
      }
    }
    processed++
    if (p.loan.status === 'fundraising' && p.loan.funded_amount < p.loan.loan_amount) kept.push(p)
  }
  return { kept, processed }
}

async function fetchAllSearchLoans(state, log) {
  const all = []
  // Kiva's listing is live and paging is offset-based, so a loan funding out
  // mid-pull shifts the window and can serve the same loan on two consecutive
  // pages. Clients trust server batches verbatim (setKivaLoans trustNoDupes),
  // so a repeat here would surface as a duplicate card. De-dupe by id as we go.
  // (The mirror case -- a loan pushed ACROSS the seam and missed -- needs no
  // handling: the next refresh re-pulls the whole listing and picks it up.)
  const seen = new Set()
  let duplicates = 0
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    checkStopped(state)
    const data = await fetchSearchPage(page)
    totalPages = data.pages
    for (const loan of data.loans) {
      if (!loan || loan.id == null) continue
      if (seen.has(loan.id)) { duplicates++; continue }
      seen.add(loan.id)
      all.push(loan)
    }
    log(`  search loans: page ${page}/${totalPages} (${all.length} loans)`)
    page++
  }
  if (duplicates) log(`  listing shifted mid-pull: ignored ${duplicates} duplicate loan(s)`)
  return all
}

const KIVA_GRAPHQL = 'https://api.kivaws.org/graphql'

/**
 * Fetch the authoritative facet taxonomy (sectors / activities / themes / tags)
 * from Kiva's GraphQL API, normalized to the {value,label} shape the client's
 * dropdowns use. This guarantees the most complete list even for values that
 * have zero current fundraising loans. One round-trip.
 *
 * Tags: the client filters loans on `kls_tags`, which is the v1 tag name with
 * whitespace stripped (e.g. "#Woman-OwnedBusiness"), so the option value must
 * match that; the readable GraphQL name (e.g. "#Woman-Owned Business") is the
 * label. Only active, non-empty tags are included.
 */
async function fetchTaxonomy() {
  const query =
    '{ lend { sector { name } activity { name } tag { name status } loanThemeFilter { name } } }'
  const res = await fetch(KIVA_GRAPHQL, {
    method: 'POST',
    headers: { ...FETCH_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`GraphQL ${res.status} ${res.statusText}`)
  const json = await res.json()
  const lend = json?.data?.lend
  if (!lend) throw new Error(`GraphQL taxonomy missing: ${JSON.stringify(json).slice(0, 200)}`)

  const byLabel = (a, b) => a.label.localeCompare(b.label)
  const named = (list) =>
    (list || [])
      .map((x) => x.name)
      .filter((n) => n && n.trim())
      .map((n) => ({ value: n, label: n }))
      .sort(byLabel)

  const tagSeen = new Set()
  const tags = (lend.tag || [])
    .filter((t) => t.status === 'active' && t.name && t.name.trim())
    .map((t) => ({ value: t.name.replace(/\s+/g, ''), label: t.name }))
    .filter((t) => (tagSeen.has(t.value) ? false : (tagSeen.add(t.value), true)))
    .sort(byLabel)

  return {
    sectors: named(lend.sector),
    activities: named(lend.activity),
    themes: named(lend.loanThemeFilter),
    tags,
  }
}

/**
 * Details for every listed loan, fetched 50 at a time with four requests in
 * flight, each batch processed as it arrives so its raw details can be released
 * at once rather than held for the whole catalog; the result keeps the listing's
 * order. Loans that left the listing since the last refresh are looked up too,
 * only to learn whether they funded (observeFundedLoans).
 */
async function fetchAndProcess(state, listing, missingIds, log) {
  const batchSize = 50
  const batches = []
  for (let i = 0; i < listing.length; i += batchSize) batches.push({ loans: listing.slice(i, i + batchSize) })
  for (let i = 0; i < missingIds.length; i += batchSize) batches.push({ ids: missingIds.slice(i, i + batchSize) })
  const total = listing.length + missingIds.length
  const results = new Array(batches.length)
  let next = 0
  let completed = 0
  let processed = 0
  let detailed = 0
  // A bad entry from Kiva costs only its own loan (fetchDetailBatch,
  // observeFundedLoans, processListed), so nothing here is expected to throw.
  // If something does, the other workers stop taking batches and the refresh
  // fails only once all four have stopped: it never returns with a worker
  // still writing to the state.
  let failed = false // not the error's own truthiness: anything can be thrown
  let failure
  const workers = Array.from({ length: 4 }, async () => {
    while (next < batches.length && !state.stopped && !failed) {
      const i = next++
      const batch = batches[i]
      try {
        let details = []
        try {
          details = await fetchDetailBatch(batch.loans ? batch.loans.map((l) => l.id) : batch.ids)
        } catch {
          // Non-fatal: the listing's own data still serves these loans
        }
        detailed += details.length
        observeFundedLoans(state, details)
        if (batch.loans) {
          const r = processListed(batch.loans, details)
          results[i] = r.kept
          processed += r.processed
        }
        completed++
        if (completed % 10 === 0 || completed === batches.length) {
          log(`  loan details: ${Math.min(completed * batchSize, total)}/${total}`)
        }
      } catch (e) {
        if (!failed) {
          failed = true
          failure = e
        }
      }
    }
  })
  await Promise.all(workers)
  if (failed) throw failure
  checkStopped(state)
  return { kept: results.filter(Boolean).flat(), processed, detailed }
}

async function fetchAllPartners(state, log) {
  const all = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    checkStopped(state)
    const url = `${KIVA_API}/partners.json?page=${page}&app_id=${APP_ID}`
    const data = await fetchJSON(url)
    totalPages = data.paging.pages
    if (data.partners) all.push(...data.partners)
    log(`  partners: page ${page}/${totalPages} (${all.length})`)
    page++
  }
  return all
}

// ---------------------------------------------------------------------------
// Loan processing (simplified server-side ResultProcessors)
// ---------------------------------------------------------------------------

const COMMON_USE = new Set([
  'PURCHASE', 'FOR', 'AND', 'BUY', 'OTHER', 'HER', 'BUSINESS', 'SELL',
  'MORE', 'HIS', 'THE', 'PAY',
])
const COMMON_DESCR = new Set([
  ...COMMON_USE, 'THIS', 'ARE', 'SHE', 'THAT', 'HAS', 'LOAN', 'BE', 'OLD',
  'BEEN', 'YEARS', 'FROM', 'WITH', 'INCOME', 'WILL', 'HAVE',
])

function extractWords(text, ignore) {
  if (!text) return []
  const matches = text.match(/(\w+)/g)
  if (!matches) return []
  const seen = new Set()
  return matches
    .filter((w) => w.length > 2)
    .map((w) => w.toUpperCase())
    .filter((w) => {
      if (seen.has(w) || ignore.has(w)) return false
      seen.add(w)
      return true
    })
}

export function processLoan(raw) {
  const loan = { ...raw }
  const now = Date.now()

  loan.kl_processed = new Date()
  loan.kl_name_arr = (loan.name || '').toUpperCase().match(/(\w+)/g) || []
  loan.kl_posted_date = new Date(loan.posted_date)
  loan.kl_newest_sort = loan.kl_posted_date.getTime()
  if (!loan.basket_amount) loan.basket_amount = 0
  if (!loan.funded_amount) loan.funded_amount = 0
  loan.kl_still_needed = Math.max(
    loan.loan_amount - loan.funded_amount - loan.basket_amount, 0,
  )
  loan.kl_percent_funded =
    (100 * (loan.funded_amount + loan.basket_amount)) / loan.loan_amount

  if (loan.tags) loan.kls_tags = loan.tags.map((t) => (t.name || '').replace(/\s+/g, ''))
  if (!loan.kls_tags) loan.kls_tags = []

  const borrowers = loan.borrowers || []
  loan.borrower_count = borrowers.length
  const femaleCount = borrowers.filter((b) => b.gender === 'F').length
  loan.kl_percent_women = borrowers.length ? (femaleCount / borrowers.length) * 100 : 0

  const descrText = loan.description?.texts?.en || ''
  loan.kls_has_descr = !!descrText
  const descrArr = extractWords(descrText, COMMON_DESCR)
  const useArr = extractWords(loan.use || '', COMMON_USE)
  const seen = new Set(useArr)
  const combined = [...useArr, ...descrArr.filter((w) => !seen.has(w))]
  loan.kls_use_or_descr_arr = combined

  // An age the description cannot settle stays null here; resolveAmbiguousAges()
  // fills those in after the batch is processed, so a child's age is never published
  // as the borrower's.
  loan.kls_age = ageFrom(readAge(descrText))

  loan.kl_repayments = []
  const schedPayments = loan.terms?.scheduled_payments
  if (schedPayments && schedPayments.length) {
    const grouped = {}
    for (const p of schedPayments) {
      const d = new Date(p.due_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!grouped[key]) grouped[key] = { date: d, amount: 0 }
      grouped[key].amount += p.amount
    }
    const repayments = Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime())

    if (repayments.length > 0) {
      const filled = []
      const startDate = new Date(Math.min(new Date().getTime(), repayments[0].date.getTime()))
      let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      const lastDate = repayments[repayments.length - 1].date

      while (cur <= lastDate) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
        const existing = grouped[key]
        filled.push({ date: new Date(cur), amount: existing?.amount ?? 0 })
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      }

      const trimmed = filled.slice(filled.findIndex((r) => r.amount > 0))

      let runningTotal = 0
      const amount50 = loan.loan_amount * 0.5
      const amount75 = loan.loan_amount * 0.75

      for (const r of trimmed) {
        runningTotal += r.amount
        const percent = (runningTotal * 100) / loan.loan_amount

        if (!loan.kls_half_back && runningTotal >= amount50) {
          loan.kls_half_back = r.date
          loan.kls_half_back_actual = parseFloat(percent.toFixed(2))
        }
        if (!loan.kls_75_back && runningTotal >= amount75) {
          loan.kls_75_back = r.date
          loan.kls_75_back_actual = parseFloat(percent.toFixed(2))
        }

        loan.kl_repayments.push({
          date: r.date,
          // 'MMM-yyyy' with a dash, matching the client-side ResultProcessors format
          display: `${r.date.toLocaleDateString('en-US', { month: 'short' })}-${r.date.getFullYear()}`,
          amount: r.amount,
          percent,
        })
      }

      loan.kls_final_repayment = new Date(schedPayments[schedPayments.length - 1].due_date)
      const todayDate = new Date()
      loan.kls_repaid_in = loan.kls_final_repayment
        ? Math.abs(
            (loan.kls_final_repayment.getFullYear() - todayDate.getFullYear()) * 12 +
              (loan.kls_final_repayment.getMonth() - todayDate.getMonth()),
          )
        : 0
    }
  }

  loan.kl_planned_expiration_date = new Date(loan.planned_expiration_date)
  loan.kl_expiring_in_days =
    (loan.kl_planned_expiration_date.getTime() - now) / (24 * 60 * 60 * 1000)
  loan.kl_disbursal_in_days = loan.terms?.disbursal_date
    ? (new Date(loan.terms.disbursal_date).getTime() - now) / (24 * 60 * 60 * 1000)
    : 0

  if (loan.description?.languages) {
    const langs = loan.description.languages.filter((l) => l !== 'en')
    for (const lang of langs) delete loan.description.texts?.[lang]
  }
  delete loan.terms?.local_payments
  delete loan.terms?.disbursal_currency
  delete loan.terms?.disbursal_amount
  delete loan.terms?.loan_amount
  delete loan.tags
  delete loan.journal_totals
  delete loan.translator
  delete loan.location?.geo
  delete loan.location?.town
  delete loan.image?.template_id
  if (!loan.bonus_credit_eligibility) delete loan.bonus_credit_eligibility
  if (loan.borrowers) {
    for (const b of loan.borrowers) if (b.last_name === '') delete b.last_name
  }

  return { loan, keywords: { id: loan.id, t: combined } }
}

export function compressLoan(loan) {
  // Shallow copy + targeted field stripping, instead of a full
  // JSON.parse(JSON.stringify(loan)) deep clone. The round-trip allocated a
  // SECOND full copy of every loan during the refresh peak (~7000 loans) on top
  // of state.allLoans + the source set — a major contributor to the dyno's R14.
  // Nested objects (location, image, kls_tags) are shared with the source (we
  // never mutate them); `terms` IS mutated below, so it is cloned first.
  const l = { ...loan }

  for (const key of Object.keys(l)) {
    if (key.startsWith('kl_')) delete l[key]
  }

  delete l.kls_use_or_descr_arr
  if (!l.kls_age) delete l.kls_age

  const borrowers = loan.borrowers || []
  const klb = { M: 0, F: 0 }
  for (const b of borrowers) {
    if (b.gender === 'M') klb.M++
    else if (b.gender === 'F') klb.F++
  }
  if (!klb.M) delete klb.M
  if (!klb.F) delete klb.F
  l.klb = klb

  delete l.description
  delete l.borrowers
  delete l.borrower_count
  delete l.status
  delete l.lender_count
  delete l.payments
  if (!l.funded_amount) delete l.funded_amount
  if (!l.basket_amount) delete l.basket_amount
  if (l.kls_tags && !l.kls_tags.length) delete l.kls_tags

  // terms is shared with the source loan (state.allLoans) — clone before stripping
  // so /graphql, RSS and the AI still see the full terms.
  if (l.terms) {
    const terms = { ...l.terms }
    delete terms.repayment_term
    delete terms.scheduled_payments
    if (terms.loss_liability) {
      terms.loss_liability = { ...terms.loss_liability }
      delete terms.loss_liability.currency_exchange_coverage_rate
    }
    l.terms = terms
  }

  l.kls = true
  return l
}

export function processPartners(partners) {
  const regionsLu = {
    'North America': 'na', 'Central America': 'ca', 'South America': 'sa',
    Africa: 'af', Asia: 'as', 'Middle East': 'me',
    'Eastern Europe': 'ee', 'Western Europe': 'we',
    Antarctica: 'an', Oceania: 'oc',
  }
  for (const p of partners) {
    p.kl_sp = p.social_performance_strengths
      ? p.social_performance_strengths.map((sp) => sp.id)
      : []
    const regionSet = new Set()
    for (const c of p.countries || []) {
      const r = regionsLu[c.region]
      if (r) regionSet.add(r)
    }
    p.kl_regions = [...regionSet]
    p.kl_years_on_kiva =
      (Date.now() - new Date(p.start_date).getTime()) / (365.25 * 24 * 60 * 60_000)
  }
  return partners
}

/**
 * Load the A+ (Atheist Team) ratings CSV. Prefers a fresh disk-cached copy,
 * otherwise fetches the spreadsheet and caches it. On fetch failure, falls back
 * to any stale cached copy. Returns the CSV text, or null if truly unavailable.
 * (The disk is ephemeral; the cache just avoids re-fetching every 10-min refresh
 * and across restarts until the dyno is recycled.)
 */
async function loadAplusCsv(log) {
  const cached = await cache.get(APLUS_CACHE_KEY, APLUS_TTL_MS)
  if (cached) {
    log(`A+ data: using cached copy (${cached.length} bytes)`)
    return cached
  }
  try {
    const res = await fetch(APLUS_CSV_URL, {
      headers: { 'User-Agent': FETCH_HEADERS['User-Agent'], Accept: 'text/csv,*/*' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const csv = await res.text()
    if (csv && csv.length > 100) {
      await cache.set(APLUS_CACHE_KEY, csv)
      log(`A+ data: fetched + cached (${csv.length} bytes)`)
      return csv
    }
    logSafely(log, `A+ data: fetch returned empty/short body (${csv?.length ?? 0} bytes)`)
  } catch (e) {
    logSafely(log, `A+ data: fetch failed (${describeError(e)})`)
  }
  const stale = await cache.get(APLUS_CACHE_KEY)
  if (stale) {
    log('A+ data: using stale cached copy')
    return stale
  }
  return null
}

// ---------------------------------------------------------------------------
// State + data preparation
// ---------------------------------------------------------------------------

/**
 * True once the FULL live loan objects are published, i.e. the shared filter
 * can actually be run over them.
 *
 * `state.ready` is NOT this: it only means the compressed /api pages are
 * servable. The Redis warm start sets `ready` with `allLoans` holding PARTIAL
 * detail objects (descriptions + repayments, no country/sector), which filter to
 * nothing. Anything running filterLoans must gate on this instead — otherwise,
 * for the ~3 minutes after every deploy or dyno restart, it reports "no loans
 * match" for every query while the site itself shows thousands (the browser is
 * warm from its own cache). RSS already had this distinction as `rssReady`;
 * this names the concept so the AI tools stop reaching for the wrong flag.
 */
export function loansFilterable(state) {
  return !!(state && state.filterableLoans && state.allLoans && state.allLoans.length)
}

/**
 * Rebuild the fields compressLoan strips, so a cached page can be filtered.
 * Mirrors the client's ResultProcessors.processLoan, which does exactly this to
 * the same payload.
 *
 * Deliberately does NOT set kl_processed: /api/since treats a loan as "changed"
 * when its kl_processed is newer than the batch, so stamping it here would make
 * the next delta request return the whole dataset.
 */
function rehydrateCompressedLoan(l, words, detail) {
  if (!l.funded_amount) l.funded_amount = 0
  if (!l.basket_amount) l.basket_amount = 0
  l.status = l.status || 'fundraising'

  const male = (l.klb && l.klb.M) || 0
  const female = (l.klb && l.klb.F) || 0
  l.borrower_count = male + female
  l.borrowers = [
    ...Array.from({ length: male }, () => ({ gender: 'M', first_name: '...' })),
    ...Array.from({ length: female }, () => ({ gender: 'F', first_name: '...' })),
  ]
  l.kl_percent_women = l.borrower_count ? (female / l.borrower_count) * 100 : 0

  l.kl_name_arr = (l.name || '').toUpperCase().match(/(\w+)/g) || []
  l.kl_posted_date = new Date(l.posted_date)
  l.kl_newest_sort = l.kl_posted_date.getTime()
  l.kl_still_needed = Math.max(l.loan_amount - l.funded_amount - l.basket_amount, 0)
  l.kl_percent_funded = (100 * (l.funded_amount + l.basket_amount)) / l.loan_amount

  const DAY = 24 * 60 * 60 * 1000
  if (l.planned_expiration_date) {
    l.kl_planned_expiration_date = new Date(l.planned_expiration_date)
    l.kl_expiring_in_days = (l.kl_planned_expiration_date.getTime() - Date.now()) / DAY
  }
  if (l.terms && l.terms.disbursal_date) {
    l.kl_disbursal_in_days = (new Date(l.terms.disbursal_date).getTime() - Date.now()) / DAY
  }
  // kl_dollars_per_hour is deliberately NOT set: the shared filter computes it
  // fresh from posted_date when the field is absent (dollarsPerHour fallback),
  // so a stored number would only freeze a value that otherwise stays live.

  if (!l.kls_tags) l.kls_tags = []
  // Word arrays for the use/description search live in the parallel keyword pages.
  l.kls_use_or_descr_arr = words || []
  for (const k of ['kls_half_back', 'kls_75_back', 'kls_final_repayment', 'kls_half_back_actual']) {
    if (typeof l[k] === 'string') l[k] = new Date(l[k])
  }
  if (detail) {
    if (detail.description) l.description = detail.description
    if (detail.kl_repayments) l.kl_repayments = detail.kl_repayments
  }
  if (!l.description) l.description = { languages: ['en'], texts: { en: '' } }
  return l
}

const gunzipJson = (buf) => JSON.parse(zlib.gunzipSync(buf).toString('utf8'))

/**
 * Make the Redis warm start filterable WITHOUT waiting for the live refresh.
 *
 * The snapshot already holds the whole dataset as the compressed pages the
 * browser filters against; the warm start just never expanded them, so for the
 * ~150s a cold refresh takes, anything server-side that filtered (the AI tools)
 * saw an empty result set. Expanding them costs one pass over ~7k loans and is
 * done at most once per boot, on demand.
 *
 * Restores partners too: without activePartners the default MFI-only filter has
 * no partner to match and would hide every loan.
 */
export function rehydrateWarmCache(state, log = () => {}) {
  if (!state || state.warmRehydrated || loansFilterable(state)) return false
  // Refuse only while the refresh has STAGED its live loans and is gzipping
  // (liveStaged): an expand in that window overwrote the freshly-built dataset
  // with the old cached one — new pages beside stale loans, persisted by the
  // deferred snapshot. Guarding on state.building instead was wrong: building
  // spans the whole ~150s startup refresh, which is precisely the window this
  // feature exists to cover (cross-exam finding). A refusal does NOT latch; the
  // staged window is seconds, and publication resolves the caller's wait.
  if (state.liveStaged) return false
  const served = state.batches && state.batches.get(state.batch)
  if (!served || !served.loanPages || !served.loanPages.length || !state.partnersGz) return false
  state.warmRehydrated = true // one attempt per boot, success or not
  try {
    const partners = gunzipJson(state.partnersGz)

    const words = new Map()
    for (const page of served.keywordPages || []) {
      for (const k of gunzipJson(page)) words.set(k.id, k.t)
    }
    const details = new Map()
    for (const d of state.warmDetails || []) details.set(d.id, d)

    const loans = []
    for (const page of served.loanPages) {
      for (const l of gunzipJson(page)) {
        loans.push(rehydrateCompressedLoan(l, words.get(l.id), details.get(l.id)))
      }
    }

    // Only populate partners if nothing owns them yet: a refresh in its fetch
    // phase may ALREADY have set fresh, A+-enriched partners, and the cached
    // blob predates the A+ merge — overwriting would strip atheistScore/
    // normalizedReligions while atheistListProcessed stays true, so the loss
    // would not even self-repair until the next cycle (cross-exam round 2).
    if (!state.partners || !state.partners.length) {
      state.partners = partners
      state.activePartners = partners.filter((p) => p.status === 'active')
    }
    state.allLoans = loans
    state.warmDetails = null // freed: merged into the loans above
    state.filterableLoans = true
    // The cached partner blob predates the A+ merge (prepareData gzips partners
    // BEFORE enriching), while the browser fetches A+ itself when its payload
    // lacks it — so without this, a religion filter here returns 0 while the
    // user's own client shows matches. Fire-and-forget; the live refresh does
    // its own merge and replaces state.partners, so bail if that happened.
    if (state.partners === partners && !state.atheistListProcessed) {
      void loadAplusCsv(log)
        .then((csv) => {
          if (!csv || state.atheistListProcessed || state.partners !== partners) return
          state.aplusMerged = applyAtheistData(state.partners, csv)
          state.atheistListProcessed = true
          log(`A+ merged into warm partners: ${state.aplusMerged}/${state.partners.length}`)
        })
        .catch(() => {})
    }
    log(`Warm cache expanded: ${loans.length} loans filterable without waiting for the refresh`)
    return true
  } catch (e) {
    logSafely(log, `Warm cache expand skipped (non-fatal): ${describeError(e)}`)
    return false
  }
}

/**
 * Wait (briefly) for the live loan set to become filterable, so a request that
 * lands late in a warm start answers properly instead of punting.
 *
 * Bounded on purpose: a cold refresh takes ~150s, and an SSE response that goes
 * quiet that long trips Heroku's inter-byte router timeout — a request held to
 * the end would fail rather than succeed. So this rescues the tail of the
 * window and gives up cleanly otherwise.
 */
export async function awaitLoansFilterable(state, timeoutMs = 20_000) {
  if (!state) return false
  const log = state.log || (() => {})
  const tryNow = () => loansFilterable(state) || rehydrateWarmCache(state, log)
  if (tryNow()) return true
  if (!state.rssReadyPromise || timeoutMs <= 0) return false
  // Poll while waiting: the Redis snapshot can finish loading AFTER this wait
  // begins, and hydrateFromCache resolves no promise — without the re-try, a
  // request arriving seconds before the snapshot landed sat out the full bound
  // and answered "still loading" with a usable cache already on the state. The
  // re-tries are near-free until the cache appears (guards fail before any
  // work, and a refusal during a live refresh does not latch).
  let timer, poller
  const ok = await Promise.race([
    state.rssReadyPromise.then(() => true),
    new Promise((resolve) => { poller = setInterval(() => { if (tryNow()) resolve(true) }, 250) }),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs) }),
  ])
  clearTimeout(timer)
  clearInterval(poller)
  return ok && loansFilterable(state)
}

export function createState() {
  let resolveRssReady
  const rssReadyPromise = new Promise((resolve) => {
    resolveRssReady = resolve
  })

  return {
    ready: false,
    // True once allLoans holds FULL loan objects the shared filter can run on —
    // set by a live refresh, or by expanding the warm-start cache on demand.
    // Distinct from `ready`, which only means the /api pages are servable.
    filterableLoans: false,
    warmRehydrated: false,
    // True only between the refresh staging its live loans and publishing them.
    liveStaged: false,
    warmDetails: null,
    // RSS needs the full live loan + partner objects. The Redis warm start only
    // restores compressed API pages and per-loan details, so general API
    // readiness must not be treated as RSS filtering readiness.
    rssReady: false,
    rssReadyPromise,
    resolveRssReady,
    batch: 0,
    klStart: null,
    batches: new Map(), // retained batches (latest RETAINED_BATCHES)
    partnersGz: null,
    partners: [], // retained processed partners (for server-side RSS filtering)
    activePartners: [], // status === 'active' subset (the RSS partner pool)
    atheistListProcessed: false, // true once A+ data has been merged at least once
    aplusMerged: 0, // count of partners matched to an A+ row last refresh
    optionsGz: null, // gzipped facet taxonomy from Kiva GraphQL
    allLoans: [],
    recentlyFunded: [], // Only { id, fundedAt }; no closed borrower content.
    loanDetailRequests: new Map(), // In-flight only; removed on every outcome.
    newestTime: 0,
    building: false,
    stopped: false, // set by startRefresh's stop(); a stopped state never refreshes again
    snapshotTimer: null, // the deferred snapshot save after a publish
  }
}

/**
 * Thrown inside a refresh once startRefresh's stop() has been called: the run
 * ends at its next step, before it publishes anything. It is recognised by
 * identity, never instanceof: instanceof runs code on whatever was thrown.
 */
const REFRESH_STOPPED = new Error('refresh stopped')
function checkStopped(state) {
  if (state.stopped) throw REFRESH_STOPPED
}

/**
 * Download everything from Kiva and publish it as the next batch. Runs at
 * startup and then every REFRESH_INTERVAL_MS, mirroring the original master's
 * refresh + prepForRequests cycle. Each run naturally drops loans that are no
 * longer fundraising (the search is status=fundraising).
 */
export async function prepareData(state, log = console.log) {
  if (state.building || state.stopped) return
  state.building = true
  try {
    log(
      state.batch === 0
        ? 'Starting data download from Kiva...'
        : `Refreshing data (batch ${state.batch} -> ${state.batch + 1})...`,
    )
    const startTime = Date.now()

    log('Fetching partners...')
    const rawPartners = await fetchAllPartners(state, log)
    const partners = processPartners(rawPartners)
    state.partnersGz = await gzipAsync(JSON.stringify(partners))
    log(`Partners ready: ${partners.length}`)

    // Retain the partner array for server-side RSS filtering, then merge the A+
    // (Atheist Team) data into it. Done AFTER gzip so the /api/partners payload
    // sent to clients is unchanged (the client still loads A+ data on its own).
    state.partners = partners
    state.activePartners = partners.filter((p) => p.status === 'active')
    try {
      const aplusCsv = await loadAplusCsv(log)
      state.aplusMerged = applyAtheistData(state.partners, aplusCsv)
      state.atheistListProcessed = !!aplusCsv
      log(`A+ merged into ${state.aplusMerged}/${state.partners.length} partners`)
    } catch (e) {
      logSafely(log, `A+ merge failed (continuing without it): ${describeError(e)}`)
    }

    // Facet taxonomy (sectors/activities/themes/tags) from GraphQL — keep the
    // previous list if this fails; it's non-essential to the loan dataset.
    try {
      const options = await fetchTaxonomy()
      state.optionsGz = await gzipAsync(JSON.stringify(options))
      log(
        `Taxonomy ready: ${options.sectors.length} sectors, ${options.activities.length} activities, ` +
          `${options.themes.length} themes, ${options.tags.length} tags`,
      )
    } catch (e) {
      logSafely(log, `Taxonomy fetch failed (keeping previous): ${describeError(e)}`)
    }

    log(`[mem] refresh start rss=${memMB()}MB heapUsed=${heapMB()}MB`)
    log('Fetching loans from search...')
    let searchLoans = await fetchAllSearchLoans(state, log)
    log(`Found ${searchLoans.length} fundraising loans`)

    log('Fetching and processing full loan details...')
    const listedIds = new Set(searchLoans.map((loan) => loan.id))
    const missingIds = state.allLoans.filter((loan) => !listedIds.has(loan.id)).map((loan) => loan.id)
    let { kept: fundable, processed, detailed } = await fetchAndProcess(state, searchLoans, missingIds, log)
    searchLoans = null
    log(`Fetched details for ${detailed} loans`)
    log(`Processed ${processed} loans`)
    log(`Excluded ${processed - fundable.length} closed or fully-funded loans; ${fundable.length} remain`)

    // Stage the live dataset now (releasing the previous batch's loans — holding
    // both through the gzip awaits cost ~29MB on the 512MB dyno), and flag the
    // staged window so the warm-cache expand cannot overwrite it mid-gzip.
    state.liveStaged = true
    state.allLoans = fundable.map((p) => p.loan)

    // The handful of descriptions the patterns could not settle. Cached by the text,
    // so this is free on all but the first sighting of a story, and it never throws:
    // a loan whose age stays unknown is simply not offered for an age filter.
    try {
      await resolveAmbiguousAges(state.allLoans, log)
    } catch (error) {
      logSafely(log, `Ages: resolution skipped (${describeError(error, { messageOnly: true })})`)
    }
    state.newestTime = Math.max(...state.allLoans.map((l) => new Date(l.kl_processed).getTime()))

    let compressed = fundable.map((p) => compressLoan(p.loan))
    let keywords = fundable.map((p) => p.keywords)
    fundable = null
    log(`[mem] after compress rss=${memMB()}MB heapUsed=${heapMB()}MB`)

    const loanChunks = chunkArray(compressed, KL_PAGE_SPLITS)
    compressed = null
    const kwChunks = chunkArray(keywords, KL_PAGE_SPLITS)
    keywords = null

    const loanLengths = []
    const descrLengths = []
    const loanPages = []
    const keywordPages = []

    for (const chunk of loanChunks) {
      const json = JSON.stringify(chunk)
      loanLengths.push(json.length)
      loanPages.push(await gzipAsync(json))
    }
    for (const chunk of kwChunks) {
      const json = JSON.stringify(chunk)
      descrLengths.push(json.length)
      keywordPages.push(await gzipAsync(json))
    }

    // Atomic publish: bump the batch, retain the last RETAINED_BATCHES
    checkStopped(state)
    const batch = state.batch + 1
    // builtAt lets a browser that downloads this batch late catch up from Kiva at
    // once instead of after the usual five minutes (src/api/kiva.ts).
    const klStart = { batch, pages: loanChunks.length, loanLengths, descrLengths, builtAt: Date.now() }
    state.batches.set(batch, { loanPages, keywordPages, klStart, newestTime: state.newestTime })
    for (const old of state.batches.keys()) {
      if (old <= batch - RETAINED_BATCHES) state.batches.delete(old)
    }
    state.batch = batch
    state.klStart = klStart
    state.ready = true
    // Live data supersedes anything expanded from the warm cache.
    state.filterableLoans = true
    state.warmDetails = null
    state.liveStaged = false
    if (!state.rssReady) {
      state.rssReady = true
      state.resolveRssReady()
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    // `processed` is deliberately released above to lower the refresh peak; use
    // the published collection here so logging cannot abort snapshot scheduling.
    log(`Data ready! ${state.allLoans.length} loans in ${elapsed}s`)
    log(`  kl_api_start: ${JSON.stringify(state.klStart)}`)

    // Persist the freshly-published dataset for the next boot's warm start.
    log(`[mem] published batch ${batch} rss=${memMB()}MB heapUsed=${heapMB()}MB`)
    // Fire-and-forget, and DEFERRED off the refresh peak: the snapshot builds a
    // multi-MB transient JSON+gzip+base64 string; running it ~8s after publish
    // lets the rebuild's garbage GC first so the two peaks don't stack.
    state.snapshotTimer = setTimeout(() => {
      snapshots.save(snapshotOf(state), log).catch((e) => logSafely(log, `Snapshot save failed: ${describeError(e)}`))
    }, 8000)
  } catch (e) {
    if (e === REFRESH_STOPPED) logSafely(log, 'Refresh stopped before publishing')
    else logSafely(log, `Data preparation failed: ${describeError(e)}`)
  } finally {
    state.building = false
    // A failed refresh must not leave the staged flag latched, or the warm
    // expand would be refused until the next successful publication.
    state.liveStaged = false
  }
}

/**
 * The published batch as the snapshot store keeps it (runtime.mjs `snapshots`),
 * or null before anything is published: the pages the browser downloads, the
 * partners and options, and each loan's description and repayment schedule,
 * which /graphql serves.
 */
export function snapshotOf(state) {
  const served = state.batches.get(state.batch)
  if (!served || !state.klStart) return null
  return {
    batch: state.batch,
    newestTime: state.newestTime,
    klStart: state.klStart,
    partnersGz: state.partnersGz,
    optionsGz: state.optionsGz,
    loanPages: served.loanPages,
    keywordPages: served.keywordPages,
    details: (state.allLoans || []).map((l) => ({ id: l.id, description: l.description, kl_repayments: l.kl_repayments })),
  }
}

/**
 * Warm start: hydrate the served dataset from the Redis snapshot so the server
 * can answer /api/* immediately while the live fetch runs. No-ops when there's
 * no cache (local dev / Redis down / first ever boot). Runs concurrently with
 * the live fetch in startRefresh; whichever lands is fine — the live batch
 * supersedes the cached one, and we never clobber an already-published batch.
 */
async function hydrateFromCache(state, log) {
  try {
    const snap = await snapshots.load(log)
    if (!snap || state.stopped) return
    // The live fetch already published while Redis was being read — keep it.
    if (state.batch > 0) return
    // A pathologically slow Redis read can land after the live refresh already
    // staged its dataset — never let cached stubs overwrite staged live loans.
    if (state.liveStaged) return
    state.batch = snap.batch
    state.klStart = snap.klStart
    // ??= : the refresh writes FRESH partner/option blobs early in its cycle —
    // a slower Redis read must not replace them with the cached copies (the
    // cross-exam reproduced /api/partners serving a stale blob beside new loans).
    state.partnersGz ??= snap.partnersGz
    state.optionsGz ??= snap.optionsGz
    state.newestTime = snap.newestTime
    // Restore the per-loan details (descriptions + repayment schedules) so
    // /graphql can serve them immediately. The live fetch replaces allLoans with
    // the full objects within the cycle. /api/since stays correct meanwhile:
    // these partial objects have no kl_processed, so none count as "changed".
    state.allLoans = snap.details ?? []
    // Kept so an on-demand expand can merge descriptions/repayments back into
    // the loans it rebuilds from the compressed pages.
    state.warmDetails = snap.details ?? []
    state.batches.set(snap.batch, {
      loanPages: snap.loanPages,
      keywordPages: snap.keywordPages,
      klStart: snap.klStart,
      newestTime: snap.newestTime,
    })
    state.ready = true
    const age = snap.savedAt ? `${Math.round((Date.now() - snap.savedAt) / 1000)}s old` : 'age unknown'
    log(`Warm start from cache: batch ${snap.batch}, ${snap.klStart.pages} pages (${age})`)
  } catch (e) {
    logSafely(log, `Warm start skipped (non-fatal): ${describeError(e)}`)
  }
}

// Per-lender RSS cache hygiene: the disk is ephemeral but restarts can be rare,
// so evict entries older than a day and cap the namespace's count/size so a
// burst of distinct lender feeds can't fill the dyno disk.
const LENDER_CLEANUP_INTERVAL_MS = 6 * 60 * 60_000
async function cleanupLenderCache(log = console.log) {
  const removed = await cache.cleanup({
    prefix: 'lender-',
    maxAgeMs: 24 * 60 * 60_000,
    maxFiles: 1000,
    maxBytes: 20 * 1024 * 1024,
  })
  if (removed.length) log(`lender RSS cache: evicted ${removed.length} stale entries`)
}

// Daily "Ask KivaLens" digest: hourly check, sends yesterday's grouped chat
// log once/day at DIGEST_HOUR_UTC (no-ops without RESEND_API_KEY / Redis).
const DIGEST_HOUR_UTC = Number(process.env.DIGEST_HOUR_UTC ?? 13)
async function maybeSendDigest(log = console.log) {
  if (new Date().getUTCHours() !== DIGEST_HOUR_UTC) return
  const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10)
  await sendDailyDigest(yesterday, log)
}

/**
 * Starts the Node server's refresh and upkeep timers. Returns stop(), which
 * clears every one of them and ends a refresh in flight at its next step: a
 * timer or run left going keeps its state (a whole loan dataset) alive and
 * keeps calling Kiva, and the Vite dev server starts a fresh one on each restart.
 */
export function startRefresh(state, log = console.log) {
  // Retain the logger for paths that run outside this call chain (e.g. the
  // on-demand warm-cache expand triggered by an AI request).
  state.log = log
  // Serve cached data ASAP (non-blocking) and fetch live data in parallel.
  void hydrateFromCache(state, log)
  prepareData(state, log)
  const timers = []
  const every = (ms, fn) => {
    const t = setInterval(fn, ms)
    t.unref?.() // never keeps the process alive on its own
    timers.push(t)
  }
  // Upkeep is logged when it fails, never left to reject unhandled, which would
  // end the Node process.
  const upkeep = (what, work) => async () => {
    try {
      await work()
    } catch (e) {
      logSafely(log, `${what} failed: ${describeError(e)}`)
    }
  }
  every(60 * 60_000, upkeep('Daily digest', () => maybeSendDigest(log)))
  // Periodically prune the per-lender RSS cache.
  const cleanup = upkeep('Lender cache cleanup', () => cleanupLenderCache(log))
  cleanup()
  every(LENDER_CLEANUP_INTERVAL_MS, cleanup)
  // Periodic memory breakdown so we can see WHAT holds RSS (heapTotal over-commit
  // that --max-old-space-size can bind, vs. external/buffer memory it can't).
  every(60_000, () => {
    recentlyFunded(state)
    const m = process.memoryUsage()
    const mb = (n) => Math.round(n / 1048576)
    log(
      `[mem] rss=${mb(m.rss)} heapTotal=${mb(m.heapTotal)} heapUsed=${mb(m.heapUsed)} ` +
        `external=${mb(m.external)} arrayBuffers=${mb(m.arrayBuffers)}`,
    )
  })
  // The refresh itself keeps the process alive (it is the server's work).
  timers.push(setInterval(() => prepareData(state, log), REFRESH_INTERVAL_MS))
  return {
    stop() {
      state.stopped = true
      for (const t of timers) clearInterval(t)
      timers.length = 0
      clearTimeout(state.snapshotTimer)
    },
  }
}

// ---------------------------------------------------------------------------
// Responses. Handlers take a Fetch API Request and return a Response, or null
// when the request is not theirs (http.mjs); the Node server converts at its
// edge (nodeAdapter.mjs) and a Cloudflare Worker needs no conversion.
// ---------------------------------------------------------------------------

const notReady = () => new Response('Not ready', { status: 404 })

// ---------------------------------------------------------------------------
// RSS feeds
// ---------------------------------------------------------------------------

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // strip control chars that are illegal in XML 1.0
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function buildRssXml(feedName, linkTo, loans, selfUrl) {
  const now = new Date().toUTCString()
  const items = loans
    .map((l) => {
      const link = `https://www.kivalens.org/rss_click/${linkTo}/${l.id}`
      const descr = l.description?.texts?.en || ''
      const d = l.posted_date ? new Date(l.posted_date) : null
      const pub = d && !Number.isNaN(d.getTime()) ? d.toUTCString() : now
      return (
        '    <item>\n' +
        `      <title>${xmlEscape(l.name)}</title>\n` +
        `      <link>${xmlEscape(link)}</link>\n` +
        `      <description>${xmlEscape(descr)}</description>\n` +
        `      <guid isPermaLink="false">${xmlEscape(l.id)}</guid>\n` +
        `      <pubDate>${pub}</pubDate>\n` +
        '    </item>'
      )
    })
    .join('\n')
  const selfLink = selfUrl
    ? `    <atom:link href="${xmlEscape(selfUrl)}" rel="self" type="application/rss+xml" />\n`
    : ''
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    `    <title>${xmlEscape(feedName)}</title>\n` +
    '    <link>https://www.kivalens.org/</link>\n' +
    `    <description>${xmlEscape('KivaLens loan feed: ' + feedName)}</description>\n` +
    `    <lastBuildDate>${now}</lastBuildDate>\n` +
    selfLink +
    (items ? items + '\n' : '') +
    '  </channel>\n' +
    '</rss>\n'
  )
}

/**
 * Handle /rss/<encoded-criteria> (an RSS 2.0 feed of matching loans, filtered by
 * the SAME shared engine the on-site search uses) and /rss_click/<go_to>/<id>
 * (the per-item redirect). Returns true if it handled the request.
 */
export async function handleRss(state, request) {
  const url = pathOf(request)

  // Per-item click redirect: /rss_click/<kiva|kivalens>/<loanId>
  const m = url.match(/^\/rss_click\/([^/]+)\/([^/?#]+)/)
  if (m) {
    // A half-written escape (%FF) is anyone's to send: answer it, don't throw.
    let goTo, id
    try {
      goTo = decodeURIComponent(m[1])
      id = encodeURIComponent(decodeURIComponent(m[2]))
    } catch {
      return text('Bad request', { status: 400 })
    }
    return redirect(goTo === 'kiva' ? `https://www.kiva.org/lend/${id}?app_id=${APP_ID}` : `https://www.kivalens.org/loans/${id}`)
  }

  // Feed: /rss/<uriComponent-encoded JSON criteria>, or /rss?<search parameters>.
  if (!/^\/rss(\/|\?|$)/.test(url)) return null
  try {
    return await serveRssFeed(state, request, url)
  } catch (e) {
    console.error('RSS feed error:', e)
    return text('RSS feed error', { status: 500 })
  }
}

async function waitForRssData(state) {
  if (state.rssReady) return true

  let timeout
  try {
    return await Promise.race([
      state.rssReadyPromise.then(() => true),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(false), RSS_READY_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

const rssUnavailable = (message) => text(message, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } })

async function serveRssFeed(state, request, url) {
  let crit
  const m = url.match(/^\/rss\/(.+)$/)
  if (m) {
    // The original shape: the whole search as JSON inside the path. Feeds
    // subscribed years ago are still this, and always will be.
    try {
      crit = JSON.parse(decodeURIComponent(m[1].split('?')[0]))
    } catch {
      return text('Invalid RSS criteria', { status: 400 })
    }
  } else {
    // /rss?<the same parameters a Search address uses>, so a feed reads like the
    // page it came from. `feed` names it, because `name` is a search field.
    const params = new URL(url, 'http://request.invalid').searchParams
    crit = criteriaFromParams(params) || { loan: {}, partner: {}, portfolio: {} }
    crit.feed = {
      name: params.get('feed') || '',
      link_to: params.get('link_to') || 'kiva',
      ...(params.get('lender') ? { lender_id: params.get('lender') } : {}),
    }
  }

  const feed = crit.feed || {}
  const linkTo = feed.link_to === 'kivalens' ? 'kivalens' : 'kiva'
  const feedName = feed.name && String(feed.name).trim() ? String(feed.name) : 'KivaLens Feed'

  // Cap the feed size (mirrors the original RSS handler).
  const criteria = {
    loan: { ...(crit.loan || {}), limit_results: 100 },
    partner: { ...(crit.partner || {}) },
    portfolio: { ...(crit.portfolio || {}) },
  }

  // Portfolio features (exclude-my-loans + balancing) require the lender's data.
  // Reject an incomplete artifact instead of silently omitting those filters.
  const lenderId = feed.lender_id ? String(feed.lender_id) : null
  const needsLenderData =
    criteria.portfolio.exclude_portfolio_loans === 'true' ||
    BALANCER_SLICES.some((s) => criteria.portfolio[`pb_${s}`]?.enabled)
  if (needsLenderData && !lenderId) {
    return text('RSS portfolio filters require a lender id', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  // General API readiness may come from the compressed warm start. RSS filtering
  // needs the separately-published live loan and partner objects.
  if (!state.rssReady && !(await waitForRssData(state))) {
    return rssUnavailable('RSS filter data is still loading; retry shortly')
  }

  const ctx = {
    loans: state.allLoans,
    activePartners: state.activePartners,
    atheistListProcessed: state.atheistListProcessed,
  }

  if (needsLenderData) {
    try {
      const lender = await loadLenderRssData(lenderId, criteria.portfolio, console.log)
      criteria.portfolio = lender.portfolio // pb_<slice>.values now resolved
      if (criteria.portfolio.exclude_portfolio_loans === 'true') {
        ctx.lenderId = lenderId
        ctx.lenderLoans = { [lenderId]: lender.loanIds }
      }
    } catch (e) {
      console.error(`RSS required lender data failed: ${e}`)
      return rssUnavailable('RSS portfolio filter data is unavailable; retry shortly')
    }
  }

  const loans = filterLoans(criteria, ctx)
  const host = new URL(request.url).host
  const selfUrl = host ? `https://${host}${url}` : ''
  return new Response(buildRssXml(feedName, linkTo, loans, selfUrl), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  })
}

export async function handleApi(state, request) {
  const url = pathOf(request)
  const method = request.method

  if (url === '/api/recently-funded' && method === 'GET') {
    return json(recentlyFunded(state), { headers: { 'Cache-Control': 'no-store' } })
  }

  if (url === '/api/start') {
    return !state.ready || !state.klStart ? notReady() : json(state.klStart)
  }

  if (url === '/api/partners') {
    return state.partnersGz ? gzipped(state.partnersGz) : notReady()
  }

  if (url === '/api/options') {
    return state.optionsGz ? gzipped(state.optionsGz) : notReady()
  }

  const loanMatch = url.match(/^\/api\/loans\/(\d+)\/(\d+)$/)
  if (loanMatch) {
    const served = state.batches.get(parseInt(loanMatch[1], 10))
    const idx = parseInt(loanMatch[2], 10) - 1
    if (!state.ready || !served || idx < 0 || idx >= served.loanPages.length) return notReady()
    return gzipped(served.loanPages[idx])
  }

  const kwMatch = url.match(/^\/api\/loans\/(\d+)\/keywords\/(\d+)$/)
  if (kwMatch) {
    const served = state.batches.get(parseInt(kwMatch[1], 10))
    const idx = parseInt(kwMatch[2], 10) - 1
    if (!state.ready || !served || idx < 0 || idx >= served.keywordPages.length) return notReady()
    return gzipped(served.keywordPages[idx])
  }

  // Loans (re)processed after the requested batch was built, in the same KLS
  // shape. Mirrors cluster.js: 404 for an evicted batch, '[]' beyond 500.
  const sinceMatch = url.match(/^\/api\/since\/(\d+)$/)
  if (sinceMatch) {
    const served = state.batches.get(parseInt(sinceMatch[1], 10))
    if (!served) return notReady()
    const changed = state.allLoans.filter((l) => new Date(l.kl_processed).getTime() > served.newestTime)
    return json(changed.length > 500 ? [] : changed.map((l) => compressLoan(l)))
  }

  if (url.startsWith('/api/heartbeat/')) return json({ status: 200 })

  if (url === '/graphql' && method === 'POST') {
    const body = await readBody(request, 64 * 1024)
    if (body.tooLarge) return json({ errors: [{ message: 'Request too large' }] }, { status: 413, headers: { 'Cache-Control': 'no-store' } })
    try {
      // The web client sends raw query text; Lite sends a JSON query envelope.
      const query = /^\{\s*"/.test(body.text.trim()) ? JSON.parse(body.text).query : body.text
      if (typeof query !== 'string') throw new Error('Invalid query')
      const idsMatch = query.match(/ids\s*:\s*\[([^\]]*)\]/)
      if (!idsMatch) return json({ data: { loans: [] } }, { headers: { 'Cache-Control': 'no-store' } })
      // Cap how many loan details one request can resolve. Without a bound, a
      // single request could buffer the whole dataset in memory (and the
      // find-per-id below is O(ids × allLoans)). Real clients page in small
      // batches, so 500 is generous; truncation is logged, not silent.
      const GRAPHQL_MAX_IDS = 500
      const tokens = idsMatch[1].split(',').map((value) => value.trim()).filter(Boolean)
      if (tokens.some((value) => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1))
        throw new Error('Invalid loan ID')
      let ids = [...new Set(tokens.map(Number))]
      if (ids.length > GRAPHQL_MAX_IDS) {
        console.warn(`/graphql: capping ${ids.length} loanIds to ${GRAPHQL_MAX_IDS}`)
        ids = ids.slice(0, GRAPHQL_MAX_IDS)
      }
      const loans = await resolveLoanDetails(state, ids, (raw) => processLoan(raw).loan, /refresh\s*:\s*true\b/.test(query))
      return json({ data: { loans } }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return json({ errors: [{ message: 'Unable to resolve loan details' }] }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Proxy handler — anonymizing GET proxy to two fixed hosts. Kiva's WAF answers
// 406 to a browser User-Agent without a full fingerprint, so requests carry only
// the cluster.js recipe (X-Requested-With / Accept / Referer, and NO User-Agent).
// ---------------------------------------------------------------------------

const PROXY_TARGETS = [
  { prefix: '/proxy/kiva/', host: 'https://www.kiva.org/', allow: /^ajax\//, kiva: true },
  { prefix: '/proxy/gdocs/', host: 'https://docs.google.com/', allow: /^spreadsheets\//, kiva: false },
]

const NULL_BODY_STATUSES = new Set([204, 205, 304])

export async function handleProxy(request) {
  const url = pathOf(request)
  const target = PROXY_TARGETS.find((t) => url.startsWith(t.prefix))
  if (!target) return null
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const rest = url.slice(target.prefix.length) // path + query, no leading slash
  if (!target.allow.test(rest)) return new Response('Forbidden', { status: 403 })

  const headers = target.kiva
    ? {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://www.kiva.org/',
      }
    : { Accept: '*/*' }

  try {
    const upstream = await fetch(target.host + rest, { headers })
    // The body is read whole rather than streamed: the answers are small, and a
    // stream that fails halfway would reach the browser as a truncated 200. A
    // status that has no body (204, 304...) cannot be given one, even empty.
    const body = NULL_BODY_STATUSES.has(upstream.status) ? null : await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    })
  } catch (err) {
    console.error('[proxy] error:', err?.message || err)
    return new Response('Proxy error', { status: 502 })
  }
}
