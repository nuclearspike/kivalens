import extend from 'extend';
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

// this will keep retrying every 500 ms until it passes the check that it has every loanDetails
// but why would it ever get called unless it already had them?
let checkIntervalAddValuesToLookup = null;
export const addValuesToLookup = (lookup, values) => {
  return (dispatch, getState) => {
    checkIntervalAddValuesToLookup = setInterval(() => {
      const { lookups, loanDetails } = getState();
      // only if we have all loan details
      if (Object.keys(loanDetails) > 0) {
        if (lookups[lookup]) {
          const payload = extend(true, [], lookups);
          payload[lookup] = lookups[lookup]
            .concat(values)
            .distinct()
            .orderBy();
          dispatch({
            type: LOOKUPS_SET,
            payload,
          });
          clearInterval(checkIntervalAddValuesToLookup);
        }
      }
    }, 500);
  };
};
