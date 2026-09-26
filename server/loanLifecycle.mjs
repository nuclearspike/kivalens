// Fundraising is a cache membership rule, not the complete lifecycle of a loan.
// Closed borrower content is returned from Kiva per request, never archived here.
export const RECENTLY_FUNDED_TTL_MS = 3 * 60 * 60_000
const BATCH_SIZE = 50
const MAX_IN_FLIGHT_BATCHES = 16
const KIVA_HEADERS = {
  Accept: 'application/json,*/*',
  Referer: 'https://www.kiva.org/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0',
}

export function recentlyFunded(state, now = Date.now()) {
  const unique = new Map()
  for (const entry of state.recentlyFunded || []) {
    const funded = Date.parse(entry.fundedAt)
    if (Number.isSafeInteger(entry.id) && entry.id > 0 && funded > now - RECENTLY_FUNDED_TTL_MS && funded <= now)
      unique.set(entry.id, { id: entry.id, fundedAt: new Date(funded).toISOString() })
  }
  state.recentlyFunded = [...unique.values()].sort((a, b) => a.id - b.id)
  return state.recentlyFunded.map(entry => ({ ...entry }))
}

export function observeFundedLoans(state, loans, now = Date.now()) {
  const entries = new Map(recentlyFunded(state, now).map(entry => [entry.id, entry]))
  for (const loan of loans) {
    // Do not invent a funding time, infer funding from absence, or use baskets.
    // Only a string is a time; anything else Kiva might send is no time at all.
    const funded = typeof loan.funded_date === 'string' ? Date.parse(loan.funded_date) : NaN
    if (loan.status === 'funded' && Number.isSafeInteger(loan.id) && loan.id > 0 &&
        funded > now - RECENTLY_FUNDED_TTL_MS && funded <= now)
      entries.set(loan.id, { id: loan.id, fundedAt: new Date(funded).toISOString() })
  }
  state.recentlyFunded = [...entries.values()]
  return recentlyFunded(state, now)
}

function shape(loan, source, checkedAt, lookupError) {
  return {
    id: loan.id,
    status: ['fundraising', 'funded', 'expired', 'unavailable'].includes(loan.status) ? loan.status : 'unknown',
    loan_amount: loan.loan_amount,
    funded_amount: loan.funded_amount,
    basket_amount: loan.basket_amount,
    funded_date: loan.funded_date,
    planned_expiration_date: loan.planned_expiration_date,
    description: { texts: { en: loan.description?.texts?.en || '' } },
    kl_repayments: loan.kl_repayments || [],
    kl_status_source: source,
    kl_status_checked_at: checkedAt,
    ...(lookupError ? { kl_lookup_error: lookupError } : {}),
  }
}

async function lookupBatch(state, ids, processLoan, deadline) {
  state.loanDetailRequests ??= new Map()
  const key = [...ids].sort((a, b) => a - b).join(',')
  if (state.loanDetailRequests.has(key)) return state.loanDetailRequests.get(key)
  if (state.loanDetailRequests.size >= MAX_IN_FLIGHT_BATCHES || Date.now() >= deadline)
    throw new Error('lookup_busy')

  const request = (async () => {
    const response = await fetch(`https://api.kivaws.org/v1/loans/${key}.json?app_id=org.kiva.kivalens`, {
      headers: KIVA_HEADERS,
      signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))),
    })
    // A batch-wide 404 does not prove that every requested ID is gone. Retry the
    // members individually, still under this request's deadline/concurrency cap.
    if (response.status === 404 || response.status === 410) {
      if (ids.length !== 1) throw new Error('batch_not_found')
      return [shape({ id: ids[0], status: 'unavailable' }, 'kiva', new Date().toISOString())]
    }
    if (!response.ok) throw new Error(`kiva_${response.status}`)
    const body = await response.json()
    if (!Array.isArray(body.loans)) throw new Error('invalid_kiva_response')
    const byId = new Map(body.loans.filter(loan => ids.includes(loan?.id)).map(loan => [loan.id, loan]))
    if (body.loans.length && byId.size === 0) throw new Error('mismatched_kiva_response')
    observeFundedLoans(state, [...byId.values()])
    const checkedAt = new Date().toISOString()
    return ids.map(id => {
      const raw = byId.get(id)
      if (!raw) return shape({ id, status: 'unknown' }, 'unverified', null, 'missing_kiva_loan')
      // A fresh positive status can correct a funding reversal or an extension.
      if (raw.status === 'fundraising' || raw.status === 'expired')
        state.recentlyFunded = state.recentlyFunded.filter(entry => entry.id !== id)
      return shape(processLoan(raw), 'kiva', checkedAt,
        ['fundraising', 'funded', 'expired'].includes(raw.status) ? undefined : 'unknown_status')
    })
  })()
  state.loanDetailRequests.set(key, request)
  try { return await request }
  finally { state.loanDetailRequests.delete(key) }
}

export async function resolveLoanDetails(state, ids, processLoan, refresh = false) {
  const catalog = new Map(state.allLoans.map(loan => [loan.id, loan]))
  const funded = new Map(recentlyFunded(state).map(entry => [entry.id, entry]))
  const result = new Map()
  const missing = []
  for (const id of ids) {
    const cached = catalog.get(id)
    if (!refresh && !funded.has(id) && cached?.description?.texts?.en && Array.isArray(cached.kl_repayments))
      result.set(id, shape(cached, 'catalog', cached.kl_processed || null))
    else missing.push(id)
  }
  const deadline = Date.now() + 20_000
  const queue = []
  for (let i = 0; i < missing.length; i += BATCH_SIZE) queue.push(missing.slice(i, i + BATCH_SIZE))
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const batch = queue.shift()
      try {
        for (const loan of await lookupBatch(state, batch, processLoan, deadline)) result.set(loan.id, loan)
      } catch (error) {
        if (error.message === 'batch_not_found') { queue.push(...batch.map(id => [id])); continue }
        for (const id of batch) {
          const known = funded.get(id)
          // Keep available cached content, but never pass a failed check off as
          // a fresh fundraising status or a genuinely empty borrower story.
          result.set(id, shape({ ...catalog.get(id), id,
            status: known ? 'funded' : 'unknown', funded_date: known?.fundedAt,
          }, known ? 'recently_funded' : 'unverified', null, 'upstream_unavailable'))
        }
      }
    }
  }))
  return ids.map(id => result.get(id))
}
