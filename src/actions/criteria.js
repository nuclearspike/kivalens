import debounce from 'lodash.debounce';
import * as c from '../constants';

// happens immediately. use for loading saved searches
export function alterCriteria(criteria) {
  return {
    type: c.SET_CRITERIA,
    payload: criteria,
  };
}

const debouncedAlter = debounce((criteria, dispatch) => {
  dispatch(alterCriteria(criteria));
}, 500);

// has a 500ms delay before action is dispatched. used when user input is in progress, to not cause a lot of refreshes
export function alterCriteriaDebounce(criteria) {
  return dispatch => debouncedAlter(criteria, dispatch);
}
