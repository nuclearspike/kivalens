import {SET_CRITERIA_VARIABLE} from '../constants'

/**
 * this is for the actual object that holds all of the
 * values to search for and what gets saved as a saved search
 *
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
