import extend from 'extend';
import { SET_CRITERIA } from '../constants';

/**
 * this is for the actual object that holds all of the
 * values to search for and what gets saved as a saved search
 */

export default function criteria(state = {}, action) {
  switch (action.type) {
    case SET_CRITERIA:
      console.log('SET_CRITERIA', action);
      return extend({}, action.payload);
    default:
      return state;
  }
}
