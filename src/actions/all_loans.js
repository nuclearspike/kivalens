import { batch } from 'react-redux';
import dayjs from 'dayjs';
import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';
import { combineIdsAndLoans } from '../utils/linqextras.mjs';
import {
  loanDetailsUpdateMany,
  loanUpdateDynamicFetchMany,
} from './loan_details';
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
          dispatch(loansSetAllIds(result.ids()));
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
          dispatch(loansSetAllIds(loans.ids()));
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

export const keepFreshTick = () => {
  return (dispatch, getState) => {
    const { allLoanIds, loanDetails } = getState();
    const loans = combineIdsAndLoans(allLoanIds, loanDetails);

    // first find any that have never been updated.
    let readyToUpdate = loans.filter(l => l.kl_dyn_updated === undefined);

    // if all have been updated, then start to find
    if (readyToUpdate.length === 0) {
      // all loans have gone through at least one update.
      const fiveMinsAgo = dayjs()
        .subtract(5, 'minute')
        .toDate()
        .getTime();
      readyToUpdate = loans
        .orderBy(l => l.kl_dyn_updated)
        .filter(l => l.kl_dyn_updated < fiveMinsAgo); // not sure this works.
    }

    dispatch(loanUpdateDynamicFetchMany(readyToUpdate.take(20).ids()));
  };
};

export const pruneOldLoans = () => {
  return (dispatch, getState) => {
    const { allLoanIds, loanDetails } = getState();
    const goodIds = combineIdsAndLoans(allLoanIds, loanDetails).ids();
    dispatch(loansSetAllIds(goodIds.ids()));
  };
};
