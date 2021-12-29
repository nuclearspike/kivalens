import extend from 'extend';
import { CRITERIA_SET, CRITERIA_CLEAR, emptyCrit } from '../constants';

/**
 * this is for the actual object that holds all of the
 * values to search for and what gets saved as a saved search
 */

export default function criteria(state = emptyCrit, action) {
  switch (action.type) {
    case CRITERIA_SET:
      return extend(true, {}, action.payload);
    case CRITERIA_CLEAR:
      return extend(true, {}, emptyCrit);
    default:
      return state;
  }
}
