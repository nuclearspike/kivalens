/**
 * generic class for handling any of kiva's paged responses in a data-type agnostic way. create subclasses to
 * specialize, see LoansSearch. This will handle all paging issues. When it first encounters a new request, it
 * makes the request to find out how many total pages there are and it will automatically use a semaphore to
 * limit the number of simultaneous connections to be able to page across all data. It's possible to have it assume
 * more than one page of data from the start to make it slightly faster in the cases where that is true. But this
 * pattern seems ok, as it only will attempt to download more pages where it knows it is possible (and not presume it
 * is ok). This unit handles a lot of the API optimizations to dramatically increase responsiveness for all calls to
 * Kiva's API. Calling all pages sequentially, rather than concurrently, dramatically increases the time it takes to
 * cover all pages... which is why this calls API requests concurrently up to the max where Kiva's servers ignore
 * additional requests until previous requests are fulfilled as well as browser maximums to the same host to prevent
 * request timeouts.
 */

import extend from 'extend'
import {Deferred} from 'jquery-deferred'
import {apiOptions, semOne, semTwo} from './kivaBase'
import Request, {ReqState} from './Request'

// NOTES
// Deferred.always is Promise.finally

/*
    BAD DESIGN: Requests are reused. They first get the ids, then they get the loans for those ids. so their
    status will go from Done to Downloading again! UGH.
 */

class PagedKiva {
  constructor(url, params, collection) {
    this.url = url
    this.params = extend(
      {},
      {per_page: 100, app_id: apiOptions.app_id},
      params,
    )
    this.collection = collection
    this.promise = Deferred()
    this.requests = []
    this.twoStage = false
    this.visitorFunct = null
    this.result_object_count = 0
  }

  processFirstResponse(request, response) {
    this.total_object_count = request.raw_paging.total
    const pages_in_result = request.raw_paging.pages
    const total_pages =
      this.options && this.options.max_pages
        ? Math.min(this.options.max_pages, pages_in_result)
        : pages_in_result
    Array.range(2, total_pages - 1).forEach(page => this.setupRequest(page))
    this.processPage(request, response)
    if (request.continuePaging) {
      this.requests.skip(1).forEach(req => {
        // for every page of data from 2 to the max, queue up the requests.
        req
          .fetch()
          .fail(this.promise.reject)
          .done(resp => this.processPage(req, resp))
      })
    }
  }

  processPage(request, response) {
    // if twoStage then the initial requests only have ids.
    return this.twoStage
      ? this.processPageOfIds(request, response)
      : this.processPageOfData(request, response)
  }

  processPageOfIds(request, response) {
    request.state = ReqState.done
    const completedPagesOfIds = this.requests.filter(req => req.ids.length > 0)
      .length
    if (completedPagesOfIds >= this.requests.length)
      semTwo.capacity = apiOptions.max_concurrent

    this.updateProgress('ids')
    request.fetchFromIds(response).done(detailResponse => {
      this.updateProgress('ids')
      this.processPageOfData(request, detailResponse)
    })
  }

  updateProgress(task) {
    if (task === 'ids') {
      // console.log('requests', JSON.stringify(this.requests))
      const completedPagesOfIds = this.requests.filter(
        req => req.ids.length > 0,
      ).length
      this.notify({
        task: 'ids',
        done: completedPagesOfIds,
        total: this.requests.length,
      })
    } else if (task === 'details') {
      this.notify({
        task: 'details',
        done: this.result_object_count,
        total: this.total_object_count,
      })
    }
  }

  notify(notification) {
    // console.log('progress sent', this.collection, notification)
    this.promise.notify(notification)
  }

  processPageOfData(request, response) {
    if (this.visitorFunct) response.forEach(this.visitorFunct)
    request.results = response
    request.state = ReqState.done
    this.result_object_count += response.length
    this.updateProgress('details')
    // this.notify({task: 'details', done: this.result_object_count, total: this.total_object_count})

    // only care that we processed all pages. if the number of loans changes while paging, still continue.
    //
    // if (this.requests.all(req => req.state != ReqState.downloading || req.state != ReqState.ready)) {
    if (this.requests.all(req => req.state === ReqState.done)) {
      this.wrapUp('details')
      return
    }

    // this seems like it can miss stuff.
    if (!this.continuePaging(response)) request.continuePaging = false

    const ignoreAfter = this.requests.first(req => !req.continuePaging)
    if (ignoreAfter) {
      // if one is calling cancel on everything after
      // cancel all remaining requests.
      this.requests
        .skipWhile(req => req.page <= ignoreAfter.page)
        .filter(req => req.state !== ReqState.cancelled)
        .forEach(req => (req.state = ReqState.cancelled))
      // then once all pages up to the one that called it quits are done, wrap it up.
      if (
        this.requests
          .takeWhile(req => req.page <= ignoreAfter.page)
          .all(req => req.state === ReqState.done)
      ) {
        this.wrapUp('details')
      }
    }
  }

  // overridden in subclasses
  continuePaging(response) {
    return true
  }

  wrapUp(task) {
    const resultObjects = this.requests
      .filter(req => req.state === ReqState.done)
      .map(req => req.results)
      .flatten()
    this.updateProgress(task)
    // this.sendNotification('details')
    // this.notify({ [task]: {complete: true} })
    this.promise.resolve(resultObjects)
  }

  setupRequest(page) {
    const req = new Request(
      this.url,
      this.params,
      page,
      this.collection,
      false,
    )
    this.requests.push(req)
    return req
  }

  start() {
    if (this.twoStage) {
      extend(true, this.params, {ids_only: 'true'})
      semOne.capacity = Math.round(apiOptions.max_concurrent * 0.3)
      semTwo.capacity = Math.round(apiOptions.max_concurrent * 0.7) + 1
    } else {
      semOne.capacity = apiOptions.max_concurrent
    }
    // this.notify({label: 'Getting the basics...'})
    this.setupRequest(1)
      .fetch()
      .fail(this.promise.reject)
      .done(result => this.processFirstResponse(this.requests.first(), result))
    return this.promise
  }
}

export default PagedKiva
