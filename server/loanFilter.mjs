/**
 * loanFilter.mjs — the criteria filtering/sorting engine, shared by the client
 * (src/api/kiva.ts) and the prod server (server/klCore.mjs, for RSS feeds) so
 * a feed matches the on-site search exactly. Plain JS (no types) so plain-Node
 * can import it; the TS client imports it too.
 *
 * Selectors are normalized to work on BOTH loan shapes:
 *  - client loans store kl_dollars_per_hour / kl_expiring_in_days /
 *    kl_disbursal_in_days as FUNCTIONS (recomputed live);
 *  - server-processed loans store them as NUMBERS (and lack dollars_per_hour).
 * valOf() unwraps a function-or-value; dollarsPerHour() computes from raw fields
 * when absent; dateMs() handles Date | string | number.
 */

// ---- tiny array utils (kept local so the module is self-contained) --------
export function groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    const g = map.get(k)
    if (g) g.push(item)
    else map.set(k, [item])
  }
  return [...map.values()]
}

export function sortBy(arr, ...selectors) {
  return arr.toSorted((a, b) => {
    for (const { fn, desc } of selectors) {
      const aVal = fn(a)
      const bVal = fn(b)
      let cmp = 0
      if (aVal == null && bVal == null) cmp = 0
      else if (aVal == null) cmp = -1
      else if (bVal == null) cmp = 1
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal)
      else if (aVal < bVal) cmp = -1
      else if (aVal > bVal) cmp = 1
      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

// ---- shape-normalizing helpers --------------------------------------------
const valOf = (v) => (typeof v === 'function' ? v() : v)
const dateMs = (d) => (d == null ? undefined : d instanceof Date ? d.getTime() : new Date(d).getTime())

function dollarsPerHour(l) {
  if (typeof l.kl_dollars_per_hour === 'function') return l.kl_dollars_per_hour()
  if (typeof l.kl_dollars_per_hour === 'number') return l.kl_dollars_per_hour
  const postedMs = dateMs(l.kl_posted_date ?? l.posted_date)
  if (postedMs == null || Number.isNaN(postedMs)) return undefined
  const hoursAgo = (Date.now() - postedMs) / (60 * 60 * 1000)
  return hoursAgo > 0 ? ((l.funded_amount || 0) + (l.basket_amount || 0)) / hoursAgo : 0
}

// ---------------------------------------------------------------------------
// CritTester — the criteria → predicate engine (ported from CritTester.ts)
// ---------------------------------------------------------------------------
export class CritTester {
  constructor(critGroup) {
    this.critGroup = critGroup
    this.testers = []
    this.failAll = false
    // critName -> selector for EVERY range registered, set or not, so
    // rangeDistributions can read a value for sliders that are wide open.
    this.ranges = {}
  }

  addRangeTesters(critName, selector, overrideIf, overrideFunc) {
    this.ranges[critName] = selector
    const tag = (fn) => {
      fn.rangeKey = critName
      this.testers.push(fn)
    }
    const min = this.critGroup[`${critName}_min`]
    if (min != null) {
      tag((entity) => {
        if (overrideIf && overrideIf(entity)) return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        return min <= selector(entity)
      })
    }
    const max = this.critGroup[`${critName}_max`]
    if (max != null) {
      tag((entity) => {
        if (overrideIf && overrideIf(entity)) return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        return selector(entity) <= max
      })
    }
  }

  // Which single range keeps this entity out? '' when it passes everything,
  // the range's critName when that range alone fails, and null when anything
  // else fails (a non-range test, or two different ranges). This is what lets
  // one pass count, for every slider at once, the entities that match all the
  // OTHER criteria.
  soleFailingRange(entity) {
    if (this.failAll) return null
    let failing = ''
    try {
      for (const fn of this.testers) {
        if (fn(entity)) continue
        if (!fn.rangeKey || (failing && failing !== fn.rangeKey)) return null
        failing = fn.rangeKey
      }
    } catch {
      return null
    }
    return failing
  }

  addAnyAllNoneTester(critName, values, defValue, selector, entityFieldIsArray) {
    if (!values) values = this.critGroup[critName]
    if (values && values.length > 0) {
      const allAnyNone = this.critGroup[`${critName}_all_any_none`] || defValue
      switch (allAnyNone) {
        case 'any':
          if (entityFieldIsArray) this.addArrayAnyTester(values, selector)
          else this.addFieldContainsOneOfArrayTester(values, selector)
          break
        case 'all':
          this.addArrayAllTester(values, selector)
          break
        case 'none':
          if (entityFieldIsArray) this.addArrayNoneTester(values, selector)
          else this.addFieldNotContainsOneOfArrayTester(values, selector)
          break
      }
    }
  }

  addArrayAllTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push((e) => selector(e) && termsArr.every((t) => selector(e).includes(t)))
    }
  }

  addArrayAnyTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push((e) => selector(e) && termsArr.some((t) => selector(e).includes(t)))
    }
  }

  addArrayNoneTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push((e) => selector(e) && !termsArr.some((t) => selector(e).includes(t)))
    }
  }

  addBalancer(crit, selector) {
    if (crit && crit.enabled) {
      if (crit.hideshow === 'show') {
        if (Array.isArray(crit.values) && crit.values.length === 0) this.failAll = true
        else this.addFieldContainsOneOfArrayTester(crit.values, selector)
      } else {
        this.addFieldNotContainsOneOfArrayTester(crit.values, selector)
      }
    }
  }

  addFieldContainsOneOfArrayTester(crit, selector, failIfEmpty) {
    if (crit) {
      if (crit.length > 0) {
        const termsArr = Array.isArray(crit) ? crit : crit.split(',')
        this.testers.push((e) => (selector(e) !== null ? termsArr.includes(selector(e)) : false))
      } else if (failIfEmpty) {
        this.failAll = true
      }
    }
  }

  addFieldNotContainsOneOfArrayTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push((e) => (selector(e) !== null ? !termsArr.includes(selector(e)) : false))
    }
  }

  addArrayAllStartWithTester(crit, selector) {
    if (crit && crit.trim().length > 0) {
      const raw = Array.isArray(crit) ? crit : crit.match(/(\w+)/g)
      const termsArr = (raw || []).map((t) => t.toUpperCase())
      this.testers.push((e) =>
        termsArr.every((searchTerm) => selector(e).some((w) => w.startsWith(searchTerm))),
      )
    }
  }

  addSimpleEquals(crit, selector) {
    if (crit && crit.trim().length > 0) {
      this.testers.push((entity) => selector(entity) == crit)
    }
  }

  addSimpleContains(crit, selector) {
    const search =
      crit && crit.trim().length > 0
        ? [...new Set(crit.match(/(\w+)/g))].map((word) => word.toUpperCase())
        : []
    if (search.length) {
      this.testers.push((entity) =>
        search.every((searchText) => selector(entity).toUpperCase().indexOf(searchText) > -1),
      )
    }
  }

  addThreeStateTester(crit, selector) {
    if (crit === 'true') this.testers.push((e) => selector(e) === true)
    else if (crit === 'false') this.testers.push((e) => selector(e) === false)
  }

  allPass(entity) {
    if (this.failAll) return false
    if (this.testers.length === 0) return true
    try {
      return this.testers.every((fn) => fn(entity))
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// sortLoans (ported from kiva.ts; method/value differences normalized)
// ---------------------------------------------------------------------------
export function sortLoans(loans, sortOption) {
  if (loans.length <= 1) return loans
  switch (sortOption) {
    case 'half_back':
      return sortBy(
        loans,
        { fn: (l) => dateMs(l.kls_half_back) },
        { fn: (l) => l.kls_half_back_actual, desc: true },
        { fn: (l) => dateMs(l.kls_75_back) },
        { fn: (l) => l.kls_75_back_actual, desc: true },
        { fn: (l) => dateMs(l.kls_final_repayment) },
      )
    case 'popularity':
      return sortBy(loans, { fn: (l) => dollarsPerHour(l), desc: true })
    case 'newest':
      return sortBy(loans, { fn: (l) => l.kl_newest_sort, desc: true }, { fn: (l) => l.id, desc: true })
    case 'expiring':
      return sortBy(loans, { fn: (l) => dateMs(l.kl_planned_expiration_date) }, { fn: (l) => l.id })
    case 'still_needed':
      return sortBy(loans, { fn: (l) => l.kl_still_needed })
    case 'none':
      return loans
    default:
      return sortBy(
        loans,
        { fn: (l) => dateMs(l.kls_final_repayment) },
        { fn: (l) => dateMs(l.kls_half_back) },
        { fn: (l) => l.kls_half_back_actual, desc: true },
        { fn: (l) => dateMs(l.kls_75_back) },
        { fn: (l) => l.kls_75_back_actual, desc: true },
      )
  }
}

// ---------------------------------------------------------------------------
// Partner filtering — returns the partner OBJECTS matching the partner
// criteria (filterPartnerIds maps to ids). ctx: { loans, activePartners,
// partnerPool?, atheistListProcessed }
// ---------------------------------------------------------------------------
export function filterPartnerIds(c, ctx) {
  return filterPartners(c, ctx).map((p) => p.id)
}

export function filterPartners(c, ctx) {
  const ct = buildPartnerTester(c, ctx)
  const pool = ctx.partnerPool || ctx.activePartners || []
  return pool.filter((p) => ct.allPass(p))
}

function buildPartnerTester(c, ctx) {
  const partner = c.partner ?? {}
  const portfolio = c.portfolio ?? {}
  const partnerPool = ctx.partnerPool

  let spArr = []
  if (typeof partner.social_performance === 'string') {
    spArr = partner.social_performance
      .split(',')
      .filter((sp) => sp && !Number.isNaN(Number(sp)))
      .map((sp) => parseInt(sp, 10))
  }

  let partnersGiven = []
  if (partner.partners) {
    const p = partner.partners
    partnersGiven = (Array.isArray(p) ? p : p.toString().split(',')).map((id) => parseInt(id, 10))
  }

  const ct = new CritTester(partner)

  if (partnerPool) ct.addAnyAllNoneTester('status', null, 'any', (p) => p.status)

  if (partner.country_code) {
    const codes = partner.country_code.split(',')
    const mode = partner.country_code_all_any_none || 'any'
    if (mode === 'none') ct.testers.push((p) => !(p.countries || []).some((c2) => codes.includes(c2.iso_code)))
    else if (mode === 'all') ct.testers.push((p) => codes.every((code) => (p.countries || []).some((c2) => c2.iso_code === code)))
    else ct.testers.push((p) => (p.countries || []).some((c2) => codes.includes(c2.iso_code)))
  }

  ct.addAnyAllNoneTester('region', null, 'any', (p) => p.kl_regions, true)
  ct.addAnyAllNoneTester('social_performance', spArr, 'all', (p) => p.kl_sp, true)
  ct.addAnyAllNoneTester('partners', partnersGiven, 'any', (p) => p.id)
  ct.addRangeTesters('partner_default', (p) => p.default_rate)
  ct.addRangeTesters('partner_arrears', (p) => p.delinquency_rate)
  ct.addRangeTesters('portfolio_yield', (p) => p.portfolio_yield)
  ct.addRangeTesters('profit', (p) => p.profitability)
  ct.addRangeTesters('loans_at_risk_rate', (p) => p.loans_at_risk_rate)
  ct.addRangeTesters('currency_exchange_loss_rate', (p) => p.currency_exchange_loss_rate)
  // No range on average_loan_size_percent_per_capita_income: Kiva sends 0 for
  // every partner (646 of 646, bar one closed in 2007), so a minimum saved in an
  // old search or feed excluded every partner. Such criteria are ignored.
  ct.addRangeTesters('years_on_kiva', (p) => p.kl_years_on_kiva)
  ct.addRangeTesters('loans_posted', (p) => p.loans_posted)

  const flcMap = {}
  for (const loan of ctx.loans || []) {
    if (loan.status === 'fundraising' && loan.partner_id != null) {
      flcMap[loan.partner_id] = (flcMap[loan.partner_id] ?? 0) + 1
    }
  }
  ct.addRangeTesters('fundraising_loan_count', (p) => flcMap[p.id] ?? 0)

  ct.addThreeStateTester(partner.charges_fees_and_interest, (p) => p.charges_fees_and_interest)

  if (ctx.atheistListProcessed) {
    ct.addRangeTesters('secular_rating', (p) => p.atheistScore?.secularRating, (p) => !p.atheistScore)
    ct.addRangeTesters('social_rating', (p) => p.atheistScore?.socialRating, (p) => !p.atheistScore)
  }

  ct.addAnyAllNoneTester('religion', null, 'any', (p) => p.normalizedReligions || ['Unknown'], true)
  ct.addBalancer(portfolio.pb_partner, (p) => p.id)
  ct.addRangeTesters(
    'partner_risk_rating',
    (p) => p.rating,
    (p) => Number.isNaN(parseFloat(String(p.rating))),
    (crit) => crit.partner_risk_rating_min == null,
  )

  return ct
}

// ---------------------------------------------------------------------------
// Loan filtering + sort + limit. Returns the matching loans.
// ctx: { loans, activePartners, atheistListProcessed, lenderId, lenderLoans }
// ---------------------------------------------------------------------------
export function filterLoans(c, ctx) {
  const criteria = normalizeCriteria(c)
  const ct = buildLoanTester(criteria, ctx, true)

  let filtered = (ctx.loans || []).filter((loan) => ct.allPass(loan))

  const limitTo = criteria.loan.limit_to
  if (limitTo?.enabled) {
    const count = Number.isNaN(limitTo.count) ? 1 : limitTo.count
    let selector
    switch (limitTo.limit_by) {
      case 'Partner': selector = (l) => l.partner_id; break
      case 'Country': selector = (l) => l.location.country_code; break
      case 'Activity': selector = (l) => l.activity; break
      case 'Sector': selector = (l) => l.sector; break
    }
    if (selector) {
      const groups = groupBy(filtered, selector)
      filtered = groups.flatMap((g) => sortLoans(g, criteria.loan.sort).slice(0, count))
    }
  }

  filtered = sortLoans(filtered, criteria.loan.sort)

  if (criteria.loan.limit_results) filtered = filtered.slice(0, criteria.loan.limit_results)

  return filtered
}

// Every loan test the criteria imply. `withPartnerMembership` false leaves out
// the "belongs to a matching partner" test so rangeDistributions can judge the
// partner side per range instead of as one yes/no.
function buildLoanTester(criteria, ctx, withPartnerMembership) {
  const ct = new CritTester(criteria.loan)

  ct.addAnyAllNoneTester('sector', null, 'any', (l) => l.sector)
  ct.addAnyAllNoneTester('activity', null, 'any', (l) => l.activity)
  ct.addAnyAllNoneTester('country_code', null, 'any', (l) => l.location.country_code)
  ct.addAnyAllNoneTester('tags', null, 'all', (l) => l.kls_tags, true)
  ct.addAnyAllNoneTester('themes', null, 'all', (l) => l.themes, true)

  ct.addFieldContainsOneOfArrayTester(criteria.loan.repayment_interval, (l) => l.terms.repayment_interval ?? 'unknown')
  ct.addFieldContainsOneOfArrayTester(criteria.loan.currency_exchange_loss_liability, (l) => l.terms.loss_liability?.currency_exchange)

  ct.addRangeTesters('repaid_in', (l) => l.kls_repaid_in)
  // Loans from the KivaLens server carry borrower_count; loans read straight
  // from Kiva's API carry only the borrowers themselves.
  ct.addRangeTesters('borrower_count', (l) => l.borrower_count ?? l.borrowers?.length)
  ct.addRangeTesters('percent_female', (l) => l.kl_percent_women)
  ct.addRangeTesters('age', (l) => l.kls_age)
  ct.addRangeTesters('still_needed', (l) => l.kl_still_needed)
  ct.addRangeTesters('loan_amount', (l) => l.loan_amount)
  ct.addRangeTesters('dollars_per_hour', (l) => dollarsPerHour(l))
  ct.addRangeTesters('percent_funded', (l) => l.kl_percent_funded)
  ct.addRangeTesters('expiring_in_days', (l) => valOf(l.kl_expiring_in_days))
  ct.addRangeTesters('disbursal_in_days', (l) => valOf(l.kl_disbursal_in_days))

  ct.addArrayAllStartWithTester(criteria.loan.use, (l) => l.kls_use_or_descr_arr)
  ct.addArrayAllStartWithTester(criteria.loan.name, (l) => l.kl_name_arr)

  if (!criteria.partner.direct || criteria.partner.direct === '') {
    if (withPartnerMembership) ct.addFieldContainsOneOfArrayTester(filterPartnerIds(criteria, ctx), (l) => l.partner_id, true)
  } else if (criteria.partner.direct === 'direct') {
    ct.testers.push((l) => l.partner_id == null)
  }

  if (criteria.portfolio.exclude_portfolio_loans === 'true' && ctx.lenderId && ctx.lenderLoans?.[ctx.lenderId]?.length) {
    ct.addFieldNotContainsOneOfArrayTester(ctx.lenderLoans[ctx.lenderId], (l) => l.id)
  }

  ct.addBalancer(criteria.portfolio.pb_sector, (l) => l.sector)
  ct.addBalancer(criteria.portfolio.pb_country, (l) => l.location.country)
  ct.addBalancer(criteria.portfolio.pb_activity, (l) => l.activity)
  // pb_region: derive each loan's region NAME from its country via partner country
  // data (partner.countries[].region are names like "South America", matching the
  // supergraph region slices). Built only when the region balancer is enabled.
  if (criteria.portfolio.pb_region?.enabled) {
    const regionByCode = {}
    for (const p of ctx.activePartners || []) {
      for (const c of p.countries || []) {
        if (c?.iso_code && c.region) regionByCode[c.iso_code] = c.region
      }
    }
    ct.addBalancer(criteria.portfolio.pb_region, (l) => regionByCode[l.location?.country_code])
  }
  // pb_gender: bucket by majority-women share to match the supergraph Female/Male slices.
  ct.addBalancer(criteria.portfolio.pb_gender, (l) => ((l.kl_percent_women ?? 0) >= 50 ? 'Female' : 'Male'))
  ct.addThreeStateTester(criteria.loan.bonus_credit_eligibility, (l) => l.bonus_credit_eligibility === true)

  ct.testers.push((l) => l.status === 'fundraising')
  ct.testers.push((l) => (l.funded_amount ?? 0) < l.loan_amount)

  return ct
}

const normalizeCriteria = (c) => ({
  loan: { ...(c.loan ?? {}) },
  partner: { ...(c.partner ?? {}) },
  portfolio: { ...(c.portfolio ?? {}) },
})


// ---------------------------------------------------------------------------
// Range distributions — for every range slider at once, how the loans that
// match ALL THE OTHER criteria are spread along that slider's scale.
//
// A slider's own min/max is left out of its own histogram: the histogram shows
// what widening or narrowing that slider would gain or lose, which a histogram
// clipped to the current selection could not. One pass does it: a loan that
// passes everything counts for every slider; a loan kept out by exactly one
// range counts for that slider only; anything else counts for none. Partner
// ranges are judged through the loan's partner, and their histograms count
// LOANS, because loans are what the search returns.
//
// specs: { loan: { critName: BinSpec }, partner: { critName: BinSpec } }
//   BinSpec = { min, max, count, discrete }   (see binIndex)
// returns: { loan: { critName: number[] }, partner: { critName: number[] } }
//
// The result-list steps after the tests (limit-per-group, limit_results, sort)
// are not part of the population: the histograms describe what matches.
// ---------------------------------------------------------------------------
export function rangeDistributions(c, ctx, specs) {
  const criteria = normalizeCriteria(c)
  const loanSpecs = Object.entries(specs.loan ?? {})
  const partnerSpecs = Object.entries(specs.partner ?? {})
  const out = { loan: {}, partner: {} }
  for (const [key, spec] of loanSpecs) out.loan[key] = new Array(spec.count).fill(0)
  for (const [key, spec] of partnerSpecs) out.partner[key] = new Array(spec.count).fill(0)

  const loanCt = buildLoanTester(criteria, ctx, false)

  // '' = the partner side adds no constraint; otherwise partners are judged one by one.
  const direct = criteria.partner.direct
  const partnersConstrain = !direct || direct === ''
  const partnerCt = buildPartnerTester(criteria, ctx)
  const partnerById = new Map()
  const partnerFailing = new Map()
  for (const p of ctx.partnerPool || ctx.activePartners || []) {
    partnerById.set(p.id, p)
    if (partnersConstrain) partnerFailing.set(p.id, partnerCt.soleFailingRange(p))
  }

  // Three loan values are computed from dates on every read. The filter reads
  // them only when their slider is set; the histograms read them for every
  // loan, every time, and they were two thirds of the cost. They move by the
  // day (or, for $/hour, by the funding resync), so a minute-old value is exact
  // enough for a bar chart. The filter itself never uses this cache.
  const now = Date.now()
  const loanValue = {}
  for (const [key] of loanSpecs) {
    const selector = loanCt.ranges[key]
    loanValue[key] = selector && SLOW_LOAN_RANGES.has(key) ? briefly(key, selector, now) : selector
  }

  const loansAtPartner = new Map()

  for (const loan of ctx.loans || []) {
    const loanFail = loanCt.soleFailingRange(loan)
    if (loanFail === null) continue
    const partner = loan.partner_id == null ? undefined : partnerById.get(loan.partner_id)
    let partnerFail = ''
    if (partnersConstrain) {
      // Mirrors filterLoans: the loan's partner must be one of the matching partners.
      partnerFail = partner ? partnerFailing.get(loan.partner_id) : null
      if (partnerFail === null || partnerFail === undefined) continue
    }
    if (loanFail && partnerFail) continue // kept out by two different ranges

    for (const [key, spec] of loanSpecs) {
      if (partnerFail || (loanFail && loanFail !== key)) continue
      const selector = loanValue[key]
      const i = selector ? binIndex(selector(loan), spec) : -1
      if (i >= 0) out.loan[key][i] += 1
    }
    // A partner's value is the same for all its loans: tally the loans here and
    // bin once per partner below, instead of once per loan per partner slider.
    if (partner && !loanFail) loansAtPartner.set(partner, (loansAtPartner.get(partner) ?? 0) + 1)
  }

  for (const [partner, loans] of loansAtPartner) {
    const partnerFail = partnersConstrain ? partnerFailing.get(partner.id) : ''
    for (const [key, spec] of partnerSpecs) {
      if (partnerFail && partnerFail !== key) continue
      const selector = partnerCt.ranges[key]
      const i = selector ? binIndex(selector(partner), spec) : -1
      if (i >= 0) out.partner[key][i] += loans
    }
  }
  return out
}

const SLOW_LOAN_RANGES = new Set(['dollars_per_hour', 'expiring_in_days', 'disbursal_in_days'])
const BRIEFLY_MS = 60_000
const brieflyCache = {}

// selector, remembered per loan object for a minute (see rangeDistributions).
function briefly(key, selector, now) {
  const cache = (brieflyCache[key] ??= new WeakMap())
  return (loan) => {
    const hit = cache.get(loan)
    if (hit && now - hit.at < BRIEFLY_MS) return hit.value
    const value = selector(loan)
    cache.set(loan, { at: now, value })
    return value
  }
}

// Where a value falls among a slider's bins, or -1 when it has no number.
// discrete: one bin per slider stop (count = stops); a value belongs to the
//   stop at or below it, so 1.4 years sits in the 1.25 bar, not the 1.5 one
//   (nearest-stop rounding would show it under a stop its own min would reject).
// otherwise: `count` equal-width bins across [min, max].
// A value past either end lands in the end bin, because a handle resting at
// the end of its slider means "no limit" and still includes that loan.
export function binIndex(value, spec) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return -1
  const at = (n - spec.min) / (spec.max - spec.min)
  // The nudge keeps a value that sits exactly on a bar's lower edge in that bar:
  // 5800 / 10000 * 50 is 28.999999999999996 in floating point, not 29.
  const i = Math.floor(at * (spec.discrete ? spec.count - 1 : spec.count) + 1e-9)
  return i < 0 ? 0 : i >= spec.count ? spec.count - 1 : i
}

// The same histograms for the Partners page, where the population is PARTNERS:
// per slider, the partners in the pool that match every other partner
// criterion. `accept` carries any test the engine does not own (the page's
// name search). specs: { critName: BinSpec }; returns { critName: number[] }.
export function partnerRangeDistributions(c, ctx, specs, accept) {
  const entries = Object.entries(specs ?? {})
  const out = {}
  for (const [key, spec] of entries) out[key] = new Array(spec.count).fill(0)
  const ct = buildPartnerTester(normalizeCriteria(c), ctx)
  for (const partner of ctx.partnerPool || ctx.activePartners || []) {
    if (accept && !accept(partner)) continue
    const failing = ct.soleFailingRange(partner)
    if (failing === null) continue
    for (const [key, spec] of entries) {
      if (failing && failing !== key) continue
      const selector = ct.ranges[key]
      const i = selector ? binIndex(selector(partner), spec) : -1
      if (i >= 0) out[key][i] += 1
    }
  }
  return out
}

// The numbers the partners in the pool have for the given partner ranges, read
// through the same selectors the filter uses (so "fundraising_loan_count" is the
// live count of fundraising loans, not a field). A slider whose scale follows
// the data (years on Kiva keeps growing) derives its upper end from these.
export function partnerRangeValues(ctx, keys) {
  const ct = buildPartnerTester(normalizeCriteria({}), ctx)
  const pool = ctx.partnerPool || ctx.activePartners || []
  const out = {}
  for (const key of keys) {
    const selector = ct.ranges[key]
    out[key] = []
    if (!selector) continue
    for (const partner of pool) {
      const v = selector(partner)
      const n = typeof v === 'number' ? v : parseFloat(v)
      if (Number.isFinite(n)) out[key].push(n)
    }
  }
  return out
}
