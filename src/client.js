import React from 'react';
import ReactDOM from 'react-dom';
import deepForceUpdate from 'react-deep-force-update';
import queryString from 'query-string';
import 'whatwg-fetch';
import { createPath } from 'history';
import { initializeIcons } from '@uifabric/icons';
import App from './components/App';
import createFetch from './createFetch';
import configureStore from './store/configureStore';
import history from './history';
import { updateMeta } from './DOMUtils';
import router from './router';
import './utils/linqextras.mjs';

import { setAPIOptions } from './kiva-api/kivaBase.mjs';
import { keepFreshTick, loansSmartFetch } from './actions/all_loans';
import { setRuntimeVariable } from './actions/runtime';
import registerStorageWatcher from './utils/registerStorageWatcher'
import { basketReplaceFromStore } from './actions/basket'

initializeIcons();

setAPIOptions({ app_id: 'org.kiva.kivalens' });

// Enables critical path CSS rendering
// https://github.com/kriasoft/isomorphic-style-loader
const insertCss = (...styles) => {
  // eslint-disable-next-line no-underscore-dangle
  const removeCss = styles.map(x => x._insertCss());
  return () => {
    removeCss.forEach(f => f());
  };
};

// Global (context) variables that can be easily accessed from any React component
// https://facebook.github.io/react/docs/context.html
const context = {
  // Universal HTTP client
  fetch: createFetch(fetch, {
    baseUrl: window.App.apiUrl,
  }),
  // Initialize a new Redux store
  // http://redux.js.org/docs/basics/UsageWithReact.html
  store: configureStore(window.App.state, { history }),
  storeSubscription: null,
};

const { dispatch } = context.store;

dispatch(loansSmartFetch());

setTimeout(() => {
  dispatch(setRuntimeVariable({ name: 'onClient', value: true }));
}, 100);

setInterval(() => dispatch(keepFreshTick()), 60000);

const container = document.getElementById('app');
let currentLocation = history.location;
let appInstance;

const scrollPositionsHistory = {};

const loadBasketFromStorage = () => dispatch(basketReplaceFromStore());

// keep basket in sync between site tabs.
registerStorageWatcher('basket', loadBasketFromStorage);

// initial basket load
loadBasketFromStorage();

// Re-render the app when window.location changes
async function onLocationChange(location, action) {
  // Remember the latest scroll position for the previous location
  scrollPositionsHistory[currentLocation.key] = {
    scrollX: window.pageXOffset,
    scrollY: window.pageYOffset,
  };
  // Delete stored scroll position for next page if any
  if (action === 'PUSH') {
    delete scrollPositionsHistory[location.key];
  }
  currentLocation = location;

  const isInitialRender = !action;
  try {
    context.pathname = location.pathname;
    context.query = queryString.parse(location.search);

    // Traverses the list of routes in the order they are defined until
    // it finds the first route that matches provided URL path string
    // and whose action method returns anything other than `undefined`.
    const route = await router.resolve(context);

    // Prevent multiple page renders during the routing process
    if (currentLocation.key !== location.key) {
      return;
    }

    if (route.redirect) {
      history.replace(route.redirect);
      return;
    }

    const renderReactApp = isInitialRender ? ReactDOM.hydrate : ReactDOM.render;
    appInstance = renderReactApp(
      <App context={context} insertCss={insertCss}>
        {route.component}
      </App>,
      container,
      () => {
        if (isInitialRender) {
          // Switch off the native scroll restoration behavior and handle it manually
          // https://developers.google.com/web/updates/2015/09/history-api-scroll-restoration
          if (window.history && 'scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
          }

          const elem = document.getElementById('css');
          if (elem) elem.parentNode.removeChild(elem);
          return;
        }

        document.title = route.title;

        updateMeta('description', route.description);
        // Update necessary tags in <head> at runtime here, ie:
        // updateMeta('keywords', route.keywords);
        // updateCustomMeta('og:url', route.canonicalUrl);
        // updateCustomMeta('og:image', route.imageUrl);
        // updateLink('canonical', route.canonicalUrl);
        // etc.

        let scrollX = 0;
        let scrollY = 0;
        const pos = scrollPositionsHistory[location.key];
        if (pos) {
          scrollX = pos.scrollX;
          scrollY = pos.scrollY;
        } else {
          const targetHash = location.hash.substr(1);
          if (targetHash) {
            const target = document.getElementById(targetHash);
            if (target) {
              scrollY = window.pageYOffset + target.getBoundingClientRect().top;
            }
          }
        }

        // Restore the scroll position if it was saved into the state
        // or scroll to the given #hash anchor
        // or scroll to top of the page
        window.scrollTo(scrollX, scrollY);

        // Google Analytics tracking. Don't send 'pageview' event after
        // the initial rendering, as it was already sent
        if (window.ga) {
          window.ga('send', 'pageview', createPath(location));
        }
      },
    );
  } catch (error) {
    if (__DEV__) {
      throw error;
    }

    console.error(error);

    // Do a full page reload if error occurs during client-side navigation
    if (!isInitialRender && currentLocation.key === location.key) {
      console.error('RSK will reload your page after error');
      window.location.reload();
    }
  }
}

// Handle client-side navigation by using HTML5 History API
// For more information visit https://github.com/mjackson/history#readme
history.listen(onLocationChange);
onLocationChange(currentLocation);

// Enable Hot Module Replacement (HMR)
if (module.hot) {
  module.hot.accept('./router', () => {
    if (appInstance && appInstance.updater.isMounted(appInstance)) {
      // Force-update the whole tree, including components that refuse to update
      deepForceUpdate(appInstance);
    }

    onLocationChange(currentLocation);
  });
}
