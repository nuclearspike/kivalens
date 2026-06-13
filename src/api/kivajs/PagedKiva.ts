import { limiter, limiterTwo, apiOptions } from './kivaBase'
import { Request, ReqState } from './Request'
import type { ProgressEvent } from '../../types'

export type OnProgress = (event: ProgressEvent) => void

export class PagedKiva {
  url: string
  params: Record<string, any>
  collection: string
  requests: Request[]
  twoStage: boolean
  visitorFunct: ((item: any) => void) | null
  resultObjectCount: number
  totalObjectCount: number
  options: Record<string, any>
  onProgress: OnProgress

  private resolvePromise!: (value: any[]) => void
  private rejectPromise!: (reason: any) => void
  promise: Promise<any[]>

  constructor(url: string, params: Record<string, any>, collection: string) {
    this.url = url
    this.params = { per_page: 100, app_id: apiOptions.appId, ...params }
    this.collection = collection
    this.requests = []
    this.twoStage = false
    this.visitorFunct = null
    this.resultObjectCount = 0
    this.totalObjectCount = 0
    this.options = {}
    this.onProgress = () => {}

    this.promise = new Promise<any[]>((resolve, reject) => {
      this.resolvePromise = resolve
      this.rejectPromise = reject
    })
  }

  processFirstResponse(request: Request, response: any): void {
    this.totalObjectCount = request.raw_paging.total
    const pagesInResult = request.raw_paging.pages
    const totalPages =
      this.options?.max_pages
        ? Math.min(this.options.max_pages, pagesInResult)
        : pagesInResult

    // Create requests for pages 2 through totalPages
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).forEach((page) =>
      this.setupRequest(page)
    )

    this.processPage(request, response)

    if (request.continuePaging) {
      // Skip the first request (page 1 already processed), queue the rest
      this.requests.slice(1).forEach((req) => {
        req
          .fetch()
          .then((resp) => this.processPage(req, resp))
          .catch((err) => this.rejectPromise(err))
      })
    }
  }

  processPage(request: Request, response: any): void {
    if (this.twoStage) {
      this.processPageOfIds(request, response)
    } else {
      this.processPageOfData(request, response)
    }
  }

  processPageOfIds(request: Request, response: any): void {
    const completedPagesOfIds = this.requests.filter(
      (req) => req.ids.length > 0
    ).length
    if (completedPagesOfIds >= this.requests.length) {
      limiterTwo.concurrency = apiOptions.maxConcurrent
    }
    this.onProgress({
      task: 'ids',
      done: completedPagesOfIds,
      total: this.requests.length,
    })
    request
      .fetchFromIds(response)
      .then((detailResponse) =>
        this.processPageOfData(request, detailResponse)
      )
      .catch((err) => this.rejectPromise(err))
  }

  processPageOfData(request: Request, response: any): void {
    if (this.visitorFunct) response.forEach(this.visitorFunct)
    request.results = response
    this.resultObjectCount += response.length
    this.onProgress({
      task: 'details',
      done: this.resultObjectCount,
      total: this.totalObjectCount,
      label: `${this.resultObjectCount}/${this.totalObjectCount} downloaded`,
    })
    request.state = ReqState.done

    // Check if all requests are done
    if (this.requests.every((req) => req.state === ReqState.done)) {
      this.wrapUp()
      return
    }

    // Check if we should stop paging
    if (!this.continuePaging(response)) request.continuePaging = false

    const ignoreAfter = this.requests.find((req) => !req.continuePaging)
    if (ignoreAfter) {
      // Cancel all remaining requests after the one that called it quits
      for (const req of this.requests) {
        if (req.page > ignoreAfter.page && req.state !== ReqState.cancelled) {
          req.state = ReqState.cancelled
        }
      }
      // If all pages up to the cancel point are done, wrap up
      const pagesUpToCancel = this.requests.filter(
        (req) => req.page <= ignoreAfter.page
      )
      if (pagesUpToCancel.every((req) => req.state === ReqState.done)) {
        this.wrapUp()
      }
    }
  }

  // Overridden in subclasses
  continuePaging(_response: any): boolean {
    return true
  }

  wrapUp(): void {
    this.onProgress({ label: 'Processing...' })
    const resultObjects = this.requests
      .filter((req) => req.state === ReqState.done)
      .map((req) => req.results)
      .flat()
    this.onProgress({ complete: true })
    this.resolvePromise(resultObjects)
  }

  setupRequest(page: number): Request {
    const req = new Request(this.url, this.params, page, this.collection, false)
    this.requests.push(req)
    return req
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    this.onProgress = onProgress || (() => {})

    if (this.twoStage) {
      this.params = { ...this.params, ids_only: 'true' }
      limiter.concurrency = Math.max(4, Math.ceil(apiOptions.maxConcurrent * 0.5))
      limiterTwo.concurrency = Math.max(4, apiOptions.maxConcurrent)
    } else {
      limiter.concurrency = Math.max(4, apiOptions.maxConcurrent)
    }

    this.onProgress({ label: 'Getting the basics...' })

    const firstReq = this.setupRequest(1)
    firstReq
      .fetch()
      .then((result) => this.processFirstResponse(this.requests[0], result))
      .catch((err) => this.rejectPromise(err))

    return this.promise
  }
}
