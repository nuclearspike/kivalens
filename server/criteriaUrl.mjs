/**
 * criteriaUrl.mjs — a search, written as a web address.
 *
 * A search used to live only in the browser that built it: it could be saved,
 * exported as JSON, or wrapped in a feed URL, but it could not be linked to.
 * Here it is query parameters, named after the fields themselves:
 *
 *   /search?country_code=KE,UG&sector=all:Agriculture,Retail&age=18..40&direct=mfi
 *
 * Three shapes carry the structure, and `:` always separates parts of one
 * setting while `,` separates items of a list:
 *
 *   a range      age=18..40, age=18.., age=..40    (either end may be left off)
 *   a list       country_code=KE,UG                (plus mode:, when one is set)
 *   a balancer   pb_country=show:gt:15:active      (written only when it is on)
 *
 * Only what the lender set appears; an untouched search is a bare /search. The
 * encoding is the same one the feed uses, so a feed address and the page it came
 * from read alike.
 *
 * Decoding is closed by the registry in criteriaFields.mjs: a parameter naming
 * no field is left where it is (an address also carries campaign tags, the open
 * tab, a lender id), and a field whose value does not fit its kind is dropped
 * rather than failing the whole address, so one stale parameter never costs a
 * lender the rest of their link.
 */

import {
  BALANCER_SET,
  BALANCER_SETTINGS,
  FIELD_GROUP,
  LIMIT_BY_VALUES,
  MAX_NUMBER,
  MAX_STRING_LENGTH,
  MIN_NUMBER,
  PARTNER_MODES,
  RANGE_FIELDS,
  STRING_FIELDS,
} from './criteriaFields.mjs'
import { resolvePartnerMode } from './loanFilter.mjs'
import { formatSearch } from './routeMap.mjs'

const MODES = new Set(['all', 'any', 'none'])
const PARTNER_MODE_SET = new Set(PARTNER_MODES)

/** Parameters this encoding owns; anything else on an address belongs to it. */
export function isCriteriaParam(name) {
  return FIELD_GROUP.has(name)
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= MIN_NUMBER && n <= MAX_NUMBER ? n : null
}

function text(value) {
  const s = String(value ?? '')
  return s.length > 0 && s.length <= MAX_STRING_LENGTH && !s.includes('\0') ? s : null
}

// ---------------------------------------------------------------------------
// A search, written out
// ---------------------------------------------------------------------------

function writeRange(params, name, group) {
  const min = group[`${name}_min`]
  const max = group[`${name}_max`]
  const hasMin = min !== undefined && min !== null && min !== ''
  const hasMax = max !== undefined && max !== null && max !== ''
  if (!hasMin && !hasMax) return
  params.set(name, `${hasMin ? min : ''}..${hasMax ? max : ''}`)
}

function writeBalancer(params, name, value) {
  if (!value || value.enabled !== true) return
  params.set(
    name,
    BALANCER_SETTINGS.map((s) => (value[s.key] ?? s.fallback)).join(':'),
  )
}

function writeLimitTo(params, value) {
  if (!value || value.enabled !== true) return
  params.set('limit_to', `${value.count ?? 1}:${value.limit_by ?? 'Partner'}`)
}

/**
 * The parameters that stand for this search. Only fields the lender set appear,
 * so an untouched search writes nothing at all.
 */
export function criteriaToParams(criteria) {
  const params = new URLSearchParams()
  const loan = criteria?.loan ?? {}
  const partner = criteria?.partner ?? {}
  const portfolio = criteria?.portfolio ?? {}

  for (const [field, groupName] of FIELD_GROUP) {
    const group = groupName === 'loan' ? loan : groupName === 'partner' ? partner : portfolio
    if (field === 'limit_to') {
      writeLimitTo(params, group.limit_to)
      continue
    }
    if (BALANCER_SET.has(field)) {
      writeBalancer(params, field, group[field])
      continue
    }
    if (RANGE_FIELDS.has(field)) {
      writeRange(params, field, group)
      continue
    }
    // A mode travels with the list it applies to, not as a parameter of its own.
    if (field.endsWith('_all_any_none')) continue

    const raw = group[field]
    if (raw === undefined || raw === null || raw === '') continue
    if (field === 'direct') {
      if (!PARTNER_MODE_SET.has(String(raw))) continue
      // An address says the mode only when leaving it out would mean something
      // else. Unset, the engine reads Both — unless partner filters are set, in
      // which case it reads MFI Only, so a deliberate Both has to be written.
      const withoutIt = { ...criteria, partner: { ...partner, direct: undefined } }
      if (String(raw) === resolvePartnerMode(withoutIt)) continue
      params.set('direct', String(raw))
      continue
    }
    const value = text(raw)
    if (value === null) continue
    const mode = FIELD_GROUP.has(`${field}_all_any_none`) ? group[`${field}_all_any_none`] : undefined
    params.set(field, MODES.has(String(mode)) ? `${mode}:${value}` : value)
  }

  return params
}

/**
 * A query string, with `:` and `,` written as themselves. Both are legal in a
 * query (RFC 3986 allows sub-delims there) and every parser reads them back
 * unchanged, so escaping them would only make the address harder for a person
 * to read, which is most of the point of naming the fields at all.
 */
export function readableSearch(params) {
  return formatSearch(params)
}

/** The address for a search, ready to hand to a router or put in a link. */
export function criteriaToSearch(criteria) {
  return readableSearch(criteriaToParams(criteria))
}

/**
 * This address with the search rewritten: whatever it carries that is not a
 * search field — a campaign tag, the open tab, a lender id — stays as it was.
 */
export function withCriteria(params, criteria) {
  const next = new URLSearchParams()
  for (const [key, value] of params.entries()) if (!isCriteriaParam(key)) next.append(key, value)
  for (const [key, value] of criteriaToParams(criteria).entries()) next.append(key, value)
  return readableSearch(next)
}

// ---------------------------------------------------------------------------
// A search, read back
// ---------------------------------------------------------------------------

/**
 * Both ends are read before either is kept: half a range is a different filter
 * from the one that was sent, and showing a lender results they did not ask for
 * is worse than showing them the field unset.
 */
function readRange(target, name, raw) {
  if (!raw.includes('..')) {
    // A bare number is both ends: "exactly this".
    const exact = num(raw)
    if (exact === null) return
    target[`${name}_min`] = exact
    target[`${name}_max`] = exact
    return
  }
  const [lo, hi] = raw.split('..')
  const min = lo === '' ? undefined : num(lo)
  const max = hi === '' ? undefined : num(hi)
  if (min === null || max === null) return
  if (min !== undefined) target[`${name}_min`] = min
  if (max !== undefined) target[`${name}_max`] = max
}

function readBalancer(raw) {
  const parts = raw.split(':')
  const result = { enabled: true }
  for (let i = 0; i < BALANCER_SETTINGS.length; i++) {
    const setting = BALANCER_SETTINGS[i]
    const given = parts[i]
    if (given === undefined || given === '') {
      result[setting.key] = setting.fallback
      continue
    }
    if (setting.values) {
      if (!setting.values.includes(given)) return null
      result[setting.key] = given
      continue
    }
    const value = num(given)
    if (value === null || value < setting.number.min || value > setting.number.max) return null
    result[setting.key] = value
  }
  return result
}

function readLimitTo(raw) {
  const [countRaw, by = 'Partner'] = raw.split(':')
  const count = num(countRaw)
  if (count === null || !Number.isInteger(count) || count < 1 || count > 100) return null
  if (!LIMIT_BY_VALUES.includes(by)) return null
  return { enabled: true, count, limit_by: by }
}

/**
 * The search an address describes, or null when it describes none. Parameters
 * that name no field are ignored, and a field whose value does not fit its kind
 * is dropped on its own.
 */
export function criteriaFromParams(params) {
  const result = { loan: {}, partner: {}, portfolio: {} }
  let found = false

  for (const field of new Set(params.keys())) {
    const groupName = FIELD_GROUP.get(field)
    if (!groupName) continue
    const raw = params.get(field)
    if (raw === null || raw === '' || raw.length > MAX_STRING_LENGTH) continue
    const group = result[groupName]

    if (field === 'limit_to') {
      const limit = readLimitTo(raw)
      if (limit) {
        group.limit_to = limit
        found = true
      }
      continue
    }
    if (BALANCER_SET.has(field)) {
      const balancer = readBalancer(raw)
      if (balancer) {
        group[field] = balancer
        found = true
      }
      continue
    }
    if (RANGE_FIELDS.has(field)) {
      const before = Object.keys(group).length
      readRange(group, field, raw)
      if (Object.keys(group).length > before) found = true
      continue
    }
    if (field === 'direct') {
      if (PARTNER_MODE_SET.has(raw)) {
        group.direct = raw
        found = true
      }
      continue
    }
    if (field.endsWith('_all_any_none')) continue
    if (!STRING_FIELDS.has(field)) continue

    const takesMode = FIELD_GROUP.has(`${field}_all_any_none`)
    const colon = takesMode ? raw.indexOf(':') : -1
    const mode = colon === -1 ? '' : raw.slice(0, colon)
    const hasMode = MODES.has(mode)
    const value = text(hasMode ? raw.slice(colon + 1) : raw)
    if (value === null) continue
    group[field] = value
    if (hasMode) group[`${field}_all_any_none`] = mode
    found = true
  }

  return found ? result : null
}

/** Whether an address describes a search at all. */
export function hasCriteriaParams(params) {
  for (const name of params.keys()) if (FIELD_GROUP.has(name)) return true
  return false
}
