# KivaLens Handoff Notes

## Project Overview
KivaLens (https://www.kivalens.org) is an advanced search tool for Kiva.org micro-lending. It downloads all fundraising loans from Kiva's API, lets users filter/search with complex criteria, manage a basket, and transfer loans to Kiva for checkout.

## Architecture
- **Server:** Node 18, Express 4, deployed on Heroku (app name: `kivalens`)
- **Client:** React 0.14, Reflux (flux), Bootstrap 3 (Flatly theme), Browserify + Babel 5
- **Build:** In `/react` dir, Node 10 required for gulp/browserify: `nvm use 10 && npx browserify -t babelify src/scripts/app.js -o ../public/javascript/build.js`
- **Vendor JS:** `npx gulp vendor` (uses .min.js files from js_lib/) — this is separate from build.js
- **Server run:** `nvm use 18 && PORT=3001 npm start` (must use hostname not IP for vhost)
- **Deploy:** Auto-deploy on push to master via Heroku. After release build, do a dev build so local HMR picks up changes.
- **BCP shortcut:** Build, commit, push (the user's standard deploy workflow)

## Key Files
- `cluster.js` — Main server, proxy to Kiva, HTTPS redirect, vhost setup
- `react/src/scripts/api/kiva.js` — Core data model, loan filtering, partner filtering
- `react/src/scripts/api/kivajs/req.js` — API request layer (kivaBase proxy URL)
- `react/src/scripts/api/kivajs/CritTester.js` — Search criteria testing (range sliders, multi-select)
- `react/src/scripts/components/Search.jsx` — Main search page (3-column: criteria|list|detail)
- `react/src/scripts/components/CriteriaTabs.jsx` — Search criteria panel
- `react/src/scripts/components/Loan.jsx` — Loan detail panel (Image/Details/Partner tabs)
- `react/src/scripts/components/Partners.jsx` — Partners browsing tab
- `react/src/scripts/components/SavedSearches.jsx` — Saved searches management
- `react/src/scripts/components/SnowStack.jsx` — 3D loan wall
- `react/src/scripts/components/About.jsx` — About/Getting Started page
- `public/javascript/snowstack.js` — 3D wall engine (modify this, then `gulp vendor` to rebuild vendor.js)
- `views/pages/index.ejs` — Main HTML template
- `public/sw.js` — Service worker for PWA

## What Was Done This Session (Mar 23-26, 2026)
### Infrastructure
- Upgraded Node 5.9 → 18 for Heroku deployment
- Fixed proxy to Kiva (406 issue — needed manual https.get with clean headers)
- HTTPS + www.kivalens.org redirects (301)
- Removed: socket.io, New Relic, airbrake, memwatch, old GA (UA), redis, express-http-proxy
- Reduced GitHub vulnerability alerts from 53 → ~22
- Added PWA support (manifest.json, service worker)
- Content Security Policy configured for helmet 4.x

### Features Added
- Religion filter (multi-select, any/all/none, data from A+ team Google Sheet)
- Partners tab (browse all partners with full criteria, 3-column layout)
- Partners: country search (any/all/none), fundraising loan count slider/badges
- Saved Searches tab (manage, rename, delete, export, import, share via URL)
- Saved Search badges (loan counts in dropdown and listing)
- Wall tab (3D loan photo wall with SnowStack, 3D loading spinner)
- Bookmark migration page (http→https localStorage transfer)
- Portfolio exclusion messaging simplified
- Lender ID modal triggered from multiple places

### UI/UX
- Kiva-inspired green/white theme (Flatly + Inter font)
- 3-column search layout (criteria|list|detail) with 4-3-5 grid
- Welcome panel when no loan selected (quick start guide, set lender ID)
- Distribution graphs float over results (dismissible, saved to options)
- Loan detail: vertical repayment graph, stacked details, Kiva "K" link
- Gender pills (pink/blue) instead of "(F)/(M)"
- Funded loan styling improved (better contrast)
- Comma separators on dollar amounts
- Tutorial system (commented out, needs polish)
- Partner logo and borrower image sizing constrained

## TODO / Known Issues

### KivaLens
- [ ] **Tutorial system** — commented out, needs polish. Steps need better targeting (step 2 should highlight full criteria, step 5 should target Add to Basket button not Bulk Add)
- [ ] **Partners tab** — mostly working but could use more testing with edge cases
- [ ] **Distribution graphs** — floating popover positioning could be improved
- [ ] **Mobile** — 3-column layout needs responsive breakpoints
- [ ] **Remaining vulnerabilities** — 22 GitHub alerts, mostly in react dev deps (build-time only)
- [ ] **PWA** — manifest validated but install prompt may need testing across browsers
- [ ] **Auto-Lend tab** — commented out, Kiva changed their settings page

### KLA (Kiva Lender Assistant) — ~/projects/lenderassist
- Fully modernized to Manifest v3 (service worker, no jQuery/MooTools/LINQ)
- See `~/projects/lenderassist/TODO.md` for remaining work
- **Critical:** All Kiva DOM selectors need updating — Kiva redesigned their entire site
- `lend.js` is stubbed — needs full rewrite against current Kiva DOM
- Options page works, speech/TTS works, omnibox works
- **Do NOT mention KLA to users** until selectors are fixed — Chrome Store shows "not following best practices"

## Build Commands
```bash
# Frontend build (must use Node 10)
cd react && nvm use 10 && npx browserify -t babelify src/scripts/app.js -o ../public/javascript/build.js

# Vendor JS build (snowstack, highcharts)
cd react && nvm use 10 && npx gulp vendor

# Server (must use Node 18)
cd /Users/paulericksen/projects/kivalensjs-old && nvm use 18 && PORT=3001 npm start

# Full BCP
cd react && nvm use 10 && npx browserify -t babelify src/scripts/app.js -o ../public/javascript/build.js && cd .. && git add -A && git commit -m "message" && git push origin master
```

## Important Notes
- The proxy in cluster.js uses manual `https.get` to Kiva — express-http-proxy was removed because Kiva's server rejects requests with extra headers
- `kivaBase` in req.js uses dynamic `${location.protocol}//${location.host}/proxy/kiva/` — do NOT hardcode to a specific domain
- The A+ team religion data comes from Google Sheets CSV export (see `req.gdocs.atheist` in req.js)
- jsx-control-statements was removed — use standard `{condition && <Component/>}` JSX
- The `If` component doesn't exist — it was from jsx-control-statements
- snowstack.js changes must go through `gulp vendor` not `gulp scripts` (it uses .min.js pattern)
