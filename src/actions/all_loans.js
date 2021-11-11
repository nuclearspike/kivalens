import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch';
import { loanDetailsUpdateMany } from './loan_details';
import { loansDLDone, loansDLProgress } from './loans_progress';

export const loansSetAllIds = ids => {
  return {
    type: c.LOANS_SET_ALL,
    ids,
  };
};

// /{q: 'Paul'} gender: 'male', sector: 'Retail'
export const loansAllFetch = () => {
  return dispatch => {
    return new LoansSearch({ sort: 'popular' })
      .start()
      .progress(p => {
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
