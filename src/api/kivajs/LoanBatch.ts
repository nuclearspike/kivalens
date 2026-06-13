import { chunk } from '../../lib/arrayUtils'
import type { OnProgress } from './PagedKiva'

// Lazy import to avoid circular dependency
let _req: any = null
async function getReq() {
  if (!_req) {
    const mod = await import('./req')
    _req = mod.req
  }
  return _req
}

export class LoanBatch {
  ids: number[]
  process: boolean

  constructor(idArr: number[], process = true) {
    this.ids = idArr
    this.process = process
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    const chunks = chunk(this.ids, 100)
    if (chunks.length === 0) throw new Error('No IDs to fetch')

    const r = await getReq()
    const allLoans: any[] = []

    for (const c of chunks) {
      onProgress?.({
        task: 'details',
        done: 0,
        total: 1,
        label: 'Downloading...',
      })
      const loans = await r.kiva.api.loans(c, this.process)
      allLoans.push(...loans)
      onProgress?.({
        task: 'details',
        done: allLoans.length,
        total: this.ids.length,
        label: `${allLoans.length}/${this.ids.length} downloaded`,
      })
    }

    return allLoans
  }
}
