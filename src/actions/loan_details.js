import * as c from '../constants';
import req from '../kiva-api/req';
import apolloKivaClient, {
  LOAN_DYNAMIC_FIELDS,
  LOANS_BY_POPULARITY,
  LOANS_DYNAMIC_FIELDS,
} from '../kivaClient';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';

export const updateDetailsForLoans = loans => ({
  type: c.LOAN_DETAILS_UPDATE_MANY_ARR,
  loans,
});

export const updateDetailsForLoan = loan => ({
  type: c.LOAN_DETAILS_UPDATE,
  loan,
});

export const fetchAPIDetailsForLoan = id => {
  if (!id) {
    // eslint-disable-next-line no-console
    console.trace('NO ID!');
    throw new Error('NO ID?? Trace it.');
  }
  return dispatch =>
    req.kiva.api
      .loan(id)
      .then(result => dispatch(updateDetailsForLoan(result)));
};

export const fetchAPIDetailsForLoans = ids => dispatch =>
  req.kiva.api
    .loans(ids)
    .then(result => dispatch(updateDetailsForLoans(result)));

export const fetchGQLDynamicDetailsForLoan = (id, includeExtras) => dispatch =>
  apolloKivaClient
    .query({
      query: LOAN_DYNAMIC_FIELDS,
      variables: { id, includeExtras },
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    })
    .then(({ data: { lend: { loan } } }) =>
      dispatch(updateDetailsForLoan(ResultProcessors.processGQLDynLoan(loan))),
    );

export const fetchGQLDynamicDetailsForLoans = (
  ids,
  includeExtras = false,
) => dispatch =>
  apolloKivaClient
    .query({
      query: LOANS_DYNAMIC_FIELDS,
      variables: { ids, includeExtras },
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    })
    .then(
      ({
        data: {
          lend: {
            loans: { values },
          },
        },
      }) => {
        dispatch(
          updateDetailsForLoans(values.map(ResultProcessors.processGQLDynLoan)),
        );
      },
    );

export const fetchGQLDynamicDetailsForPopularLoans = () => dispatch =>
  apolloKivaClient
    .query({
      query: LOANS_BY_POPULARITY,
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    })
    .then(({ data: { lend: { loans: { values } } } }) =>
      dispatch(
        updateDetailsForLoans(values.map(ResultProcessors.processGQLDynLoan)),
      ),
    );
