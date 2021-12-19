import extend from 'extend';
import { HELPER_GRAPH_SET, HELPER_GRAPH_CLEAR } from '../constants';

/**
 * payload is the name of the thing that's being loaded.
 */

export const defaultHelperGraphState = {
  config: null,
  selected: null, // criteria name, set onFocus
};

export default function helperGraphs(state = defaultHelperGraphState, action) {
  switch (action.type) {
    case HELPER_GRAPH_SET:
      return extend({}, state, action.payload);
    case HELPER_GRAPH_CLEAR:
      return defaultHelperGraphState;
    default:
      return state;
  }
}
