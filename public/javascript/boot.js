// Bootstrap shim — replaces the inline <script> blocks that used to live in index.ejs
// so the page ships NO executable inline scripts (lets the CSP drop 'unsafe-inline').
// Config (api start data, airbrake, css urls) is injected by the server as a
// non-executable <script type="application/json" id="kl-bootstrap"> block, which is
// not governed by script-src. Loaded with `defer` first, so it runs before the app
// bundle and sets up the globals the bundle expects.
(function () {
    'use strict';

    // app.js / utilsStore read window.pageStarted for load-timing; navigationStart is
    // the true page start (this script runs after parse, so Date.now() would be late).
    window.pageStarted = (window.performance && performance.timing && performance.timing.navigationStart) || Date.now();

    var cfg = {};
    try {
        cfg = JSON.parse(document.getElementById('kl-bootstrap').textContent) || {};
    } catch (e) { /* missing/malformed config — fall through with defaults so the app still boots (initialdownload.js then pulls from Kiva) */ }

    window.kl_api_start = cfg.start || { batch: 0, pages: 0 };
    window.kl_progress = {};
    if (cfg.airbrake) window.__AIRBRAKE__ = cfg.airbrake;

    // Personalize the loading screen for returning lenders.
    try {
        if (typeof localStorage === 'object') {
            var stored = localStorage.getItem('lenderObj');
            if (stored) {
                var lenderObj = JSON.parse(stored);
                if (lenderObj && lenderObj.name) {
                    var el = document.getElementById('welcome_text');
                    if (el) el.innerHTML = 'Welcome back, ' + lenderObj.name + '!';
                }
            }
        }
    } catch (e) { /* ignore corrupt lenderObj */ }

    // Load stylesheets asynchronously. The first entry (bootstrap) flips the
    // bootstrap-ready flag; app.js's LoadReactApp waits on it before rendering.
    window.isBootstrapLoaded = false;
    window.bootstrapLoaded = function () {
        window.isBootstrapLoaded = true;
        if (typeof window.bootstrapLoadedCallback === 'function') window.bootstrapLoadedCallback();
    };
    var loadCss = function () {
        var cssfiles = cfg.css || [];
        var head = document.getElementsByTagName('head')[0];
        for (var i = 0; i < cssfiles.length; i++) {
            var link = document.createElement('link');
            link.type = 'text/css';
            link.rel = 'stylesheet';
            link.href = cssfiles[i];
            if (i === 0) link.onload = window.bootstrapLoaded; // bootstrap css
            head.appendChild(link);
        }
    };
    setTimeout(function () {
        var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
        if (raf) raf(loadCss); else window.addEventListener('load', loadCss);
    }, 1);

    // Register service worker for PWA.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
})();
