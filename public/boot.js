// Runs before the app, in two parts.
//
// 1. Applies the lender's saved appearance choice, so a forced light or dark
//    theme never flashes the other one. The storage key and the data-theme
//    contract are shared with src/lib/theme.ts.
// 2. Turns an address written as a fragment — `#/live`, `#/search/loan/42` —
//    into the path it belongs at. A fragment never reaches the server, so this
//    is the only place such an address can be redirected, and the addresses are
//    in bookmarks, community posts and every delivered feed item: this half of
//    the file is permanent.
//
// It is an external classic script because the production CSP allows scripts
// from 'self' only and it has to run before first paint, which rules out both
// an inline script and a module. The rules below are the ones in
// server/routeMap.mjs; src/lib/bootRedirect.test.ts runs this file against that
// module for every address the app has ever had and fails if they disagree.
(function () {
  try {
    var choice = window.localStorage.getItem('kl_theme')
    if (choice === 'light' || choice === 'dark') {
      document.documentElement.setAttribute('data-theme', choice)
    }
  } catch (e) {
    // Storage is unavailable: follow the browser's preference.
  }

  var HOME = '/search'
  var ROUTES = [
    '/search',
    '/partners',
    '/basket',
    '/saved',
    '/stats',
    '/wall',
    '/teams',
    '/options',
    '/about',
    '/about/advanced',
    '/privacy',
    '/autolend',
    '/outdated',
  ]
  var PARAM_ROUTES = [/^\/loans\/[^/]+$/, /^\/partners\/[^/]+$/, /^\/basket\/[^/]+$/]
  var ALIASES = [
    ['kivaid', 'lender'],
    ['importSS', 'import'],
  ]
  var LEGACY = [
    [
      /^\/search\/loan\/([^/]+)$/,
      function (m) {
        return '/loans/' + m[1]
      },
      null,
    ],
    [
      /^\/clear-basket$/,
      function () {
        return '/basket'
      },
      { clear: '1' },
    ],
    [
      /^\/live$/,
      function () {
        return '/stats'
      },
      null,
    ],
    [
      /^\/portfolio$/,
      function () {
        return '/wall'
      },
      null,
    ],
    [
      /^\/on$/,
      function () {
        return HOME
      },
      null,
    ],
    [
      /^\/donate$/,
      function () {
        return HOME
      },
      null,
    ],
    [
      /^\/?$/,
      function () {
        return HOME
      },
      null,
    ],
  ]

  function trim(path) {
    if (path.length <= 1 || path.charAt(path.length - 1) !== '/') return path
    return path.replace(/\/+$/, '') || '/'
  }

  function known(path) {
    if (ROUTES.indexOf(path) !== -1) return true
    for (var i = 0; i < PARAM_ROUTES.length; i++) if (PARAM_ROUTES[i].test(path)) return true
    return false
  }

  var loc = window.location
  var raw = String(loc.hash || '').replace(/^#/, '')
  if (raw.charAt(0) !== '/') return

  var hashIndex = raw.indexOf('#')
  var anchor = hashIndex === -1 ? '' : raw.slice(hashIndex + 1)
  var address = hashIndex === -1 ? raw : raw.slice(0, hashIndex)
  var queryIndex = address.indexOf('?')
  var path = trim(queryIndex === -1 ? address : address.slice(0, queryIndex))
  var inner = queryIndex === -1 ? '' : address.slice(queryIndex + 1)

  // The value inside the fragment wins on any key the address also carries at
  // the top level, and a key is never left in twice.
  var params = new URLSearchParams(String(loc.search || '').replace(/^\?/, ''))
  var add = new URLSearchParams(inner)
  add.forEach(function (_value, key) {
    params.delete(key)
  })
  add.forEach(function (value, key) {
    params.append(key, value)
  })
  for (var a = 0; a < ALIASES.length; a++) {
    var from = ALIASES[a][0]
    var to = ALIASES[a][1]
    if (!params.has(from)) continue
    var values = params.getAll(from)
    params.delete(from)
    if (params.has(to)) continue
    for (var v = 0; v < values.length; v++) params.append(to, values[v])
  }

  var next = null
  for (var r = 0; r < LEGACY.length; r++) {
    var m = LEGACY[r][0].exec(path)
    if (!m) continue
    next = LEGACY[r][1](m)
    var extra = LEGACY[r][2]
    if (extra) for (var k in extra) params.set(k, extra[k])
    break
  }
  // An address naming nothing — including one reaching for another site, which
  // matches no rule and no route — goes to Search.
  if (next === null) next = known(path) ? path : HOME

  var query = params.toString()
  // replace, not assign: the address the visitor arrived at is not a place to
  // come back to, and Back still leaves the site.
  loc.replace(next + (query ? '?' + query : '') + (anchor ? '#' + anchor : ''))
})()
