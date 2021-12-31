import extend from 'extend';
import { LOADING_SET, LOADING_CLEAR } from '../constants';

/**
 * payload is the name of the thing that's being loaded.
 */

export default function loading(state = {}, action) {
  switch (action.type) {
    case LOADING_SET:
      state[action.payload] = true;
      // console.log('loading', action.payload);
      return extend({}, state);
    case LOADING_CLEAR:
      delete state[action.payload];
      // console.log('done loading', action.payload);
      return extend({}, state);
    default:
      return state;
  }
}
