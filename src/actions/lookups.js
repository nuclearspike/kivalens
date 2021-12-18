import { LOOKUPS_SET } from '../constants';
import { getLookups } from '../kivaClient';

// can be called multiple times, as soon as the values are set, then it won't re-issue
// another query to Kiva.
export const getLookupValues = () => {
  return (dispatch, getState) => {
    if (getState().lookups.populated) {
      return Promise.resolve();
    }
    return getLookups().then(lookups =>
      dispatch({
        type: LOOKUPS_SET,
        payload: lookups,
      }),
    );
  };
};
