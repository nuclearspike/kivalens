# Working on KivaLens

Rules for everyone who changes this repo, people and coding agents alike. Each one is here because
breaking it once cost the lenders who use the site.

The case behind most of them: PR #73 ("Serve proxy data with fixed response types") was merged eight
seconds after it was opened, and its release broke portfolio balancing and the Teams graphs for 29 hours
(issue #74). Its tests passed against a mock that labelled Kiva's answers `application/json`; Kiva labels
them `text/html`. Nothing checked the live site after the release, and the page absorbed every failure
quietly, so the first sign was a lender's report 26 hours in.

## Before you call a change ready

- Run the release gate on the commit: `node scripts/gate.mjs <commit>`. It builds a clean copy of the
  commit the way Heroku will and runs the tests, the language check, the RUM Worker's types, lint, and
  `npm audit`. Tests passing in your own checkout are not the gate.
- `engines.npm` in package.json is the npm Heroku builds with, and the gate stops before `npm ci` when
  your npm is outside it. npm majors disagree about which lockfiles are valid: on 2026-10-26 a lockfile
  that npm 11 accepted passed the gate, and Heroku's default npm 10 refused to build it. Keep the pin a
  plain version (`11.x`, not `>=11`), and change the pin and your npm together.
- Lint has old debt. The gate fails a commit with more problems than `scripts/lint-baseline.json`
  allows. When you fix some, lower the number; never raise it to let a commit through.
- A test that comes with a fix must fail without the fix. Run it both ways before you rely on it.
- Do not merge a pull request, your own included, until the gate has passed on its head commit.

## Kiva and Google: test against what they really send

- Tests of code that reads Kiva or the Google research sheet use the answers recorded in
  `src/test/fixtures/upstream/`, through `recorded()` and `recordedResponse()` in `src/test/upstream.ts`.
  Do not write an upstream response from memory or from documentation: Kiva labels its JSON `text/html`
  and answers an empty slice with status 200 and `{"error": …}`, and mocks that "looked right" missed both.
- When Kiva or Google change what they send, re-record with `node scripts/record-upstream-fixtures.mjs`
  and say in the commit what changed.
- A change to how the server or the page judges an upstream answer (its status, type, size or shape) is
  not done until a real, successful answer has gone through the changed code: run
  `node scripts/smoke-live.mjs --url http://localhost:<port>` against a local `npm run build && npm start`.
  If Kiva answers your check with a 4xx, an error, or nothing, that is a blocker, not a pass.
- Kiva refuses headless browsers, curl, and clients that do not present themselves as a browser (403).
  Check anything the page asks of Kiva directly in a real browser. Do not disguise a script as a browser
  to get around this.

## Deploying

- Deploy only with `node scripts/deploy.mjs <commit> --yes`, after `--dry-run` on the same commit. The
  script requires both remotes to fast-forward, runs the gate, checks production before and after, waits
  until the live site serves the gated build byte for byte, and reads the server log since the release.
- Deploy only when the owner has said to deploy that change.
- A deploy is not done until the live checks pass. If the script ends in DEPLOY FAILED, report that at
  once, with the rollback command it printed. It does not roll back by itself; the owner decides.
- `node scripts/smoke-live.mjs` checks production at any time. It makes no paid calls.

## Failures the page absorbs are still reported

- Code that catches a failure and carries on (a retry, a fallback, a "could not be read" note, a skipped
  item) reports it with `reportProblem()` from `src/lib/reportProblem.ts`, using `reasonOf(error)` for the
  reason. The message names the step and the reason, never a lender, a loan id, an address, or a count, so
  one cause makes one row in the error collector however often it happens.
- The server's proxy logs every answer it refuses (`[proxy] refused <path>: <reason>`). A new refusal is
  logged the same way, without the query string.

## Records, staging and shared checkouts

- Gate and deploy records go to `analysis/` in the main checkout, which git ignores. Never commit them,
  and never keep records only in a temporary folder that the system clears.
- Stage files by name and read `git status` before every commit. Do not use `git add -A`, `git add .` or
  `git commit -a`.
- Several sessions may share a checkout. Do not commit, stage, stash or reset changes you did not make;
  work in a git worktree of your own.

## Costs and secrets

- Anything billed per call, such as Ask KivaLens's OpenAI requests or `npm run eval:ai`, needs the owner's
  yes first, with the calls and a rough cost named. The gate, the live checks and the fixture recorder make
  no paid calls.
- `.env.local` holds real keys and is ignored. Never print it, copy it, or commit a key.
