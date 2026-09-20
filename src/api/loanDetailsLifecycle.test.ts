/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Loans } from './kiva'
import { req } from './kivajs/req'
import type { KivaLoan } from '../types'

const stale = () => ({ id: 3237744, name: 'Francisco', status: 'fundraising', loan_amount: 175,
  funded_amount: 100, basket_amount: 0, kl_still_needed: 75,
  description: { languages: ['en'], texts: {} }, kl_repayments: [], kl_processed: new Date(),
}) as unknown as KivaLoan

afterEach(() => vi.restoreAllMocks())

describe('web borrower selection lifecycle', () => {
  it('checks Kiva when KL drops the selected borrower and updates the current funding status', async () => {
    const subject = new Loans()
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
    const subject = new Loans()
    const loan = stale()
    subject.indexedLoans[loan.id] = loan
    vi.spyOn(req.kl, 'graph').mockResolvedValue({ loans: [] })
    vi.spyOn(subject, 'getLoanFromKiva').mockRejectedValue(new Error('offline'))
    await expect(subject.fetchDescrAndRepayments(loan)).rejects.toThrow()
    expect(loan.status).toBe('fundraising')
    expect(loan.funded_amount).toBe(100)
  })
})
