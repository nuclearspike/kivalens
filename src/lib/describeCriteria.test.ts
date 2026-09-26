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
    const lines = describeCriteria(withFresh({ portfolio: { pb_sector: { enabled: true } } }), deps)
    expect(lines).toHaveLength(1)
    expect(lines[0].value).toBeNull()
  })

  it('gives the hover every line on its own', () => {
    const lines = describeCriteria(withFresh({ loan: { sector: 'Food', name: 'jane' } }), deps)
    expect(criteriaDetails(lines, t)).toBe('Sector: Food\nName: jane')
    expect(criteriaSummary(lines, t)).toBe('Sector: Food · Name: jane')
  })
})
