import React from 'react';
import path from 'path';
import { Worker } from 'worker_threads';
import fs from 'fs';
import express from 'express';
import proxy from 'express-http-proxy';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import expressJwt, { UnauthorizedError as Jwt401Error } from 'express-jwt';
import { graphql } from 'graphql';
import nodeFetch from 'node-fetch';
import ReactDOM from 'react-dom/server';
import PrettyError from 'pretty-error';
import forceSSL from 'express-force-ssl';
import App from './components/App';
import Html from './components/Html';
import { ErrorPageWithoutStyle } from './routes/error/ErrorPage';
import errorPageStyle from './routes/error/ErrorPage.css';
import createFetch from './createFetch';
import router from './router';
import chunks from './chunk-manifest.json'; // eslint-disable-line import/no-unresolved
import configureStore from './store/configureStore';
import { setRuntimeVariable } from './actions/runtime';
import config from './config';
import { setAPIOptions } from './kiva-api/kivaBase.mjs';
import { getLookups } from './kivaClient';
import { defaultLookupState } from './reducers/lookups';
import { LOOKUPS_SET } from './constants';
import './utils/linqextras.mjs';
// import passport from './passport';
// import spdy from 'spdy';
// import models from './data/models';
// import schema from './data/schema';
// import assets from './asset-manifest.json'; // eslint-disable-line import/no-unresolved
// import fs from 'fs'

let currentBatchNum = 0;
let preppingBatchNum = 0;

const runThread = (module, workerData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`./src/threads/${module}.mjs`, { workerData });
    worker.on('message', message => {
      if (message.dispatch) {
        // dispatch(message.dispatch)???
      }

      if (message.progress) {
        console.log(message.progress);
      }

      if (message.resolve) {
        resolve(message.resolve);
      }
    });
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`stopped with ${code} exit code`));
    });
  });
};

const run = async () => {
  preppingBatchNum = new Date().getTime();
  const result = await runThread('prepFastFiles', { batch: preppingBatchNum });
  console.log('FastFiles Prep:', result);
};

if (__DEV__ && currentBatchNum === 0) {
  // only relevant for DEV. heroku will always have dirs wiped on dyno restart
  const allDirs = fs
    .readdirSync('/tmp/batches', { withFileTypes: true })
    .filter(ent => ent.isDirectory()) // nothing should ever be in this dir anyway.
    .map(ent => ent.name)
    .orderBy(e => e);

  const last = allDirs.last();

  if (last) {
    const toRemove = allDirs.filter(e => e !== last);
    Promise.all(
      toRemove.map(rem =>
        fs.promises.rmdir(`/tmp/batches/${rem}/`, {
          recursive: true,
          force: true,
        }),
      ),
    ).then(() => console.log(`Dirs Removed: ${toRemove.length}`));

    console.log('Using most recent directory', last);
    currentBatchNum = parseInt(last, 10);
  }
}

const runFastFilesPrep = () => {
  // if we're already prepping, don't start another prep
  // this has the potential to stop everything if the preppingBatchNum is not returned to 0
  if (!__DEV__) return;
  if (preppingBatchNum > 0) {
    return;
  }
  run()
    .catch(err => console.error(err))
    .then(() => {
      currentBatchNum = preppingBatchNum;
    })
    .finally(() => {
      preppingBatchNum = 0;
    });
};

if (currentBatchNum === 0) {
  runFastFilesPrep();
}
setInterval(() => {
  runFastFilesPrep();
}, 30 * 60000).unref();

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  // send entire app down. Process manager will restart it
  process.exit(1);
});

// console.log('******** dir', __dirname )

// const options = {
//   key: fs.readFileSync('./public/server.key'),
//   cert: fs.readFileSync('./public/server.crt'),
// }

//
// Tell any CSS tooling (such as Material UI) to use all vendor prefixes if the
// user agent is not known.
// -----------------------------------------------------------------------------
global.navigator = global.navigator || {};
global.navigator.userAgent = global.navigator.userAgent || 'all';

setAPIOptions({ app_id: 'org.kiva.kivalens' });

const app = express();

//
// If you are using proxy from external machine, you can set TRUST_PROXY env
// Default is to trust proxy headers only from loopback interface.
// -----------------------------------------------------------------------------
if (process.env.DYNO) {
  app.set('trust proxy'); // , config.trustProxy
}

//
// Register Node.js middleware
// -----------------------------------------------------------------------------
app.use(express.static(path.resolve(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//
// Authentication
// -----------------------------------------------------------------------------
app.use(
  expressJwt({
    secret: config.auth.jwt.secret,
    credentialsRequired: false,
    getToken: req => req.cookies.id_token,
  }),
);
// Error handler for express-jwt
app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  if (err instanceof Jwt401Error) {
    console.error('[express-jwt-error]', req.cookies.id_token);
    // `clearCookie`, otherwise user can't use web-app until cookie expires
    res.clearCookie('id_token');
  }
  next(err);
});

// const proxyHandlerOld = {
//   filter: req => req.xhr, // only proxy xhr requests
//   forwardPath: req => require('url').parse(req.url).path,
//   intercept: (rsp, data, req, res, callback) => {
//     res.header('Access-Control-Allow-Origin', '*');
//     res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//     res.header(
//       'Access-Control-Allow-Headers',
//       'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID',
//     );
//     res.set('Set-Cookie', 'ilove=kiva; Path=/; HttpOnly'); // don't pass back kiva's cookies.
//     // intercept OPTIONS method
//     if (req.method === 'OPTIONS') {
//       res.send(200);
//     } else {
//       callback(null, data);
//     }
//   },
// };

const proxyHandler = {
  // filter: req => req.xhr, // only proxy xhr requests
  proxyReqPathResolver: req => {
    // console.log('**** url', req.url);
    return req.url;
    // const toUse = req.url;
    // console.log('toUse', toUse);
    // return toUse;
  },
  userResHeaderDecorator: headers => {
    headers['Access-Control-Allow-Origin'] = '*'; // restrict to kivalens.org
    headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE';
    headers['Referrer-Policy'] = 'unsafe-url';
    headers['Access-Control-Allow-Headers'] =
      'Origin, X-Requested-With, Content-Type, Accept';
    headers['Set-Cookie'] = 'ilove=kiva; Path=/; HttpOnly'; // don't pass back kiva's cookies.
    return headers;
  },

  //   // intercept OPTIONS method
  //   if (userReq.method === 'OPTIONS') {
  //     res.send(200);
  //   } else {
  //     res.send(data);
  //   }
  // },
};

// app.get('/robots.txt', (req, res) => res.sendStatus(404));

app.use('/proxy/kiva', proxy('https://www.kiva.org', proxyHandler));

app.set('forceSSLOptions', {
  trustXFPHeader: true, // needed for heroku
  sslRequiredMessage: 'SSL Required.',
});

const smartForceSSL = () => {
  if (!__DEV__) {
    return forceSSL;
  }
  return (req, res, next) => next();
};

const serveEncodedFile = (res, fullPath, encoding) => {
  // console.log('serve encoded', fullPath);
  try {
    const { size } = fs.statSync(fullPath);
    res.type('application/json;  charset=utf-8');
    res.header('Content-Encoding', encoding);
    res.header('Content-Length', size);
    res.header('Cache-Control', `public, max-age=600`);
    res.sendFile(fullPath);
  } catch (e) {
    res.sendStatus(404);
  }
};

app.get('/batches/:batchNumString/:file', (req, res) => {
  const { batchNumString, file } = req.params;
  const batchNum = parseInt(batchNumString, 10);
  const encoding = req.acceptsEncodings('br') || 'gzip';
  const fullPath = `/tmp/batches/${batchNum}/${file}.kl.${encoding}`;
  serveEncodedFile(res, fullPath, encoding);
});

// app.use(passport.initialize());

// app.get(
//   '/login/facebook',
//   passport.authenticate('facebook', {
//     scope: ['email', 'user_location'],
//     session: false,
//   }),
// );

// app.get(
//   '/login/facebook/return',
//   passport.authenticate('facebook', {
//     failureRedirect: '/login',
//     session: false,
//   }),
//   (req, res) => {
//     const expiresIn = 60 * 60 * 24 * 180; // 180 days
//     const token = jwt.sign(req.user, config.auth.jwt.secret, { expiresIn });
//     res.cookie('id_token', token, { maxAge: 1000 * expiresIn, httpOnly: true });
//     res.redirect('/');
//   },
// );

//
// Register API middleware
// -----------------------------------------------------------------------------
// app.use(
//   '/graphql',
//   expressGraphQL(req => ({
//     schema,
//     graphiql: __DEV__,
//     rootValue: { request: req },
//     pretty: __DEV__,
//   })),
// );

// fetch values once on startup, set in apollo store to go out with page.
let lookups = defaultLookupState;
const setupLookups = () => {
  getLookups().then(lu => {
    lookups = lu;
  });
};
setupLookups();
setInterval(setupLookups, 6 * 60 * 60000).unref();

//
// Register server-side rendering middleware
// -----------------------------------------------------------------------------
app.get('*', smartForceSSL(), async (req, res, next) => {
  try {
    const css = new Set();

    // Enables critical path CSS rendering
    // https://github.com/kriasoft/isomorphic-style-loader
    const insertCss = (...styles) => {
      // eslint-disable-next-line no-underscore-dangle
      styles.forEach(style => css.add(style._getCss()));
    };

    // Universal HTTP apolloClient
    const fetch = createFetch(nodeFetch, {
      baseUrl: config.api.serverUrl,
      cookie: req.headers.cookie,
      // schema,
      graphql,
    });

    const initialState = {
      user: req.user || null,
    };

    const store = configureStore(initialState, {
      fetch,
    });

    store.dispatch(
      setRuntimeVariable({
        name: 'initialNow',
        value: Date.now(),
      }),
    );

    store.dispatch(
      setRuntimeVariable({
        name: 'batchNum',
        value: currentBatchNum,
      }),
    );

    store.dispatch({
      type: LOOKUPS_SET,
      payload: lookups,
    });

    // Global (context) variables that can be easily accessed from any React component
    // https://facebook.github.io/react/docs/context.html
    const context = {
      fetch,
      // The twins below are wild, be careful!
      pathname: req.path,
      query: req.query,
      // You can access redux through react-redux connect
      store,
      storeSubscription: null,
    };

    const route = await router.resolve(context);

    if (route.redirect) {
      res.redirect(route.status || 302, route.redirect);
      return;
    }

    const data = { ...route };
    data.children = ReactDOM.renderToString(
      <App context={context} insertCss={insertCss}>
        {route.component}
      </App>,
    );
    data.styles = [{ id: 'css', cssText: [...css].join('') }];

    const scripts = new Set();
    const addChunk = chunk => {
      if (chunks[chunk]) {
        chunks[chunk].forEach(asset => scripts.add(asset));
      } else if (__DEV__) {
        throw new Error(`Chunk with name '${chunk}' cannot be found`);
      }
    };
    addChunk('client');
    if (route.chunk) addChunk(route.chunk);
    if (route.chunks) route.chunks.forEach(addChunk);

    data.scripts = Array.from(scripts);
    data.app = {
      apiUrl: config.api.clientUrl,
      state: context.store.getState(),
    };

    const html = ReactDOM.renderToStaticMarkup(<Html {...data} />);
    res.status(route.status || 200);
    res.send(`<!doctype html>${html}`);
  } catch (err) {
    next(err);
  }
});

//
// Error handling
// -----------------------------------------------------------------------------
const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(pe.render(err));
  const html = ReactDOM.renderToStaticMarkup(
    <Html
      title="Internal Server Error"
      description={err.message}
      styles={[{ id: 'css', cssText: errorPageStyle._getCss() }]} // eslint-disable-line no-underscore-dangle
    >
      {ReactDOM.renderToString(<ErrorPageWithoutStyle error={err} />)}
    </Html>,
  );
  res.status(err.status || 500);
  res.send(`<!doctype html>${html}`);
});

//
// Launch the server
// -----------------------------------------------------------------------------
// const promise = models.sync().catch(err => console.error(err.stack));

if (!module.hot) {
  // promise.then(() => {
  // spdy
  //   .createServer(options, app)
  //   .listen(config.port, (err) => {
  //     if (err) {
  //       throw new Error(err);
  //     }
  //   })
  //   console.info(`The server is running at http://localhost:${config.port}/`);

  app.listen(config.port, () => {
    console.info(`The server is running at http://localhost:${config.port}/`);
  });
  // });
}

//
// Hot Module Replacement
// -----------------------------------------------------------------------------
if (module.hot) {
  app.hot = module.hot;
  module.hot.accept('./router');
}

export default app;
