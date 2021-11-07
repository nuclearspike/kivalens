import * as c from '../constants'
import extend from 'extend'

/**
 * here's all the loan details.
 * state is an object where the keys are the loan ids
 *
 * state = object with keys being loan ids.
 * { 11111: { id: 11111, name: 'blah' ...}, 22222: { id: 22222, name: 'blah' ...} }
 * all loan ids are in separate reducer
 * action.loan = {loan object}
 * action.loans = array of {loan objects}
 **/

export default function loan_details(state = {}, action) {
  switch (action.type) {
    case c.LOAN_DETAILS_UPDATE_MANY:
      // not only adds but also replaces old versions.
      const toAdd = {}
      action.loans.forEach(loan => toAdd[loan.id] = loan)
      // overrides old ones, introduces new ones.
      return extend(true, {}, state, toAdd)
    case c.LOAN_DETAILS_UPDATE:
      return extend(true, {}, state, {[action.loan.id]: action.loan})
    default:
      return state
  }
}
