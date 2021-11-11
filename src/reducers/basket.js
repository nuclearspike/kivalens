import * as c from '../constants';
import 'linqjs';

/**
 * this is all state actions on a basket
 * basket state is an array of objects [{id:, amount:}]
 */

// NOT DONE YET.
export default function basket(state = [], { type, payload }) {
  switch (type) {
    case c.BASKET_ADD: {
      const { basketItem } = payload;
      // add loan that was sent.
      if (!state.some(({ id }) => basketItem.id === id)) {
        state.push(basketItem);
        // must be a new object or tests won't think basket changed.
        return [...state];
      }
      // nothing changed return existing array.
      return state;
    }
    case c.BASKET_ADD_MANY:
      return state.concat(payload.basketItems).distinct(bi => bi.id);
    case c.BASKET_REMOVE:
      return state.filter(bi => payload.id !== bi.id);
    case c.BASKET_CLEAN:
      // not called yet.
      // needs to check that the ID has loans that
      // are all still fundraising!
      // todo: not yet complete
      // this still needs a wrapping process that updates all of the loans in the basket before cleaning.
      // needs to also reduce basket amount to what fits based on available on the loan.
      return state.filter(l => l.status !== 'fundraising');
    case c.BASKET_CLEAR:
      return [];
    default:
      return state;
  }
}
