import { ApolloClient, gql, HttpLink, InMemoryCache } from '@apollo/client';
import fetch from 'cross-fetch';

const apolloKivaClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: 'https://api.kivaws.org/graphql',
    fetch,
  }),
});

const DYN_FIELDS_FRAGMENT = gql`
  fragment DYN_LOAN_FIELDS on LoanBasic {
    id
    tags
    status
    raisedDate
    loanFundraisingInfo {
      fundedAmount
      reservedAmount
    }
    loanAmount
    borrowers @include(if: $includeExtras) {
      pictured
      firstName
      gender
      borrowedAmount
      isPrimary
    }
    description @include(if: $includeExtras)
    terms @include(if: $includeExtras) {
      scheduled_payments: expectedPayments {
        amount
        due_date: dueToKivaDate
      }
    }
  }
`;

const lookups = gql`
  {
    lend {
      countryFacets {
        country {
          name
        }
      }
      sector {
        name
      }
      activity {
        name
      }
      loanThemeFilter {
        name
      }
      tag {
        name
      }
    }
  }
`;

export const LOAN_DYNAMIC_FIELDS = gql`
  query loanDynamic($id: Int!, $includeExtras: Boolean = false) {
    lend {
      loan(id: $id) {
        ...DYN_LOAN_FIELDS
      }
    }
  }
  ${DYN_FIELDS_FRAGMENT}
`;

export const LOANS_DYNAMIC_FIELDS = gql`
  query loansDynamic($ids: [Int]!, $includeExtras: Boolean = false) {
    lend {
      loans(filters: { loanIds: $ids, status: all }) {
        values {
          ...DYN_LOAN_FIELDS
        }
      }
    }
  }
  ${DYN_FIELDS_FRAGMENT}
`;

/**
 * Only used
 */
export const LOANS_BY_POPULARITY = gql`
  query loansPopular($includeExtras: Boolean = false) {
    lend {
      loans(sortBy: popularity) {
        values {
          ...DYN_LOAN_FIELDS
        }
      }
    }
  }
  ${DYN_FIELDS_FRAGMENT}
`;

// element to element, useful for filters and ordering.
const etoe = e => e;

// element to name, useful for many lookup values from Kiva.
const eton = e => e.name;

export const getLookups = async () => {
  return apolloKivaClient
    .query({
      query: lookups,
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    })
    .then(
      ({
        data: {
          lend: { countryFacets, sector, activity, loanThemeFilter, tag },
        },
      }) => ({
        countries: countryFacets.map(a => a.country.name).orderBy(etoe),
        sectors: sector.map(eton).orderBy(etoe),
        activities: activity.map(eton).orderBy(etoe),
        themes: loanThemeFilter.map(eton).orderBy(etoe),
        tags: tag
          .map(eton)
          .nonBlank()
          .orderBy(etoe),
        populated: true,
      }),
    );
};

export default apolloKivaClient;
