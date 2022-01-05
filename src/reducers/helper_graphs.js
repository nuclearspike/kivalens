import extend from 'extend';
import {
  HELPER_GRAPH_SET,
  HELPER_GRAPH_CLEAR,
  CRITERIA_CLEAR,
} from '../constants';

/**
 * payload is the name of the thing that's being loaded.
 */

export const defaultHelperGraphState = {
  config: null,
  data: null,
  selected: null, // criteria name, set onFocus
};

export default function helperGraphs(state = defaultHelperGraphState, action) {
  switch (action.type) {
    case HELPER_GRAPH_SET:
      return action.payload;
    // return extend({}, state, state, action.payload);
    case CRITERIA_CLEAR:
    case HELPER_GRAPH_CLEAR:
      return extend({}, defaultHelperGraphState);
    default:
      return state;
  }
}
