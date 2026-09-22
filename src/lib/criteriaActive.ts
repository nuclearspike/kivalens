import type { Criteria, BalancerConfig } from '../types'
import { humanize } from './utils'
import en from '../i18n/locales/en'
import { resolvePartnerMode } from '../../server/loanFilter.mjs'

// `limit_by`'s VALUE ('Partner' / 'Country' / 'Sector' / 'Activity') is persisted
// criteria data and must stay exactly as-is; this maps it to the catalog key
// for its DISPLAY label. Shared with CriteriaTabs' LimitResultRow so the two
// can't drift.
export const LIMIT_BY_LABEL_KEY: Record<string, string> = {
  Partner: 'partner_2', Country: 'country_2', Sector: 'sector_2', Activity: 'activity_2',
}

/**
 * One active filter the user can remove with a single click. `without` returns a
 * NEW Criteria with this filter dropped, so the caller can both preview the
 * resulting count (filter on it) and apply it (setCriteria).
 */
export interface ActiveCrit {
  id: string
  /** Translation key. May be parameterized (see labelParams). */
  label: string
  /**
   * Params for a parameterized `label` (e.g. "Limit to {count} per {group}").
   * String params are themselves translation keys — the renderer translates them.
   */
  labelParams?: Record<string, string | number>
  value: string
  /**
   * How the listed values combine. Without this the summary cannot tell an
   * INCLUDE filter from an EXCLUDE one: "Sector: Retail" rendered identically
   * whether the user was filtering TO Retail or hiding it.
   */
  modifier?: 'all' | 'none'
  without: (c: Criteria) => Criteria
}

/** 'none' (exclude) and 'all' (must have every value) change what the filter MEANS. */
function modifierOf(raw: unknown): 'all' | 'none' | undefined {
  const m = String(raw ?? '')
  return m === 'none' || m === 'all' ? m : undefined
}

// Values are catalog keys (src/i18n/locales/en.ts), rendered via t(label).
const LOAN_MULTI: Record<string, string> = {
  sector: 'sector_2',
  activity: 'activity_2',
  country_code: 'country_2',
  themes: 'theme',
  tags: 'tag',
}
const LOAN_RANGE: Record<string, string> = {
  age: 'age',
  percent_female: 'percent_women',
  still_needed: 'still_needed_dollar',
  loan_amount: 'loan_amount_dollar',
  repaid_in: 'repaid_mo',
  borrower_count: 'borrowers',
  percent_funded: 'percent_funded',
  expiring_in_days: 'expiring_days',
  disbursal_in_days: 'disbursal_days',
  dollars_per_hour: 'dollar_hour',
}
const LOAN_SINGLE: Record<string, string> = {
  bonus_credit_eligibility: 'bonus_credit',
  repayment_interval: 'repayment',
  currency_exchange_loss_liability: 'currency_loss',
}
const PARTNER_FIELD: Record<string, string> = {
  region: 'region_2',
  social_performance: 'social_performance',
  religion: 'religion',
  partners: 'field_partner',
  charges_fees_and_interest: 'charges_fees',
}
// The value shown for the MFI/Direct mode is the ENGLISH label text, because the
// panel translates every value by its English text (translateData).
const MODE_VALUE: Record<string, string> = { mfi: en.mfi_only, direct: en.direct_only }

function clone(c: Criteria): Criteria {
  return {
    loan: { ...c.loan },
    partner: { ...c.partner },
    portfolio: { ...c.portfolio },
  }
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/** Enumerate the filters currently constraining the search, most-specific first. */
export function activeCriteria(c: Criteria): ActiveCrit[] {
  const out: ActiveCrit[] = []
  const loan = c.loan || {}
  const partner = c.partner || {}
  const portfolio = c.portfolio || {}

  // loan multi-selects
  for (const [k, label] of Object.entries(LOAN_MULTI)) {
    const v = loan[k]
    if (typeof v === 'string' && v.trim()) {
      out.push({
        id: `loan.${k}`,
        label,
        value: v.split(',').join(', '),
        modifier: modifierOf(loan[`${k}_all_any_none`]),
        without: (cc) => {
          const n = clone(cc)
          delete n.loan[k]
          delete n.loan[`${k}_all_any_none`]
          return n
        },
      })
    }
  }

  // loan ranges (group min/max into one removable filter)
  for (const [base, label] of Object.entries(LOAN_RANGE)) {
    const min = loan[`${base}_min`]
    const max = loan[`${base}_max`]
    if (min != null || max != null) {
      out.push({
        id: `loan.${base}`,
        label,
        value: `${min ?? '–'} – ${max ?? '–'}`,
        without: (cc) => {
          const n = clone(cc)
          delete n.loan[`${base}_min`]
          delete n.loan[`${base}_max`]
          return n
        },
      })
    }
  }

  // loan singles + free text
  for (const [k, label] of Object.entries(LOAN_SINGLE)) {
    const v = loan[k]
    if (v != null && v !== '') {
      out.push({ id: `loan.${k}`, label, value: fmt(v), without: (cc) => { const n = clone(cc); delete n.loan[k]; return n } })
    }
  }
  for (const k of ['name', 'use']) {
    const v = loan[k]
    if (typeof v === 'string' && v.trim()) {
      out.push({ id: `loan.${k}`, label: k === 'name' ? 'name' : 'use_description_2', value: v, without: (cc) => { const n = clone(cc); delete n.loan[k]; return n } })
    }
  }

  // limit_to (diversification cap). The cap is user-set — read it, never assume 1.
  const lt = loan.limit_to as { enabled?: boolean; count?: number; limit_by?: string } | undefined
  if (lt && lt.enabled) {
    const n = Number(lt.count)
    out.push({
      id: 'loan.limit_to',
      label: 'limit_count_per_group',
      labelParams: { count: Number.isFinite(n) && n > 0 ? n : 1, group: LIMIT_BY_LABEL_KEY[lt.limit_by ?? ''] ?? 'partner_2' },
      value: 'on',
      without: (cc) => { const c2 = clone(cc); delete c2.loan.limit_to; return c2 },
    })
  }

  // MFI or Direct. Both is no filter at all. MFI Only and Direct Only are, and
  // removing either means going back to Both — not deleting the value, which on a
  // search saved before the modes existed would resolve straight back to MFI Only.
  const mode = resolvePartnerMode(c)
  if (mode !== 'both') {
    out.push({
      id: 'partner.direct',
      label: 'mfi_direct',
      value: MODE_VALUE[mode],
      without: (cc) => {
        const n = clone(cc)
        n.partner = { ...n.partner, direct: 'both' }
        return n
      },
    })
  }
  // Partner criteria apply only in MFI Only. In Both and Direct Only they are kept
  // but change nothing, so offering to remove one would promise results it cannot give.
  const partnerApplies = mode === 'mfi'

  // partner fields
  for (const [k, label] of Object.entries(PARTNER_FIELD)) {
    if (!partnerApplies) break
    const v = partner[k]
    if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
      out.push({ id: `partner.${k}`, label, value: fmt(v), modifier: modifierOf(partner[`${k}_all_any_none`]), without: (cc) => { const n = clone(cc); delete n.partner[k]; delete n.partner[`${k}_all_any_none`]; return n } })
    }
  }
  // partner ranges
  const partnerBases = new Set<string>()
  for (const k of Object.keys(partner)) {
    const m = k.match(/^(.+)_(min|max)$/)
    if (m) partnerBases.add(m[1])
  }
  for (const base of partnerApplies ? partnerBases : []) {
    const min = partner[`${base}_min`]
    const max = partner[`${base}_max`]
    // Match the loan-range guard: a present-but-empty bound is not a filter.
    if (min == null && max == null) continue
    out.push({ id: `partner.${base}`, label: humanize(base), value: `${min ?? '–'} – ${max ?? '–'}`, without: (cc) => { const n = clone(cc); delete n.partner[`${base}_min`]; delete n.partner[`${base}_max`]; return n } })
  }

  // portfolio: exclude loans I funded
  if (portfolio.exclude_portfolio_loans === 'true') {
    out.push({ id: 'portfolio.exclude', label: 'exclude_loans_i_funded', value: 'on', without: (cc) => { const n = clone(cc); n.portfolio = { ...n.portfolio, exclude_portfolio_loans: 'false' }; return n } })
  }
  // portfolio balancers
  for (const pb of ['pb_sector', 'pb_country', 'pb_activity', 'pb_partner', 'pb_region', 'pb_gender'] as const) {
    const b = portfolio[pb] as BalancerConfig | undefined
    // Balance by partner is partner-side: kept but inert outside MFI Only.
    if (pb === 'pb_partner' && !partnerApplies) continue
    if (b && b.enabled) {
      out.push({ id: `portfolio.${pb}`, label: `balancer_${pb.replace('pb_', '')}`, value: 'on', without: (cc) => { const n = clone(cc); n.portfolio = { ...n.portfolio, [pb]: { ...b, enabled: false } }; return n } })
    }
  }

  return out
}
