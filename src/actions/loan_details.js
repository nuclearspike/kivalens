import * as c from '../constants'
import req from "../kiva-api/req"

export const loanDetailsUpdateMany = (loans) => {
  return {
    type: c.LOAN_DETAILS_UPDATE_MANY,
    loans,
  }
}

export const loanDetailsUpdate = (loan) => {
  return {
    type: c.LOAN_DETAILS_UPDATE,
    loan,
  }
}

export const loanDetailsFetch = (id) => {
  if (!id) {
    console.trace("NO ID!")
    throw new Error("NO ID?? Track it.")
  }
  return (dispatch) => {
    return req.kiva.api.loan(id).then((result) => dispatch(loanDetailsUpdate(result)))
  }
}

export const loanDetailsFetchMany = (ids) => {
  return (dispatch) => {
    return req.kiva.api.loans(ids).then((result) => dispatch(loanDetailsUpdateMany(result)))
  }
}
