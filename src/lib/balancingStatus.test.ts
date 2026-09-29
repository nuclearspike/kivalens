import { describe, expect, it } from 'vitest'
import { enabledBalancers, lenderIdNeeds } from './balancingStatus'
import type { Criteria } from '../types'

/**
 * Paul, 2026-09-29: "when a filter selection requires a lender id, it should never
 * be hidden from the user." lenderIdNeeds is the one rule every place that says so
 * reads: the notice above the results, the line under the count, the list tags and
 * Ask KivaLens.
 */

const bal = (over: Record<string, unknown> = {}) => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all', ...over })
const crit = (portfolio: Record<string, unknown>, partner: Record<string, unknown> = {}) => ({ loan: {}, partner, portfolio }) as unknown as Criteria

describe('what a search cannot do without a lender ID', () => {
  it('names every balancer the search applies, in the Portfolio tab order, and Exclude My Loans', () => {
    expect(lenderIdNeeds(crit({ exclude_portfolio_loans: 'true', pb_sector: bal(), pb_country: bal() }), '')).toEqual({
      balancing: ['country', 'sector'],
      excludeMine: true,
    })
    expect(lenderIdNeeds(crit({ pb_gender: bal(), pb_region: bal({ enabled: false }) }), null)).toEqual({ balancing: ['gender'], excludeMine: false })
  })

  it('counts balance by partner only in MFI Only, the one mode it applies in', () => {
    expect(lenderIdNeeds(crit({ pb_partner: bal() }, { direct: 'mfi' }), '').balancing).toEqual(['partner'])
    // Unset means MFI Only once balance by partner is on.
    expect(lenderIdNeeds(crit({ pb_partner: bal() }), '').balancing).toEqual(['partner'])
    expect(lenderIdNeeds(crit({ pb_partner: bal() }, { direct: 'both' }), '').balancing).toEqual([])
    expect(lenderIdNeeds(crit({ pb_partner: bal() }, { direct: 'direct' }), '').balancing).toEqual([])
  })

  it('needs nothing once an ID is set, and nothing for a search that uses neither', () => {
    expect(lenderIdNeeds(crit({ exclude_portfolio_loans: 'true', pb_country: bal() }), 'jane')).toEqual({ balancing: [], excludeMine: false })
    expect(lenderIdNeeds(crit({ exclude_portfolio_loans: 'false' }), '')).toEqual({ balancing: [], excludeMine: false })
    expect(lenderIdNeeds(undefined, '')).toEqual({ balancing: [], excludeMine: false })
  })
})

describe('the balancers the note under the count names follow the same rule', () => {
  it('leaves out balance by partner outside MFI Only', () => {
    expect(enabledBalancers(crit({ pb_partner: bal({ allactive: 'active' }), pb_country: bal() }, { direct: 'mfi' }))).toEqual([
      { sliceBy: 'partner', include: 'active' },
      { sliceBy: 'country', include: 'all' },
    ])
    expect(enabledBalancers(crit({ pb_partner: bal(), pb_country: bal() }, { direct: 'both' }))).toEqual([{ sliceBy: 'country', include: 'all' }])
  })
})
