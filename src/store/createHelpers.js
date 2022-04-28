function createGraphqlRequest(fetch) {
  return async function graphqlRequest(query, variables) {
    const fetchConfig = {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'KIVALENS.GraphQL/1.0 createHelpers.js',
      },
      body: JSON.stringify({ query, variables }),
      credentials: 'include',
    };
    const resp = await fetch('/graphql', fetchConfig);
    if (resp.status !== 200) throw new Error(resp.statusText);
    return resp.json();
  };
}

export default function createHelpers({ fetch, history }) {
  return {
    fetch,
    history,
    graphqlRequest: createGraphqlRequest(fetch),
  };
}
