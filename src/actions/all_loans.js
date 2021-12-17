import { batch } from 'react-redux';
import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';
import { loanDetailsUpdateMany } from './loan_details';
import { loansDLDone, loansDLProgress } from './loans_progress';
import { markDone, markLoading } from './loading';
import {partnersFastFetch, partnersKivaFetch} from './partner_details'
import { atheistListFetch } from './atheist_list';

export const loansSetAllIds = ids => ({
  type: c.LOANS_SET_ALL,
  ids,
});

// /{q: 'Paul'} gender: 'male', sector: 'Retail'
export const loansKivaFetch = () => {
  return dispatch => {
    dispatch(markLoading('loans'));
    return new LoansSearch({ sort: 'popular' }) //  q: 'mary',
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

export const loansFastFetch = () => {
  return (dispatch, getState) => {
    dispatch(markLoading('loans'));
    const { batchNum } = getState().runtime;
    return fetch(`${window.location.origin}/batches/${batchNum}/loans/0`)
      .catch(() => {
        // if the server restarted or something?
        dispatch(loansKivaFetch());
      })
      .then(async response => response.json())
      .then(loans => {
        ResultProcessors.processLoans(loans);
        batch(() => {
          dispatch(loanDetailsUpdateMany(loans));
          dispatch(loansSetAllIds(loans.map(l => l.id)));
          dispatch(markDone('loans'));
        });
      });
  };
};

export const loansSmartFetch = () => {
  return (dispatch, getState) => {
    const { batchNum } = getState().runtime;
    if (batchNum > 0) {
      return dispatch(loansFastFetch())
        .then(dispatch(partnersFastFetch()))
        .then(dispatch(atheistListFetch()));
    }
    return dispatch(loansKivaFetch())
      .then(dispatch(partnersKivaFetch()))
      .then(dispatch(atheistListFetch()));
  };
};
