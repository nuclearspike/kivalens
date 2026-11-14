/**
 * utilsStore holds cross-cutting UI state: the lender id (which unlocks
 * portfolio features), the AI widget's open/seed handshake, and misc toggles.
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useUtilsStore } from './utilsStore'
import { useCriteriaStore } from './criteriaStore'
import { getKivaLoans } from '../api/kiva'
import { held } from '../test/lateWork'

const store = () => useUtilsStore.getState()

beforeEach(() => {
  store().closeAskKl()
  store().closeLenderIdModal()
  store().clearCallout()
})

describe("a lender ID changed while the last one's profile is read", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    store().setLenderObj(null)
  })

  /** The two profile reads, answered when the test says; the catalog's own read is left out. */
  function twoReads() {
    const kl = getKivaLoans()
    vi.spyOn(kl, 'setLender').mockImplementation(() => {})
    const first = held<never>()
    const second = held<never>()
    vi.spyOn(kl, 'fetchLender').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    store().setLenderId('firstlender')
    store().setLenderId('secondlender')
    return { first, second }
  }

  it("keeps the new lender's profile when the earlier one answers last", async () => {
    const { first, second } = twoReads()
    second.resolve({ lender_id: 'secondlender', name: 'Second' } as never)
    await Promise.resolve()
    first.resolve({ lender_id: 'firstlender', name: 'First' } as never)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderId).toBe('secondlender')
    expect(store().lenderObj).toMatchObject({ name: 'Second' })
  })

  it.each([
    ['answers', (first: ReturnType<typeof held<never>>) => first.resolve({ lender_id: 'firstlender', name: 'Old first' } as never)],
    ['turns out not to exist', (first: ReturnType<typeof held<never>>) => first.reject({ status: 404, message: 'Not Found' })],
  ])('keeps the profile of a lender set again with a checked profile, when the first read of the same ID %s last', async (_outcome, land) => {
    const kl = getKivaLoans()
    vi.spyOn(kl, 'setLender').mockImplementation(() => {})
    const first = held<never>()
    vi.spyOn(kl, 'fetchLender').mockReturnValueOnce(first.promise).mockResolvedValue({ lender_id: 'secondlender', name: 'Second' } as never)
    store().setLenderId('firstlender')
    store().setLenderId('secondlender')
    // The lender-ID dialog checked the first ID again and sets it with its profile.
    store().setLenderId('firstlender', { lender_id: 'firstlender', name: 'New first' } as never)
    land(first)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderId).toBe('firstlender')
    expect(store().lenderObj).toMatchObject({ name: 'New first' })
  })

  it('keeps the profile a lender ID was just set with, when a read of that ID begun before answers last', async () => {
    const kl = getKivaLoans()
    vi.spyOn(kl, 'setLender').mockImplementation(() => {})
    const first = held<never>()
    vi.spyOn(kl, 'fetchLender').mockReturnValueOnce(first.promise)
    store().setLenderId('firstlender')
    store().setLenderId('firstlender', { lender_id: 'firstlender', name: 'New first' } as never)
    first.resolve({ lender_id: 'firstlender', name: 'Old first' } as never)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderObj).toMatchObject({ name: 'New first' })
  })

  it('a profile read of the same ID made on its own (as Options does) does not cancel the check that clears a missing one', async () => {
    const kl = getKivaLoans()
    vi.spyOn(kl, 'setLender').mockImplementation(() => {})
    const missing = Promise.reject({ status: 404, message: 'Not Found' })
    missing.catch(() => {})
    vi.spyOn(kl, 'fetchLender').mockReturnValue(missing)
    store().setLenderId('missinglender')
    void store().fetchLenderObj('missinglender', false)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderId).toBe('')
  })

  it('never clears the new lender ID because the earlier one turned out not to exist', async () => {
    const { first, second } = twoReads()
    first.reject({ status: 404, message: 'Not Found' })
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderId).toBe('secondlender')
    second.resolve({ lender_id: 'secondlender', name: 'Second' } as never)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(store().lenderObj).toMatchObject({ name: 'Second' })
  })
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

  it('drops the lists their portfolio filled in and keeps the balancers on, live and in saved searches', () => {
    // Paul, 2026-09-29: switching them off here broke "Countries I Don't Have" for good.
    useCriteriaStore.setState((state) => ({
      lastKnown: { ...state.lastKnown, portfolio: { ...state.lastKnown.portfolio, pb_partner: balancer() } },
      savedSearches: { ...state.savedSearches, mine: { loan: {}, partner: {}, portfolio: { pb_country: balancer() } } },
    }) as never)
    store().setLenderId('somelender')
    store().setLenderId('')

    const live = useCriteriaStore.getState().lastKnown.portfolio as Record<string, { enabled: boolean; values?: unknown[] }>
    const saved = useCriteriaStore.getState().savedSearches.mine.portfolio as Record<string, { enabled: boolean; values?: unknown[] }>
    expect(store().lenderId).toBe('')
    expect(live.pb_partner.enabled).toBe(true)
    expect(live.pb_partner.values).toBeUndefined()
    expect(saved.pb_country.enabled).toBe(true)
    expect(saved.pb_country.values).toBeUndefined()
  })
})
