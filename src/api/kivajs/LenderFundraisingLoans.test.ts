import { describe, it, expect } from 'vitest'
import { LenderFundraisingLoans } from './LenderFundraisingLoans'

// Regression test for the "stops at page 11" bug: the lender's loans come back
// posted_date DESC, fundraising windows vary (30-82 days observed), so paging
// must stop on a posted_date bound rather than a per-loan "expired" check.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

describe('LenderFundraisingLoans.continuePaging', () => {
  const lfl = new LenderFundraisingLoans('someone')

  it('keeps paging while a page still contains a fundraising loan', () => {
    expect(
      lfl.continuePaging([
        { status: 'funded', posted_date: daysAgo(400) },
        { status: 'fundraising', posted_date: daysAgo(390) },
      ]),
    ).toBe(true)
  })

  it('keeps paging when the newest loan on the page is within the window', () => {
    // All funded/expired, but newest posted recently -> an older long-window
    // loan on a later page could still be fundraising, so we must continue.
    // (This is exactly the case the old per-loan expiry check got wrong.)
    expect(
      lfl.continuePaging([
        { status: 'funded', posted_date: daysAgo(10) },
        { status: 'expired', posted_date: daysAgo(40) },
      ]),
    ).toBe(true)
  })

  it('stops once the newest loan on the page is older than the window', () => {
    expect(
      lfl.continuePaging([
        { status: 'funded', posted_date: daysAgo(200) },
        { status: 'funded', posted_date: daysAgo(500) },
      ]),
    ).toBe(false)
  })

  it('keeps paging when posted_date is missing (cannot safely bound)', () => {
    expect(
      lfl.continuePaging([{ status: 'funded' }, { status: 'expired' }]),
    ).toBe(true)
  })
})
