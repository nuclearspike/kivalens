import PagedKiva from './PagedKiva.mjs'

class LenderLoans extends PagedKiva {
  constructor(lenderIid, options) {
    super(`lenders/${lenderIid}/loans.json`, {}, 'loans')
    this.options = options
  }
}

export default LenderLoans
