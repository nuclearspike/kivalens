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
    loanFundraisingInfo {
      fundedAmount
      reservedAmount
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
  query loanDynamic($id: Int!) {
    lend {
      loan(id: $id) {
        ...DYN_LOAN_FIELDS
      }
    }
  }
  ${DYN_FIELDS_FRAGMENT}
`;

export const LOANS_DYNAMIC_FIELDS = gql`
  query loansDynamic($ids: [Int]!) {
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

// element to element, useful for filters and ordering.
const etoe = e => e;

// element to name, useful for many lookup values from Kiva.
const eton = e => e.name;

export const getLookups = async () => {
  return apolloKivaClient
    .query({
      query: lookups,
      // fetchPolicy: 'cache-and-network',
      errorPolicy: 'ignore',
    })
    .then(({ data: { lend } }) => ({
      countries: lend.countryFacets.map(a => a.country.name).orderBy(etoe),
      sectors: lend.sector.map(eton).orderBy(etoe),
      activities: lend.activity.map(eton).orderBy(etoe),
      themes: lend.loanThemeFilter.map(eton).orderBy(etoe),
      tags: lend.tag
        .map(eton)
        .filter(etoe)
        .orderBy(etoe),
      populated: true,
    }));
};

export default apolloKivaClient;
