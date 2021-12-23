import extend from 'extend';
import * as c from '../constants';

/**
 * here's all the loan details.
 * state is an object where the keys are the loan ids
 *
 * state = object with keys being loan ids. this is a speed thing. referencing properties
 * of objects is highly optimized by V8 engine. It's one of the reasons why Chrome processes
 * references to obj.property calls much faster than Firefox (at least the last time I checked)
 * From what I know, it's because the properties are indexed in V8 but just iterated in FF
 * { 11111: { id: 11111, name: 'blah' ...}, 22222: { id: 22222, name: 'blah' ...} }
 * all loan ids are in separate reducer
 * action.loan = {loan object}
 * action.loans = array of {loan objects}
 * */

export default function loanDetails(state = {}, action) {
  switch (action.type) {
    case c.LOAN_DETAILS_UPDATE_MANY_ARR: {
      // not only adds but also replaces old versions.
      const toAdd = {};
      action.loans.forEach(loan => {
        toAdd[loan.id] = extend(true, {}, state[loan.id], loan);
      });
      // overrides old ones, introduces new ones.
      return extend({}, state, toAdd);
    }
    case c.LOAN_DETAILS_UPDATE_MANY_OBJ: {
      // does this work?? not used
      return extend(true, {}, state, action.payload);
    }
    case c.LOAN_DETAILS_UPDATE:
      return extend({}, state, {
        [action.loan.id]: extend(true, {}, state[action.loan.id], action.loan),
      });
    default:
      return state;
  }
}
