import PagedKiva from './PagedKiva'
import ResultProcessors from './ResultProcessors'

class Partners extends PagedKiva {
  constructor() {
    super(`partners.json`, {per_page: 500}, 'partners')
  }

  start() {
    return super.start().then(ResultProcessors.processPartners)
  }
}

export default Partners
