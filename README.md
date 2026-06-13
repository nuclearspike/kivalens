# KivaLens

[KivaLens](https://www.kivalens.org) — the advanced loan-search tool for
[Kiva.org](https://www.kiva.org) micro-lending — rebuilt on a modern stack with
**zero Bootstrap**.

The original 2015 app (React 0.14 + Reflux + Bootstrap 3 / Bootswatch Flatly +
Browserify) is preserved on the [`legacy`](../../tree/legacy) branch and the
`v1-legacy` tag. This rebuild reproduces its rendered look and behavior using:

| Layer            | Original                       | This app                          |
| ---------------- | ------------------------------ | --------------------------------- |
| Build            | Browserify + Babel 5 + gulp    | Vite 8                            |
| Language         | ES2015 JSX                     | TypeScript 5.9                    |
| UI runtime       | React 0.14                     | React 19                          |
| State            | Reflux stores                  | zustand (+ immer)                 |
| Routing          | react-router 1                 | react-router-dom 7 (hash router)  |
| CSS framework    | Bootstrap 3 / Flatly + SCSS    | **None** — hand-rolled `src/ui/` + `src/styles/base/` |
| Charts           | Highcharts (vendor bundle)     | recharts                          |
| Selects          | react-select v1                | react-select v5 (restyled to v1)  |
| Sliders          | react-slider                   | rc-slider (restyled)              |
| Server           | Express proxy server           | Node server (`server/prod.mjs`) + Vite dev plugin |

## No Bootstrap, same pixels

- `src/ui/` — hand-written components exposing the subset of the
  react-bootstrap API the app uses (Grid, Button, Form, Card, ListGroup,
  Badge, Alert, Tabs, Modal, Dropdown, ProgressBar, OverlayTrigger/Popover,
  Navbar/Nav). No runtime dependencies.
- `src/styles/base/` — a hand-written CSS base layer that reproduces the
  Bootstrap 3 Flatly 3.3.5 rendering (buttons, forms, tabs, panels, alerts,
  modals, badges, progress bars, grid, utilities). Values were lifted from
  `reference/flatly-3.3.5-reference.css` (kept for reference only — never
  imported).
- `src/styles/main.scss` — the KivaLens green theme, ported from the original
  `application.scss`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 (or --port)
```

On startup the dev plugin downloads all fundraising loans from Kiva's API and
serves them at the same `/api/` endpoints the production KivaLens server uses
(first page-load may briefly use the Kiva-direct path while data is prepared).

```bash
npm run build    # tsc + vite build
npm run lint
```

## Production

The same API the dev plugin provides is served in production by a tiny,
dependency-free Node server, so dev and prod share one implementation:

| File | Role |
| ---- | ---- |
| `server/klCore.mjs` | All the logic — Kiva download, KLS batch packaging, periodic refresh, and the `/api/*`, `/graphql`, `/proxy/*` request handlers. Node builtins only. |
| `server/klDevPlugin.ts` | Thin Vite plugin that mounts `klCore` into `vite dev`. |
| `server/prod.mjs` | Production HTTP server: serves the built `dist/` SPA + mounts `klCore`. Listens on `$PORT`. |

```bash
npm run build       # produces dist/
npm start           # node server/prod.mjs — serves dist/ + the API on $PORT
```

The server upgrades HTTP→HTTPS behind a TLS-terminating proxy
(`x-forwarded-proto`), sends an A+ set of security headers (CSP, HSTS,
nosniff, frame-deny, referrer + permissions policies), gzips the loan batches,
refreshes the dataset every 10 minutes, and proxies Kiva's `getGraphData` and
the A+ Google-Sheet through `/proxy/*` with the header recipe Kiva's WAF
requires (no browser `User-Agent`). It has **zero runtime dependencies** (Node
builtins only).
