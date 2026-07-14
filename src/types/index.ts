export interface KivaLoan {
  id: number
  name: string
  status: string
  loan_amount: number
  funded_amount: number
  basket_amount: number
  posted_date: string
  sector: string
  activity: string
  use: string
  location: { country: string; country_code: string; geo?: unknown; town?: string }
  borrowers: Borrower[]
  borrower_count: number
  terms: LoanTerms
  description: { languages: string[]; texts: { en?: string } }
  image: { id: number; template_id?: number }
  themes?: string[]
  tags?: Array<{ name: string }>
  planned_expiration_date?: string
  partner_id: number | null
  bonus_credit_eligibility?: boolean
  // KivaLens computed fields
  kl_processed?: Date
  kl_name_arr?: string[]
  kl_posted_date?: Date
  kl_newest_sort?: number
  kl_still_needed?: number
  kl_percent_funded?: number
  kls_tags?: string[]
  kls_age?: number | null
  kls_use_or_descr_arr?: string[]
  kls_has_descr?: boolean
  kls_half_back?: Date | null
  kls_half_back_actual?: number
  kls_75_back?: Date | null
  kls_75_back_actual?: number
  kls_final_repayment?: Date | null
  kls_repaid_in?: number
  kl_repayments?: Repayment[]
  kl_repay_categories?: string[]
  kl_repay_data?: number[]
  kl_repay_percent?: number[]
  kl_percent_women?: number
  kl_planned_expiration_date?: Date
  kl_partner?: Partner | null
  kl_similar?: KivaLoan[]
  kl_background_resync?: number
  kl_dynamicFieldChange?: number
  kl_posted_hours_ago?: () => number
  kl_dollars_per_hour?: () => number
  kl_expiring_in_days?: () => number
  kl_disbursal_in_days?: () => number
  getPartner?: () => Partner | null
  kls?: boolean
  klb?: { M?: number; F?: number }
}

export interface Borrower {
  first_name: string
  last_name?: string
  gender: string
  pictured?: boolean
}

export interface LoanTerms {
  disbursal_date?: string
  repayment_interval?: string
  repayment_term?: number
  loss_liability?: { currency_exchange?: string }
  scheduled_payments?: ScheduledPayment[]
  local_payments?: unknown
  disbursal_currency?: string
  disbursal_amount?: number
  loan_amount?: number
}

export interface ScheduledPayment {
  due_date: string
  amount: number
}

export interface Repayment {
  date: Date
  display: string
  amount: number
  percent?: number
}

export interface Partner {
  id: number
  name: string
  status: string
  countries: Array<{ iso_code: string; name: string; region: string }>
  rating?: number | string
  start_date: string
  default_rate?: number
  delinquency_rate?: number
  portfolio_yield?: number
  profitability?: number
  loans_at_risk_rate?: number
  currency_exchange_loss_rate?: number
  average_loan_size_percent_per_capita_income?: number
  loans_posted?: number
  charges_fees_and_interest?: boolean
  social_performance_strengths?: Array<{ id: number | string }>
  // KivaLens computed
  kl_sp?: (number | string)[]
  kl_regions?: string[]
  kl_years_on_kiva?: number
  kl_name_arr?: string[]
  atheistScore?: AtheistScore
  normalizedReligions?: string[]
}

export interface AtheistScore {
  secularRating: number
  religiousAffiliation: string
  commentsOnSecularRating: string
  socialRating: number
  commentsOnSocialRating: string
  reviewComments: string
}

export interface BasketItem {
  loan_id: number
  amount: number
}

export interface Criteria {
  loan: LoanCriteria
  partner: PartnerCriteria
  portfolio: PortfolioCriteria
}

export interface LoanCriteria {
  sort?: string | null
  [key: string]: unknown
}

export interface PartnerCriteria {
  direct?: string
  [key: string]: unknown
}

export interface PortfolioCriteria {
  exclude_portfolio_loans?: string
  pb_sector?: BalancerConfig
  pb_country?: BalancerConfig
  pb_activity?: BalancerConfig
  pb_partner?: BalancerConfig
  pb_region?: BalancerConfig
  pb_gender?: BalancerConfig
}

export interface BalancerConfig {
  enabled: boolean
  hideshow?: string
  ltgt?: string
  percent?: number
  allactive?: string
  values?: unknown[]
}

export interface ProgressEvent {
  task?: string
  done?: number
  total?: number
  label?: string
  complete?: boolean
  singlePass?: boolean
  title?: string
  percent?: number
  loaded?: number
}

export interface RunningTotals {
  funded_amount: number
  funded_loans: number
  new_loans: number
  expired_loans: number
}
