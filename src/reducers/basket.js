import * as c from '../constants';
import 'linqjs';
import store from 'store2';

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
        const all = [...state];
        store.set('basket', JSON.stringify(all));
        return all;
      }
      // nothing changed return existing array.
      return state;
    }
    case c.BASKET_ADD_MANY: {
      const all = state.concat(payload.basketItems).distinct(bi => bi.id);
      store.set('basket', JSON.stringify(all));
      return all;
    }
    case c.BASKET_REPLACE_FROM_STORE: {
      const storedBasket = store.get('basket');
      if (storedBasket) {
        try {
          return JSON.parse(storedBasket);
        } catch {
          return [];
        }
      }
      return [];
    }
    case c.BASKET_REMOVE: {
      const all = state.filter(bi => payload.id !== bi.id);
      store.set('basket', JSON.stringify(all));
      return all;
    }
    case c.BASKET_CLEAN:
      // not called yet.
      // needs to check that the ID has loans that
      // are all still fundraising!
      // todo: not yet complete
      // this still needs a wrapping process that updates all of the loans in the basket before cleaning.
      // needs to also reduce basket amount to what fits based on available on the loan.
      return state.filter(l => l.status !== 'fundraising');
    case c.BASKET_CLEAR:
      store.set('basket', JSON.stringify([]));
      return [];
    default:
      return state;
  }
}
