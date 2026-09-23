/**
 * utilsStore holds cross-cutting UI state: the lender id (which unlocks
 * portfolio features), the AI widget's open/seed handshake, and misc toggles.
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useUtilsStore } from './utilsStore'
import { useCriteriaStore } from './criteriaStore'

const store = () => useUtilsStore.getState()

beforeEach(() => {
  store().closeAskKl()
  store().closeLenderIdModal()
  store().clearCallout()
})

describe('lender id', () => {
  it('stores the id', () => {
    store().setLenderId('jmcgimpsey')
    expect(store().lenderId).toBe('jmcgimpsey')
  })

  it('stores an accompanying lender object when given one', () => {
    store().setLenderId('someone', { name: 'Someone', loan_count: 12 } as never)
    expect(store().lenderObj).toMatchObject({ name: 'Someone' })
  })

  it('can be cleared back to empty', () => {
    store().setLenderId('temp')
    store().setLenderId('')
    expect(store().lenderId).toBe('')
  })

  it('setLenderObj replaces the object independently', () => {
    store().setLenderObj({ name: 'A' } as never)
    expect(store().lenderObj).toMatchObject({ name: 'A' })
    store().setLenderObj(null)
    expect(store().lenderObj).toBeNull()
  })
})

describe('lender id modal', () => {
  it('opens and closes', () => {
    store().openLenderIdModal()
    expect(store().lenderModalOpen).toBe(true)
    store().closeLenderIdModal()
    expect(store().lenderModalOpen).toBe(false)
  })
})

describe('Ask KivaLens open/seed handshake', () => {
  it('opens the panel', () => {
    store().openAskKl()
    expect(store().askKlOpen).toBe(true)
  })

  it('carries a seed prompt that is consumed exactly once', () => {
    store().openAskKl('find me vegan loans')
    expect(store().consumeAskKlSeed()).toBe('find me vegan loans')
    // A second read must not replay the prompt, or the AI would answer twice.
    expect(store().consumeAskKlSeed()).toBeNull()
  })

  it('opening without a seed yields nothing to consume', () => {
    store().openAskKl()
    expect(store().consumeAskKlSeed()).toBeNull()
  })

  it('closes', () => {
    store().openAskKl()
    store().closeAskKl()
    expect(store().askKlOpen).toBe(false)
  })
})

describe('callout (the point-at-a-control affordance)', () => {
  it('shows a target + message, then clears', () => {
    store().showCallout('nav-options', 'Set it here!')
    expect(store().aiCallout).toMatchObject({ target: 'nav-options', message: 'Set it here!' })
    store().clearCallout()
    expect(store().aiCallout).toBeNull()
  })

  it('bumps a nonce so pointing at the SAME control again re-triggers it', () => {
    store().showCallout('nav-options', 'Here!')
    const first = store().aiCallout!.nonce
    store().showCallout('nav-options', 'Here!')
    expect(store().aiCallout!.nonce).toBe(first + 1)
  })
})

describe('toggles', () => {
  it('AI widget disabled flag round-trips', () => {
    store().setAiWidgetDisabled(true)
    expect(store().aiWidgetDisabled).toBe(true)
    store().setAiWidgetDisabled(false)
    expect(store().aiWidgetDisabled).toBe(false)
  })

  it('AI server-enabled flag round-trips', () => {
    store().setAiServerEnabled(true)
    expect(store().aiServerEnabled).toBe(true)
  })

  it.each(['abc', 'count'] as const)('criteria sort mode accepts %s', (mode) => {
    store().setCriteriaSortMode(mode)
    expect(store().criteriaSortMode).toBe(mode)
  })
})

describe('generic var bag', () => {
  it('round-trips a value', () => {
    store().setVar('answer', 42)
    expect(store().getVar('answer')).toBe(42)
  })

  it('returns undefined for a name never set', () => {
    expect(store().getVar('never-set-xyz')).toBeUndefined()
  })

  it('overwrites an existing value', () => {
    store().setVar('k', 'first')
    store().setVar('k', 'second')
    expect(store().getVar('k')).toBe('second')
  })
})

describe('clearing the lender id lets go of what their portfolio put in', () => {
  // A balancer's values are partner ids, countries and sectors worked out from ONE
  // lender's portfolio. The filter engine applies them on `enabled` + `values` alone,
  // so leaving them behind would keep filtering by a portfolio the app no longer has.
  const balancer = () => ({ enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 10, allactive: 'all', values: [123, 456] })

  it('switches the balancers off and drops their values, live and in saved searches', () => {
    useCriteriaStore.setState((state) => ({
      lastKnown: { ...state.lastKnown, portfolio: { ...state.lastKnown.portfolio, pb_partner: balancer() } },
      savedSearches: { ...state.savedSearches, mine: { loan: {}, partner: {}, portfolio: { pb_country: balancer() } } },
    }) as never)
    store().setLenderId('somelender')
    store().setLenderId('')

    const live = useCriteriaStore.getState().lastKnown.portfolio as Record<string, { enabled: boolean; values?: unknown[] }>
    const saved = useCriteriaStore.getState().savedSearches.mine.portfolio as Record<string, { enabled: boolean; values?: unknown[] }>
    expect(store().lenderId).toBe('')
    expect(live.pb_partner.enabled).toBe(false)
    expect(live.pb_partner.values).toBeUndefined()
    expect(saved.pb_country.enabled).toBe(false)
    expect(saved.pb_country.values).toBeUndefined()
  })
})
