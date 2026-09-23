import { describe, it, expect } from 'vitest'
import {
  criteriaFromParams,
  criteriaToParams,
  criteriaToSearch,
  hasCriteriaParams,
  isCriteriaParam,
  withCriteria,
} from '../../server/criteriaUrl.mjs'
import { FIELD_GROUP } from '../../server/criteriaFields.mjs'
import { parseSearchPreset } from './searchPreset'
import { resolvePartnerMode } from '../../server/loanFilter.mjs'
import type { Criteria } from '../types'

const read = (search: string) => criteriaFromParams(new URLSearchParams(search.replace(/^\?/, '')))
const roundTrip = (c: Criteria) => read(criteriaToSearch(c))

describe('a search written as an address', () => {
  it('names the fields, so the address says what it filters', () => {
    expect(
      criteriaToSearch({
        loan: { country_code: 'KE,UG', sector: 'Agriculture', age_min: 18, age_max: 40 },
        partner: { direct: 'mfi' },
        portfolio: {},
      }),
    ).toBe('?country_code=KE,UG&sector=Agriculture&age=18..40&direct=mfi')
  })

  it('writes `:` and `,` as themselves, which a query allows', () => {
    const search = criteriaToSearch({
      loan: { country_code: 'KE,UG', country_code_all_any_none: 'all' },
      partner: {},
      portfolio: {},
    })
    expect(search).toBe('?country_code=all:KE,UG')
    expect(search).not.toContain('%3A')
    expect(search).not.toContain('%2C')
  })

  it('writes an untouched search as nothing at all', () => {
    expect(criteriaToSearch({ loan: {}, partner: {}, portfolio: {} })).toBe('')
    expect(criteriaToSearch(null)).toBe('')
  })

  it('leaves out a half-empty range end', () => {
    expect(criteriaToSearch({ loan: { still_needed_min: 25 }, partner: {}, portfolio: {} })).toBe(
      '?still_needed=25..',
    )
    expect(criteriaToSearch({ loan: { expiring_in_days_max: 3 }, partner: {}, portfolio: {} })).toBe(
      '?expiring_in_days=..3',
    )
  })

  it('writes a balancer only when it is on', () => {
    const on = { enabled: true, hideshow: 'show', ltgt: 'gt', percent: 15, allactive: 'active' }
    expect(criteriaToSearch({ loan: {}, partner: {}, portfolio: { pb_country: on } })).toBe(
      '?pb_country=show:gt:15:active',
    )
    expect(
      criteriaToSearch({ loan: {}, partner: {}, portfolio: { pb_country: { ...on, enabled: false } } }),
    ).toBe('')
  })
})

describe('the address read back', () => {
  const searches: Array<[string, Criteria]> = [
    [
      'the default Expiring Soon',
      {
        loan: { sort: 'expiring', still_needed_min: 25, expiring_in_days_max: 3 },
        partner: {},
        portfolio: { exclude_portfolio_loans: 'true' },
      },
    ],
    [
      'a list with a mode, a range and a partner mode',
      {
        loan: { country_code: 'KE,UG', country_code_all_any_none: 'all', age_min: 18, age_max: 40 },
        partner: { direct: 'mfi' },
        portfolio: {},
      },
    ],
    ['an exact amount', { loan: { still_needed_min: 25, still_needed_max: 25 }, partner: {}, portfolio: {} }],
    [
      'a negative partner range',
      { loan: {}, partner: { profit_min: -5, profit_max: 10 }, portfolio: {} },
    ],
    [
      'every balancer setting',
      {
        loan: {},
        partner: {},
        portfolio: {
          pb_country: { enabled: true, hideshow: 'show', ltgt: 'gt', percent: 15, allactive: 'active' },
          pb_sector: { enabled: true, hideshow: 'hide', ltgt: 'lt', percent: 10, allactive: 'all' },
        },
      },
    ],
    [
      'a per-partner limit',
      { loan: { limit_to: { enabled: true, count: 3, limit_by: 'Partner' } }, partner: {}, portfolio: {} },
    ],
    ['free text that happens to contain both separators', { loan: { use: 'beads, thread: blue', name: 'Maria, Juan' }, partner: {}, portfolio: {} }],
    ['a free-text field beginning with a mode word', { loan: { use: 'all: weaving' }, partner: {}, portfolio: {} }],
  ]

  it.each(searches)('survives the round trip: %s', (_label, criteria) => {
    expect(roundTrip(criteria)).toEqual(criteria)
  })

  it('says an address with no search fields describes no search', () => {
    expect(read('')).toBeNull()
    expect(read('?utm_source=news&tab=partner')).toBeNull()
    expect(hasCriteriaParams(new URLSearchParams('utm_source=news'))).toBe(false)
    expect(hasCriteriaParams(new URLSearchParams('sector=Retail'))).toBe(true)
  })

  it('reads a bare number on a range as exactly that', () => {
    expect(read('?still_needed=25')).toEqual({
      loan: { still_needed_min: 25, still_needed_max: 25 },
      partner: {},
      portfolio: {},
    })
  })

  it('fills a balancer setting that was left out', () => {
    expect(read('?pb_sector=show')).toEqual({
      loan: {},
      partner: {},
      portfolio: {
        pb_sector: { enabled: true, hideshow: 'show', ltgt: 'lt', percent: 10, allactive: 'all' },
      },
    })
  })
})

describe('an address a lender typed, or that went stale', () => {
  it('ignores a parameter that names no field, rather than failing the address', () => {
    expect(read('?sector=Retail&utm_source=news&nonsense=1')).toEqual({
      loan: { sector: 'Retail' },
      partner: {},
      portfolio: {},
    })
  })

  it('drops one unreadable field and keeps the rest of the link', () => {
    // A range that is not numbers, a mode that is not a mode, a balancer part
    // that is not one of its values, a limit outside its bounds.
    expect(read('?sector=Retail&age=old..older&pb_country=sideways&limit_to=0:Partner&direct=sideways')).toEqual({
      loan: { sector: 'Retail' },
      partner: {},
      portfolio: {},
    })
  })

  it('drops a range whichever end is unreadable, never half of one', () => {
    // Half a range is a different filter from the one that was sent: a lender
    // would be shown results nobody asked for, with nothing to say so.
    expect(read('?sector=Retail&age=bad..40')).toEqual({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    expect(read('?sector=Retail&age=18..bad')).toEqual({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    expect(read('?sector=Retail&age=bad..bad')).toEqual({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    // An end left out on purpose is not unreadable.
    expect(read('?age=18..')).toEqual({ loan: { age_min: 18 }, partner: {}, portfolio: {} })
    expect(read('?age=..40')).toEqual({ loan: { age_max: 40 }, partner: {}, portfolio: {} })
  })

  it('refuses a percent outside its range and a limit_by that is not a thing', () => {
    expect(read('?pb_country=show:gt:900:all')).toBeNull()
    expect(read('?limit_to=3:Nonsense')).toBeNull()
  })

  it('refuses a value longer than a field may hold', () => {
    expect(read(`?use=${'x'.repeat(1001)}`)).toBeNull()
    expect(read(`?use=${'x'.repeat(1000)}`)).not.toBeNull()
  })

  it('never puts a field in the wrong group, whatever the address claims', () => {
    const all = Object.fromEntries([...FIELD_GROUP.keys()].map((f) => [f, 'x']))
    const result = read(`?${new URLSearchParams(all).toString()}`)
    for (const group of ['loan', 'partner', 'portfolio'] as const) {
      for (const key of Object.keys(result?.[group] ?? {})) {
        const base = key.replace(/_(min|max)$/, '')
        expect(FIELD_GROUP.get(base) ?? FIELD_GROUP.get(key)).toBe(group)
      }
    }
  })
})

describe('what an address may write into the app', () => {
  it('produces only what the Lite handoff validator would also accept', () => {
    // The handoff validator (src/lib/searchPreset.ts) is the existing boundary on
    // what a link may set. Anything this decoder yields has to clear it too, so
    // two independent checks agree on the same shape.
    const addresses = [
      '?sort=expiring&still_needed=25..&expiring_in_days=..3&exclude_portfolio_loans=true',
      '?country_code=all:KE,UG&age=18..40&direct=mfi',
      '?pb_country=show:gt:15:active&pb_gender=hide:lt:10:all',
      '?limit_to=3:Partner&partner_risk_rating=2..5',
      '?nonsense=1&sector=Retail&__proto__=x&constructor=y',
    ]
    for (const address of addresses) {
      const decoded = read(address)
      expect(decoded).not.toBeNull()
      expect(parseSearchPreset(JSON.stringify(decoded))).toEqual(decoded)
    }
  })

  it('cannot smuggle a prototype key into the search', () => {
    const decoded = read('?__proto__=x&constructor=y&prototype=z&sector=Retail')
    expect(decoded).toEqual({ loan: { sector: 'Retail' }, partner: {}, portfolio: {} })
    expect(Object.keys(decoded!.loan)).toEqual(['sector'])
  })
})

describe('an address that is not only a search', () => {
  it('keeps what does not belong to the search, and replaces what does', () => {
    const params = new URLSearchParams('utm_source=news&tab=partner&sector=OldValue')
    expect(withCriteria(params, { loan: { sector: 'Retail' }, partner: {}, portfolio: {} })).toBe(
      '?utm_source=news&tab=partner&sector=Retail',
    )
  })

  it('clears the search and keeps the rest when nothing is filtered', () => {
    const params = new URLSearchParams('utm_source=news&sector=Retail&age=18..40')
    expect(withCriteria(params, { loan: {}, partner: {}, portfolio: {} })).toBe('?utm_source=news')
  })

  it('knows which parameters are its own', () => {
    expect(isCriteriaParam('sector')).toBe(true)
    expect(isCriteriaParam('pb_country')).toBe(true)
    expect(isCriteriaParam('direct')).toBe(true)
    expect(isCriteriaParam('utm_source')).toBe(false)
    expect(isCriteriaParam('tab')).toBe(false)
    expect(isCriteriaParam('import')).toBe(false)
    expect(isCriteriaParam('lender')).toBe(false)
  })
})

describe('the registry', () => {
  it('gives every field exactly one group, and no two groups a shared name', () => {
    const seen = new Map<string, string>()
    for (const [field, group] of FIELD_GROUP) {
      expect(seen.has(field)).toBe(false)
      seen.set(field, group)
    }
    expect(seen.size).toBe([...FIELD_GROUP.keys()].length)
  })

  it('writes and reads every field it knows', () => {
    // Anything in the registry has to be expressible; a field that cannot reach
    // an address is a field a lender cannot share.
    const params = criteriaToParams({
      loan: { sector: 'Retail', age_min: 1, limit_to: { enabled: true, count: 2, limit_by: 'Country' } },
      partner: { region: 'Africa', profit_min: 1, direct: 'both' },
      portfolio: {
        exclude_portfolio_loans: 'true',
        pb_gender: { enabled: true, hideshow: 'hide', ltgt: 'lt', percent: 10, allactive: 'all' },
      },
    })
    for (const name of params.keys()) expect(isCriteriaParam(name)).toBe(true)
  })
})

describe('the MFI/Direct mode', () => {
  it('stays out of an address where leaving it out means the same thing', () => {
    // Unset, the engine reads Both.
    expect(criteriaToSearch({ loan: { sector: 'Retail' }, partner: { direct: 'both' }, portfolio: {} }))
      .toBe('?sector=Retail')
  })

  it('is written when leaving it out would mean something else', () => {
    // Unset WITH partner filters, the engine reads MFI Only, so a deliberate
    // Both has to survive the trip.
    const both: Criteria = { loan: {}, partner: { direct: 'both', region: 'Africa' }, portfolio: {} }
    expect(criteriaToSearch(both)).toBe('?region=Africa&direct=both')
    expect(roundTrip(both)).toEqual(both)
  })

  it('is always written when it is not Both', () => {
    expect(criteriaToSearch({ loan: {}, partner: { direct: 'mfi' }, portfolio: {} })).toBe('?direct=mfi')
    expect(criteriaToSearch({ loan: {}, partner: { direct: 'direct' }, portfolio: {} })).toBe('?direct=direct')
  })

  it('reads back the same mode the engine would apply, either way', () => {
    for (const criteria of [
      { loan: {}, partner: { direct: 'both' }, portfolio: {} },
      { loan: {}, partner: { direct: 'both', region: 'Africa' }, portfolio: {} },
      { loan: {}, partner: { direct: 'mfi' }, portfolio: {} },
      { loan: {}, partner: { direct: 'direct' }, portfolio: {} },
      { loan: { sector: 'Retail' }, partner: {}, portfolio: {} },
    ] as Criteria[]) {
      const back = read(criteriaToSearch(criteria)) ?? { loan: {}, partner: {}, portfolio: {} }
      expect(resolvePartnerMode(back)).toBe(resolvePartnerMode(criteria))
    }
  })
})
