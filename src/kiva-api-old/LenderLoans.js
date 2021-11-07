'use strict'

const PagedKiva = require("./PagedKiva")

class LenderLoans extends PagedKiva {
  constructor(lender_id, options) {
    super(`lenders/${lender_id}/loans.json`, {}, 'loans')
    this.options = options
  }
}

module.exports = LenderLoans
