import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// No test may reach OpenAI or the real cache dir.
const create = vi.fn()
vi.mock('openai', () => ({ default: class { chat = { completions: { create } } } }))
const store = new Map<string, string>()
const { configureRuntime } = await import('../../server/runtime.mjs')
configureRuntime({
  cache: {
    get: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    set: vi.fn(async (k: string, v: string) => { store.set(k, v); return true }),
    cleanup: vi.fn(async () => []),
  },
})
const budgetExceeded = vi.fn(async () => false)
vi.mock('../../server/aiUsage.mjs', () => ({ budgetExceeded, addSpend: vi.fn(), costOf: () => 0.0001 }))

const { resolveAmbiguousAges, lastAgeAnswers, storyPrint } = await import('../../server/borrowerAgeAI.mjs')

// "is 48" with no "years old": exactly what the patterns refuse to settle.
const ambiguous = (text = 'Zhamalaim is 48 and married with two children.') =>
  ({ kls_age: null as number | null, description: { texts: { en: text } } })
const answers = (age: number | null) =>
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ age }) } }], usage: {} })

beforeEach(() => {
  store.clear()
  create.mockReset()
  budgetExceeded.mockResolvedValue(false)
  process.env.OPENAI_API_KEY = 'test-key'
})
afterEach(() => { delete process.env.OPENAI_API_KEY })

describe('resolveAmbiguousAges', () => {
  it('asks only about the descriptions the patterns could not settle', async () => {
    const loans = [
      ambiguous(),                                              // asked
      { kls_age: 45, description: { texts: { en: 'Maria is 45 years old.' } } },   // already settled
      { kls_age: null, description: { texts: { en: 'No age here at all.' } } },    // nothing to ask about
      { kls_age: null, description: { texts: { en: 'She lives with her 20-year-old daughter.' } } }, // the age is the daughter's
    ]
    answers(48)
    const stats = await resolveAmbiguousAges(loans as never)
    expect(create).toHaveBeenCalledTimes(1)
    expect(stats).toMatchObject({ considered: 1, asked: 1, resolved: 1 })
    expect(loans[0].kls_age).toBe(48)
    expect(loans[3].kls_age).toBeNull() // still refused; the model was never asked
  })

  // Paul, 2026-09-30: "the borrower ages should be (OF COURSE) added to the loan details, not
  // stored on ephemeral storage with heroku." The answer rides on the loan, and the next refresh
  // (or the details a warm start restored) hands it on.
  it('asks once per loan and keeps the answer on it, so a refresh costs nothing twice', async () => {
    answers(48)
    const first = [{ id: 7, ...ambiguous() }]
    await resolveAmbiguousAges(first as never)
    expect(first[0]).toMatchObject({ kls_age: 48, kl_age_answer: { age: 48, of: storyPrint('Zhamalaim is 48 and married with two children.') } })
    const second = [{ id: 7, ...ambiguous() }]
    const stats = await resolveAmbiguousAges(second as never, () => {}, lastAgeAnswers(first))
    expect(create).toHaveBeenCalledTimes(1)
    expect(stats).toMatchObject({ kept: 1, asked: 0, resolved: 1 })
    expect(second[0].kls_age).toBe(48)
  })

  it('remembers a "no age" answer too, instead of paying to be told again', async () => {
    answers(null)
    const first = [{ id: 7, ...ambiguous() }]
    await resolveAmbiguousAges(first as never)
    expect(first[0].kl_age_answer).toMatchObject({ age: null })
    const again = [{ id: 7, ...ambiguous() }]
    await resolveAmbiguousAges(again as never, () => {}, lastAgeAnswers(first))
    expect(create).toHaveBeenCalledTimes(1)
    expect(again[0].kls_age).toBeNull()
  })

  it('asks again when Kiva has edited the story, and never hands an answer to another loan', async () => {
    answers(48)
    const first = [{ id: 7, ...ambiguous() }]
    await resolveAmbiguousAges(first as never)
    const edited = [{ id: 7, ...ambiguous('Zhamalaim is 49 and married with two children.') }]
    const otherLoan = [{ id: 8, ...ambiguous() }]
    await resolveAmbiguousAges([...edited, ...otherLoan] as never, () => {}, lastAgeAnswers(first))
    expect(create).toHaveBeenCalledTimes(3) // the first, the edited story, and loan 8's own
  })

  it('refuses an answer outside the range Kiva lends in', async () => {
    for (const bad of [7, 130, null, 'forty']) {
      create.mockReset()
      create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ age: bad }) } }], usage: {} })
      const loans = [ambiguous()]
      await resolveAmbiguousAges(loans as never)
      expect(loans[0].kls_age, `age ${bad}`).toBeNull()
    }
  })

  it('leaves the age unset rather than failing the refresh when the model errors', async () => {
    create.mockRejectedValue(new Error('upstream down'))
    const loans = [ambiguous()]
    const logged: string[] = []
    await expect(resolveAmbiguousAges(loans as never, (m: string) => logged.push(m))).resolves.toBeTruthy()
    expect(loans[0].kls_age).toBeNull()
    expect(logged.join(' ')).toContain('failed')
    // A failure is not recorded on the loan: the next refresh is free to try again.
    expect(loans[0]).not.toHaveProperty('kl_age_answer')
  })

  it('survives an unparseable answer', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: 'not json' } }], usage: {} })
    const loans = [ambiguous()]
    await resolveAmbiguousAges(loans as never)
    expect(loans[0].kls_age).toBeNull()
  })

  it('does not spend past the monthly budget, and does not ask without a key', async () => {
    budgetExceeded.mockResolvedValue(true)
    await resolveAmbiguousAges([ambiguous()] as never)
    expect(create).not.toHaveBeenCalled()

    budgetExceeded.mockResolvedValue(false)
    delete process.env.OPENAI_API_KEY
    vi.resetModules()
    const fresh = await import('../../server/borrowerAgeAI.mjs')
    const loans = [ambiguous()]
    await fresh.resolveAmbiguousAges(loans as never)
    expect(create).not.toHaveBeenCalled()
    expect(loans[0].kls_age).toBeNull()
  })

  it("gives the model the name on the loan, and never asks about an age the story ties to that name (Paul, 2026-09-29)", async () => {
    answers(null) // the son's age: the model says the borrower's is not stated
    const loans = [
      { name: 'Rosa', kls_age: null, description: { texts: { en: 'Her son works in Lima and is 24 years old.' } } }, // asked, with the name
      { name: 'Zhamalaim', kls_age: null, description: { texts: { en: 'Zhamalaim is 48 and married with two children.' } } }, // settled by the name
    ]
    const stats = await resolveAmbiguousAges(loans as never)
    expect(create).toHaveBeenCalledTimes(1)
    expect(stats).toMatchObject({ considered: 1, asked: 1 })
    expect(loans.map((l) => l.kls_age)).toEqual([null, null]) // the second is filled in by the refresh's own read, not here
    const user = create.mock.calls[0][0].messages.find((m: { role: string }) => m.role === 'user').content
    expect(user).toBe('Name on the loan: Rosa\n\nHer son works in Lima and is 24 years old.')
    expect(create.mock.calls[0][0].messages[0].content).toContain('An age the description ties to that name is the borrower')
  })

  it('does nothing, cheaply, when there is nothing to settle', async () => {
    const stats = await resolveAmbiguousAges([] as never)
    expect(stats).toMatchObject({ considered: 0, asked: 0 })
    expect(create).not.toHaveBeenCalled()
  })
})
