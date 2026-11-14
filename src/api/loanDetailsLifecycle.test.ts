/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Loans } from './kiva'
import { req } from './kivajs/req'
import type { KivaLoan } from '../types'
import { held } from '../test/lateWork'

const stale = () => ({ id: 3237744, name: 'Francisco', status: 'fundraising', loan_amount: 175,
  funded_amount: 100, basket_amount: 0, kl_still_needed: 75,
  description: { languages: ['en'], texts: {} }, kl_repayments: [], kl_processed: new Date(),
}) as unknown as KivaLoan

// Each catalog a case makes runs queue intervals until it is killed.
const made: Loans[] = []
const catalog = () => {
  const loans = new Loans()
  made.push(loans)
  return loans
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const loans of made.splice(0)) loans.kill()
})

describe('web borrower selection lifecycle', () => {
  it('checks Kiva when KL drops the selected borrower and updates the current funding status', async () => {
    const subject = catalog()
    const loan = stale()
    subject.indexedLoans[loan.id] = loan
    vi.spyOn(req.kl, 'graph').mockResolvedValue({ loans: [] })
    const fallback = vi.spyOn(subject, 'getLoanFromKiva').mockResolvedValue({ ...loan,
      status: 'funded', funded_amount: 175, description: { languages: ['en'], texts: { en: 'His solar kit.' } },
    })
    await subject.fetchDescrAndRepayments(loan)
    expect(fallback).toHaveBeenCalledWith(3237744)
    expect(loan).toMatchObject({ status: 'funded', funded_amount: 175, kl_still_needed: 0,
      description: { texts: { en: 'His solar kit.' } } })
  })

  it('rejects unverified details without changing fundraising into a fabricated terminal state', async () => {
    const subject = catalog()
    const loan = stale()
    subject.indexedLoans[loan.id] = loan
    vi.spyOn(req.kl, 'graph').mockResolvedValue({ loans: [] })
    vi.spyOn(subject, 'getLoanFromKiva').mockRejectedValue(new Error('offline'))
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    try {
      await expect(subject.fetchDescrAndRepayments(loan)).rejects.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
    expect(loan.status).toBe('fundraising')
    expect(loan.funded_amount).toBe(100)
    // The page shows the loan as not checked; the error collector hears why, once.
    expect(reported).toEqual(['Checking loan details with Kiva failed: offline'])
  })

  it('a catalog killed while it looks a loan up on this site asks Kiva for nothing', async () => {
    const subject = catalog()
    const loan = stale()
    subject.indexedLoans[loan.id] = loan
    const lookup = held<{ loans: never[] }>()
    vi.spyOn(req.kl, 'graph').mockReturnValue(lookup.promise)
    const fromKiva = vi.spyOn(subject, 'getLoanFromKiva')
    const heard: unknown[] = []
    subject.onNotify((message) => { heard.push(message) })
    const checking = subject.fetchDescrAndRepayments(loan)
    subject.kill()
    lookup.resolve({ loans: [] })
    await checking
    expect(fromKiva).not.toHaveBeenCalled()
    // Nothing was checked, so nothing is announced.
    expect(heard).toEqual([])
  })

  it("a catalog killed while it checks several loans with Kiva takes no further loan of them", async () => {
    const subject = catalog()
    const loans = [1, 2, 3, 4, 5].map((n) => ({ ...stale(), id: 3237740 + n }) as KivaLoan)
    for (const loan of loans) subject.indexedLoans[loan.id] = loan
    vi.spyOn(req.kl, 'graph').mockResolvedValue({ loans: [] })
    const answers = loans.map(() => held<never>())
    // An answer nobody asked for is rejected below too; that is not a failure of the case.
    for (const answer of answers) answer.promise.catch(() => {})
    const fromKiva = vi.spyOn(subject, 'getLoanFromKiva').mockImplementation((id: number) => answers[loans.findIndex((l) => l.id === id)].promise)
    const checking = subject.fetchDescrAndRepayments(loans).catch(() => {})
    // Four at a time: the fifth waits for one of them.
    await vi.waitFor(() => expect(fromKiva).toHaveBeenCalledTimes(4))
    subject.kill()
    // Every answer comes back (the fifth is asked for only by a worker that goes on after kill).
    for (const answer of answers) answer.reject(new Error('offline'))
    await checking
    expect(fromKiva).toHaveBeenCalledTimes(4)
  })
})
