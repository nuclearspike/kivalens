import extend from 'extend';
import { LOOKUPS_SET } from '../constants';

/**
 * payload is the name of the thing that's being loaded.
 */

export const defaultLookupState = {
  countries: [],
  sectors: [],
  activities: [],
  themes: [],
  tags: [],
  populated: false,
};

export default function lookups(state = defaultLookupState, action) {
  switch (action.type) {
    case LOOKUPS_SET:
      return extend({}, state, action.payload);
    default:
      return state;
  }
}
