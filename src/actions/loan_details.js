import * as c from '../constants';
import req from '../kiva-api/req';

export const loanDetailsUpdateMany = loans => {
  return {
    type: c.LOAN_DETAILS_UPDATE_MANY_ARR,
    loans,
  };
};

export const loanDetailsUpdate = loan => {
  return {
    type: c.LOAN_DETAILS_UPDATE,
    loan,
  };
};

export const loanDetailsFetch = id => {
  if (!id) {
    // eslint-disable-next-line no-console
    console.trace('NO ID!');
    throw new Error('NO ID?? Trace it.');
  }
  return dispatch => {
    return req.kiva.api
      .loan(id)
      .then(result => dispatch(loanDetailsUpdate(result)));
  };
};

export const loanUpdateDynamic = (
  id,
  {
    // eslint-disable-next-line camelcase
    reservedAmount: basket_amount,
    // eslint-disable-next-line camelcase
    fundedAmount: funded_amount,
    // eslint-disable-next-line camelcase
    tags,
    status,
  },
) => {
  return {
    type: c.LOAN_DETAILS_UPDATE,
    loan: {
      id,
      kls_tags: tags, // .map(tag => tag.replace(/^#/g, '')),
      basket_amount,
      funded_amount,
      status,
    },
  };
};

export const loanDetailsFetchMany = ids => {
  return dispatch => {
    return req.kiva.api
      .loans(ids)
      .then(result => dispatch(loanDetailsUpdateMany(result)));
  };
};
