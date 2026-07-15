import type { Criteria, BalancerConfig } from '../types'
import { humanize } from './utils'

/**
 * One active filter the user can remove with a single click. `without` returns a
 * NEW Criteria with this filter dropped, so the caller can both preview the
 * resulting count (filter on it) and apply it (setCriteria).
 */
export interface ActiveCrit {
  id: string
  label: string
  value: string
  without: (c: Criteria) => Criteria
}

const LOAN_MULTI: Record<string, string> = {
  sector: 'Sector',
  activity: 'Activity',
  country_code: 'Country',
  themes: 'Theme',
  tags: 'Tag',
}
const LOAN_RANGE: Record<string, string> = {
  age: 'Age',
  percent_female: '% Women',
  still_needed: 'Still needed ($)',
  loan_amount: 'Loan amount ($)',
  repaid_in: 'Repaid in (mo)',
  borrower_count: 'Borrowers',
  percent_funded: '% Funded',
  expiring_in_days: 'Expiring (days)',
  disbursal_in_days: 'Disbursal (days)',
  dollars_per_hour: '$/hour',
}
const LOAN_SINGLE: Record<string, string> = {
  bonus_credit_eligibility: 'Bonus credit',
  repayment_interval: 'Repayment',
  currency_exchange_loss_liability: 'Currency loss',
}
const PARTNER_FIELD: Record<string, string> = {
  region: 'Region',
  social_performance: 'Social performance',
  religion: 'Religion',
  partners: 'Field partner',
  direct: 'MFI / Direct',
  charges_fees_and_interest: 'Charges fees',
}

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
      out.push({ id: `loan.${k}`, label: k === 'name' ? 'Name' : 'Use/Description', value: v, without: (cc) => { const n = clone(cc); delete n.loan[k]; return n } })
    }
  }

  // limit_to (diversification cap)
  const lt = loan.limit_to as { enabled?: boolean; limit_by?: string } | undefined
  if (lt && lt.enabled) {
    out.push({ id: 'loan.limit_to', label: `Limit to 1 per ${lt.limit_by || 'Partner'}`, value: 'on', without: (cc) => { const n = clone(cc); delete n.loan.limit_to; return n } })
  }

  // partner fields
  for (const [k, label] of Object.entries(PARTNER_FIELD)) {
    const v = partner[k]
    if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
      out.push({ id: `partner.${k}`, label, value: fmt(v), without: (cc) => { const n = clone(cc); delete n.partner[k]; delete n.partner[`${k}_all_any_none`]; return n } })
    }
  }
  // partner ranges
  const partnerBases = new Set<string>()
  for (const k of Object.keys(partner)) {
    const m = k.match(/^(.+)_(min|max)$/)
    if (m) partnerBases.add(m[1])
  }
  for (const base of partnerBases) {
    const min = partner[`${base}_min`]
    const max = partner[`${base}_max`]
    out.push({ id: `partner.${base}`, label: humanize(base), value: `${min ?? '–'} – ${max ?? '–'}`, without: (cc) => { const n = clone(cc); delete n.partner[`${base}_min`]; delete n.partner[`${base}_max`]; return n } })
  }

  // portfolio: exclude loans I funded
  if (portfolio.exclude_portfolio_loans === 'true') {
    out.push({ id: 'portfolio.exclude', label: 'Exclude loans I funded', value: 'on', without: (cc) => { const n = clone(cc); n.portfolio = { ...n.portfolio, exclude_portfolio_loans: 'false' }; return n } })
  }
  // portfolio balancers
  for (const pb of ['pb_sector', 'pb_country', 'pb_activity', 'pb_partner', 'pb_region', 'pb_gender'] as const) {
    const b = portfolio[pb] as BalancerConfig | undefined
    if (b && b.enabled) {
      out.push({ id: `portfolio.${pb}`, label: `Balancer: ${pb.replace('pb_', '')}`, value: 'on', without: (cc) => { const n = clone(cc); n.portfolio = { ...n.portfolio, [pb]: { ...b, enabled: false } }; return n } })
    }
  }

  return out
}
