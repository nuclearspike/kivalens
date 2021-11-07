import * as c from '../constants'

export function basketAdd(id, amount) {
  return {
    type: c.BASKET_ADD,
    id,
    amount,
  }
}

/*
 basketItems: array of object: [{id:, amount:}]
 */
export function basketAddMany(basketItems) {
  return {
    type: c.BASKET_ADD_MANY,
    basketItems,
  }
}

export function basketRemove(id) {
  return {
    type: c.BASKET_REMOVE,
    id,
  }
}

export function basketClear() {
  return {
    type: c.BASKET_CLEAR,
  }
}
