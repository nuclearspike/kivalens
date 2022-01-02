// import extend from 'extend';
import { DISPLAYED_RESULTS_SET } from '../constants';

const defaultDisplayedResults = {
  // time ran? index? hash of crit?
  matching: [],
};

export default function displayedResults(
  state = defaultDisplayedResults,
  action,
) {
  switch (action.type) {
    case DISPLAYED_RESULTS_SET: {
      return { matching: action.payload.matching };
    }
    default:
      return state;
  }
}
