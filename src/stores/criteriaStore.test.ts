/**
 * criteriaStore persists the user's search and their saved searches. An early
 * rewrite build lost saved searches here (an empty persisted value overwrote the
 * real set), so the round-trips and the mutation boundaries are worth pinning.
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useCriteriaStore } from './criteriaStore'
import { getKivaLoans } from '../api/kiva'
import type { Criteria, KivaLoan } from '../types'

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

  // Paul, 2026-09-25: "when loading a saved search that requires MFI only, just
  // switch to only MFI … if you select 'balance partner risk' it won't set the MFI
  // only which prevents it from balancing partner risk".
  it('Balance Partner Risk loads in MFI Only, from whatever mode was in force', () => {
    for (const mode of ['both', 'direct', 'mfi']) {
      store().setCriteria(crit({ partner: { direct: mode } }))
      store().loadSearch('balance_partner_risk')
      expect(store().lastKnown.partner.direct, `from ${mode}`).toBe('mfi')
      expect(store().lastKnown.portfolio.pb_partner).toMatchObject({ enabled: true })
    }
  })

  it('a saved search with partner criteria loads in MFI Only even when Both was saved with it', () => {
    store().setCriteria(crit({ partner: { direct: 'both', partners: '246' } }))
    store().saveSearch('test-both-with-a-partner')
    store().setCriteria(crit({ partner: { direct: 'both' }, portfolio: { pb_partner: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, values: [] } } }))
    store().saveSearch('test-both-balancing-partners')
    for (const name of ['test-both-with-a-partner', 'test-both-balancing-partners']) {
      store().startFresh()
      store().loadSearch(name)
      expect(store().lastKnown.partner.direct, name).toBe('mfi')
      expect(store().lastSwitch).toBe(name)
    }
  })

  it('leaves a saved Direct Only alone, and a saved Both with no partner criteria in Both', () => {
    store().setCriteria(crit({ partner: { direct: 'direct', partners: '246' } }))
    store().saveSearch('test-direct-with-a-partner')
    store().setCriteria(crit({ loan: { sector: 'Retail' }, partner: { direct: 'both' } }))
    store().saveSearch('test-both-no-partner')
    store().startFresh()
    store().loadSearch('test-direct-with-a-partner')
    expect(store().lastKnown.partner.direct).toBe('direct')
    store().loadSearch('test-both-no-partner')
    expect(store().lastKnown.partner.direct).toBe('both')
  })

  it('reads a saved search as it runs wherever it is shown, counted, shared or exported', () => {
    store().setCriteria(crit({ partner: { direct: 'both', partners: '246' } }))
    store().saveSearch('test-both-with-a-partner')
    expect(store().getSavedSearch('test-both-with-a-partner')?.partner).toMatchObject({ direct: 'mfi', partners: '246' })
    // What was saved is kept as it was; only the reading follows the rule.
    expect(store().savedSearches['test-both-with-a-partner'].partner).toMatchObject({ direct: 'both' })
  })

  it('counts a saved search in the mode it runs in, and counts one that cannot run as none', async () => {
    const { countSavedSearch } = await import('./criteriaStore')
    const seen: unknown[] = []
    const kl = { filter: (c: unknown) => (seen.push(c), [1, 2, 3]) }
    expect(countSavedSearch(kl, crit({ partner: { direct: 'both', partners: '246' } }))).toBe(3)
    expect(seen[0]).toMatchObject({ partner: { direct: 'mfi', partners: '246' } })
    expect(countSavedSearch({ filter: () => { throw new Error('not loaded') } }, crit())).toBe(0)
  })

  it("waits to count a search while a balancer it applies is still being read from the lender's portfolio", async () => {
    const { countSavedSearch } = await import('./criteriaStore')
    const balancer = (allactive: string) => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive, values: [] })
    const asked: string[] = []
    const kl = (pending: boolean) => ({ filter: () => [1, 2, 3], balancerPending: (slice: string, include: string) => (asked.push(`${slice}:${include}`), pending) })
    // Paul, 2026-09-28: Countries I Don't Have counted every country until the portfolio arrived.
    const countries = crit({ portfolio: { exclude_portfolio_loans: 'true', pb_country: balancer('all') } })
    expect(countSavedSearch(kl(true), countries)).toBeUndefined()
    expect(asked).toEqual(['country:all'])
    expect(countSavedSearch(kl(false), countries)).toBe(3)
    // Balance Partner Risk stored in Both runs in MFI Only, so it waits for the partner slice.
    expect(countSavedSearch(kl(true), crit({ partner: { direct: 'both' }, portfolio: { pb_partner: balancer('active') } }))).toBeUndefined()
    // Nothing to wait for: no balancer, or balance by partner kept in Direct Only, where it applies to nothing.
    expect(countSavedSearch(kl(true), crit({ loan: { sector: 'Retail' } }))).toBe(3)
    expect(countSavedSearch(kl(true), crit({ partner: { direct: 'direct' }, portfolio: { pb_partner: balancer('active') } }))).toBe(3)
  })

  it('matches new loans for a saved search in the mode it loads in', () => {
    store().setCriteria(crit({ partner: { direct: 'both', partners: '246' } }))
    store().saveSearch('test-both-with-a-partner')
    const kl = getKivaLoans()
    const ready = vi.spyOn(kl, 'isReady').mockReturnValue(true)
    try {
      const direct = {
        id: 9001, partner_id: null, status: 'fundraising', funded_amount: 0, loan_amount: 1000,
        location: { country_code: 'US', country: 'United States' }, terms: { repayment_interval: 'Monthly' },
        kls_tags: [], themes: [], borrower_count: 1, kl_percent_women: 100, kl_still_needed: 500,
        kl_percent_funded: 50, kl_name_arr: [], kls_use_or_descr_arr: [], sector: 'Retail', posted_date: '2026-06-01',
      } as unknown as KivaLoan
      // A Direct loan has no field partner, so a partner search cannot be about it.
      expect(store().getMatchingCriteria(direct)).not.toContain('test-both-with-a-partner')
    } finally {
      ready.mockRestore()
    }
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

describe('Reset, then one thing (a partner’s Show loans)', () => {
  it('is what Reset sets plus that thing, in one change the history sees once', () => {
    const changes: Criteria[] = []
    const unsubscribe = useCriteriaStore.subscribe((s, prev) => {
      if (s.lastKnown !== prev.lastKnown) changes.push(s.lastKnown)
    })
    store().setCriteria(crit({ loan: { sector: 'Retail', country_code: 'KE' }, portfolio: { exclude_portfolio_loans: 'false' } }))
    changes.length = 0
    store().startFresh(crit({ partner: { direct: 'mfi', partners: '246' } }))
    unsubscribe()
    expect(changes).toHaveLength(1)
    expect(store().lastKnown.loan).toEqual({ name: '', use: '' })
    expect(store().lastKnown.partner).toEqual({ direct: 'mfi', partners: '246' })
    expect(store().lastKnown.portfolio).toMatchObject({ exclude_portfolio_loans: 'true' })
  })

  it('stops the switcher naming the saved search it replaced, so Re-save cannot overwrite it', () => {
    store().setCriteria(crit({ loan: { sector: 'Retail' } }))
    store().saveSearch('test-reset-switch')
    expect(store().lastSwitch).toBe('test-reset-switch')
    store().startFresh(crit({ partner: { direct: 'mfi', partners: '246' } }))
    expect(store().lastSwitch).toBeNull()
    expect(store().savedSearches['test-reset-switch'].loan).toMatchObject({ sector: 'Retail' })
  })
})

describe('clearing the lender ID keeps every search’s balancers', () => {
  // Paul, 2026-09-29: "Countries I Don't Have" stopped balancing for good. Clearing the
  // lender ID switched off every balancer in every saved search.
  const bal = (over: Record<string, unknown> = {}) => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all', values: ['Kenya'], ...over })

  it('drops only the lists the lender’s portfolio filled in', () => {
    store().setCriteria(crit({ portfolio: { pb_country: bal() } }))
    store().saveSearch('test-my-balancer')
    store().releasePortfolioBalancers()
    for (const c of [store().savedSearches['test-my-balancer'], store().savedSearches.countries_i_dont_have, store().lastKnown]) {
      const b = (c.portfolio as Record<string, Record<string, unknown>>).pb_country
      expect(b).toMatchObject({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' })
      expect(b).not.toHaveProperty('values')
    }
    expect(store().savedSearches.balance_partner_risk.portfolio.pb_partner).toMatchObject({ enabled: true })
  })

  it('puts back the balancer of a built-in portfolio search found switched off, and leaves a lender’s own alone', async () => {
    const { restorePortfolioPresets } = await import('./criteriaStore')
    const saved = {
      countries_i_dont_have: crit({ loan: { limit_to: { enabled: true, count: 1, limit_by: 'Country' } }, portfolio: { exclude_portfolio_loans: 'true', pb_country: bal({ enabled: false, values: undefined }) } }),
      balance_partner_risk: crit({ portfolio: { exclude_portfolio_loans: 'true' } }),
      'my own': crit({ portfolio: { pb_sector: bal({ enabled: false }) } }),
    } as never as Parameters<typeof restorePortfolioPresets>[0]
    expect(restorePortfolioPresets(saved)).toEqual(['countries_i_dont_have', 'balance_partner_risk'])
    const s = saved as unknown as Record<string, { portfolio: Record<string, Record<string, unknown>>; loan: Record<string, unknown> }>
    expect(s.countries_i_dont_have.portfolio.pb_country).toMatchObject({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' })
    expect(s.countries_i_dont_have.loan.limit_to).toMatchObject({ limit_by: 'Country' })
    // Missing altogether: the definition's balancer.
    expect(s.balance_partner_risk.portfolio.pb_partner).toMatchObject({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'active' })
    expect(s['my own'].portfolio.pb_sector).toMatchObject({ enabled: false })
    // Nothing to do the second time.
    expect(restorePortfolioPresets(saved)).toEqual([])
  })

  it('repairs a stored copy when the store loads it (version 2 to 3)', async () => {
    const damaged = { ...store().savedSearches.countries_i_dont_have, portfolio: { exclude_portfolio_loans: 'true', pb_country: { enabled: false, hideshow: 'hide', ltgt: 'gt', percent: 0, allactive: 'all' } } }
    localStorage.setItem('kivalens-criteria', JSON.stringify({ state: { savedSearches: { countries_i_dont_have: damaged }, lastSwitch: null }, version: 2 }))
    await useCriteriaStore.persist.rehydrate()
    expect((store().savedSearches.countries_i_dont_have.portfolio as Record<string, Record<string, unknown>>).pb_country).toMatchObject({ enabled: true })
  })
})
