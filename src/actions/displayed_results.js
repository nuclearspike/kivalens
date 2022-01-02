import { DISPLAYED_RESULTS_SET } from '../constants';
import performSearch from '../components/Search/performSearch'

export const displayedResultsSet = matching => {
  return {
    type: DISPLAYED_RESULTS_SET,
    payload: { matching },
  };
};

// uses the current criteria to produce results for display.
export const displayedResultsSetFromCriteria = () => {
  return (dispatch, getState) => {
    const appState = getState();
    const matching = performSearch(appState);
    dispatch(displayedResultsSet(matching));
  };
};
