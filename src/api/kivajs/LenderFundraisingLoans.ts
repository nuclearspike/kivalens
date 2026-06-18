import { LenderLoans } from './LenderLoans'
import type { OnProgress } from './PagedKiva'

class LenderStatusLoans extends LenderLoans {
  constructor(lenderId: string, options: Record<string, any> = {}) {
    super(lenderId, { ...options })
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    const loans = await super.start(onProgress)
    if (this.options.status) {
      return loans.filter((loan) => loan.status === this.options.status)
    }
    return loans
  }
}

export class LenderFundraisingLoans extends LenderStatusLoans {
  constructor(lenderId: string, options: Record<string, any> = {}) {
    super(lenderId, {
      ...options,
      status: 'fundraising',
      fundraising_only: true,
    })
  }

  // Kiva returns a lender's loans sorted by posted_date DESC. We only need the
  // ones still fundraising, which can only be recently-posted loans, so we stop
  // paging into the older history.
  //
  // The previous check stopped at the first page whose loans had all passed
  // planned_expiration_date. But Kiva fundraising windows VARY (observed 30-82
  // days), so "expired" is NOT monotonic with posted_date: a newer short-window
  // loan can expire while an older long-window loan on a *later* page is still
  // fundraising. That made paging cancel those later pages and silently drop
  // fundraising loans (the reported "stops at page 11" bug). Instead, stop only
  // once the NEWEST loan on a page was posted before a generous window cutoff --
  // past that point no older (later-paged) loan can still be fundraising.
  static readonly FUNDRAISING_WINDOW_DAYS = 120

  continuePaging(loans: any[]): boolean {
    if (!this.options.fundraising_only) return true
    // Never stop on a page that still contains a fundraising loan.
    if (loans.some((loan) => loan.status === 'fundraising')) return true
    const cutoff =
      Date.now() - LenderFundraisingLoans.FUNDRAISING_WINDOW_DAYS * 86_400_000
    let newestPosted = -Infinity
    for (const loan of loans) {
      const t = loan.posted_date ? new Date(loan.posted_date).getTime() : NaN
      if (!Number.isNaN(t) && t > newestPosted) newestPosted = t
    }
    // Unknown posted dates -> can't safely bound the window; keep paging.
    if (newestPosted === -Infinity) return true
    return newestPosted >= cutoff
  }

  async ids(onProgress?: OnProgress): Promise<number[]> {
    const loans = await this.start(onProgress)
    return loans
      .filter((loan) => loan.status === 'fundraising')
      .map((loan) => loan.id)
  }
}
