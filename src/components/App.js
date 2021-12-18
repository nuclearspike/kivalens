import React from 'react';
import PropTypes from 'prop-types';
import StyleContext from 'isomorphic-style-loader/StyleContext';
import { Provider, Provider as ReduxProvider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import apolloKivaClient from '../kivaClient';
import { getLookupValues } from '../actions/lookups';
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

export default function App({ context, insertCss, children }) {
  // NOTE: If you need to add or modify header, footer etc. of the app,
  // please do that inside the Layout component.
  context.store.dispatch(getLookupValues());
  return (
    <Provider store={context.store}>
      <ApolloProvider client={apolloKivaClient}>
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
