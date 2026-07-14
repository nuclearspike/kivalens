/**
 * lenderData.mjs — per-lender data the prod server needs to apply portfolio
 * features (exclude-my-loans + portfolio balancing) to RSS feeds. The original
 * app refused to do these server-side; we now fetch + disk-cache them per lender
 * (the disk is ephemeral, so it just avoids re-fetching until the dyno recycles;
 * cleanupCache evicts stale/space-hogging entries since restarts can be rare).
 *
 * Mirrors the client: LenderFundraisingLoans (exclusion) and
 * fetchBalancerData + updateBalancers (balancing) in src.
 */
import { readCache, writeCache } from './diskCache.mjs'

const KIVA_API = 'https://api.kivaws.org/v1'
const KIVA_WWW = 'https://www.kiva.org'
const APP_ID = 'org.kiva.kivalens'
const FUNDRAISING_WINDOW_DAYS = 120

// api.kivaws.org wants a normal UA; the kiva.org ajax WAF wants NO User-Agent
// (mirrors handleProxy in klCore).
const API_HEADERS = {
  Accept: 'application/json,*/*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0',
  Referer: 'https://www.kiva.org/',
}
const AJAX_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  Referer: 'https://www.kiva.org/',
}

const LENDER_LOANS_TTL_MS = 60 * 60_000 // 1h — fundraising set shifts as loans fund/expire
const SUPERGRAPH_TTL_MS = 6 * 60 * 60_000 // 6h — portfolio distribution moves slowly
const LENDER_PROFILE_TTL_MS = 24 * 60 * 60_000 // 24h — profile (loan count, member-since) moves slowly
export const BALANCER_SLICES = ['sector', 'activity', 'partner', 'country', 'region', 'gender']

// Stop paging a lender's loans once no fundraising loan remains AND the newest
// loan on the page predates the fundraising window (ported verbatim from
// LenderFundraisingLoans.continuePaging — fundraising windows vary, so "expired"
// is not monotonic with posted_date).
function continuePaging(loans) {
  if (loans.some((l) => l.status === 'fundraising')) return true
  const cutoff = Date.now() - FUNDRAISING_WINDOW_DAYS * 86_400_000
  let newest = -Infinity
  for (const l of loans) {
    const t = l.posted_date ? new Date(l.posted_date).getTime() : NaN
    if (!Number.isNaN(t) && t > newest) newest = t
  }
  if (newest === -Infinity) return true
  return newest >= cutoff
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fetch one page of a lender's loans with retry + exponential backoff. Busy
// lenders have hundreds of pages (Kiva forces 20/page); without backoff a single
// rate-limit 403 threw and failed the whole fetch, so RSS "exclude my loans"
// silently did nothing for them.
async function fetchLenderLoansPage(lenderId, page, tries = 5) {
  let lastErr
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const url = `${KIVA_API}/lenders/${encodeURIComponent(lenderId)}/loans.json?page=${page}&app_id=${APP_ID}`
      const res = await fetch(url, { headers: API_HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return JSON.parse(await res.text())
    } catch (e) {
      lastErr = e
      await sleep(500 * 2 ** attempt) // 0.5s, 1s, 2s, 4s, 8s
    }
  }
  throw lastErr
}

export async function fetchLenderFundraisingLoanIds(lenderId, log = () => {}) {
  const key = `lender-loans-${lenderId}`
  const cached = await readCache(key, LENDER_LOANS_TTL_MS)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      /* fall through to refetch */
    }
  }
  const ids = []
  try {
    let page = 1
    let pages = 1
    do {
      const data = await fetchLenderLoansPage(lenderId, page)
      const loans = data.loans || []
      pages = data.paging?.pages ?? page
      for (const l of loans) if (l.status === 'fundraising') ids.push(l.id)
      if (!continuePaging(loans)) break
      page++
    } while (page <= pages)
    await writeCache(key, JSON.stringify(ids))
    log(`lender ${lenderId}: ${ids.length} fundraising loans`)
    return ids
  } catch (e) {
    log(`lender ${lenderId} loans fetch failed: ${e}`)
    const stale = await readCache(key)
    if (stale) {
      try {
        return JSON.parse(stale)
      } catch {
        /* ignore */
      }
    }
    return ids
  }
}

// A lender's public profile: total loans made + member-since (for the AI to
// gauge how experienced the lender is). Kiva v1: lenders/<id>.json -> {lenders:[..]}.
export async function fetchLenderProfile(lenderId, log = () => {}) {
  const key = `lender-profile-${lenderId}`
  const cached = await readCache(key, LENDER_PROFILE_TTL_MS)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      /* fall through to refetch */
    }
  }
  try {
    const url = `${KIVA_API}/lenders/${encodeURIComponent(lenderId)}.json?app_id=${APP_ID}`
    const res = await fetch(url, { headers: API_HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = JSON.parse(await res.text())
    const l = (data.lenders || [])[0]
    if (!l) return null
    const profile = {
      name: l.name,
      loan_count: l.loan_count,
      member_since: l.member_since,
      country_code: l.country_code,
      occupation: l.occupation,
      loan_because: l.loan_because,
    }
    await writeCache(key, JSON.stringify(profile))
    log(`lender ${lenderId}: profile loan_count=${profile.loan_count}`)
    return profile
  } catch (e) {
    log(`lender ${lenderId} profile fetch failed: ${e}`)
    const stale = await readCache(key)
    if (stale) {
      try {
        return JSON.parse(stale)
      } catch {
        /* ignore */
      }
    }
    return null
  }
}

export async function fetchSuperGraphSlices(lenderId, sliceBy, include = 'all', log = () => {}) {
  const key = `lender-sg-${lenderId}-${sliceBy}-${include}`
  const cached = await readCache(key, SUPERGRAPH_TTL_MS)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      /* fall through */
    }
  }
  try {
    const qs = new URLSearchParams({
      sliceBy,
      include,
      measure: 'count',
      subject_id: String(lenderId),
      type: 'lender',
      granularity: 'cumulative',
    }).toString()
    const res = await fetch(`${KIVA_WWW}/ajax/getSuperGraphData?${qs}`, { headers: AJAX_HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = JSON.parse(await res.text())
    const dataArr = raw.data ?? []
    const total = dataArr.reduce((s, d) => s + parseInt(d.value, 10), 0)
    const slices = dataArr.map((d) => ({
      id: d.name,
      name: raw.lookup?.[d.name] ?? d.name,
      value: parseInt(d.value, 10),
      percent: total ? (parseInt(d.value, 10) * 100) / total : 0,
    }))
    await writeCache(key, JSON.stringify(slices))
    return slices
  } catch (e) {
    log(`lender ${lenderId} supergraph ${sliceBy} failed: ${e}`)
    const stale = await readCache(key)
    if (stale) {
      try {
        return JSON.parse(stale)
      } catch {
        /* ignore */
      }
    }
    return []
  }
}

// Resolve a balancer config's `values` (the show/hide list) from the lender's
// distribution — ported from updateBalancers: gt keeps slices above the percent
// threshold, lt keeps those below; partner slices use numeric ids, others names.
export function resolveBalancerValues(config, slices, sliceBy) {
  const threshold = config.percent ?? 0
  const filtered =
    config.ltgt === 'gt'
      ? slices.filter((s) => s.percent > threshold)
      : slices.filter((s) => s.percent < threshold)
  return sliceBy === 'partner'
    ? filtered.map((s) => parseInt(String(s.id), 10)).filter((v) => !Number.isNaN(v))
    : filtered.map((s) => s.name).filter((v) => v != null)
}

/**
 * Gather everything the RSS filter needs for a lender's portfolio criteria:
 *   - loanIds: the lender's current fundraising loan ids (for exclude-my-loans)
 *   - portfolio: a copy of the input with each enabled pb_<slice>'s `values`
 *     resolved from the lender's live distribution.
 * Fetches run concurrently; each piece is independently disk-cached, so a static
 * RSS URL stays fresh without re-fetching every request.
 */
export async function loadLenderRssData(lenderId, portfolio, log = () => {}) {
  const result = { lenderId, loanIds: [], portfolio: { ...portfolio } }
  const tasks = []
  if (portfolio.exclude_portfolio_loans === 'true') {
    tasks.push(
      fetchLenderFundraisingLoanIds(lenderId, log).then((ids) => {
        result.loanIds = ids
      }),
    )
  }
  for (const slice of BALANCER_SLICES) {
    const cfg = portfolio[`pb_${slice}`]
    if (cfg?.enabled) {
      tasks.push(
        fetchSuperGraphSlices(lenderId, slice, cfg.allactive ?? 'all', log).then((slices) => {
          result.portfolio[`pb_${slice}`] = { ...cfg, values: resolveBalancerValues(cfg, slices, slice) }
        }),
      )
    }
  }
  await Promise.all(tasks)
  return result
}
