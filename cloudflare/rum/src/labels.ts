import { FIELD_GROUP } from '../../../server/criteriaFields.mjs'
import en from '../../../src/i18n/locales/en'

/**
 * The dashboard's names for what the usage statistics count, in the words the
 * site uses. The dashboard is the owner's, so it is English only. Every criterion
 * field, page and action the site can report has a name here (labels.test in
 * rum.test.ts), so nothing shows up as a bare identifier.
 */

/** Criterion field -> its name in the criteria panel. */
export const CRITERIA: Record<string, string> = {
  // Borrower tab
  sort: 'Sort',
  name: 'Name (typed)',
  use: 'Use or description (typed)',
  country_code: 'Country',
  sector: 'Sector',
  activity: 'Activity',
  themes: 'Theme',
  tags: 'Tag',
  repayment_interval: 'Repayment interval',
  currency_exchange_loss_liability: 'Currency loss',
  bonus_credit_eligibility: 'Bonus credit',
  repaid_in: 'Repaid in (months)',
  borrower_count: 'Borrowers',
  percent_female: '% women',
  age: 'Age',
  still_needed: 'Still needed ($)',
  loan_amount: 'Loan amount ($)',
  dollars_per_hour: '$/hour',
  percent_funded: '% funded',
  expiring_in_days: 'Expiring in (days)',
  disbursal_in_days: 'Disbursal (days)',
  limit_to: 'Limit results',
  // Partner tab
  partners: 'Field partner',
  region: 'Region',
  social_performance: 'Social performance',
  charges_fees_and_interest: 'Charges interest',
  religion: 'Religion',
  partner_risk_rating: 'Risk rating',
  partner_arrears: 'Arrears',
  loans_at_risk_rate: 'Loans at risk',
  partner_default: 'Default rate',
  portfolio_yield: 'Portfolio yield',
  profit: 'Profitability',
  currency_exchange_loss_rate: 'Currency exchange loss',
  average_loan_size_percent_per_capita_income: 'Avg loan / income (retired)',
  years_on_kiva: 'Years on Kiva',
  loans_posted: 'Loans posted',
  fundraising_loan_count: 'Fundraising loans',
  secular_rating: 'Secular score (A+)',
  social_rating: 'Social score (A+)',
  // Portfolio tab
  exclude_portfolio_loans: 'Exclude my loans',
  pb_sector: 'Balance by sector',
  pb_country: 'Balance by country',
  pb_activity: 'Balance by activity',
  pb_partner: 'Balance by partner',
  pb_region: 'Balance by region',
  pb_gender: 'Balance by gender',
}

/** Which criteria tab a field is on. */
export const TAB: Record<string, string> = { loan: 'Borrower', partner: 'Partner', portfolio: 'Portfolio' }

export const MODES: Record<string, string> = { both: 'Both', mfi: 'MFI Only', direct: 'Direct Only' }

/** Route id -> page. */
export const PAGES: Record<string, string> = {
  root: 'Home (/)',
  search: 'Search',
  loan: 'A loan',
  partners: 'Partners',
  partner: 'A field partner',
  basket: 'Basket',
  basketLoan: 'A loan in the basket',
  saved: 'Saved searches',
  stats: 'Stats',
  wall: 'Wall',
  teams: 'Teams',
  mfiGame: 'MFI Game',
  options: 'Options',
  about: 'About',
  aboutAdvanced: 'About › Advanced',
  privacy: 'Privacy',
  autolend: 'Auto-Lending',
  outdated: 'Outdated link',
  other: 'Other address',
}

export const EVENTS: Record<string, string> = {
  basket_add: 'Loans added to the basket',
  checkout: 'Checkouts at Kiva',
  checkout_loans: 'Loans sent to Kiva',
  saved_load: 'Own saved search loaded',
  history_restore: 'Went back through History',
  rss_copy: 'RSS feed link copied',
}

/**
 * The MFI Builder game (mfi.kivalens.org), which reports to this collector as its own site. Its milestones,
 * views and arrival sources are named in mfi-builder/src/usage.ts; these lists follow that file's order.
 */
export const GAME_MILESTONES: ReadonlyArray<readonly [string, string]> = [
  ['setup', 'Leased a place'],
  ['opened', 'Opened the branch'],
  ['first_loan', 'Made a first loan'],
  ['first_repayment', 'Received a first repayment'],
  ['month_2', 'Reached month 2'],
  ['month_3', 'Reached month 3'],
  ['month_6', 'Reached month 6'],
  ['month_12', 'Reached month 12'],
  ['month_24', 'Reached month 24'],
  ['month_36', 'Reached month 36'],
  ['assessment', 'Reached the 36-month assessment'],
  ['continued', 'Continued past the assessment'],
  ['second_office', 'Opened a second office'],
]
/** The game's views, by the names its own navigation shows. */
export const GAME_VIEWS: Record<string, string> = {
  overview: 'Overview',
  branch: 'Your branch',
  team: 'People',
  lending: 'Lending',
  field: 'Fieldwork',
  finance: 'Finances',
  community: 'Community',
}
export const GAME_ARRIVALS: Record<string, string> = {
  kivalens: 'From KivaLens',
  kiva: 'From Kiva.org',
  search: 'From a search engine',
  other: 'From another site',
  direct: 'No referring site',
}
/** The game's host, which the dashboard shows with its own report. */
export const GAME_HOST = 'mfi.kivalens.org'

/** The Search start panel's cards (src/lib/searchStages.ts), for home:<stage> actions. */
export const HOME_CARDS: Record<string, string> = {
  link: 'A search from a link',
  back_from_kiva: 'Back from Kiva',
  basket: 'Basket waiting',
  few_results: 'Only a few results',
  new_since: 'Since the last visit',
  continuing: 'Where you left off',
  saved: 'Saved searches',
  lender: 'Their Kiva lending',
  lender_pitch: 'Add a lender ID',
  first_visit: 'First visit',
}

/** A built-in saved search's name is its catalog key. */
export function presetName(key: string): string {
  const name = (en as Record<string, string>)[key]
  return typeof name === 'string' ? name : key
}

/** Everything the dashboard's script needs to name what it shows. */
export function labelsForDashboard(): Record<string, unknown> {
  return {
    criteria: CRITERIA,
    tab: Object.fromEntries([...FIELD_GROUP.entries()].map(([field, group]) => [field, TAB[group]])),
    modes: MODES,
    pages: PAGES,
    events: EVENTS,
    home: HOME_CARDS,
    gameMilestones: GAME_MILESTONES,
    gameViews: GAME_VIEWS,
    gameArrivals: GAME_ARRIVALS,
    gameHost: GAME_HOST,
    presets: Object.fromEntries(
      Object.keys(en)
        .filter((k) => /^[a-z0-9_]+$/.test(k))
        .map((k) => [k, presetName(k)])
        .filter(([k]) => PRESET_KEYS.has(k)),
    ),
  }
}

/** The built-in saved searches (src/stores/criteriaStore.ts DEFAULT_SAVED_SEARCH_NAMES), as the collector knows them. */
export const PRESET_KEYS: ReadonlySet<string> = new Set([
  'expiring_soon',
  'pays_back_fast_ex_short',
  'popular',
  'only_one_more_lender_needed',
  'large_groups_evenly_men_women',
  'countries_i_dont_have',
  'balance_partner_risk',
  'young_parent',
])
