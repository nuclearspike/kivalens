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

const { resolveAmbiguousAges } = await import('../../server/borrowerAgeAI.mjs')

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

  it('asks once per description and reuses the answer, so a refresh costs nothing twice', async () => {
    answers(48)
    await resolveAmbiguousAges([ambiguous()] as never)
    const second = [ambiguous()]
    const stats = await resolveAmbiguousAges(second as never)
    expect(create).toHaveBeenCalledTimes(1)
    expect(stats).toMatchObject({ fromCache: 1, asked: 0, resolved: 1 })
    expect(second[0].kls_age).toBe(48)
  })

  it('remembers a "no age" answer too, instead of paying to be told again', async () => {
    answers(null)
    await resolveAmbiguousAges([ambiguous()] as never)
    const again = [ambiguous()]
    await resolveAmbiguousAges(again as never)
    expect(create).toHaveBeenCalledTimes(1)
    expect(again[0].kls_age).toBeNull()
  })

  it('refuses an answer outside the range Kiva lends in', async () => {
    for (const bad of [7, 130, null, 'forty']) {
      store.clear(); create.mockReset()
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
    // A failure is not cached: the next refresh is free to try again.
    expect(store.size).toBe(0)
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

  it('does nothing, cheaply, when there is nothing to settle', async () => {
    const stats = await resolveAmbiguousAges([] as never)
    expect(stats).toMatchObject({ considered: 0, asked: 0 })
    expect(create).not.toHaveBeenCalled()
  })
})
