import {SET_CRITERIA_VARIABLE} from '../constants'

/**
 * this is for the actual object that holds all of the
 * values to search for and what gets saved as a saved search
 *
 * NOT PLANNING TO USE THIS ANYMORE. ALL CRITERIA AND SEARCHES WILL BE DONE
 * IN THE PAGE, NOT IN REDUX.
 */

export default function criteria(state = {}, action) {
  switch (action.type) {
    case SET_CRITERIA_VARIABLE:
      return {
        ...state,
        [action.payload.name]: action.payload.value,
      }
    default:
      return state
  }
}
