import { limiter, limiterTwo, serialize, apiOptions, getUrl } from './kivaBase'

export const ReqState = {
  ready: 1,
  downloading: 2,
  done: 3,
  failed: 4,
  cancelled: 5,
} as const

export type ReqState = (typeof ReqState)[keyof typeof ReqState]

export class Request {
  url: string
  params: Record<string, any>
  page: number
  state: ReqState
  collection: string
  isSingle: boolean
  ids: number[]
  results: any[]
  continuePaging: boolean
  raw_paging: any
  raw_result: any

  constructor(
    url: string,
    params: Record<string, any>,
    page: number,
    collection: string,
    isSingle: boolean
  ) {
    this.url = url
    this.params = params
    this.page = page || 1
    this.state = ReqState.ready
    this.collection = collection
    this.isSingle = isSingle
    this.ids = []
    this.results = []
    this.continuePaging = true
    this.raw_result = {}
  }

  async fetch(): Promise<any> {
    return limiter(async () => {
      if (this.state === ReqState.cancelled) {
        return undefined
      }

      if (this.page) {
        this.params = { ...this.params, page: this.page }
      }

      try {
        const result = await Request.get(this.url, this.params)
        if (result.paging && result.paging.page === 1) {
          this.raw_paging = result.paging
        }

        if (this.collection) {
          return this.isSingle
            ? result[this.collection][0]
            : result[this.collection]
        }
        return result
      } catch (e) {
        this.state = ReqState.failed
        throw e
      }
    })
  }

  async fetchFromIds(ids: number[]): Promise<any> {
    this.state = ReqState.downloading
    this.ids = ids

    return limiterTwo(async () => {
      if (this.state === ReqState.cancelled) {
        return undefined
      }

      try {
        const result = await Request.get(
          `${this.collection}/${ids.join(',')}.json`,
          {}
        )
        return result[this.collection]
      } catch (e) {
        this.state = ReqState.failed
        throw e
      }
    })
  }

  static async get(path: string, params: Record<string, any>): Promise<any> {
    const allParams = { ...params, app_id: apiOptions.appId }
    return getUrl(
      `https://api.kivaws.org/v1/${path}?${serialize(allParams)}`,
      { parseJSON: true }
    )
  }

  static async semGet(
    url: string,
    params: Record<string, any>,
    collection?: string,
    isSingle?: boolean
  ): Promise<any> {
    const result = await limiter(() => Request.get(url, params))
    if (collection) {
      return isSingle ? result[collection][0] : result[collection]
    }
    return result
  }
}
