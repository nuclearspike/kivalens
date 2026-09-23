/**
 * criteriaFields.mjs — every field a search can carry, and which group it is in.
 *
 * One registry, three readers: the URL encoding (server/criteriaUrl.mjs), the
 * KivaLens Lite handoff validator (src/lib/searchPreset.ts), and the tests that
 * hold them to each other. A field added to the search and not added here is
 * simply not shareable — it will not reach a link, and a link cannot set it.
 *
 * Field names are unique across the three groups, so a URL names a field
 * directly and needs no group prefix.
 */

/** Text fields, including the `_all_any_none` companion of a multi-select. */
export const LOAN_STRING_FIELDS = [
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
]

/** Each name stands for a `_min`/`_max` pair. */
export const LOAN_RANGE_FIELDS = [
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
]

export const PARTNER_STRING_FIELDS = [
  'partners',
  'partners_all_any_none',
  'region',
  'region_all_any_none',
  'social_performance',
  'social_performance_all_any_none',
  'charges_fees_and_interest',
  'religion',
  'religion_all_any_none',
]

export const PARTNER_RANGE_FIELDS = [
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
]

export const PORTFOLIO_STRING_FIELDS = ['exclude_portfolio_loans']

/** The six portfolio balancers, each an object of five settings. */
export const BALANCER_FIELDS = [
  'pb_sector',
  'pb_country',
  'pb_activity',
  'pb_partner',
  'pb_region',
  'pb_gender',
]

/** Whether the search is over MFI-backed loans, direct loans, or both. */
export const PARTNER_MODES = ['both', 'mfi', 'direct']

/** The settings a balancer holds, in the order a URL writes them. */
export const BALANCER_SETTINGS = [
  { key: 'hideshow', values: ['hide', 'show'], fallback: 'hide' },
  { key: 'ltgt', values: ['lt', 'gt'], fallback: 'lt' },
  { key: 'percent', number: { min: 0, max: 100 }, fallback: 10 },
  { key: 'allactive', values: ['all', 'active'], fallback: 'all' },
]

/** How many loans to keep per partner/country/sector/activity. */
export const LIMIT_BY_VALUES = ['Partner', 'Country', 'Sector', 'Activity']

export const MAX_STRING_LENGTH = 1_000
export const MIN_NUMBER = -1_000_000
export const MAX_NUMBER = 1_000_000

/** Which criteria group a field belongs to, by field name. */
export const FIELD_GROUP = new Map([
  ...LOAN_STRING_FIELDS.map((f) => [f, 'loan']),
  ...LOAN_RANGE_FIELDS.map((f) => [f, 'loan']),
  ['limit_to', 'loan'],
  ...PARTNER_STRING_FIELDS.map((f) => [f, 'partner']),
  ...PARTNER_RANGE_FIELDS.map((f) => [f, 'partner']),
  ['direct', 'partner'],
  ...PORTFOLIO_STRING_FIELDS.map((f) => [f, 'portfolio']),
  ...BALANCER_FIELDS.map((f) => [f, 'portfolio']),
])

export const RANGE_FIELDS = new Set([...LOAN_RANGE_FIELDS, ...PARTNER_RANGE_FIELDS])
export const STRING_FIELDS = new Set([
  ...LOAN_STRING_FIELDS,
  ...PARTNER_STRING_FIELDS,
  ...PORTFOLIO_STRING_FIELDS,
])
export const BALANCER_SET = new Set(BALANCER_FIELDS)
