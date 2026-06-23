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
 * Plain JavaScript, Node builtins only in the hot path, so it runs directly on
 * Heroku; klCore.d.ts gives the TS dev plugin its types. The optional Redis
 * warm-start cache (server/klCache.mjs) lazily imports the `redis` dependency
 * only when a connection URL is configured.
 */

import zlib from 'node:zlib'
import { loadSnapshot, saveSnapshot } from './klCache.mjs'
import { applyAtheistData } from './aplus.mjs'
import { readCache, writeCache, cleanupCache } from './diskCache.mjs'
import { filterLoans } from './loanFilter.mjs'
import { loadLenderRssData, BALANCER_SLICES } from './lenderData.mjs'
import { sendDailyDigest } from './digest.mjs'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KL_PAGE_SPLITS = 4
// Re-download + re-batch like the original master (which re-searched Kiva
// every 5 min and re-packaged every 60s). One combined cycle is plenty.
export const REFRESH_INTERVAL_MS = 10 * 60_000
const RETAINED_BATCHES = 2
const KIVA_API = 'https://api.kivaws.org/v1'
const APP_ID = 'org.kiva.kivalens'

// Resident set size in MB — for diagnosing the dyno's R14 memory pressure.
const memMB = () => Math.round(process.memoryUsage().rss / 1048576)
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

async function fetchJSON(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return res.json()
}

async function fetchAllSearchLoans(log) {
  const all = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const url =
      `${KIVA_API}/loans/search.json?status=fundraising&page=${page}` +
      `&per_page=100&app_id=${APP_ID}`
    const data = await fetchJSON(url)
    totalPages = Math.min(data.paging.pages, 100) // safety cap
    if (data.loans) all.push(...data.loans)
    log(`  search loans: page ${page}/${totalPages} (${all.length} loans)`)
    page++
  }
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

async function fetchLoanDetails(ids, log) {
  const details = new Map()
  const batchSize = 50
  const concurrency = 4
  let completed = 0

  const batches = []
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize))

  const queue = [...batches]
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const batch = queue.shift()
      const url = `${KIVA_API}/loans/${batch.join(',')}.json?app_id=${APP_ID}`
      try {
        const data = await fetchJSON(url)
        if (data.loans) for (const loan of data.loans) details.set(loan.id, loan)
      } catch {
        // Non-fatal: we'll still have search data for these loans
      }
      completed++
      if (completed % 10 === 0 || completed === batches.length) {
        log(`  loan details: ${Math.min(completed * batchSize, ids.length)}/${ids.length}`)
      }
    }
  })

  await Promise.all(workers)
  return details
}

async function fetchAllPartners(log) {
  const all = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
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
const AGE_RE1 = /([2-9]\d)[ -]years?[ -](?:of age|old)/i
const AGE_RE2 = /(?:aged?|is) ([2-9]\d)/i

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

function getAge(text) {
  if (!text) return null
  const m = AGE_RE1.exec(text) || AGE_RE2.exec(text)
  return m && m.length === 2 ? parseInt(m[1], 10) : null
}

function processLoan(raw) {
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

  loan.kls_age = getAge(descrText)

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

function compressLoan(loan) {
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

function processPartners(partners) {
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
  const cached = await readCache(APLUS_CACHE_KEY, APLUS_TTL_MS)
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
      await writeCache(APLUS_CACHE_KEY, csv)
      log(`A+ data: fetched + cached (${csv.length} bytes)`)
      return csv
    }
    log(`A+ data: fetch returned empty/short body (${csv?.length ?? 0} bytes)`)
  } catch (e) {
    log(`A+ data: fetch failed (${e})`)
  }
  const stale = await readCache(APLUS_CACHE_KEY)
  if (stale) {
    log('A+ data: using stale cached copy')
    return stale
  }
  return null
}

// ---------------------------------------------------------------------------
// State + data preparation
// ---------------------------------------------------------------------------

export function createState() {
  return {
    ready: false,
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
    newestTime: 0,
    building: false,
  }
}

/**
 * Download everything from Kiva and publish it as the next batch. Runs at
 * startup and then every REFRESH_INTERVAL_MS, mirroring the original master's
 * refresh + prepForRequests cycle. Each run naturally drops loans that are no
 * longer fundraising (the search is status=fundraising).
 */
export async function prepareData(state, log = console.log) {
  if (state.building) return
  state.building = true
  try {
    log(
      state.batch === 0
        ? 'Starting data download from Kiva...'
        : `Refreshing data (batch ${state.batch} -> ${state.batch + 1})...`,
    )
    const startTime = Date.now()

    log('Fetching partners...')
    const rawPartners = await fetchAllPartners(log)
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
      log(`A+ merge failed (continuing without it): ${e}`)
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
      log(`Taxonomy fetch failed (keeping previous): ${e}`)
    }

    log(`[mem] refresh start rss=${memMB()}MB`)
    log('Fetching loans from search...')
    let searchLoans = await fetchAllSearchLoans(log)
    log(`Found ${searchLoans.length} fundraising loans`)

    log('Fetching full loan details...')
    let detailMap = await fetchLoanDetails(searchLoans.map((l) => l.id), log)
    log(`Fetched details for ${detailMap.size} loans`)

    // Free each heavy intermediate as soon as it is consumed. The refresh used to
    // hold 6-8 full copies of the ~7000-loan dataset live at once (search +
    // detail + merged + processed + fundable + compressed), which is what spiked
    // the 512MB dyno into R14. Nulling lets GC reclaim mid-cycle.
    let rawLoans = searchLoans.map((searchLoan) => {
      const detail = detailMap.get(searchLoan.id)
      return detail ? { ...searchLoan, ...detail } : searchLoan
    })
    searchLoans = null
    detailMap = null

    log('Processing loans...')
    let processed = []
    for (const raw of rawLoans) {
      try {
        processed.push(processLoan(raw))
      } catch {
        // Skip bad loans
      }
    }
    rawLoans = null
    log(`Processed ${processed.length} loans`)

    // Drop loans Kiva still reports as fundraising but that are already fully
    // funded (funded_amount >= loan_amount). basket_amount is deliberately
    // ignored: Kiva's basket figures are unreliable and sometimes exceed the
    // amount remaining, so only funded vs. total decides fundability.
    let fundable = processed.filter((p) => p.loan.funded_amount < p.loan.loan_amount)
    log(`Excluded ${processed.length - fundable.length} fully-funded loans; ${fundable.length} remain`)
    processed = null

    state.allLoans = fundable.map((p) => p.loan)
    state.newestTime = Math.max(...state.allLoans.map((l) => new Date(l.kl_processed).getTime()))

    let compressed = fundable.map((p) => compressLoan(p.loan))
    let keywords = fundable.map((p) => p.keywords)
    fundable = null
    log(`[mem] after compress rss=${memMB()}MB`)

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
    const batch = state.batch + 1
    const klStart = { batch, pages: loanChunks.length, loanLengths, descrLengths }
    state.batches.set(batch, { loanPages, keywordPages, klStart, newestTime: state.newestTime })
    for (const old of state.batches.keys()) {
      if (old <= batch - RETAINED_BATCHES) state.batches.delete(old)
    }
    state.batch = batch
    state.klStart = klStart
    state.ready = true

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`Data ready! ${processed.length} loans in ${elapsed}s`)
    log(`  kl_api_start: ${JSON.stringify(state.klStart)}`)

    // Persist the freshly-published dataset for the next boot's warm start.
    log(`[mem] published batch ${batch} rss=${memMB()}MB`)
    // Fire-and-forget, and DEFERRED off the refresh peak: the snapshot builds a
    // multi-MB transient JSON+gzip+base64 string; running it ~8s after publish
    // lets the rebuild's garbage GC first so the two peaks don't stack.
    setTimeout(() => void saveSnapshot(state, log), 8000)
  } catch (e) {
    log(`Data preparation failed: ${e}`)
  } finally {
    state.building = false
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
    const snap = await loadSnapshot(log)
    if (!snap) return
    // The live fetch already published while Redis was being read — keep it.
    if (state.batch > 0) return
    state.batch = snap.batch
    state.klStart = snap.klStart
    state.partnersGz = snap.partnersGz
    state.optionsGz = snap.optionsGz
    state.newestTime = snap.newestTime
    // Restore the per-loan details (descriptions + repayment schedules) so
    // /graphql can serve them immediately. The live fetch replaces allLoans with
    // the full objects within the cycle. /api/since stays correct meanwhile:
    // these partial objects have no kl_processed, so none count as "changed".
    state.allLoans = snap.details ?? []
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
    log(`Warm start skipped (non-fatal): ${e}`)
  }
}

/** Kick off the initial download and a refresh timer. Returns the timer id. */
// Per-lender RSS cache hygiene: the disk is ephemeral but restarts can be rare,
// so evict entries older than a day and cap the namespace's count/size so a
// burst of distinct lender feeds can't fill the dyno disk.
const LENDER_CLEANUP_INTERVAL_MS = 6 * 60 * 60_000
async function cleanupLenderCache(log = console.log) {
  const removed = await cleanupCache({
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

export function startRefresh(state, log = console.log) {
  // Serve cached data ASAP (non-blocking) and fetch live data in parallel.
  void hydrateFromCache(state, log)
  prepareData(state, log)
  setInterval(() => void maybeSendDigest(log), 60 * 60_000).unref()
  // Periodically prune the per-lender RSS disk cache. unref() so this timer
  // never keeps the process alive on its own.
  void cleanupLenderCache(log)
  setInterval(() => void cleanupLenderCache(log), LENDER_CLEANUP_INTERVAL_MS).unref()
  // Periodic memory sample so we can see steady-state vs. the refresh spike.
  setInterval(
    () => log(`[mem] rss=${memMB()}MB heapUsed=${Math.round(process.memoryUsage().heapUsed / 1048576)}MB`),
    60_000,
  ).unref()
  return setInterval(() => prepareData(state, log), REFRESH_INTERVAL_MS)
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendGzip(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Encoding', 'gzip')
  res.setHeader('Content-Length', data.length)
  res.setHeader('Cache-Control', 'public, max-age=600')
  res.end(data)
}

function sendJSON(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function send404(res) {
  res.statusCode = 404
  res.end('Not ready')
}

// ---------------------------------------------------------------------------
// API request handler — returns true if it handled the request.
// Works with both Vite's connect middleware and a raw Node http server.
// ---------------------------------------------------------------------------

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
    .replace(/[ --]/g, '')
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
export function handleRss(state, req, res) {
  const url = req.url || ''

  // Per-item click redirect: /rss_click/<kiva|kivalens>/<loanId>
  let m = url.match(/^\/rss_click\/([^/]+)\/([^/?#]+)/)
  if (m) {
    const goTo = decodeURIComponent(m[1])
    const id = encodeURIComponent(decodeURIComponent(m[2]))
    const dest =
      goTo === 'kiva'
        ? `https://www.kiva.org/lend/${id}?app_id=${APP_ID}`
        : `https://www.kivalens.org/#/search/loan/${id}`
    res.statusCode = 302
    res.setHeader('Location', dest)
    res.end()
    return true
  }

  // Feed: /rss/<uriComponent-encoded JSON criteria>. We own it as soon as the
  // path matches; the actual work is async (lender portfolio data may need
  // fetching), but the routing contract stays a synchronous boolean.
  if (!/^\/rss\//.test(url)) return false
  serveRssFeed(state, req, res).catch((e) => {
    console.error('RSS feed error:', e)
    try {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('RSS feed error')
    } catch {
      /* response already started */
    }
  })
  return true
}

async function serveRssFeed(state, req, res) {
  const url = req.url || ''
  const m = url.match(/^\/rss\/(.+)$/)
  let crit
  try {
    crit = JSON.parse(decodeURIComponent(m[1].split('?')[0]))
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Invalid RSS criteria')
    return
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

  const ctx = {
    loans: state.allLoans,
    activePartners: state.activePartners,
    atheistListProcessed: state.atheistListProcessed,
  }

  // Portfolio features (exclude-my-loans + balancing) require the lender's data,
  // which we fetch + disk-cache per lender. The lender id rides in feed.lender_id.
  const lenderId = feed.lender_id ? String(feed.lender_id) : null
  const wantsLender =
    lenderId &&
    (criteria.portfolio.exclude_portfolio_loans === 'true' ||
      BALANCER_SLICES.some((s) => criteria.portfolio[`pb_${s}`]?.enabled))
  if (wantsLender) {
    try {
      const lender = await loadLenderRssData(lenderId, criteria.portfolio, console.log)
      criteria.portfolio = lender.portfolio // pb_<slice>.values now resolved
      if (criteria.portfolio.exclude_portfolio_loans === 'true') {
        ctx.lenderId = lenderId
        ctx.lenderLoans = { [lenderId]: lender.loanIds }
      }
    } catch (e) {
      console.error(`RSS lender data failed (serving feed without portfolio): ${e}`)
    }
  }

  const loans = filterLoans(criteria, ctx)
  const selfUrl = req.headers?.host ? `https://${req.headers.host}${url}` : ''
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.end(buildRssXml(feedName, linkTo, loans, selfUrl))
}

export function handleApi(state, req, res) {
  const url = req.url || ''

  if (url === '/api/start') {
    if (!state.ready || !state.klStart) send404(res)
    else sendJSON(res, state.klStart)
    return true
  }

  if (url === '/api/partners') {
    if (!state.partnersGz) send404(res)
    else sendGzip(res, state.partnersGz)
    return true
  }

  if (url === '/api/options') {
    if (!state.optionsGz) send404(res)
    else sendGzip(res, state.optionsGz)
    return true
  }

  const loanMatch = url.match(/^\/api\/loans\/(\d+)\/(\d+)$/)
  if (loanMatch) {
    const served = state.batches.get(parseInt(loanMatch[1], 10))
    const idx = parseInt(loanMatch[2], 10) - 1
    if (!state.ready || !served || idx < 0 || idx >= served.loanPages.length) send404(res)
    else sendGzip(res, served.loanPages[idx])
    return true
  }

  const kwMatch = url.match(/^\/api\/loans\/(\d+)\/keywords\/(\d+)$/)
  if (kwMatch) {
    const served = state.batches.get(parseInt(kwMatch[1], 10))
    const idx = parseInt(kwMatch[2], 10) - 1
    if (!state.ready || !served || idx < 0 || idx >= served.keywordPages.length) send404(res)
    else sendGzip(res, served.keywordPages[idx])
    return true
  }

  // Loans (re)processed after the requested batch was built, in the same KLS
  // shape. Mirrors cluster.js: 404 for an evicted batch, '[]' beyond 500.
  const sinceMatch = url.match(/^\/api\/since\/(\d+)$/)
  if (sinceMatch) {
    const served = state.batches.get(parseInt(sinceMatch[1], 10))
    if (!served) send404(res)
    else {
      const changed = state.allLoans.filter(
        (l) => new Date(l.kl_processed).getTime() > served.newestTime,
      )
      sendJSON(res, changed.length > 500 ? [] : changed.map((l) => compressLoan(l)))
    }
    return true
  }

  if (url.startsWith('/api/heartbeat/')) {
    sendJSON(res, { status: 200 })
    return true
  }

  if (url === '/graphql' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const idsMatch = body.match(/ids:\[([^\]]+)\]/)
        if (!idsMatch) return sendJSON(res, { data: { loans: [] } })
        // Cap how many loan details one request can resolve. Without a bound, a
        // single request could buffer the whole dataset in memory (and the
        // find-per-id below is O(ids × allLoans)). Real clients page in small
        // batches, so 500 is generous; truncation is logged, not silent.
        const GRAPHQL_MAX_IDS = 500
        let ids = idsMatch[1]
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n))
        if (ids.length > GRAPHQL_MAX_IDS) {
          console.warn(`/graphql: capping ${ids.length} loanIds to ${GRAPHQL_MAX_IDS}`)
          ids = ids.slice(0, GRAPHQL_MAX_IDS)
        }
        const loans = ids
          .map((id) => state.allLoans.find((l) => l.id === id))
          .filter(Boolean)
          .map((l) => ({
            id: l.id,
            description: l.description || { texts: { en: '' } },
            kl_repayments: l.kl_repayments || [],
          }))
        sendJSON(res, { data: { loans } })
      } catch {
        sendJSON(res, { data: { loans: [] } })
      }
    })
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Proxy handler — anonymizing GET proxy to two fixed hosts, returns true if
// it handled the request. Kiva's WAF answers 406 to a browser User-Agent
// without a full fingerprint, so requests carry only the cluster.js recipe
// (X-Requested-With / Accept / Referer, and NO User-Agent).
// ---------------------------------------------------------------------------

const PROXY_TARGETS = [
  { prefix: '/proxy/kiva/', host: 'https://www.kiva.org/', allow: /^ajax\//, kiva: true },
  { prefix: '/proxy/gdocs/', host: 'https://docs.google.com/', allow: /^spreadsheets\//, kiva: false },
]

export function handleProxy(req, res) {
  const url = req.url || ''
  const target = PROXY_TARGETS.find((t) => url.startsWith(t.prefix))
  if (!target) return false

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return true
  }

  const rest = url.slice(target.prefix.length) // path + query, no leading slash
  if (!target.allow.test(rest)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }

  const upstreamUrl = target.host + rest
  const headers = target.kiva
    ? {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://www.kiva.org/',
      }
    : { Accept: '*/*' }

  // Node's fetch sends no User-Agent unless set — exactly what we want for Kiva.
  fetch(upstreamUrl, { headers })
    .then(async (upstream) => {
      res.statusCode = upstream.status
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'application/json',
      )
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.end(buf)
    })
    .catch((err) => {
      if (!res.headersSent) {
        res.statusCode = 502
        res.end('Proxy error')
      } else {
        res.end()
      }
      console.error('[proxy] error:', err?.message || err)
    })

  return true
}
