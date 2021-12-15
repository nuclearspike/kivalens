import * as c from '../constants';

export default function runtime(state = {}, action) {
  switch (action.type) {
    case c.SET_RUNTIME_VARIABLE:
      return {
        ...state,
        [action.payload.name]: action.payload.value,
      };
    default:
      return state;
  }
}
