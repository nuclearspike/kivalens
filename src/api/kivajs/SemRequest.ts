import { limiter, serialize, getUrl } from './kivaBase'

export class SemRequest {
  private serverAndBasePath: string
  private asJSON: boolean
  private requestedWith: boolean
  private defaultParams: Record<string, any>
  private ttlSecs: number
  private cache: Map<string, { promise: Promise<any>; requested: number }>

  constructor(
    serverAndBasePath: string,
    asJSON: boolean,
    requestedWith: boolean,
    defaultParams: Record<string, any>,
    ttlSecs: number
  ) {
    this.serverAndBasePath = serverAndBasePath
    this.asJSON = asJSON
    this.requestedWith = requestedWith
    this.defaultParams = defaultParams
    this.ttlSecs = ttlSecs || 0
    this.cache = new Map()
  }

  async semGet(
    path: string,
    params?: Record<string, any>
  ): Promise<any> {
    return limiter(() => this.raw(path, params))
  }

  async raw(
    path: string,
    params?: Record<string, any>
  ): Promise<any> {
    const mergedParams = serialize({ ...this.defaultParams, ...params })
    const qs = mergedParams ? `?${mergedParams}` : ''
    return getUrl(`${this.serverAndBasePath}${path}${qs}`, {
      parseJSON: this.asJSON,
      includeRequestedWith: this.requestedWith,
    })
  }

  async get(
    path?: string,
    params?: Record<string, any>,
    getOpts?: { semaphored?: boolean; useCache?: boolean }
  ): Promise<any> {
    const p = path || ''
    const par = params || {}
    const opts = { semaphored: true, useCache: true, ...getOpts }

    const key = `${p}?${JSON.stringify(par)}`

    if (opts.useCache) {
      const cached = this.cache.get(key)
      if (cached) {
        return cached.promise
      }
    }

    const promise = opts.semaphored
      ? this.semGet(p, par)
      : this.raw(p, par)

    if (this.ttlSecs > 0) {
      this.cache.set(key, { promise, requested: Date.now() })
      setTimeout(() => {
        this.cache.delete(key)
      }, this.ttlSecs * 1000)
      // Never serve a failure from cache — evict so the next call retries.
      promise.catch(() => {
        this.cache.delete(key)
      })
    }

    return promise
  }
}
