import type { Criteria } from '../types'

const MAX_PRESET_LENGTH = 8_000
const MAX_STRING_LENGTH = 1_000
const MIN_NUMBER = -1_000_000
const MAX_NUMBER = 1_000_000

const LOAN_STRING_KEYS = new Set([
  'sort',
  'use',
  'name',
  'country_code',
  'country_code_all_any_none',
  'sector',
  'sector_all_any_none',
  'activity',
  'activity_all_any_none',
  'themes',
  'themes_all_any_none',
  'tags',
  'tags_all_any_none',
  'repayment_interval',
  'currency_exchange_loss_liability',
  'bonus_credit_eligibility',
])

const LOAN_RANGE_NAMES = [
  'repaid_in',
  'borrower_count',
  'percent_female',
  'age',
  'still_needed',
  'loan_amount',
  'dollars_per_hour',
  'percent_funded',
  'expiring_in_days',
  'disbursal_in_days',
] as const

const PARTNER_STRING_KEYS = new Set([
  'partners',
  'partners_all_any_none',
  'region',
  'region_all_any_none',
  'social_performance',
  'social_performance_all_any_none',
  'charges_fees_and_interest',
  'religion',
  'religion_all_any_none',
])

const PARTNER_RANGE_NAMES = [
  'partner_risk_rating',
  'partner_arrears',
  'loans_at_risk_rate',
  'partner_default',
  'portfolio_yield',
  'profit',
  'currency_exchange_loss_rate',
  'average_loan_size_percent_per_capita_income',
  'years_on_kiva',
  'loans_posted',
  'fundraising_loan_count',
  'secular_rating',
  'social_rating',
] as const

const PORTFOLIO_STRING_KEYS = new Set(['exclude_portfolio_loans'])
const PORTFOLIO_BALANCER_KEYS = new Set([
  'pb_sector',
  'pb_country',
  'pb_activity',
  'pb_partner',
  'pb_region',
  'pb_gender',
])

const SEARCH_PRESET_TABS = new Set(['borrower', 'partner', 'portfolio', 'rss'])
const PARTNER_MODES = new Set(['both', 'mfi', 'direct'])

type PlainRecord = Record<string, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rangeKeys(names: readonly string[]): Set<string> {
  return new Set(names.flatMap((name) => [`${name}_min`, `${name}_max`]))
}

const LOAN_NUMBER_KEYS = rangeKeys(LOAN_RANGE_NAMES)
const PARTNER_NUMBER_KEYS = rangeKeys(PARTNER_RANGE_NAMES)

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_STRING_LENGTH && !value.includes('\0')
    ? value
    : null
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_NUMBER
    && value <= MAX_NUMBER
    ? value
    : null
}

function sanitizeLimitTo(value: unknown): PlainRecord | null {
  if (!isPlainRecord(value)) return null
  const allowed = new Set(['enabled', 'count', 'limit_by'])
  if (Object.keys(value).some((key) => !allowed.has(key))) return null

  const result: PlainRecord = {}
  if ('enabled' in value) {
    if (typeof value.enabled !== 'boolean') return null
    result.enabled = value.enabled
  }
  if ('count' in value) {
    if (!Number.isInteger(value.count) || (value.count as number) < 1 || (value.count as number) > 100) return null
    result.count = value.count
  }
  if ('limit_by' in value) {
    if (!['Partner', 'Country', 'Sector', 'Activity'].includes(String(value.limit_by))) return null
    result.limit_by = value.limit_by
  }
  return result
}

function sanitizeBalancer(value: unknown): PlainRecord | null {
  if (!isPlainRecord(value)) return null
  const allowed = new Set(['enabled', 'hideshow', 'ltgt', 'percent', 'allactive'])
  if (Object.keys(value).some((key) => !allowed.has(key))) return null

  const result: PlainRecord = {}
  if ('enabled' in value) {
    if (typeof value.enabled !== 'boolean') return null
    result.enabled = value.enabled
  }
  if ('hideshow' in value) {
    if (!['hide', 'show'].includes(String(value.hideshow))) return null
    result.hideshow = value.hideshow
  }
  if ('ltgt' in value) {
    if (!['lt', 'gt'].includes(String(value.ltgt))) return null
    result.ltgt = value.ltgt
  }
  if ('percent' in value) {
    const percent = safeNumber(value.percent)
    if (percent === null || percent < 0 || percent > 100) return null
    result.percent = percent
  }
  if ('allactive' in value) {
    if (!['all', 'active'].includes(String(value.allactive))) return null
    result.allactive = value.allactive
  }
  return result
}

function sanitizeFlatGroup(
  value: unknown,
  stringKeys: Set<string>,
  numberKeys: Set<string>,
  nestedKey?: string,
  nestedSanitizer?: (value: unknown) => PlainRecord | null,
): PlainRecord | null {
  if (!isPlainRecord(value)) return null
  const result: PlainRecord = {}

  for (const [key, raw] of Object.entries(value)) {
    if (stringKeys.has(key)) {
      const stringValue = safeString(raw)
      if (stringValue === null) return null
      result[key] = stringValue
      continue
    }
    if (numberKeys.has(key)) {
      const numberValue = safeNumber(raw)
      if (numberValue === null) return null
      result[key] = numberValue
      continue
    }
    if (key === nestedKey && nestedSanitizer) {
      const nested = nestedSanitizer(raw)
      if (nested === null) return null
      result[key] = nested
      continue
    }
    return null
  }

  return result
}

function sanitizePortfolio(value: unknown): PlainRecord | null {
  if (!isPlainRecord(value)) return null
  const result: PlainRecord = {}

  for (const [key, raw] of Object.entries(value)) {
    if (PORTFOLIO_STRING_KEYS.has(key)) {
      const stringValue = safeString(raw)
      if (stringValue === null) return null
      result[key] = stringValue
      continue
    }
    if (PORTFOLIO_BALANCER_KEYS.has(key)) {
      const balancer = sanitizeBalancer(raw)
      if (balancer === null) return null
      result[key] = balancer
      continue
    }
    return null
  }

  return result
}

/**
 * Parses the deliberately small, non-personal search handoff used by KivaLens
 * Lite help. Unknown fields fail closed so a link can never write arbitrary
 * persisted state into the full application.
 */
export function parseSearchPreset(raw: string | null): Criteria | null {
  if (raw === null || raw.length === 0 || raw.length > MAX_PRESET_LENGTH) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isPlainRecord(parsed)) return null
  if (Object.keys(parsed).some((key) => !['loan', 'partner', 'portfolio'].includes(key))) return null

  const loan = sanitizeFlatGroup(
    parsed.loan ?? {},
    LOAN_STRING_KEYS,
    LOAN_NUMBER_KEYS,
    'limit_to',
    sanitizeLimitTo,
  )
  // The MFI/Direct mode is one of three values, never free text.
  const rawPartner = isPlainRecord(parsed.partner) ? { ...parsed.partner } : parsed.partner ?? {}
  let direct: string | undefined
  if (isPlainRecord(rawPartner) && 'direct' in rawPartner) {
    const value = rawPartner.direct
    delete rawPartner.direct
    // '' is how the mode was written before it had three values: it means "not set",
    // and the engine reads an unset mode from the partner criteria. Anything else
    // that is not one of the three fails the whole preset closed.
    if (value !== '') {
      if (!PARTNER_MODES.has(String(value))) return null
      direct = String(value)
    }
  }
  const sanitizedPartner = sanitizeFlatGroup(
    rawPartner,
    PARTNER_STRING_KEYS,
    PARTNER_NUMBER_KEYS,
  )
  const partner = sanitizedPartner && direct ? { ...sanitizedPartner, direct } : sanitizedPartner
  const portfolio = sanitizePortfolio(parsed.portfolio ?? {})
  if (!loan || !partner || !portfolio) return null

  return {
    loan,
    partner,
    portfolio,
  } as Criteria
}

export function parseSearchPresetTab(raw: string | null): string | null {
  return raw !== null && SEARCH_PRESET_TABS.has(raw) ? raw : null
}
