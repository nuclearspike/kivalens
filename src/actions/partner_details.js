import { batch } from 'react-redux';
import * as c from '../constants';
import Partners from '../kiva-api/Partners';
import { markDone, markLoading } from './loading';

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

export const partnersAllFetch = () => {
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

// export const partnerDetailsFetchMany = (ids) => {
//   return (dispatch) => {
//     // return req.kiva.api.partners(ids).then((result) => dispatch(partnerDetailsUpdateMany(result)))
//   }
// }
