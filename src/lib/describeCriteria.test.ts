import { describe, expect, it } from 'vitest'
import type { Criteria } from '../types'
import { criteriaDetails, criteriaSummary, describeCriteria, type DescribeDeps } from './describeCriteria'
import { freshCriteria } from './freshCriteria'
import { translate } from '../i18n'

const t = (key: string, params?: Record<string, string | number>) => translate('en', key, params)
const deps: DescribeDeps = { t, data: (s) => s, partnerName: (id) => ({ '246': 'ADICLA' })[id] }
const withFresh = (c: Partial<Record<keyof Criteria, Record<string, unknown>>>): Criteria => {
  const f = freshCriteria()
  return {
    loan: { ...f.loan, ...c.loan },
    partner: { ...f.partner, ...c.partner },
    portfolio: { ...f.portfolio, ...c.portfolio },
  } as Criteria
}
const text = (c: Criteria) => criteriaSummary(describeCriteria(c, deps), t)

describe('a search in words', () => {
  it('says nothing of what Reset sets', () => {
    expect(describeCriteria(freshCriteria(), deps)).toEqual([])
    expect(text(freshCriteria())).toBe('No filters')
  })

  it('names countries and field partners, not their codes', () => {
    expect(text(withFresh({ loan: { country_code: 'KE,UG' } }))).toBe('Country: Kenya, Uganda')
    expect(text(withFresh({ partner: { direct: 'mfi', partners: '246,999' } }))).toBe('MFI / Direct: MFI Only · Field partner: ADICLA, #999')
  })

  it('says when a list excludes its values, or needs all of them', () => {
    expect(text(withFresh({ loan: { sector: 'Food', sector_all_any_none: 'none' } }))).toBe('Sector: not Food')
    expect(text(withFresh({ loan: { themes: 'Water,Youth', themes_all_any_none: 'all' } }))).toContain('all of Water, Youth')
  })

  it('includes the sort, and letting in loans the lender funded', () => {
    expect(text(withFresh({ loan: { sort: 'newest' } }))).toBe('Sort: Newest')
    expect(text(withFresh({ portfolio: { exclude_portfolio_loans: 'false' } }))).toBe(`${t('exclude_my_loans')}: ${t('no_include_loans_ive_made')}`)
  })

  it('writes a label alone where the label says it all', () => {
    // A balancer is no longer such a line: it says what it does (portfolio balancers in words, below).
    const lines = describeCriteria(withFresh({ loan: { limit_to: { enabled: true, count: 1, limit_by: 'Country' } } }), deps)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ label: 'Limit to 1 per Country', value: null })
  })

  it('gives the hover every line on its own', () => {
    const lines = describeCriteria(withFresh({ loan: { sector: 'Food', name: 'jane' } }), deps)
    expect(criteriaDetails(lines, t)).toBe('Sector: Food\nName: jane')
    expect(criteriaSummary(lines, t)).toBe('Sector: Food · Name: jane')
  })
})

describe('portfolio balancers in words', () => {
  // Paul, 2026-09-29: "the criteria summary isn't complete. it leaves out PB crits."
  const bal = (over: Record<string, unknown> = {}) => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all', ...over })
  const withPortfolio = (portfolio: Record<string, unknown>, partner: Record<string, unknown> = {}): Criteria => {
    const f = freshCriteria()
    return { ...f, partner: { ...f.partner, ...partner }, portfolio: { ...f.portfolio, ...portfolio } } as Criteria
  }

  it('lists every enabled balancer, in the order the Portfolio tab shows them', () => {
    const all = Object.fromEntries(['pb_partner', 'pb_country', 'pb_region', 'pb_sector', 'pb_activity', 'pb_gender'].map((k) => [k, bal()]))
    const labels = describeCriteria(withPortfolio(all, { direct: 'mfi' }), deps).filter((l) => l.id.startsWith('portfolio.pb_')).map((l) => l.label)
    expect(labels).toEqual(['Balancer: partner', 'Balancer: country', 'Balancer: region', 'Balancer: sector', 'Balancer: activity', 'Balancer: gender'])
  })

  it('says what each one does', () => {
    const line = (b: Record<string, unknown>) => describeCriteria(withPortfolio({ pb_country: b }), deps).find((l) => l.id === 'portfolio.pb_country')!
    expect(line(bal())).toEqual({ id: 'portfolio.pb_country', label: 'Balancer: country', value: 'hide those already in my total portfolio' })
    expect(line(bal({ hideshow: 'show', allactive: 'active' })).value).toBe('only those already in my active portfolio')
    expect(line(bal({ percent: 5 })).value).toBe('hide those with more than 5% of my total portfolio')
    expect(line(bal({ hideshow: 'show', ltgt: 'lt', percent: 5, allactive: 'active' })).value).toBe('only those with less than 5% of my active portfolio')
    expect(line(bal({ ltgt: 'lt', percent: 10 })).value).toBe('hide those with less than 10% of my total portfolio')
    expect(line(bal({ hideshow: 'show', percent: 20 })).value).toBe('only those with more than 20% of my total portfolio')
    // Read the way the filter reads it: no percent is 0, so more than none is any.
    expect(line({ enabled: true, hideshow: 'hide', ltgt: 'gt' }).value).toBe('hide those already in my total portfolio')
  })

  it('says how many that is for the lender now, once their portfolio has been read', () => {
    const seen: string[] = []
    const withCount = { ...deps, balancerCount: (slice: string, b: { allactive?: string }) => (seen.push(`${slice}:${b.allactive}`), slice === 'country' ? 79 : undefined) }
    const lines = describeCriteria(withPortfolio({ pb_country: bal(), pb_sector: bal({ hideshow: 'show' }) }), withCount)
    expect(lines.find((l) => l.id === 'portfolio.pb_country')!.value).toBe('hide those already in my total portfolio · hidden now: 79')
    expect(lines.find((l) => l.id === 'portfolio.pb_sector')!.value).toBe('only those already in my total portfolio')
    expect(seen).toEqual(['country:all', 'sector:all'])
  })

  it('leaves balance by partner out where it applies to nothing', () => {
    expect(describeCriteria(withPortfolio({ pb_partner: bal() }, { direct: 'both' }), deps).some((l) => l.id === 'portfolio.pb_partner')).toBe(false)
  })
})

describe('a line in one piece', () => {
  it('puts a dash, not a second colon, after a label that has its own', async () => {
    const { lineText } = await import('./describeCriteria')
    expect(lineText({ id: 'loan.sector', label: 'Sector', value: 'Food' })).toBe('Sector: Food')
    expect(lineText({ id: 'portfolio.pb_country', label: 'Balancer: country', value: 'hide those' })).toBe('Balancer: country — hide those')
    expect(lineText({ id: 'portfolio.pb_country', label: 'バランサー：国', value: '非表示' })).toBe('バランサー：国 — 非表示')
    expect(lineText({ id: 'loan.limit_to', label: 'Limit to 1 per Country', value: null })).toBe('Limit to 1 per Country')
  })
})
