import PagedKiva from './PagedKiva'
import ResultProcessors from './ResultProcessors'
import extend from 'extend'

/**
 *
 */
class LoansSearch extends PagedKiva {
  constructor(params, getDetails, max_repayment_date, preventVisitor) {
    if (getDetails === undefined) getDetails = true
    params = extend({}, {status: 'fundraising'}, params)
    if (max_repayment_date) extend(params, {sort_by: 'repayment_term'})
    super('loans/search.json', params, 'loans')
    this.max_repayment_date = max_repayment_date
    this.twoStage = getDetails
    if (!preventVisitor) {
      this.visitorFunct = ResultProcessors.processLoan
    }
  }

  continuePaging(loans) {
    if (this.max_repayment_date) {
      //if all loans on the given page won't repay until after the max, then we've passed (assuming. there could be oddball ones!)
      if (loans.all(loan => loan.kls_final_repayment && loan.kls_final_repayment.isAfter(this.max_repayment_date))) {
        return false
      }
    }
    return true
  }

  start() {
    //this seems problematic, break this into a "post process" function, support it in the base class?
    return super.start().fail(this.promise.reject).then(loans => {
      //after the download process is complete, if a max final payment date was specified, then remove all that don't match.
      //may want to re-enable this at some point but right now, it's a waste to throw any loans away.
      //could make this
      //if (this.max_repayment_date)
      //    loans = loans.filter(loan => loan.kls_final_repayment.isBefore(this.max_repayment_date))
      return loans
    })
  }
}

export default LoansSearch // prefer default
// export { LoansSearch } // deprecated
