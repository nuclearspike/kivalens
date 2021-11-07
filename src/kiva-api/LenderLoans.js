import PagedKiva from "./PagedKiva"

class LenderLoans extends PagedKiva {
  constructor(lenderIid, options) {
    super(`lenders/${lenderIid}/loans.json`, {}, 'loans')
    this.options = options
  }
}

export {LenderLoans}
export default LenderLoans
