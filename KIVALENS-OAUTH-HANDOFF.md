# KivaLens — Handoff: Repo Consolidation + Kiva OAuth Feature Plan

> Written 2026-06-13 at the end of a prior Claude session. Self-contained — you
> need no prior context. Read top to bottom, then start at **Step 0**.

---

## 0. First thing: get a clean clone

The codebase now lives on the **renamed, consolidated** repo. Pull a fresh copy:

```bash
git clone https://github.com/nuclearspike/kivalens.git
cd kivalens
npm install            # modern stack, installs clean (NO --legacy-peer-deps needed)
npm run dev            # Vite dev server + Kiva proxy plugin
```

- `master` (default branch) = the modern app (Vite + React 19 + TypeScript).
- `legacy` branch + `v1-legacy` tag = the original 2015 app (React 0.14 / Reflux /
  Bootstrap 3). Don't touch unless you need to reference old behavior.
- Ignore the old local dirs `~/projects/kivalensjs-old` (stale v1) and
  `~/projects/kivalens-modern` (being deleted). Work only from the fresh clone.
- 0 known dependency vulnerabilities (just patched: vite 8.0.16, react-router
  7.17, postcss 8.5.15).

---

## 1. What just happened (context)

KivaLens existed as THREE GitHub repos. We consolidated:

| Repo | Was | Now |
|---|---|---|
| `kivalensjs` (2015, **49★ / 21 forks**) | original app | **renamed → `nuclearspike/kivalens`**; `master` replaced with the modern app; old code preserved on `legacy` branch + `v1-legacy` tag. Old URL 301-redirects. |
| `kivalens` (2021 webpack refresh, 1★) | blocked the name | renamed → `kivalens-webpack`, made private |
| `kivalens-modern` (today's rebuild, 0★) | the modern code | **being deleted** — its code is now `kivalens`'s `master` |

Why: stars/forks/watchers can't be transferred between repos, so we did an
in-place rewrite to keep 10 years of social proof + SEO + the URL.

**Commit conventions:** plain commit messages, **no attribution trailers**
(a "wozcode" wrapper was uninstalled; launch the CLI via `claude`, not `wozcode`).

---

## 2. Architecture orientation (so the OAuth work fits the grain)

- **Stack:** Vite 8 · React 19 · TypeScript 5.9 · zustand + immer · react-router 7
  (hash router) · recharts · react-select (restyled) · rc-slider.
- **Shared server core:** `server/klCore.mjs` — plain JS, Node builtins only,
  **zero runtime deps** (so Heroku devDep pruning can't break prod). It is imported
  by BOTH the Vite dev plugin (`server/klDevPlugin.ts`) and the production server
  (`server/prod.mjs`). **Put new server logic here so dev and prod never drift.**
- **Prod server** `server/prod.mjs`: serves `dist/`, mounts the proxy + API,
  HTTP→HTTPS redirect, and sets hardened security headers (CSP/HSTS/etc — currently
  an A+). Any OAuth network targets must satisfy the CSP (see §4).
- **Imperative dialogs:** `src/lib/dialog.ts` + `src/components/DialogHost.tsx`
  (`showAlert/showConfirm/showPrompt`). Use these, not native `window.*`.
- **Facet options:** `src/components/CriteriaTabs.tsx`; the dropdown lists are the
  union of a hard-coded baseline ∪ server taxonomy (`/api/options`, from Kiva
  GraphQL) ∪ values discovered in loaded loans.
- **Deploy:** manual `git push heroku master` (Heroku does NOT auto-deploy from
  GitHub). Add the remote in the new clone: `heroku git:remote -a <app>`.

---

## 3. Kiva OAuth — the opportunity (THIS is the new work)

We introspected Kiva's **live** GraphQL schema (`https://api.kivaws.org/graphql`).
It has a real OAuth2 surface. Headline: **OAuth turns the three areas KivaLens
currently fakes/approximates — portfolio balancing, saved searches, and autolend —
into exact, two-way-synced features**, and lets KivaLens build the real Kiva basket.

GraphQL query roots include `lend` (public, already used for taxonomy), **`my`**
("Exposes fields for the logged in user via OAuth2"), and **`shop`** (basket).
Mutation roots include **`my`** (MyMutation), **`shop`** (ShopMutation),
`autoRepayment`, `addOrRemoveTagOnLoan`.

### Feature tiers (prioritized)

**Tier 1 — Exact personal portfolio (read `my.*`). Highest value, lowest risk.**
Today the "Your Portfolio" balancers (Countries I Don't Have, Balance Partner Risk)
are inferred from the PUBLIC lender view and only work if the profile is public.
OAuth gives authenticated, complete data + Kiva's own server-side rollups:
- `my.loans`, `my.lendingStats`, `my.userStats`, `my.borrowedLoans`
- `my.statsPerCountry / statsPerSector / statsPerPartner / statsPerGender`
  — **pre-computed breakdowns** → balancers become exact + instant.
- Account ledger (all `Money`): `amountDepositedByKiva`, `amountDonated`,
  `amountWithdrawn`, `currencyGainsAmount`, `currencyLossesAmount`,
  `defaultLossesAmount`, `outstandingPromoCreditAmount`,
  `kivaCardsPurchased/Redeemed/CanceledAmount` → a real **account dashboard**.
- `my.transactions` → true repayment calendar + CSV export.

**Tier 2 — Saved-search two-way sync. The killer integration.**
`my.savedSearches` + mutations `createSavedSearch` / `updateSavedSearch` /
`deleteSavedSearch`. KivaLens's far-better search builder becomes the editor for
Kiva's NATIVE saved searches — a search built in KivaLens shows up on kiva.org.

**Tier 3 — Autolend integration (read + write).**
`my.autolendProfile` + `updateAutolendProfile`. The existing `AutoLendSettings`
screen is currently local/simulated; wire it to the user's REAL Kiva autolending
profile. KivaLens's rich criteria UI becomes the front-end for Kiva autolend.

**Tier 4 — Teams + build the real Kiva basket.**
- Teams: `my.teams` + `joinTeam` / `quitTeam` / `updateTeamMessageFrequencies`.
- Basket: `shop.basket` (read `Manifest`) + `ShopMutation.updateLoanReservation`
  (add/update a loan), `updateDonation`, `applyLendingReward`,
  `updateLoanReservationTeam`, `validatePreCheckout`. So "Checkout at Kiva" could
  push straight into the user's real cart instead of the current URL-param handoff.

**Tier 5 — Loan updates / notifications.**
`my.updates` (journal updates for funded loans), `my.lenderMessages`,
`my.communicationSettings` + `updateCommunicationSettings`.

### TWO HARD CAVEATS (verify before promising features)
1. **Several powerful mutations are gated "(Kiva app only)"** — `checkout`,
   `doNoncePaymentDepositAndCheckout`, `getClientToken`, `getPaymentToken`,
   `requestWithdrawal`, MFA, trustee. A third-party OAuth client almost certainly
   **cannot complete payment in-app**. Realistic ceiling: read everything personal
   + write saved searches/autolend + BUILD the basket, then hand off to kiva.org
   for the actual payment.
2. **Confirm which `my`/`shop` fields a THIRD-PARTY token can actually read.**
   Some may need elevated scopes or be first-party-only. This is the first thing to
   test once OAuth is wired (see §5).

### Recommended starting scope
**Tier 1 + Tier 2 together.** Read-mostly (Tier 1) plus a clean low-risk write
surface (saved searches). They make the two flagship screens genuinely better than
kiva.org and prove out the OAuth plumbing before touching baskets or money.

---

## 4. Proxy + Kiva WAF settings (critical — Kiva blocks naive requests)

Kiva's WAF answers **406/403** to requests that look like a browser without a full
fingerprint. There are **two distinct header recipes** already in `klCore.mjs`:

**(a) GET proxy to kiva.org `/ajax/*`** — `handleProxy`, used for the loan data and
the portfolio balancer. Recipe = send `X-Requested-With: XMLHttpRequest`,
`Accept: application/json, text/javascript, */*; q=0.01`,
`Referer: https://www.kiva.org/`, and **NO User-Agent** (Node `fetch` sends none by
default — that's intentional; a browser UA gets blocked).
- Proxy targets + SSRF allowlist: `/proxy/kiva/` → `https://www.kiva.org/` (allow
  `^ajax/`), `/proxy/gdocs/` → `https://docs.google.com/` (allow `^spreadsheets/`).
- The portfolio balancer endpoint is `/proxy/kiva/ajax/getSuperGraphData`
  (a prior bug used a wrong `/supergraph` path — don't reintroduce it).

**(b) GraphQL POST to `https://api.kivaws.org/graphql`** — `fetchTaxonomy`. Recipe =
the OPPOSITE: send a **full Chrome `User-Agent`** + `Referer: https://www.kiva.org/`
+ `Content-Type: application/json`. (See `FETCH_HEADERS` in `klCore.mjs`.)

For OAuth, GraphQL `my`/`shop` calls will use recipe (b) **plus** an
`Authorization: Bearer <token>` header — and MUST go through the server (token never
reaches the client). Add an authenticated GraphQL helper in `klCore.mjs` next to
`fetchTaxonomy`.

**CSP already permits the needed hosts** (from `prod.mjs`):
`connect-src 'self' https://api.kivaws.org https://www.kiva.org https://docs.google.com`
and `form-action 'self' https://www.kiva.org`. So the OAuth authorize redirect
(kiva.org) and token/GraphQL calls (api.kivaws.org) fit the existing policy — but
double-check the exact OAuth authorize/token hostnames and widen CSP only if they
differ.

---

## 5. OAuth implementation plan + what to test

**Plumbing (server-side, in `klCore.mjs` + `prod.mjs` + dev plugin):**
1. Register KivaLens as an OAuth2 client with Kiva → get `client_id`, `client_secret`,
   register the redirect URI. (Find Kiva's current developer/OAuth registration —
   the old docs may be stale; the GraphQL `my` namespace existing proves OAuth2 is
   live.)
2. Implement the **authorization-code flow**: `/auth/login` → redirect to Kiva
   authorize → `/auth/callback` exchanges code for tokens.
3. **Store tokens SERVER-SIDE only** (never in client storage). Given the financial
   data and the current A+ header posture, treat tokens like secrets. Decide on a
   session mechanism (httpOnly cookie session id → server-side token store).
4. Add an authenticated GraphQL helper (recipe (b) + Bearer) and per-feature
   resolvers behind `/api/*`.

**Tests / things to verify (in rough order):**
- [ ] **Scope reality check (do FIRST):** with a real third-party token, query
      `my { id lender { name } loans { totalCount } statsPerCountry { ... } }`.
      Confirm what actually returns vs. permission-denies. This determines which
      tiers are buildable.
- [ ] Token refresh works (access token expiry + refresh token flow).
- [ ] Tier 1 read: `my.statsPerCountry/Partner/Sector` populate the balancers; cross-
      check against the current inferred numbers for a known lender.
- [ ] Tier 2: `createSavedSearch` round-trips — created in KivaLens, visible on
      kiva.org, and `my.savedSearches` reads it back; map KivaLens criteria ↔ Kiva's
      saved-search shape (mind the tag value/label nuance: Kiva tag names have spaces
      like `#Woman-Owned Business` but the loan filter matches the whitespace-stripped
      `kls_tags` value `#Woman-OwnedBusiness`).
- [ ] Tier 3: read `my.autolendProfile`, then `updateAutolendProfile` and confirm it
      persists on kiva.org.
- [ ] Tier 4 basket: `shop.updateLoanReservation` adds a loan to the real basket;
      confirm whether `checkout` is truly first-party-only (expected: yes → hand off).
- [ ] CSP: no violations in console after adding OAuth flows; confirm authorize/token
      hosts are CSP-allowed.
- [ ] Security headers stay A+ after adding cookie/session handling.

**Verification harness:** the project has a Vite dev server + a preview/browser
tooling workflow — run `npm run dev`, load it, and check console/network for the
GraphQL calls. For prod-shape testing: `npm run build` then `node server/prod.mjs`.

---

## 6. Gotchas / conventions
- Keep new server logic in `klCore.mjs` (shared) so dev + prod don't drift.
- Zero runtime deps in the server path (Heroku prunes devDeps).
- Plain commit messages, no tool/AI attribution trailers.
- Don't reintroduce `/proxy/kiva/supergraph` — it's `/proxy/kiva/ajax/getSuperGraphData`.
- Two header recipes, don't mix them (GET-proxy = no UA; GraphQL = full UA).
- Open optional cleanup on the repo: two stale branches
  (`codex/update-dependencies-for-heroku-compatibility`,
  `dependabot/npm_and_yarn/react/node-sass-4.14.1`) can be pruned.

---

## 7. OAuth registration findings (added 2026-06-13, live probes)

**Question answered:** "Find Kiva's current OAuth2 client-registration path."
**Short answer: there is no live public self-service registration path anymore.**
The OAuth2 surface is real and live, but registration appears first-party-only.

### Live vs dead (probed directly; mind the two WAF recipes — see §4)
| Endpoint | Status | Notes |
|---|---|---|
| `https://www.kiva.org/oauth/authorize` | **LIVE (302)** | Accepts `response_type=code` + `client_id`; mints an `oauthKey` and redirects to `/login?doneUrl=...&authLevel=active`. Defers client validation to post-login. The ONLY surviving OAuth endpoint. |
| `https://api.kivaws.org/graphql` `my` (OAuth2) | **LIVE (200)** | Introspectable. Unauthed query → `api.authenticationRequired`. |
| Bogus `Authorization: Bearer` → GraphQL | **500** | Error: *"The JWT string must contain two dots"* — modern tokens are **JWTs** (OAuth2 Bearer), NOT legacy OAuth 1.0a opaque tokens. |
| `api.kivaws.org/oauth/request_token` · `/oauth/access_token` · `/oauth/token` (+ `.json`) | **DEAD (404)** | Legacy OAuth 1.0a REST flow is gone. (403 without UA = WAF; true status is 404 with full-UA recipe.) |
| `www.kiva.org/oauth/token` · `/oauth/access_token` | **DEAD (404)** | Token endpoint is not on www either. |
| `build.kiva.org` (+ `/docs`, `/me`, `/docs/conventions/registering`) | **DEAD (404)** | The old self-service "App Dashboard / My Apps" portal is gone. |
| `*.well-known/openid-configuration` · `oauth-authorization-server` (api + www) | **404** | No OIDC discovery, no dynamic client registration. Custom OAuth2 server. |
| `www.kiva.org/{developers,settings/apps,settings/connected-apps,oauth/applications,...}` | **404 (honest)** | No modern self-service app-registration page exists (checked with no-UA recipe so 404 = real, not WAF). |

### What the archived docs (Wayback) say
`build.kiva.org/docs/conventions/{registering,oauth}` (snapshots through 2017–19)
describe the OLD flow: register via the **build.kiva.org “My Apps” dashboard** to get
`client_id`/`client_secret`, then an **OAuth 1.0a** dance
(`POST api.kivaws.org/oauth/request_token` → `www.kiva.org/oauth/authorize` →
`POST api.kivaws.org/oauth/access_token`). Every piece of that EXCEPT `/oauth/authorize`
is now 404. So the docs are stale; only the authorize front door carried over into
the new JWT/OAuth2 world (it's what kiva.org's own first-party login uses).

### Community signal
The `build-kiva` Google Group shows Kiva announced (2019–2020) it was "upgrading its
authentication procedure" and that GraphQL auth was "on the roadmap... before full
deprecation of the REST API" — but never publicly shipped a self-service replacement.
Lender questions about "the roadmap for authentication with the GraphQL API" (last
seen May 2022) went unanswered. Consistent with: REST OAuth retired, GraphQL OAuth2
live but **first-party-only**, no public onboarding.

### Implications for the plan
- **§5 step 1 (register → get client_id/secret) has no self-service path.** Getting
  third-party credentials requires contacting Kiva directly. Real risk they no longer
  issue third-party OAuth clients (the schema's "(Kiva app only)" gating + the dead
  portal both point that way).
- **The §5 "scope reality check" is BLOCKED** until we hold a real token — can't test
  which `my`/`shop` fields a third-party token reads without one.

### Options (pick before writing auth plumbing)
1. **Ask Kiva for a client.** partnerships (`www.kiva.org/about/partner-with-us`) /
   the `build-kiva` group / open an issue on `github.com/kiva/API`. Highest-fidelity,
   slowest, may be declined.
2. **Mirror the first-party flow.** Observe a real kiva.org login in a browser
   (Chrome MCP / project preview tooling) to capture the actual `client_id`, authorize
   params, the token-exchange call, and the JWT — then drive the same flow server-side
   through KivaLens's existing WAF-recipe proxy. Pragmatic, no Kiva sign-off needed,
   but undocumented/first-party (ToS + fragility risk). This is the decisive next probe
   if we want to know whether the features are buildable without Kiva's blessing.
3. **Session passthrough.** User logs into kiva.org; KivaLens calls `my` with the
   user's session/JWT the way kiva.org's frontend does. Same undocumented/fragile caveat.
4. **Defer.** Keep the current public-data Tier-0 approach; gate OAuth features behind
   "pending Kiva API access."

**Recommendation:** do (1) and (2) in parallel — send the access request (long lead
time) while reverse-engineering the live first-party flow to learn if Tiers 1–3 are
even reachable with a JWT a browser can obtain. Don't write `/auth/*` plumbing until
one of those tells us whether/how we can get a token.

---

## 8. RESOLVED — extension session-passthrough WORKS (added 2026-06-13/14)

**We do not need OAuth client registration at all.** A LenderAssist-style Chrome
extension can read the user's `my.*` data by reusing the user's own first-party Kiva
session. Proven end-to-end (read `my { __typename } → AUTHENTICATED (My)`, HTTP 200).

### How Kiva actually authenticates (discovered live)
- **IdP: Auth0.** Tenant `login.kiva.org`. The kiva.org SPA uses Auth0 silent auth:
  `GET https://login.kiva.org/authorize?client_id=AEnMbebwn6LBvxg1iMYczZKoAgdUt37K`
  `&redirect_uri=https://www.kiva.org/process-browser-auth`
  `&audience=https://api.kivaws.org/graphql&response_type=token%20id_token`
  `&scope=openid%20mfa&response_mode=web_message&prompt=none` (auth0.js 9.19.2).
- **Access token = a signed JWT (~1070 chars), audience `api.kivaws.org/graphql`,**
  held **in JS memory only** (NOT in localStorage/sessionStorage/cookies).
- **GraphQL endpoint the SPA calls:** `https://kiva.stellate.sh/` (Stellate edge cache
  fronting `api.kivaws.org/graphql`). Auth = `Authorization: Bearer <jwt>`.
  `kiva.stellate.sh` and `api.kivaws.org` are different domains from `kiva.org`, so
  the `.kiva.org` session cookie does NOT reach them — that's why cookie-based attempts
  all returned `api.authenticationRequired`.
- **Type introspection works WITHOUT a token** (e.g. `{ __type(name:"My"){ fields { name } } }`
  against `api.kivaws.org/graphql` with the recipe-(b) WAF headers). Use this to build
  queries without needing creds. The `My` type exposes ~53–58 fields (full Tier-1
  surface: statsPer*, loans, lendingStats, userStats, transactions, all the Money
  ledger fields, savedSearch(es), autolendProfile, teams, updates, lenderMessages,
  communicationSettings). Only `authenticatorEnrollments`/`enrolledInMFA` are tagged
  `(Kiva app only)`.

### Two ways for the extension to get a usable token
1. **Intercept (PROVEN).** A MAIN-world content script on `www.kiva.org` hooks
   `fetch`/`XHR`, captures the `Authorization: Bearer` the SPA sends to
   `kiva.stellate.sh`, and reuses it. Simplest; uses the user's own live token.
   Caveat: only available after the SPA makes an authenticated call, and the token is
   short-lived (~Auth0 access-token TTL, often ≤2h) → needs re-capture/refresh handling.
2. **Re-mint via Auth0 (durable, TODO).** Replay the `prompt=none&response_mode=web_message`
   authorize call above from a `www.kiva.org`-origin iframe (the user already has an SSO
   session at `login.kiva.org`). Lets the extension obtain/refresh a token ON DEMAND
   without waiting for the SPA. This is the production mechanism for "pull my data anytime".
   Risk/notes: uses Kiva's first-party `client_id`; iframe parent origin must be an Auth0
   "Allowed Web Origin" (www.kiva.org is). Essentially re-implements auth0-spa-js checkSession.

### The bridge already exists (both ends — see §2 repos)
- Extension (`~/projects/lenderassist`, MV3 v3.0.0): `externally_connectable` =
  `https://www.kivalens.org/*`; `background.js onMessageExternal` dispatches
  `getFeatures/getManifest/getVersion/getLenderId/notify/speak/setAutoLendPCS`;
  `host_permissions` already include kiva.org + api.kivaws.org (add `kiva.stellate.sh`).
- KivaLens: `src/components/AutoLendSettings.tsx` already calls
  `chrome.runtime.sendMessage('ehmkalmhgpadjmfcfekgdagfnmhakgna', {setAutoLendPCS}, cb)`.
  (Two extension IDs in play: that hardcoded unpacked id vs webstore
  `jkljjpdljndblihlcoenjbmdakaomhgo` — reconcile; pin a `key` in the manifest so the
  unpacked id is stable.) Old read path in `inject/all_start.js` uses dead REST v1
  (`/v1/...json?app_id=org.kiva.kivalens`) + routes graphql through `kivalens.org/graphql`
  — replace with direct authenticated `my.*` calls to `kiva.stellate.sh`.

### Decision: dedicated extension (NOT lenderassist)
This lives in its own extension, **`~/projects/kivalens-companion`** (MV3, v0.1.0, own git
repo), not bolted onto lenderassist. Built 2026-06-14. It already implements:
- interception (`content/intercept.main.js`) + Auth0 silent re-mint
  (`content/kiva.bridge.js`, `prompt=none` web_message iframe on a www.kiva.org tab),
- a token cache in the SW (`chrome.storage.session`, memory-only),
- an authenticated GraphQL helper (POST `kiva.stellate.sh`, Bearer),
- a KivaLens-facing API over `externally_connectable` (`www.kivalens.org` + `localhost`):
  `getFeatures`, `getStatus`, `getMyStats`, `getMyPortfolio`, and a generic `graphql`
  passthrough (KivaLens composes any `my.*`/`shop` query; token stays in the extension).
- a popup (`popup.html`) with Refresh status / Force re-mint / Run my.* self-test.

The throwaway proof-of-concept `~/projects/kiva-auth-probe` (v0.3.0) can be deleted.

### Recommended next steps
1. **Verify** the companion end-to-end: load unpacked, copy its extension ID, log into
   kiva.org, run the popup self-test (intercept token + Auth0 re-mint).
2. **KivaLens side:** feature-detect the companion via `getFeatures`; replace the inferred
   "Your Portfolio" balancers with exact data from `my.statsPer*` (use the generic
   `graphql` passthrough with introspection-correct shapes). Note the companion's
   extension ID differs from the old lenderassist id hardcoded in
   `src/components/AutoLendSettings.tsx` (`ehmkalmhgpadjmfcfekgdagfnmhakgna`) — make the
   id configurable / point AutoLendSettings at the companion.
3. **Writes (later):** add `savedSearches` create/update + `autolendProfile` update to the
   companion API (Tier 2/3).
4. Keep tokens client-side in the extension only; KivaLens receives derived DATA. (Revisit
   §3 caveat #1: test whether the intercepted first-party token also reads the
   `(Kiva app only)` fields — if so, the basket/checkout ceiling moves.)

---

### Suggested first prompt for the new session
> "Read ../KIVALENS-OAUTH-HANDOFF.md (or wherever you put it). We're adding Kiva
> OAuth2 to KivaLens, starting with Tier 1 (exact portfolio) + Tier 2 (saved-search
> sync). First, find Kiva's current OAuth2 client-registration path and confirm
> which `my`/`shop` GraphQL fields a third-party token can read. Then scaffold the
> auth-code flow server-side in klCore.mjs."
