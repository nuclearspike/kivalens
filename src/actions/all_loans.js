import { batch } from 'react-redux';
import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch';
import { loanDetailsUpdateMany } from './loan_details';
import { loansDLDone, loansDLProgress } from './loans_progress';
import { markDone, markLoading } from './loading';

export const loansSetAllIds = ids => {
  return {
    type: c.LOANS_SET_ALL,
    ids,
  };
};

// /{q: 'Paul'} gender: 'male', sector: 'Retail'
export const loansAllFetch = () => {
  return dispatch => {
    dispatch(markLoading('loans'));
    return new LoansSearch({ sort: 'popular' })
      .start()
      .progress(p => {
        dispatch(loansDLProgress(p));
      })
      .done(result => {
        // details need to be present prior to being referenced by ID to avoid needing checks.
        batch(() => {
          dispatch(loansDLDone());
          dispatch(loanDetailsUpdateMany(result));
          dispatch(loansSetAllIds(result.map(l => l.id)));
          dispatch(markDone('loans'));
        });
      });
  };
};
