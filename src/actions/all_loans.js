import * as c from '../constants'
import {loanDetailsUpdateMany} from './loan_details'
import LoansSearch from '../kiva-api/LoansSearch'
import {loansDLDone, loansDLProgress} from './loans_progress'

export const loansSetAllIds = ids => {
  return {
    type: c.LOANS_SET_ALL,
    ids,
  };
};

export const loansAllFetch = () => {
  return dispatch => {
    // /{q: 'Paul'} gender: 'male', sector: 'Retail'
    return new LoansSearch()
      .start()
      .progress(p => {
        // console.log('progress received', p)
        dispatch(loansDLProgress(p));
      })
      .done(result => {
        // details need to be present prior to being referenced by ID to avoid needing checks.
        dispatch(loansDLDone());
        dispatch(loanDetailsUpdateMany(result));
        dispatch(loansSetAllIds(result.map(l => l.id)));
      });
  };
};
