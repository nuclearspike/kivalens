import extend from 'extend';
import { LOADING_SET, LOADING_CLEAR } from '../constants';

/**
 * .payload is the name of the thing that's being loaded.
 */

export default function loading(state = {}, action) {
  switch (action.type) {
    case LOADING_SET:
      // if state shows this thing is not loading then add it and pass back a new object
      if (!state[action.payload]) {
        state[action.payload] = true;
        return extend({}, state);
      }
      // otherwise nothing changed, so don't pretend it changed.
      return state;
    case LOADING_CLEAR:
      // if state shows this thing is loading then delete it and pass back a new object
      if (state[action.payload]) {
        delete state[action.payload];
        return extend({}, state);
      }
      // otherwise nothing changed, so don't pretend it changed.
      return state;
    default:
      return state;
  }
}
