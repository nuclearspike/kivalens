import PagedKiva from './PagedKiva.mjs'
import ResultProcessors from './ResultProcessors.mjs'

class Partners extends PagedKiva {
  constructor() {
    super(`partners.json`, {per_page: 500}, 'partners')
  }

  start() {
    return super.start().then(ResultProcessors.processPartners)
  }
}

export default Partners
