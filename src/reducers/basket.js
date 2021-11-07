import * as c from '../constants'
import 'linqjs'

/**
 * this is all state actions on a basket
 * basket state is an array of objects [{id:, team_id: amount:}]
 */

// NOT DONE YET.
export default function basket(state = [], action) {
  switch (action.type) {
    case c.BASKET_ADD:
      state.push({id: action.id, team_id: action.team_id, amount: action.amount})
      return state.distinct(({id}) => id)
    case c.BASKET_ADD_MANY:
      // not correct... concat with array of ids vs that it's an array of objects.
      return state.concat(action.basketItems).distinct(bi => bi.id)
    case c.BASKET_REMOVE:
      return state.filter(bi => action.id !== bi.id)
    case c.BASKET_CLEAN:
      // needs to check that the ID has loans that
      // are all still fundraising!
      // todo: not yet complete
      return state
    case c.BASKET_CLEAR:
      return []
    default:
      return state
  }
}
