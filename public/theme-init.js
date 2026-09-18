// Applies the lender's saved appearance choice before first paint, so a forced
// light or dark theme never flashes the other one. It is an external file
// because the production CSP allows scripts from 'self' only. The storage key
// and the data-theme contract are shared with src/lib/theme.ts.
(function () {
  try {
    var choice = window.localStorage.getItem('kl_theme')
    if (choice === 'light' || choice === 'dark') {
      document.documentElement.setAttribute('data-theme', choice)
    }
  } catch (e) {
    // Storage is unavailable: follow the browser's preference.
  }
})()
