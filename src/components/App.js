import React from 'react';
import PropTypes from 'prop-types';
import StyleContext from 'isomorphic-style-loader/StyleContext';
import { Provider, Provider as ReduxProvider } from 'react-redux';
import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import fetch from 'cross-fetch';
import ApplicationContext from './ApplicationContext';

/**
 * The top-level React component setting context (global) variables
 * that can be accessed from all the child components.
 *
 * https://facebook.github.io/react/docs/context.html
 *
 * Usage example:
 *
 *   const context = {
 *     history: createBrowserHistory(),
 *     store: createStore(),
 *   };
 *
 *   ReactDOM.render(
 *     <App context={context} insertCss={() => {}}>
 *       <Layout>
 *         <LandingPage />
 *       </Layout>
 *     </App>,
 *     container,
 *   );
 */

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: 'https://api.kivaws.org/graphql',
    fetch,
  }),
});

export default function App({ context, insertCss, children }) {
  // NOTE: If you need to add or modify header, footer etc. of the app,
  // please do that inside the Layout component.
  return (
    <Provider store={context.store}>
      <ApolloProvider client={client}>
        <StyleContext.Provider value={{ insertCss }}>
          <ApplicationContext.Provider value={{ context }}>
            {React.Children.only(children)}
          </ApplicationContext.Provider>
        </StyleContext.Provider>
      </ApolloProvider>
    </Provider>
  );
}

App.propTypes = {
  // Enables critical path CSS rendering
  // https://github.com/kriasoft/isomorphic-style-loader
  insertCss: PropTypes.func.isRequired,
  context: PropTypes.shape({
    // Universal HTTP client
    fetch: PropTypes.func.isRequired,
    pathname: PropTypes.string.isRequired,
    query: PropTypes.object,
    store: PropTypes.object,
    // Integrate Redux
    // http://redux.js.org/docs/basics/UsageWithReact.html
    ...ReduxProvider.childContextTypes,
  }).isRequired,
  children: PropTypes.element.isRequired,
};
