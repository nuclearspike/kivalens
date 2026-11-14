/**
 * kiva.ts pulls in req.ts, which reads `location` at module load, so this suite
 * needs a DOM global.
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Loans } from './kiva'
import type { KivaLoan } from '../types'

// Each catalog a case makes runs queue intervals until it is killed.
const made: Loans[] = []
const catalog = () => {
  const loans = new Loans()
  made.push(loans)
  return loans
}
afterEach(() => {
  for (const loans of made.splice(0)) loans.kill()
})

/**
 * The client ingests loans from two places, with different trust:
 *   - the KL server, which pages Kiva itself and de-dupes  -> trusted verbatim
 *   - Kiva directly (paged in the browser)                 -> may repeat a loan
 *     across a page seam when the live listing shifts, so it must be de-duped
 * plus incremental /api/since deltas that merge into what is already loaded.
 *
 * These pin that contract: the index and the array must never disagree, and a
 * repeat must update the existing loan rather than append a second card.
 */

const mk = (id: number, extra: Partial<KivaLoan> = {}) =>
  ({
    id,
    name: `Borrower ${id}`,
    status: 'fundraising',
    loan_amount: 1000,
    funded_amount: 0,
    basket_amount: 0,
    sector: 'Agriculture',
    activity: 'Farming',
    use: 'to buy seed',
    location: { country_code: 'KE', country: 'Kenya' },
    terms: { repayment_interval: 'monthly' },
    kls_tags: [],
    themes: [],
    borrowers: [],
    kl_percent_women: 100,
    kl_still_needed: 1000,
    kl_percent_funded: 0,
    kl_name_arr: [],
    kls_use_or_descr_arr: [],
    kl_newest_sort: 0,
    posted_date: '2026-06-01',
    // Pre-marked so setKivaLoans skips reprocessing; we are testing ingestion.
    kl_processed: new Date(),
    ...extra,
  }) as unknown as KivaLoan

const idsOf = (l: Loans) => l.loansFromKiva.map((x) => x.id)
/** The array and the id index must always describe the same set. */
const indexAgrees = (l: Loans) =>
  idsOf(l).length === Object.keys(l.indexedLoans).length &&
  idsOf(l).every((id) => l.indexedLoans[id]?.id === id)

describe('setKivaLoans — direct-from-Kiva pull (must de-dupe)', () => {
  it('keeps one entry when a page seam repeats a loan', () => {
    const l = catalog()
    // page 1 ended with 3; the listing shifted, so page 2 served 3 again
    l.setKivaLoans([mk(1), mk(2), mk(3), mk(3), mk(4)])

    expect(idsOf(l)).toEqual([1, 2, 3, 4])
    expect(indexAgrees(l)).toBe(true)
  })

  it('merges the repeat into the existing loan instead of appending', () => {
    const l = catalog()
    l.setKivaLoans([mk(1, { funded_amount: 100 }), mk(1, { funded_amount: 250 })])

    expect(idsOf(l)).toEqual([1])
    // the later copy wins, so the fresher funding figure survives
    expect(l.getById(1)!.funded_amount).toBe(250)
  })

  it('is a no-op for an empty pull (does not wipe what is loaded)', () => {
    const l = catalog()
    l.setKivaLoans([mk(1), mk(2)])
    l.setKivaLoans([])

    expect(idsOf(l)).toEqual([1, 2])
  })

  it('replaces the dataset on a reset pull', () => {
    const l = catalog()
    l.setKivaLoans([mk(1), mk(2)])
    l.setKivaLoans([mk(3)])

    expect(idsOf(l)).toEqual([3])
    expect(l.hasLoan(1)).toBe(false)
    expect(indexAgrees(l)).toBe(true)
  })
})

describe('setKivaLoans — trusted server batch', () => {
  it('takes the batch verbatim (the server already de-duped)', () => {
    const l = catalog()
    l.setKivaLoans([mk(1), mk(2), mk(3)], true, true)

    expect(idsOf(l)).toEqual([1, 2, 3])
    expect(indexAgrees(l)).toBe(true)
  })

  it('DOCUMENTS the trust contract: a dirty batch is NOT re-checked', () => {
    // This is why server-side de-duplication is mandatory: on this fast path the
    // client does no hasLoan() check, so a duplicate from the server would be
    // shown twice. klCorePaging.test.ts guards the server end of this contract.
    const l = catalog()
    l.setKivaLoans([mk(1), mk(1)], true, true)

    expect(idsOf(l)).toEqual([1, 1])
  })
})

describe('setKivaLoans — incremental /api/since delta', () => {
  it('appends genuinely new loans without touching existing ones', () => {
    const l = catalog()
    l.setKivaLoans([mk(1), mk(2)], true, true)
    l.setKivaLoans([mk(3)], false)

    expect(idsOf(l)).toEqual([1, 2, 3])
    expect(indexAgrees(l)).toBe(true)
  })

  it('updates an already-loaded loan rather than duplicating it', () => {
    const l = catalog()
    l.setKivaLoans([mk(1, { funded_amount: 0 })], true, true)
    l.setKivaLoans([mk(1, { funded_amount: 750 })], false)

    expect(idsOf(l)).toEqual([1])
    expect(l.getById(1)!.funded_amount).toBe(750)
  })

  it('keeps the index consistent across mixed new + updated deltas', () => {
    const l = catalog()
    l.setKivaLoans([mk(1), mk(2)], true, true)
    l.setKivaLoans([mk(2, { funded_amount: 500 }), mk(3)], false)

    expect(idsOf(l)).toEqual([1, 2, 3])
    expect(l.getById(2)!.funded_amount).toBe(500)
    expect(indexAgrees(l)).toBe(true)
  })
})
