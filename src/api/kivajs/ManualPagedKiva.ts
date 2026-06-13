/**
 * Allows for specific control over fetching paged results. Unlike PagedKiva which
 * waits until all pages are downloaded before returning, ManualPagedKiva lets you
 * get page 1 immediately, prefetch upcoming pages, and navigate forward/backward.
 * Designed for UI-driven browsing (e.g. team search results).
 */

import { Request } from './Request'
import { apiOptions } from './kivaBase'

export class ManualPagedKiva {
  private url: string
  private params: Record<string, any>
  private collection: string
  private pages: Record<number, any[]>
  pageCount: number
  objectCount: number
  currentPage: number

  constructor(
    url: string,
    params: Record<string, any>,
    collection: string
  ) {
    this.url = url
    this.params = { page: 1, per_page: 100, app_id: apiOptions.appId, ...params }
    this.collection = collection
    this.pages = {}
    this.pageCount = 0
    this.objectCount = 0
    this.currentPage = 0
  }

  private processPage(result: any): any[] {
    const items = result[this.collection]
    this.pages[result.paging.page] = items
    return items
  }

  async start(): Promise<any[]> {
    const result = await Request.get(this.url, this.params)
    this.currentPage = result.paging.page
    this.pageCount = result.paging.pages
    this.objectCount = result.paging.total
    return this.processPage(result)
  }

  async getPage(pageNum: number): Promise<any[]> {
    if (pageNum > this.pageCount || pageNum < 1) {
      throw new Error(`Page ${pageNum} out of range (1-${this.pageCount})`)
    }
    if (this.pages[pageNum]) {
      return this.pages[pageNum]
    }
    const result = await Request.get(this.url, { ...this.params, page: pageNum })
    return this.processPage(result)
  }

  async next(): Promise<any[]> {
    if (this.currentPage >= this.pageCount) {
      throw new Error('No more pages')
    }
    this.currentPage++
    return this.getPage(this.currentPage)
  }

  async prev(): Promise<any[]> {
    if (this.currentPage <= 1) {
      throw new Error('Already on first page')
    }
    this.currentPage--
    return this.getPage(this.currentPage)
  }

  prefetch(maxPages = 3): void {
    const startPage = this.currentPage + 1
    const endPage = Math.min(startPage + maxPages - 1, this.pageCount)
    for (let page = startPage; page <= endPage; page++) {
      // Fire and forget -- results are cached in this.pages via processPage
      this.getPage(page).catch(() => {
        // Swallow prefetch errors silently
      })
    }
  }

  canNext(): boolean {
    return this.currentPage < this.pageCount
  }

  canPrev(): boolean {
    return this.currentPage > 1
  }
}
