import { batch } from 'react-redux';
import dayjs from 'dayjs';
import * as c from '../constants';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';
import { combineIdsAndLoans } from '../utils/linqextras.mjs';
import {
  updateDetailsForLoans,
  fetchGQLDynamicDetailsForLoans,
  fetchGQLDynamicDetailsForPopularLoans,
} from './loan_details';
import { loansDLDone, loansDLProgress } from './loans_progress';
import { markDone, markLoading } from './loading';
import { partnersFastFetch, partnersKivaFetch } from './partner_details';
import { atheistListFetch } from './atheist_list';
import { basketClean } from './basket';

export const loansSetAllIds = ids => ({
  type: c.LOANS_SET_ALL,
  ids,
});

// /{q: 'Paul'} gender: 'male', sector: 'Retail'
export const loansKivaFetch = () => {
  return dispatch => {
    dispatch(markLoading('loans'));
    return new LoansSearch() //  q: 'mary', { region: 'as' } { sort: 'newest' }
      .start()
      .progress(p => {
        dispatch(loansDLProgress(p));
      })
      .fail(e => console.error(e))
      .done(result => {
        // details need to be present prior to being referenced by ID to avoid needing checks.
        batch(() => {
          dispatch(loansDLDone());
          dispatch(updateDetailsForLoans(result));
          dispatch(loansSetAllIds(result.ids()));
          dispatch(basketClean());
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
        // if the server restarted or something? any way the batchNum is not valid
        // eslint-disable-next-line no-use-before-define
        dispatch(loansSmartFetch(true));
        // this recovers from a failed load from KL server by restarting the load from Kiva Servers.
      })
      .then(response => response.json())
      .then(loans => {
        ResultProcessors.processLoans(loans);
        // batch reduces UI updates to one
        batch(() => {
          dispatch(updateDetailsForLoans(loans));
          dispatch(loansSetAllIds(loans.ids()));
          dispatch(basketClean());
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
                updateDetailsForLoans(
                  keywords.map(kw => ({
                    id: kw.id,
                    kls_use_or_descr_arr: kw.t,
                  })),
                ),
              );
            });
        }, 200);
      });
  };
};

export const loansSmartFetch = (forceKiva = false) => {
  return (dispatch, getState) => {
    const { batchNum } = getState().runtime;
    // const batchNum = 0; uncomment to force to use Kiva rather than KL server
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

let currentlyDoingFreshTick = false;
export const keepFreshTick = () => {
  if (currentlyDoingFreshTick) {
    console.log('keepFreshTick', 'currentlyDoingFreshTick === true');
    return () => true;
  }
  return (dispatch, getState) => {
    // get the updated funded/basket amounts for the most popular loans so sorts work right.
    currentlyDoingFreshTick = true;
    dispatch(fetchGQLDynamicDetailsForPopularLoans())
      .then(() => {
        const { allLoanIds, loanDetails } = getState();
        const loans = combineIdsAndLoans(allLoanIds, loanDetails);

        // first find any that have never been updated.
        let readyToUpdate = loans.filter(l => l.kl_dyn_updated === undefined);

        // if all have been updated, then start to find loans that haven't updated recently
        if (readyToUpdate.length === 0) {
          // all loans have gone through at least one update.
          const fiveMinsAgo = dayjs()
            .subtract(5, 'minute')
            .toDate()
            .getTime();

          readyToUpdate = loans
            .orderBy(l => l.kl_dyn_updated)
            .filter(l => l.kl_dyn_updated < fiveMinsAgo);
        }

        // 20 is a Kiva limit or I would do more.
        dispatch(fetchGQLDynamicDetailsForLoans(readyToUpdate.take(20).ids()));
      })
      .finally(() => {
        currentlyDoingFreshTick = false;
      });
  };
};

// this only sets All IDs to good ones, but does not clear old data from loanDetails
export const pruneOldLoans = () => {
  return (dispatch, getState) => {
    const { allLoanIds, loanDetails } = getState();
    const goodIds = combineIdsAndLoans(allLoanIds, loanDetails)
      .fundraising()
      .ids();
    dispatch(loansSetAllIds(goodIds.ids()));
  };
};
