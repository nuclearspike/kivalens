import { describe, it, expect } from 'vitest'
import {
  kivaHandoff,
  minutesAtKiva,
  KIVA_ADDRESS_MAX,
  KIVA_LEND_AMOUNT,
  KIVA_SIGNED_OUT_LIMIT,
  type CheckoutLoan,
} from './kivaCheckout'

const loan = (id: number, amount = 25): CheckoutLoan => ({ id, amount })

describe('the address that hands a basket to Kiva', () => {
  it('is nothing when there is nothing Kiva could add', () => {
    expect(kivaHandoff([])).toBeNull()
    expect(kivaHandoff([loan(0), loan(-4), loan(1.5), loan(Number.NaN), loan(7, 0), loan(8, -25), loan(9, Number.NaN)])).toBeNull()
    expect(kivaHandoff([null, undefined] as unknown as CheckoutLoan[])).toBeNull()
    expect(kivaHandoff([{ id: '12' as unknown as number, amount: 25 }, { id: 13, amount: '25' as unknown as number }])).toBeNull()
  })

  it('sends one loan at $25', () => {
    expect(KIVA_LEND_AMOUNT).toBe(25)
    const handoff = kivaHandoff([loan(3248504)])
    expect(handoff?.url).toBe('https://www.kiva.org/process-instant-lending/3248504/25?app_id=org.kiva.kivalens')
    expect(handoff?.needsSignIn).toBe(false)
    expect(handoff?.left).toBe(0)
    expect(handoff?.loans.map((l) => l.id)).toEqual([3248504])
  })

  it('sends one loan at what it still needs when that is less than $25', () => {
    expect(kivaHandoff([loan(9, 15)])?.url).toBe('https://www.kiva.org/process-instant-lending/9/15?app_id=org.kiva.kivalens')
    expect(kivaHandoff([loan(9, 12.5)])?.url).toBe('https://www.kiva.org/process-instant-lending/9/12.5?app_id=org.kiva.kivalens')
  })

  it('never names more than $25 for one loan, whatever amount it is handed', () => {
    for (const amount of [50, 75, 175, 1000]) {
      const handoff = kivaHandoff([loan(77, amount)])
      expect(handoff?.url).toBe('https://www.kiva.org/process-instant-lending/77/25?app_id=org.kiva.kivalens')
      expect(handoff?.needsSignIn).toBe(false)
    }
  })

  it('sends several loans as one bundle, in basket order', () => {
    const handoff = kivaHandoff([loan(30), loan(10), loan(20)])
    expect(handoff?.url).toBe('https://www.kiva.org/add-loan-bundle?loanIds=30,10,20&app_id=org.kiva.kivalens')
  })

  it('carries no amount in the bundle address and reports none to set, whatever the loans are held at', () => {
    const handoff = kivaHandoff([loan(1, 25), loan(2, 50), loan(3, 40), loan(4, 10)])!
    expect(handoff.url).toBe('https://www.kiva.org/add-loan-bundle?loanIds=1,2,3,4&app_id=org.kiva.kivalens')
    expect(Object.keys(handoff).sort()).toEqual(['left', 'loans', 'needsSignIn', 'url'])
  })

  it('counts a loan once however often the basket holds it', () => {
    const handoff = kivaHandoff([loan(5), loan(6), loan(5)])
    expect(handoff?.url).toContain('loanIds=5,6&')
    expect(handoff?.loans).toHaveLength(2)
  })

  it('decides one-or-several after dropping what cannot be sent', () => {
    // Two rows, one of them unusable: one loan goes, by the single-loan address.
    const handoff = kivaHandoff([loan(77), loan(0)])
    expect(handoff?.url).toBe('https://www.kiva.org/process-instant-lending/77/25?app_id=org.kiva.kivalens')
  })

  /** Where Kiva's sign-in sends the lender on to. */
  const after = (url: string) => {
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://www.kiva.org/ui-login')
    expect([...u.searchParams.keys()]).toEqual(['doneUrl'])
    return u.searchParams.get('doneUrl')!
  }

  it('goes direct while the basket is within what Kiva takes signed out', () => {
    expect(KIVA_SIGNED_OUT_LIMIT).toBe(150)
    const six = kivaHandoff([1, 2, 3, 4, 5, 6].map((id) => loan(id)))
    expect(six?.needsSignIn).toBe(false)
    expect(six?.url).toBe('https://www.kiva.org/add-loan-bundle?loanIds=1,2,3,4,5,6&app_id=org.kiva.kivalens')
  })

  it('goes through Kiva\u2019s sign-in when the basket is more than that', () => {
    const seven = kivaHandoff([1, 2, 3, 4, 5, 6, 7].map((id) => loan(id)))
    expect(seven?.needsSignIn).toBe(true)
    expect(after(seven!.url)).toBe('/add-loan-bundle?loanIds=1,2,3,4,5,6,7&app_id=org.kiva.kivalens')
  })

  it('counts what the bundle adds, $25 a loan, not what the loans are held at', () => {
    // Seven loans that each need only $10 are held at $70, and the bundle adds them at $25 each, $175.
    expect(kivaHandoff([1, 2, 3, 4, 5, 6, 7].map((id) => loan(id, 10)))?.needsSignIn).toBe(true)
    // Six held at $50 each are still six loans at $25 to Kiva: $150, inside the limit.
    expect(kivaHandoff([1, 2, 3, 4, 5, 6].map((id) => loan(id, 50)))?.needsSignIn).toBe(false)
  })

  it('carries a large basket in one address', () => {
    const ids = Array.from({ length: 300 }, (_, i) => 3_000_000 + i)
    const handoff = kivaHandoff(ids.map((id) => loan(id)))
    expect(handoff?.loans).toHaveLength(300)
    const path = new URL(after(handoff!.url), 'https://www.kiva.org')
    expect(path.pathname).toBe('/add-loan-bundle')
    expect(path.searchParams.get('loanIds')?.split(',').map(Number)).toEqual(ids)
    expect(path.searchParams.get('app_id')).toBe('org.kiva.kivalens')
    expect(handoff?.left).toBe(0)
    expect(handoff!.url.length).toBeLessThan(KIVA_ADDRESS_MAX)
  })

  it('carries the first loans that fit when the address would be too long for Kiva, and says how many are left', () => {
    const ids = Array.from({ length: 900 }, (_, i) => 3_000_000 + i)
    const handoff = kivaHandoff(ids.map((id) => loan(id)))!
    expect(handoff.url.length).toBeLessThanOrEqual(KIVA_ADDRESS_MAX)
    // One loan more would not have fitted.
    const more = `https://www.kiva.org/ui-login?doneUrl=${encodeURIComponent(`/add-loan-bundle?loanIds=${ids.slice(0, handoff.loans.length + 1).join(',')}&app_id=org.kiva.kivalens`)}`
    expect(more.length).toBeGreaterThan(KIVA_ADDRESS_MAX)
    expect(handoff.loans.map((l) => l.id)).toEqual(ids.slice(0, handoff.loans.length))
    expect(handoff.loans.length).toBeGreaterThan(500)
    expect(handoff.left).toBe(900 - handoff.loans.length)
    const path = new URL(after(handoff.url), 'https://www.kiva.org')
    expect(path.searchParams.get('loanIds')?.split(',').map(Number)).toEqual(ids.slice(0, handoff.loans.length))
  })

  it('says how long to allow Kiva, never less than a minute', () => {
    expect(minutesAtKiva(1)).toBe(1)
    expect(minutesAtKiva(20)).toBe(1)
    expect(minutesAtKiva(80)).toBe(2)
    expect(minutesAtKiva(400)).toBe(10)
  })

  it('never posts to the address Kiva retired', () => {
    for (const basket of [[loan(1)], [loan(1), loan(2)]]) expect(kivaHandoff(basket)?.url).not.toContain('basket/set')
  })
})
