'use strict'

const LenderLoans = require("./LenderLoans")
const extend = require('extend')
const Deferred = require("jquery-deferred").Deferred
require('linqjs')
require('datejs')

class LenderStatusLoans extends LenderLoans {
  constructor(lender_id, options) {
    //test for options.status... then can remove test in result()
    super(lender_id, extend(true, {}, options))
  }

  start() { //returns actual loan objects.
    return super.start().then(loans => {
      if (this.options.status)
        loans = loans.where(loan => loan.status == this.options.status)
      return loans
    })
  }
}

class LenderFundraisingLoans extends LenderStatusLoans {
  constructor(lender_id, options) {
    super(lender_id, extend(true, {}, options, {status: 'fundraising', fundraising_only: true}))
  }

  continuePaging(loans) {
    //only do this stuff if we are only wanting fundraising which is what we want now. but if open-sourced other
    //projects may want it for different reasons.
    if (this.options.fundraising_only && !loans.any(loan => loan.status == 'fundraising')) {
      //if all loans on the page would have expired. this could miss some mega-mega lenders in corner cases.
      var today = Date.today()
      //older loans do not have a planned_expiration_date field.
      if (loans.all(loan => !loan.planned_expiration_date || new Date(loan.planned_expiration_date).isBefore(today)))
        return false
    }
    return true
  }

  ids() {
    var d = Deferred()
    this.promise.fail(d.reject)
    super.start().then(loans => d.resolve(loans.select(loan => loan.id)))
    return d
  }
}

module.exports = LenderFundraisingLoans
