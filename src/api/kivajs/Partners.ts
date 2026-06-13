import { PagedKiva } from './PagedKiva'
import type { OnProgress } from './PagedKiva'
import { ResultProcessors } from './ResultProcessors'

export class Partners extends PagedKiva {
  constructor() {
    super('partners.json', { per_page: 500 }, 'partners')
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    const partners = await super.start(onProgress)
    return ResultProcessors.processPartners(partners)
  }
}
