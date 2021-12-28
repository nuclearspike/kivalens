/* eslint-disable global-require */

// The top-level (parent) route
const routes = {
  path: '',

  // Keep in mind, routes are evaluated in order
  children: [
    {
      path: '',
      load: () => import(/* webpackChunkName: 'home' */ './home'),
    },
    {
      path: '/contact',
      load: () => import(/* webpackChunkName: 'contact' */ './contact'),
    },
    // {
    //   path: '/login',
    //   load: () => import(/* webpackChunkName: 'login' */ './login'),
    // },
    // {
    //   path: '/register',
    //   load: () => import(/* webpackChunkName: 'register' */ './register'),
    // },
    {
      path: '/about',
      load: () => import(/* webpackChunkName: 'about' */ './about'),
    },
    {
      path: '/search',
      load: () => import(/* webpackChunkName: 'search' */ './search'),
    },
    // {
    //   path: '/search/customize',
    //   load: () => import(/* webpackChunkName: 'search' */ './customize'),
    // },
    {
      path: '/search/:id',
      load: () => import(/* webpackChunkName: 'search' */ './search'),
    },
    {
      path: '/basket',
      load: () => import(/* webpackChunkName: 'search' */ './basket'),
    },
    {
      path: '/basket/:id',
      load: () => import(/* webpackChunkName: 'search' */ './basket'),
    },
    {
      path: '/options',
      load: () => import(/* webpackChunkName: 'options' */ './options'),
    },
    {
      path: '/privacy',
      load: () => import(/* webpackChunkName: 'privacy' */ './privacy'),
    },
    {
      path: '/admin',
      load: () => import(/* webpackChunkName: 'admin' */ './admin'),
    },

    // Wildcard routes, e.g. { path: '(.*)', ... } (must go last)
    {
      path: '(.*)',
      load: () => import(/* webpackChunkName: 'not-found' */ './not-found'),
    },
  ],

  async action({ next }) {
    // Execute each child route until one of them return the result
    const route = await next()

    // Provide default values for title, description etc.
    route.title = `${route.title || 'Untitled Page'} - www.kivalens.org`
    route.description = route.description || ''

    return route
  },
};

// The error page is available by permanent url for development mode
if (__DEV__) {
  routes.children.unshift({
    path: '/error',
    action: require('./error').default,
  });
}

export default routes;
