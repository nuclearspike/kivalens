/**
 * Allows for specific control over fetching the results. The PagedKiva class waits until all pages have been
 * downloaded and processed before returning an array of all the results. ManualPagedKiva was created
 * for the ability to do a team search (but obviously can do more) where you can perform the search,
 * get the results, prefetch to make paging really fast without downloading EVERYTHING before it can
 * respond. it's also possible to start on a page other than 1. It's designed with the intention of being used for UI
 * results. PagedKiva does not care about results coming back out of order as it assembles them all once
 * they are either all done or it has been told to stop paging past a certain point. It's therefore
 * a much faster option (~6-8 concurrent requests since waiting on Kiva is the slowest part). This could
 * still be used where you pull a bunch of stuff then prefetch a ton of pages (prefetching does parallel requests)
 *
 * Example use
 * var pk = new ManualPagedKiva('lenders/nuclearspike/teams.json',{},'teams')
 * pk.start().done(page1=>console.log(page1)) //you'd probably just have something like "done(this.displayTeams.bind(this))"
 * pk.prefetch() //defaults to 3 pages
 * pk.next().done(page=>console.log(page)) //next() will share the same request that prefetch started and get that promise
 * pk.getPage(4).done(page=>console.log(page))
 * pk.pageCount, pk.objectCount, accessible for display
 */

// this is not done yet. needs req. doesn't export...

import {Deferred} from 'jquery-deferred'
import extend from 'extend'
import {apiOptions} from './kivaBase'
import req from './req'

class ManualPagedKiva {
  constructor(url, params, collection) {
    this.url = url
    this.params = extend(
      {},
      {page: 1, per_page: 100, app_id: apiOptions.app_id},
      params,
    )
    this.collection = collection
    this.pages = {}
    this.pageCount = 0
    this.objectCount = 0
    this.currentPage = 0
  }

  processPage(page) {
    this.pages[page.paging.page] = page[this.collection]
    return page[this.collection]
  }

  start() {
    return req.kiva.api
      .get(this.url, this.params)
      .then(result => {
        this.currentPage = result.paging.page
        this.pageCount = result.paging.pages
        this.objectCount = result.paging.total
        return result
      })
      .then(this.processPage.bind(this))
  }

  getPage(pageNum) {
    if (pageNum > this.pageCount || pageNum < 1) return Deferred().reject()
    if (this.pages[pageNum]) {
      return Deferred().resolve(this.pages[pageNum])
    }
    return this.sharedReq
      .request(this.url, extend({}, this.params, {page: pageNum}))
      .then(this.processPage.bind(this))
  }

  next() {
    if (this.currentPage >= this.pageCount) return Deferred().reject()
    this.currentPage++
    return this.getPage(this.currentPage)
  }

  prev() {
    if (this.currentPage <= 1) return Deferred().reject()
    this.currentPage--
    return this.getPage(this.currentPage)
  }

  prefetch(maxPages = 3) {
    const startPage = this.currentPage + 1
    Array.range(
      startPage,
      Math.min(maxPages, this.pageCount - startPage + 1),
    ).forEach(this.getPage.bind(this))
  }

  canNext() {
    return this.currentPage < this.pageCount
  }

  canPrev() {
    return this.currentPage > 1
  }
}

export default ManualPagedKiva
