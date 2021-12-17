import { batch } from 'react-redux';
import * as c from '../constants';
import Partners from '../kiva-api/Partners.mjs';
import { markDone, markLoading } from './loading';
import { loansKivaFetch } from './all_loans';

export const partnerDetailsUpdateMany = partners => {
  return {
    type: c.PARTNER_DETAILS_UPDATE_MANY,
    partners,
  };
};

export const partnerDetailsUpdate = partner => {
  return {
    type: c.PARTNER_DETAILS_UPDATE,
    partner,
  };
};

export const partnersKivaFetch = () => {
  return dispatch => {
    dispatch(markLoading('partners'));
    return new Partners().start().then(result => {
      batch(() => {
        dispatch(partnerDetailsUpdateMany(result));
        dispatch(markDone('partners'));
      });
    });
  };
};

export const partnersFastFetch = () => {
  return (dispatch, getState) => {
    dispatch(markLoading('partners'));
    const { batchNum } = getState().runtime;
    return fetch(`${window.location.origin}/batches/${batchNum}/partners/0`)
      .catch(() => {
        // if the server restarted or something?
        dispatch(loansKivaFetch());
      })
      .then(async response => {
        const partners = await response.json();
        batch(() => {
          dispatch(partnerDetailsUpdateMany(partners));
          dispatch(markDone('partners'));
        });
      });
  };
};

// export const partnerDetailsFetchMany = (ids) => {
//   return (dispatch) => {
//     // return req.kiva.api.partners(ids).then((result) => dispatch(partnerDetailsUpdateMany(result)))
//   }
// }
