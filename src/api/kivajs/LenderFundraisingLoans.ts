import { LenderLoans } from './LenderLoans'
import { Request } from './Request'
import type { OnProgress } from './PagedKiva'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const out: number[] = []
    const seen = new Set<number>()
    let page = 1
    let pages = 1
    do {
      const data = await this.fetchPageWithBackoff(page)
      const loans: any[] = data?.loans ?? []
      pages = data?.paging?.pages ?? page
      for (const loan of loans) {
        if (loan.status === 'fundraising' && !seen.has(loan.id)) {
          seen.add(loan.id)
          out.push(loan.id)
        }
      }
      onProgress?.({
        task: 'details',
        done: page,
        total: pages,
        label: `Scanning your loans (page ${page}/${pages})...`,
      })
      if (!this.continuePaging(loans)) break
      page++
    } while (page <= pages)
    return out
  }

  // Page the lender's loans SEQUENTIALLY (one request at a time) with retry +
  // exponential backoff, instead of PagedKiva's all-at-once fan-out. Busy lenders
  // have hundreds of pages (Kiva forces 20/page and ignores per_page), and the
  // burst tripped Kiva's WAF (403) and failed the WHOLE fetch — so "hide loans
  // I've lent to" silently did nothing for heavy lenders. Sequential + backoff
  // self-throttles and rides out transient 403s.
  private async fetchPageWithBackoff(page: number, tries = 5): Promise<any> {
    let lastErr: unknown
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        return await Request.get(this.url, { ...this.params, page })
      } catch (e) {
        lastErr = e
        await sleep(500 * 2 ** attempt) // 0.5s, 1s, 2s, 4s, 8s
      }
    }
    throw lastErr
  }
}
