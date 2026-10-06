import type { Criteria } from '../types'

/**
 * What Reset sets: every loan, MFI and Direct both, the lender's own loans left
 * out, no portfolio balancing. The criteria history describes a search by how
 * it differs from this, so these are never listed as though the lender chose them.
 */
export function freshCriteria(): Criteria {
  return {
    loan: { name: '', use: '' },
    // Every loan: MFI and Direct both. Partner filters apply once MFI only is chosen.
    partner: { direct: 'both' },
    portfolio: {
      exclude_portfolio_loans: 'true',
      pb_sector: { enabled: false },
      pb_country: { enabled: false },
      pb_activity: { enabled: false },
      pb_partner: { enabled: false },
    },
  }
}

/**
 * Reset, then `then` on top of it: the search a caller starts when it means "only
 * this, and nothing left over from the search before". One function, so what a
 * page counts before starting such a search is what the search then finds.
 */
export function freshThen(then?: Criteria): Criteria {
  const fresh = freshCriteria()
  if (!then) return fresh
  return {
    loan: { ...fresh.loan, ...then.loan },
    partner: { ...fresh.partner, ...then.partner },
    portfolio: { ...fresh.portfolio, ...then.portfolio },
  }
}
