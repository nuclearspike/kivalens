import * as c from '../constants';

/**
 * here's all the loans in an array of ids.
 * */

// state = array of ids []
// details are in separate reducer: loan_details.js

export default function allLoans(state = [], action) {
  switch (action.type) {
    case c.LOANS_SET_ALL:
      return action.ids;
    default:
      return state;
  }
}
