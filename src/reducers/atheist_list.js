import { ATHEIST_LIST_SET } from '../constants';

/**
 * payload is the name of the thing that's being loaded.
 */

export default function atheistList(state = {}, action) {
  switch (action.type) {
    case ATHEIST_LIST_SET: {
      return action.payload;
    }
    default:
      return state;
  }
}
