/**
 * criteriaStore persists the user's search and their saved searches. An early
 * rewrite build lost saved searches here (an empty persisted value overwrote the
 * real set), so the round-trips and the mutation boundaries are worth pinning.
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useCriteriaStore } from './criteriaStore'
import type { Criteria } from '../types'

const store = () => useCriteriaStore.getState()

const crit = (c: Partial<Record<'loan' | 'partner' | 'portfolio', Record<string, unknown>>> = {}): Criteria =>
  ({ loan: {}, partner: {}, portfolio: {}, ...c }) as unknown as Criteria

/** Saved searches are shared module state; keep tests independent. */
let original: Record<string, unknown>
beforeEach(() => {
  original = { ...store().savedSearches }
  for (const name of Object.keys(store().savedSearches)) {
    if (name.startsWith('test-')) store().deleteSearch(name)
  }
  void original
})

describe('stripNullValues', () => {
  it('drops null, undefined and empty-string filters across all three groups', () => {
    const c = crit({
      loan: { sector: 'Retail', activity: null, name: '', age_min: undefined },
      partner: { region: 'me', religion: '' },
      portfolio: { exclude_portfolio_loans: 'true', pb_sector: null },
    })
    store().stripNullValues(c)

    expect(c.loan).toEqual({ sector: 'Retail' })
    expect(c.partner).toEqual({ region: 'me' })
    expect(c.portfolio).toEqual({ exclude_portfolio_loans: 'true' })
  })

  it('keeps falsy values that are real filters (0 and false)', () => {
    const c = crit({ loan: { percent_female_min: 0, bonus_credit_eligibility: false } })
    store().stripNullValues(c)
    expect(c.loan).toEqual({ percent_female_min: 0, bonus_credit_eligibility: false })
  })

  it('tolerates undefined', () => {
    expect(store().stripNullValues(undefined)).toBeUndefined()
  })
})

describe('fixUpgrades (legacy shapes from older saved searches)', () => {
  it('converts an array social_performance to the CSV form', () => {
    const out = store().fixUpgrades(crit({ partner: { social_performance: ['1', '3'] } }))
    expect(out.partner.social_performance).toBe('1,3')
  })

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('converts boolean exclude_portfolio_loans %s to "%s"', (input, expected) => {
    const out = store().fixUpgrades(crit({ portfolio: { exclude_portfolio_loans: input } }))
    expect(out.portfolio.exclude_portfolio_loans).toBe(expected)
  })

  it('does not mutate the criteria it was given', () => {
    const input = crit({ partner: { social_performance: ['1', '3'] } })
    store().fixUpgrades(input)
    expect(input.partner.social_performance).toEqual(['1', '3'])
  })
})

describe('prepForRSS', () => {
  it('never mutates the live criteria', () => {
    const input = crit({ loan: { sector: 'Retail', activity: null } })
    store().prepForRSS(input)
    // activity was null, but the caller's object must be untouched
    expect('activity' in (input.loan as object)).toBe(true)
  })

  it('excludes portfolio filters (they are lender-specific, not feed-able)', () => {
    const out = store().prepForRSS(crit({
      loan: { sector: 'Retail' },
      portfolio: { exclude_portfolio_loans: 'true' },
    }))
    expect(out.portfolio).toBeUndefined()
    expect(out.loan).toEqual({ sector: 'Retail' })
  })

  it('drops a disabled limit_to but keeps an enabled one', () => {
    const off = store().prepForRSS(crit({ loan: { limit_to: { enabled: false, count: 3 } } }))
    expect(off.loan).toBeUndefined() // nothing left -> group omitted

    const on = store().prepForRSS(crit({ loan: { limit_to: { enabled: true, count: 3 } } }))
    expect((on.loan as Record<string, unknown>).limit_to).toEqual({ enabled: true, count: 3 })
  })

  it('omits groups that end up empty', () => {
    const out = store().prepForRSS(crit({ loan: { name: '' }, partner: {} }))
    expect(out.loan).toBeUndefined()
    expect(out.partner).toBeUndefined()
  })
})

describe('saved searches CRUD', () => {
  it('saves the current criteria under a name and reads it back', () => {
    useCriteriaStore.setState({ lastKnown: crit({ loan: { sector: 'Retail' } }) } as never)
    store().saveSearch('test-retail')

    expect(store().getSavedSearchNames()).toContain('test-retail')
    expect(store().getSavedSearch('test-retail')!.loan.sector).toBe('Retail')
    expect(store().lastSwitch).toBe('test-retail')
  })

  it('ignores a blank name', () => {
    const before = store().getSavedSearchNames().length
    store().saveSearch('')
    expect(store().getSavedSearchNames()).toHaveLength(before)
  })

  it('renames a saved search, carrying lastSwitch with it', () => {
    useCriteriaStore.setState({ lastKnown: crit({ loan: { sector: 'Food' } }) } as never)
    store().saveSearch('test-old')
    store().renameSearch('test-old', 'test-new')

    expect(store().getSavedSearchNames()).toContain('test-new')
    expect(store().getSavedSearchNames()).not.toContain('test-old')
    expect(store().getSavedSearch('test-new')!.loan.sector).toBe('Food')
    expect(store().lastSwitch).toBe('test-new')
  })

  it.each([
    ['an empty new name', 'test-keep', '  '],
    ['an unchanged name', 'test-keep', 'test-keep'],
  ])('refuses a rename with %s', (_why, from, to) => {
    useCriteriaStore.setState({ lastKnown: crit({ loan: { sector: 'Arts' } }) } as never)
    store().saveSearch(from)
    store().renameSearch(from, to)
    expect(store().getSavedSearchNames()).toContain(from)
  })

  it('deletes a saved search and clears lastSwitch when it was current', () => {
    useCriteriaStore.setState({ lastKnown: crit({ loan: { sector: 'Health' } }) } as never)
    store().saveSearch('test-del')
    expect(store().lastSwitch).toBe('test-del')

    store().deleteSearch('test-del')
    expect(store().getSavedSearchNames()).not.toContain('test-del')
    expect(store().lastSwitch).toBeNull()
  })

  it('returns undefined for a search that does not exist', () => {
    expect(store().getSavedSearch('test-nope')).toBeUndefined()
  })
})

describe('notifyOnNew toggle (drives RSS/new-loan alerts)', () => {
  it('flips the flag and reports the new value', () => {
    useCriteriaStore.setState({ lastKnown: crit({ loan: { sector: 'Retail' } }) } as never)
    store().saveSearch('test-notify')

    expect(store().toggleNotifyOnNew('test-notify')).toBe(true)
    expect(store().getSavedSearch('test-notify')!.notifyOnNew).toBe(true)
    expect(store().toggleNotifyOnNew('test-notify')).toBe(false)
    expect(store().getSavedSearch('test-notify')!.notifyOnNew).toBe(false)
  })

  it('returns undefined for an unknown search rather than creating one', () => {
    expect(store().toggleNotifyOnNew('test-missing')).toBeUndefined()
    expect(store().getSavedSearchNames()).not.toContain('test-missing')
  })
})

describe('blankCriteria', () => {
  it('produces all three empty groups', () => {
    const b = store().blankCriteria()
    expect(b.loan).toEqual({})
    expect(b.partner).toEqual({})
    expect(b.portfolio).toEqual({})
  })

  it('returns a fresh object each call (no shared reference)', () => {
    const a = store().blankCriteria()
    const b = store().blankCriteria()
    ;(a.loan as Record<string, unknown>).sector = 'Retail'
    expect(b.loan).toEqual({})
  })
})

describe('MFI or Direct: the mode is written in as criteria arrive', () => {
  it('writes the mode an old search implies, and leaves a written one alone', async () => {
    const { withPartnerMode } = await import('./criteriaStore')
    expect(withPartnerMode(crit()).partner).toMatchObject({ direct: 'both' })
    expect(withPartnerMode(crit({ partner: { region: 'af' } })).partner).toMatchObject({ direct: 'mfi', region: 'af' })
    // Already written: the SAME object back, so the store-to-panel sync settles.
    const written = crit({ partner: { direct: 'both', region: 'af' } })
    expect(withPartnerMode(written)).toBe(written)
  })

  it('Reset shows every loan: MFI and Direct both', () => {
    store().startFresh()
    expect(store().lastKnown.partner).toMatchObject({ direct: 'both' })
  })

  it('an old saved search with a partner filter loads as MFI Only; one without, as Both', () => {
    expect(store().fixUpgrades(crit({ partner: { partner_risk_rating_min: 4 } })).partner.direct).toBe('mfi')
    expect(store().fixUpgrades(crit({ loan: { sector: 'Retail' } })).partner.direct).toBe('both')
  })

  it("keeps 'both' through the cleanup that drops empty values", () => {
    const c = crit({ partner: { direct: 'both', region: 'af', religion: '' } })
    store().stripNullValues(c)
    expect(c.partner).toEqual({ direct: 'both', region: 'af' })
  })

  it('an RSS link outside MFI Only carries no partner filters, so it cannot become MFI-only', () => {
    const kept = { region: 'af', partner_risk_rating_min: 4 }
    // Both: no partner group at all — which reads back as Both.
    expect(store().prepForRSS(crit({ partner: { direct: 'both', ...kept } })).partner).toBeUndefined()
    expect(store().prepForRSS(crit({ partner: { direct: 'direct', ...kept } })).partner).toEqual({ direct: 'direct' })
    // In MFI Only they are the point of the feed, and the mode travels with them.
    expect(store().prepForRSS(crit({ partner: { direct: 'mfi', ...kept } })).partner).toEqual({ direct: 'mfi', ...kept })
    // An old search is written as the mode it implies.
    expect(store().prepForRSS(crit({ partner: kept })).partner).toEqual({ direct: 'mfi', ...kept })
    expect(store().prepForRSS(crit({ loan: { sector: 'Retail' } })).partner).toBeUndefined()
  })
})
