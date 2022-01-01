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
  return (dispatch, getState) => {
    const { basket, loanDetails } = getState();

    // hasn't loaded yet.
    if (Object.keys(loanDetails) === 0) {
      return;
    }

    const toRemove = basket
      .map(bi => ({ hasDetails: !!loanDetails[bi.id], id: bi.id }))
      .filter(l => !l.hasDetails)
      .ids();

    if (toRemove.length > 0) {
      dispatch({
        type: c.BASKET_REMOVE_MANY,
        payload: { ids: toRemove },
      });
    }
  };
}

export function basketReplaceFromStore() {
  return dispatch => {
    dispatch({
      type: c.BASKET_REPLACE_FROM_STORE,
    });
  };
}
