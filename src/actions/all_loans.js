import { batch } from 'react-redux';
import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';
import { loanDetailsUpdateMany } from './loan_details';
import { loansDLDone, loansDLProgress } from './loans_progress';
import { markDone, markLoading } from './loading';
import { partnersFastFetch, partnersKivaFetch } from './partner_details';
import { atheistListFetch } from './atheist_list';

export const loansSetAllIds = ids => ({
  type: c.LOANS_SET_ALL,
  ids,
});

// /{q: 'Paul'} gender: 'male', sector: 'Retail'
export const loansKivaFetch = () => {
  return dispatch => {
    dispatch(markLoading('loans'));
    return new LoansSearch({ sort: 'newest' }) //  q: 'mary', { region: 'as' }
      .start()
      .progress(p => {
        dispatch(loansDLProgress(p));
      })
      .fail(e => console.error(e))
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
  const options = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  return (dispatch, getState) => {
    dispatch(markLoading('loans'));
    const { batchNum } = getState().runtime;
    return fetch(`/batches/${batchNum}/loans`, options)
      .catch(() => {
        // if the server restarted or something?
        // eslint-disable-next-line no-use-before-define
        dispatch(loansSmartFetch(true));
      })
      .then(async response => response.json())
      .then(loans => {
        ResultProcessors.processLoans(loans);
        batch(() => {
          dispatch(loanDetailsUpdateMany(loans));
          dispatch(loansSetAllIds(loans.map(l => l.id)));
          dispatch(markDone('loans'));
        });
      })
      .then(() => {
        // set a timeout so that the page renders before keywords downloaded.
        setTimeout(() => {
          fetch(`/batches/${batchNum}/keywords`, options)
            .then(response => response.json())
            .then(keywords => {
              // update all use or descr arrays
              dispatch(
                loanDetailsUpdateMany(
                  keywords.map(kw => ({
                    id: kw.id,
                    kls_use_or_descr_arr: kw.t,
                  })),
                ),
              );
            });
        }, 100);
      });
  };
};

export const loansSmartFetch = (forceKiva = false) => {
  return (dispatch, getState) => {
    const { batchNum } = getState().runtime;
    if (batchNum > 0 && !forceKiva) {
      return dispatch(loansFastFetch())
        .then(dispatch(partnersFastFetch()))
        .then(dispatch(atheistListFetch()));
    }
    return dispatch(loansKivaFetch())
      .then(dispatch(partnersKivaFetch()))
      .then(dispatch(atheistListFetch()));
  };
};
