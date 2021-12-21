import * as c from '../constants';
import req from '../kiva-api/req';
import apolloKivaClient, {
  LOAN_DYNAMIC_FIELDS,
  LOANS_DYNAMIC_FIELDS,
} from '../kivaClient';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';

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

export const loanUpdateDynamic = dynLoan => {
  return {
    type: c.LOAN_DETAILS_UPDATE,
    loan: ResultProcessors.processGQLDynLoan(dynLoan),
  };
};

export const loanUpdateDynamicFetchOne = id => {
  return dispatch => {
    apolloKivaClient
      .query({
        query: LOAN_DYNAMIC_FIELDS,
        variables: { id },
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      })
      .then(result => {
        const {
          data: {
            lend: { loan },
          },
        } = result;
        dispatch(loanUpdateDynamic(loan.id, loan));
      });
  };
};

export const loanDetailsFetchMany = ids => dispatch =>
  req.kiva.api
    .loans(ids)
    .then(result => dispatch(loanDetailsUpdateMany(result)));

export const loanUpdateDynamicFetchMany = ids => {
  return dispatch => {
    return apolloKivaClient
      .query({
        query: LOANS_DYNAMIC_FIELDS,
        variables: { ids },
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      })
      .then(result => {
        const {
          data: {
            lend: {
              loans: { values },
            },
          },
        } = result;
        const toUpdate = values.map(ResultProcessors.processGQLDynLoan);
        dispatch(loanDetailsUpdateMany(toUpdate));
      });
  };
};
