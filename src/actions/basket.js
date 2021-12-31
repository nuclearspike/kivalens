import * as c from '../constants';

/*
 basketItem: object: {id:, amount:}
 */
export function basketAdd(basketItem) {
  return {
    type: c.BASKET_ADD,
    payload: { basketItem },
  };
}

/*
 basketItems: array of object: [{id:, amount:}]
 */
export function basketAddMany(basketItems) {
  return {
    type: c.BASKET_ADD_MANY,
    payload: { basketItems },
  };
}

export function basketRemove(id) {
  return {
    type: c.BASKET_REMOVE,
    payload: { id },
  };
}

export function basketClear() {
  return {
    type: c.BASKET_CLEAR,
  };
}

export function basketClean() {
  return {
    type: c.BASKET_CLEAN,
  };
}

export function basketReplaceFromStore() {
  return {
    type: c.BASKET_REPLACE_FROM_STORE,
  };
}
